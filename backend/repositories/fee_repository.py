# backend/repositories/fee_repository.py
from uuid import UUID
from datetime import date
from typing import Optional, List, Tuple
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, text

from repositories.base import BaseRepository
from models.fee import FeeInvoice, FeePayment, FeeStructure, FeeInvoiceItem


class InvoiceRepository(BaseRepository[FeeInvoice]):
    def __init__(self, db: Session):
        super().__init__(FeeInvoice, db)

    def get_full(self, invoice_id: UUID, tenant_id: UUID) -> Optional[FeeInvoice]:
        """Fetch invoice with items + payments + student."""
        return (
            self.db.query(FeeInvoice)
            .options(
                joinedload(FeeInvoice.items).joinedload(FeeInvoiceItem.category),
                joinedload(FeeInvoice.payments),
                joinedload(FeeInvoice.student),
            )
            .filter(FeeInvoice.id == invoice_id, FeeInvoice.tenant_id == tenant_id)
            .first()
        )

    def get_by_invoice_no(self, invoice_no: str, tenant_id: UUID) -> Optional[FeeInvoice]:
        return (
            self.db.query(FeeInvoice)
            .filter(FeeInvoice.invoice_no == invoice_no, FeeInvoice.tenant_id == tenant_id)
            .first()
        )

    def list_by_student(self, student_id: UUID, tenant_id: UUID) -> List[FeeInvoice]:
        return (
            self.db.query(FeeInvoice)
            .options(
                joinedload(FeeInvoice.items),
                joinedload(FeeInvoice.payments),
            )
            .filter(FeeInvoice.student_id == student_id, FeeInvoice.tenant_id == tenant_id)
            .order_by(FeeInvoice.issue_date.desc())
            .all()
        )

    def list_with_filters(
        self,
        tenant_id:        UUID,
        academic_year_id: Optional[UUID]  = None,
        status:           Optional[str]   = None,
        student_id:       Optional[UUID]  = None,
        search:           Optional[str]   = None,
        skip:             int             = 0,
        limit:            int             = 50,
    ) -> Tuple[List[FeeInvoice], int]:
        q = (
            self.db.query(FeeInvoice)
            .options(
                joinedload(FeeInvoice.student),
                joinedload(FeeInvoice.payments),
            )
            .filter(FeeInvoice.tenant_id == tenant_id)
        )
        if academic_year_id:
            q = q.filter(FeeInvoice.academic_year_id == academic_year_id)
        if status:
            q = q.filter(FeeInvoice.status == status)
        if student_id:
            q = q.filter(FeeInvoice.student_id == student_id)
        if search:
            from sqlalchemy import or_
            from models.student import Student
            q = q.join(Student).filter(
                or_(
                    FeeInvoice.invoice_no.ilike(f"%{search}%"),
                    Student.first_name.ilike(f"%{search}%"),
                    Student.last_name.ilike(f"%{search}%"),
                    Student.admission_no.ilike(f"%{search}%"),
                )
            )
        total = q.count()
        invoices = q.order_by(FeeInvoice.created_at.desc()).offset(skip).limit(limit).all()
        return invoices, total

    def get_next_invoice_no(self, tenant_id: UUID) -> str:
        """Generate next sequential invoice number."""
        from datetime import datetime
        year   = datetime.now().year
        result = self.db.execute(text("""
            SELECT COUNT(*) FROM fee_invoices
            WHERE tenant_id = :tid
              AND EXTRACT(YEAR FROM created_at) = :year
        """), {"tid": str(tenant_id), "year": year}).scalar()
        seq = (result or 0) + 1
        return f"INV-{year}-{seq:04d}"

    def get_collection_summary(
        self,
        tenant_id:        UUID,
        academic_year_id: UUID,
    ) -> dict:
        """Dashboard stats: total billed, collected, pending."""
        result = self.db.execute(text("""
            SELECT
                COUNT(*)::int                                      AS total_invoices,
                COALESCE(SUM(total_amount), 0)::float              AS total_billed,
                COALESCE(SUM(paid_amount), 0)::float               AS total_collected,
                COALESCE(SUM(balance), 0)::float                   AS total_pending,
                COUNT(*) FILTER (WHERE status = 'paid')::int       AS paid_count,
                COUNT(*) FILTER (WHERE status = 'partial')::int    AS partial_count,
                COUNT(*) FILTER (WHERE status = 'overdue')::int    AS overdue_count
            FROM fee_invoices
            WHERE tenant_id        = :tenant_id
              AND academic_year_id = :academic_year_id
              AND status != 'cancelled'
        """), {
            "tenant_id":        str(tenant_id),
            "academic_year_id": str(academic_year_id),
        }).fetchone()

        if not result:
            return {
                "total_invoices": 0, "total_billed": 0.0,
                "total_collected": 0.0, "total_pending": 0.0,
                "paid_count": 0, "partial_count": 0, "overdue_count": 0,
            }
        return dict(result._mapping)

    def recalculate_balance(self, invoice: FeeInvoice) -> FeeInvoice:
        """Recalculate paid_amount and balance from payments."""
        total_paid = self.db.execute(text("""
            SELECT COALESCE(SUM(amount), 0) FROM fee_payments
            WHERE invoice_id = :invoice_id
        """), {"invoice_id": str(invoice.id)}).scalar()

        invoice.paid_amount = float(total_paid or 0)
        invoice.balance     = float(invoice.total_amount) - invoice.paid_amount

        # Update status
        if invoice.balance <= 0:
            invoice.status = "paid"
        elif invoice.paid_amount > 0:
            invoice.status = "partial"
        elif date.today() > invoice.due_date:
            invoice.status = "overdue"
        else:
            invoice.status = "sent"

        return invoice


