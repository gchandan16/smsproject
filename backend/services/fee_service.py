# backend/services/fee_service.py
from uuid import UUID
from datetime import date, timedelta
from decimal import Decimal
from typing import Optional, List
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from repositories.fee_repository import (
    InvoiceRepository, PaymentRepository, FeeStructureRepository
)
from models.fee import FeeInvoice, FeeInvoiceItem, FeePayment, FeeStructure


class FeeService:
    def __init__(self, db: Session):
        self.invoice_repo   = InvoiceRepository(db)
        self.payment_repo   = PaymentRepository(db)
        self.structure_repo = FeeStructureRepository(db)
        self.db             = db

    # ── Fee Structures ────────────────────────────────────────
    def list_structures(self, tenant_id: UUID, academic_year_id: UUID) -> List[FeeStructure]:
        return self.structure_repo.get_all_for_year(tenant_id, academic_year_id)

    def create_structure(
        self,
        tenant_id:        UUID,
        fee_category_id:  UUID,
        academic_year_id: UUID,
        amount:           Decimal,
        grade_id:         Optional[UUID] = None,
        due_day:          int            = 10,
        late_fine:        Decimal        = Decimal(0),
    ) -> FeeStructure:
        structure = FeeStructure(
            tenant_id        = tenant_id,
            fee_category_id  = fee_category_id,
            academic_year_id = academic_year_id,
            grade_id         = grade_id,
            amount           = amount,
            due_day          = due_day,
            late_fine        = late_fine,
        )
        return self.structure_repo.create(structure)

    def update_structure(
        self, structure_id: UUID, tenant_id: UUID, data: dict
    ) -> FeeStructure:
        structure = self.db.query(FeeStructure).filter(
            FeeStructure.id == structure_id,
            FeeStructure.tenant_id == tenant_id,
        ).first()
        if not structure:
            raise HTTPException(404, "Fee structure not found")
        return self.structure_repo.update(structure, data)

    def delete_structure(self, structure_id: UUID, tenant_id: UUID) -> None:
        structure = self.db.query(FeeStructure).filter(
            FeeStructure.id == structure_id,
            FeeStructure.tenant_id == tenant_id,
        ).first()
        if not structure:
            raise HTTPException(404, "Fee structure not found")
        self.structure_repo.delete(structure)

    # ── Invoices ──────────────────────────────────────────────
    def list_invoices(
        self,
        tenant_id:        UUID,
        academic_year_id: Optional[UUID] = None,
        status:           Optional[str]  = None,
        student_id:       Optional[UUID] = None,
        search:           Optional[str]  = None,
        page:             int            = 1,
        limit:            int            = 50,
    ) -> dict:
        skip = (page - 1) * limit
        invoices, total = self.invoice_repo.list_with_filters(
            tenant_id, academic_year_id, status, student_id, search, skip, limit
        )
        return {
            "total":    total,
            "page":     page,
            "limit":    limit,
            "invoices": [self._serialize_invoice_list(inv) for inv in invoices],
        }

    def get_invoice(self, invoice_id: UUID, tenant_id: UUID) -> FeeInvoice:
        invoice = self.invoice_repo.get_full(invoice_id, tenant_id)
        if not invoice:
            raise HTTPException(404, "Invoice not found")
        return invoice

    def create_invoice(
        self,
        tenant_id:        UUID,
        student_id:       UUID,
        academic_year_id: UUID,
        items:            List[dict],
        due_date:         date,
        discount_amount:  Decimal        = Decimal(0),
        notes:            Optional[str]  = None,
        created_by:       Optional[UUID] = None,
    ) -> FeeInvoice:
        if not items:
            raise HTTPException(400, "Invoice must have at least one line item")

        # Generate invoice number
        invoice_no = self.invoice_repo.get_next_invoice_no(tenant_id)

        # Calculate totals
        subtotal = sum(Decimal(str(item["amount"])) for item in items)
        total    = subtotal - discount_amount

        if total < 0:
            raise HTTPException(400, "Discount cannot exceed subtotal")

        invoice = FeeInvoice(
            tenant_id        = tenant_id,
            invoice_no       = invoice_no,
            student_id       = student_id,
            academic_year_id = academic_year_id,
            due_date         = due_date,
            subtotal         = subtotal,
            discount_amount  = discount_amount,
            total_amount     = total,
            balance          = total,
            paid_amount      = Decimal(0),
            status           = "sent",
            notes            = notes,
            created_by       = created_by,
        )
        self.db.add(invoice)
        self.db.flush()

        for item in items:
            line = FeeInvoiceItem(
                invoice_id      = invoice.id,
                fee_category_id = item.get("fee_category_id"),
                description     = item["description"],
                amount          = Decimal(str(item["amount"])),
            )
            self.db.add(line)

        self.db.commit()
        self.db.refresh(invoice)
        return self.invoice_repo.get_full(invoice.id, tenant_id)

    def cancel_invoice(self, invoice_id: UUID, tenant_id: UUID) -> FeeInvoice:
        invoice = self._get_invoice_or_404(invoice_id, tenant_id)
        if invoice.paid_amount > 0:
            raise HTTPException(400, "Cannot cancel invoice with payments. Refund first.")
        self.invoice_repo.update(invoice, {"status": "cancelled"})
        return invoice

    def get_student_invoices(self, student_id: UUID, tenant_id: UUID) -> List[dict]:
        invoices = self.invoice_repo.list_by_student(student_id, tenant_id)
        return [self._serialize_invoice_full(inv) for inv in invoices]

    def get_collection_summary(self, tenant_id: UUID, academic_year_id: UUID) -> dict:
        return self.invoice_repo.get_collection_summary(tenant_id, academic_year_id)

    # ── Payments ──────────────────────────────────────────────
    def record_payment(
        self,
        tenant_id:    UUID,
        invoice_id:   UUID,
        amount:       Decimal,
        method:       str,
        payment_date: date,
        collected_by: UUID,
        reference_no: Optional[str] = None,
        remarks:      Optional[str] = None,
    ) -> FeePayment:
        invoice = self._get_invoice_or_404(invoice_id, tenant_id)

        # Validations
        if invoice.status == "cancelled":
            raise HTTPException(400, "Cannot accept payment for a cancelled invoice")
        if invoice.status == "paid":
            raise HTTPException(400, "Invoice is already fully paid")
        if amount <= 0:
            raise HTTPException(400, "Payment amount must be greater than zero")
        if Decimal(str(amount)) > invoice.balance:
            raise HTTPException(
                400,
                f"Payment amount ({amount}) exceeds balance ({float(invoice.balance):.2f}). "
                f"Maximum payable: ₹{float(invoice.balance):.2f}"
            )

        valid_methods = {"cash", "upi", "bank_transfer", "cheque", "dd", "online"}
        if method not in valid_methods:
            raise HTTPException(400, f"Invalid payment method. Use: {', '.join(sorted(valid_methods))}")

        # Generate receipt number
        receipt_no = self.payment_repo.get_next_receipt_no(tenant_id)

        # Create payment record (immutable — never update payments)
        payment = FeePayment(
            tenant_id    = tenant_id,
            invoice_id   = invoice_id,
            receipt_no   = receipt_no,
            payment_date = payment_date,
            amount       = Decimal(str(amount)),
            method       = method,
            reference_no = reference_no,
            remarks      = remarks,
            collected_by = collected_by,
        )
        self.db.add(payment)
        self.db.flush()

        # Recalculate invoice balance
        self.invoice_repo.recalculate_balance(invoice)

        self.db.commit()
        self.db.refresh(payment)
        return payment

    def get_payments_by_invoice(self, invoice_id: UUID) -> List[FeePayment]:
        return self.payment_repo.get_by_invoice(invoice_id)

    def get_daily_collection(self, tenant_id: UUID, payment_date: date) -> dict:
        return self.payment_repo.get_daily_collection(tenant_id, payment_date)

    # ── Generate invoice from fee structure ───────────────────
    def generate_from_structure(
        self,
        tenant_id:        UUID,
        student_id:       UUID,
        grade_id:         UUID,
        academic_year_id: UUID,
        due_date:         date,
        created_by:       UUID,
    ) -> FeeInvoice:
        """Auto-generate invoice from the fee structure for a grade,
        plus an automatic Transport Fee line if the student is
        assigned to an active transport route."""
        structures = self.structure_repo.get_for_grade_year(
            tenant_id, grade_id, academic_year_id
        )

        items = [
            {
                "fee_category_id": str(s.fee_category_id),
                "description":     s.category.name if s.category else "Fee",
                "amount":          float(s.amount),
            }
            for s in structures
        ]

        # ── Auto-add Transport Fee if student has an active route assignment ──
        transport_item = self._get_transport_fee_item(tenant_id, student_id, academic_year_id)
        if transport_item:
            # Avoid duplicate if a manual Transport fee structure also exists
            already_has_transport = any(
                "transport" in (i.get("description") or "").lower() for i in items
            )
            if not already_has_transport:
                items.append(transport_item)

        if not items:
            raise HTTPException(
                404,
                "No fee structure found for this class and academic year, "
                "and the student has no transport assignment. "
                "Please set up fee structure in Settings first."
            )

        return self.create_invoice(
            tenant_id=tenant_id,
            student_id=student_id,
            academic_year_id=academic_year_id,
            items=items,
            due_date=due_date,
            created_by=created_by,
        )

    def _get_transport_fee_item(
        self, tenant_id: UUID, student_id: UUID, academic_year_id: UUID
    ) -> Optional[dict]:
        """
        Look up the student's active transport assignment and return
        a fee-invoice-item dict for their route/stop fare, or None
        if the student doesn't use transport.
        Uses transport_stops.fare if set and > 0, otherwise
        falls back to transport_routes.fare.
        """
        from sqlalchemy import text

        row = self.db.execute(text("""
            SELECT
                tr.id    AS route_id,
                tr.name  AS route_name,
                tr.route_no,
                tr.fare  AS route_fare,
                ts.name  AS stop_name,
                ts.fare  AS stop_fare
            FROM student_transport st
            JOIN transport_routes tr ON tr.id = st.route_id
            LEFT JOIN transport_stops ts ON ts.id = st.stop_id
            WHERE st.tenant_id = :tid
              AND st.student_id = :sid
              AND st.is_active = true
              AND (st.academic_year_id = :yr OR st.academic_year_id IS NULL)
            LIMIT 1
        """), {"tid": str(tenant_id), "sid": str(student_id), "yr": str(academic_year_id)}).fetchone()

        if not row:
            return None

        # Prefer stop-specific fare if set and positive, else route fare
        fare = float(row.stop_fare) if (row.stop_fare and float(row.stop_fare) > 0) else float(row.route_fare or 0)
        if fare <= 0:
            return None

        # Find or auto-create a "Transport" fee category so it shows up
        # correctly in Finance Reports → Transport Fees
        transport_cat_id = self.db.execute(text("""
            SELECT id FROM fee_categories
            WHERE tenant_id = :tid AND name ILIKE '%transport%'
            LIMIT 1
        """), {"tid": str(tenant_id)}).scalar()

        if not transport_cat_id:
            transport_cat_id = self.db.execute(text("""
                INSERT INTO fee_categories (tenant_id, name, is_recurring, frequency)
                VALUES (:tid, 'Transport', true, 'monthly')
                RETURNING id
            """), {"tid": str(tenant_id)}).scalar()
            self.db.commit()

        route_label = f"{row.route_no or ''} {row.route_name or ''}".strip()
        description = f"Transport Fee - {route_label}"
        if row.stop_name:
            description += f" ({row.stop_name})"

        return {
            "fee_category_id": str(transport_cat_id) if transport_cat_id else None,
            "description":     description,
            "amount":          fare,
        }

    # ── Helpers ───────────────────────────────────────────────
    def _get_invoice_or_404(self, invoice_id: UUID, tenant_id: UUID) -> FeeInvoice:
        invoice = self.invoice_repo.get_full(invoice_id, tenant_id)
        if not invoice:
            raise HTTPException(404, "Invoice not found")
        return invoice

    def _serialize_invoice_list(self, inv: FeeInvoice) -> dict:
        student = inv.student
        return {
            "id":             str(inv.id),
            "invoice_no":     inv.invoice_no,
            "student_id":     str(inv.student_id),
            "student_name":   f"{student.first_name} {student.last_name or ''}".strip() if student else "",
            "admission_no":   student.admission_no if student else "",
            "issue_date":     str(inv.issue_date),
            "due_date":       str(inv.due_date),
            "total_amount":   float(inv.total_amount),
            "paid_amount":    float(inv.paid_amount),
            "balance":        float(inv.balance),
            "status":         inv.status,
        }

    def _serialize_invoice_full(self, inv: FeeInvoice) -> dict:
        return {
            **self._serialize_invoice_list(inv),
            "subtotal":        float(inv.subtotal),
            "discount_amount": float(inv.discount_amount),
            "fine_amount":     float(inv.fine_amount),
            "notes":           inv.notes,
            "items": [
                {
                    "id":              str(item.id),
                    "description":     item.description,
                    "amount":          float(item.amount),
                    "fee_category_id": str(item.fee_category_id) if item.fee_category_id else None,
                    "category_name":   item.category.name if item.category else None,
                }
                for item in (inv.items or [])
            ],
            "payments": [
                {
                    "id":           str(p.id),
                    "receipt_no":   p.receipt_no,
                    "payment_date": str(p.payment_date),
                    "amount":       float(p.amount),
                    "method":       p.method,
                    "reference_no": p.reference_no,
                    "remarks":      p.remarks,
                }
                for p in (inv.payments or [])
            ],
        }