class PaymentRepository(BaseRepository[FeePayment]):
    def __init__(self, db: Session):
        super().__init__(FeePayment, db)

    def get_by_receipt_no(self, receipt_no: str, tenant_id: UUID) -> Optional[FeePayment]:
        return (
            self.db.query(FeePayment)
            .filter(FeePayment.receipt_no == receipt_no, FeePayment.tenant_id == tenant_id)
            .first()
        )

    def get_by_invoice(self, invoice_id: UUID) -> List[FeePayment]:
        return (
            self.db.query(FeePayment)
            .filter(FeePayment.invoice_id == invoice_id)
            .order_by(FeePayment.payment_date.desc())
            .all()
        )

    def get_next_receipt_no(self, tenant_id: UUID) -> str:
        from datetime import datetime
        year   = datetime.now().year
        result = self.db.execute(text("""
            SELECT COUNT(*) FROM fee_payments
            WHERE tenant_id = :tid
              AND EXTRACT(YEAR FROM created_at) = :year
        """), {"tid": str(tenant_id), "year": year}).scalar()
        seq = (result or 0) + 1
        return f"RCP-{year}-{seq:04d}"

    def get_daily_collection(
        self,
        tenant_id:    UUID,
        payment_date: date,
    ) -> dict:
        result = self.db.execute(text("""
            SELECT
                COUNT(*)::int                  AS total_transactions,
                COALESCE(SUM(amount), 0)::float AS total_amount,
                method,
                COUNT(*)::int                  AS method_count
            FROM fee_payments
            WHERE tenant_id    = :tenant_id
              AND payment_date = :payment_date
            GROUP BY method
        """), {
            "tenant_id":    str(tenant_id),
            "payment_date": payment_date,
        }).fetchall()

        breakdown = {r.method: {"count": r.method_count, "amount": r.total_amount} for r in result}
        total     = sum(r.total_amount for r in result)
        count     = sum(r.total_transactions for r in result)

        return {
            "date":          str(payment_date),
            "total_amount":  total,
            "total_count":   count,
            "breakdown":     breakdown,
        }


class FeeStructureRepository(BaseRepository[FeeStructure]):
    def __init__(self, db: Session):
        super().__init__(FeeStructure, db)

    def get_for_grade_year(
        self,
        tenant_id:        UUID,
        grade_id:         UUID,
        academic_year_id: UUID,
    ) -> List[FeeStructure]:
        return (
            self.db.query(FeeStructure)
            .options(joinedload(FeeStructure.category))
            .filter(
                FeeStructure.tenant_id        == tenant_id,
                FeeStructure.academic_year_id == academic_year_id,
                FeeStructure.grade_id         == grade_id,
            )
            .all()
        )

    def get_all_for_year(
        self,
        tenant_id:        UUID,
        academic_year_id: UUID,
    ) -> List[FeeStructure]:
        return (
            self.db.query(FeeStructure)
            .options(
                joinedload(FeeStructure.category),
            )
            .filter(
                FeeStructure.tenant_id        == tenant_id,
                FeeStructure.academic_year_id == academic_year_id,
            )
            .order_by(FeeStructure.grade_id)
            .all()
        )
