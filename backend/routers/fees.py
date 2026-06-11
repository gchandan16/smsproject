# backend/routers/fees.py
from uuid import UUID
from datetime import date
from decimal import Decimal
from typing import Optional, List
from fastapi import APIRouter, Depends, Query, status, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, field_validator

from database import get_db
from routers.auth import get_current_user
from models.user import User
from services.fee_service import FeeService

router = APIRouter()


def get_service(db: Session = Depends(get_db)) -> FeeService:
    return FeeService(db)


# ─────────────────────────────────────────────────────────────
#  SCHEMAS
# ─────────────────────────────────────────────────────────────
class FeeStructureIn(BaseModel):
    fee_category_id:  UUID
    academic_year_id: UUID
    amount:           float
    grade_id:         Optional[UUID] = None
    due_day:          int            = 10
    late_fine:        float          = 0.0

    model_config = {"extra": "ignore"}

    @field_validator("amount")
    @classmethod
    def positive_amount(cls, v):
        if v < 0:
            raise ValueError("Amount cannot be negative")
        return v


class InvoiceItemIn(BaseModel):
    fee_category_id: Optional[UUID] = None
    description:     str
    amount:          float

    @field_validator("amount")
    @classmethod
    def positive(cls, v):
        if v <= 0:
            raise ValueError("Item amount must be greater than zero")
        return v


class CreateInvoiceIn(BaseModel):
    student_id:       UUID
    academic_year_id: UUID
    due_date:         date
    items:            List[InvoiceItemIn]
    discount_amount:  float = 0.0
    notes:            Optional[str] = None


class GenerateInvoiceIn(BaseModel):
    student_id:       UUID
    grade_id:         UUID
    academic_year_id: UUID
    due_date:         date


class RecordPaymentIn(BaseModel):
    invoice_id:   UUID
    amount:       float
    method:       str = "cash"
    payment_date: date
    reference_no: Optional[str] = None
    remarks:      Optional[str] = None

    model_config = {"extra": "ignore"}

    @field_validator("amount")
    @classmethod
    def positive(cls, v):
        if v <= 0:
            raise ValueError("Payment amount must be greater than zero")
        return v

    @field_validator("method")
    @classmethod
    def valid_method(cls, v):
        valid = {"cash", "upi", "bank_transfer", "cheque", "dd", "online"}
        if v not in valid:
            raise ValueError(f"method must be one of: {', '.join(sorted(valid))}")
        return v


# ─────────────────────────────────────────────────────────────
#  FEE STRUCTURES
# ─────────────────────────────────────────────────────────────
@router.get("/structures")
def list_structures(
    academic_year_id: UUID           = Query(...),
    service:          FeeService     = Depends(get_service),
    cu:               User           = Depends(get_current_user),
):
    try:
        structures = service.list_structures(cu.tenant_id, academic_year_id)
        return [
            {
                "id":               str(s.id),
                "fee_category_id":  str(s.fee_category_id),
                "category_name":    s.category.name if s.category else "",
                "grade_id":         str(s.grade_id) if s.grade_id else None,
                "academic_year_id": str(s.academic_year_id),
                "amount":           float(s.amount),
                "due_day":          s.due_day,
                "late_fine":        float(s.late_fine),
            }
            for s in structures
        ]
    except Exception as e:
        raise HTTPException(500, f"Failed to load fee structures: {str(e)}")


@router.post("/structures", status_code=201)
def create_structure(
    data:    FeeStructureIn,
    service: FeeService = Depends(get_service),
    cu:      User       = Depends(get_current_user),
):
    try:
        s = service.create_structure(
            tenant_id        = cu.tenant_id,
            fee_category_id  = data.fee_category_id,
            academic_year_id = data.academic_year_id,
            amount           = Decimal(str(data.amount)),
            grade_id         = data.grade_id,
            due_day          = data.due_day,
            late_fine        = Decimal(str(data.late_fine)),
        )
        return {
            "id":               str(s.id),
            "fee_category_id":  str(s.fee_category_id),
            "category_name":    s.category.name if s.category else "",
            "grade_id":         str(s.grade_id) if s.grade_id else None,
            "academic_year_id": str(s.academic_year_id),
            "amount":           float(s.amount),
            "due_day":          s.due_day,
            "late_fine":        float(s.late_fine),
        }
    except HTTPException:
        raise
    except Exception as e:
        err = str(e)
        if "unique" in err.lower() or "duplicate" in err.lower():
            raise HTTPException(
                409,
                "A fee structure for this category + class + year already exists. "
                "Edit the existing one instead."
            )
        raise HTTPException(500, f"Failed to create fee structure: {err}")


@router.put("/structures/{structure_id}")
def update_structure(
    structure_id: UUID,
    data:         FeeStructureIn,
    service:      FeeService = Depends(get_service),
    cu:           User       = Depends(get_current_user),
):
    try:
        s = service.update_structure(
            structure_id, cu.tenant_id,
            {
                "amount":    Decimal(str(data.amount)),
                "due_day":   data.due_day,
                "late_fine": Decimal(str(data.late_fine)),
                "grade_id":  data.grade_id,
            }
        )
        return {
            "id":      str(s.id),
            "amount":  float(s.amount),
            "due_day": s.due_day,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Failed to update: {str(e)}")


@router.delete("/structures/{structure_id}", status_code=204)
def delete_structure(
    structure_id: UUID,
    service:      FeeService = Depends(get_service),
    cu:           User       = Depends(get_current_user),
):
    try:
        service.delete_structure(structure_id, cu.tenant_id)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Failed to delete: {str(e)}")


# ─────────────────────────────────────────────────────────────
#  INVOICES
# ─────────────────────────────────────────────────────────────
@router.get("/invoices")
def list_invoices(
    academic_year_id: Optional[UUID] = Query(None),
    inv_status:       Optional[str]  = Query(None, alias="status"),
    student_id:       Optional[UUID] = Query(None),
    search:           Optional[str]  = Query(None),
    page:             int            = Query(1, ge=1),
    limit:            int            = Query(50, ge=1, le=200),
    service:          FeeService     = Depends(get_service),
    cu:               User           = Depends(get_current_user),
):
    try:
        return service.list_invoices(
            tenant_id        = cu.tenant_id,
            academic_year_id = academic_year_id,
            status           = inv_status,
            student_id       = student_id,
            search           = search,
            page             = page,
            limit            = limit,
        )
    except Exception as e:
        raise HTTPException(500, f"Failed to load invoices: {str(e)}")


@router.post("/invoices", status_code=201)
def create_invoice(
    data:    CreateInvoiceIn,
    service: FeeService = Depends(get_service),
    cu:      User       = Depends(get_current_user),
):
    try:
        invoice = service.create_invoice(
            tenant_id        = cu.tenant_id,
            student_id       = data.student_id,
            academic_year_id = data.academic_year_id,
            due_date         = data.due_date,
            items            = [item.model_dump() for item in data.items],
            discount_amount  = Decimal(str(data.discount_amount)),
            notes            = data.notes,
            created_by       = cu.id,
        )
        return service._serialize_invoice_full(invoice)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Failed to create invoice: {str(e)}")


@router.post("/invoices/generate", status_code=201)
def generate_invoice(
    data:    GenerateInvoiceIn,
    service: FeeService = Depends(get_service),
    cu:      User       = Depends(get_current_user),
):
    try:
        invoice = service.generate_from_structure(
            tenant_id        = cu.tenant_id,
            student_id       = data.student_id,
            grade_id         = data.grade_id,
            academic_year_id = data.academic_year_id,
            due_date         = data.due_date,
            created_by       = cu.id,
        )
        return service._serialize_invoice_full(invoice)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Failed to generate invoice: {str(e)}")


@router.get("/invoices/{invoice_id}")
def get_invoice(
    invoice_id: UUID,
    service:    FeeService = Depends(get_service),
    cu:         User       = Depends(get_current_user),
):
    invoice = service.get_invoice(invoice_id, cu.tenant_id)
    return service._serialize_invoice_full(invoice)


@router.post("/invoices/{invoice_id}/cancel")
def cancel_invoice(
    invoice_id: UUID,
    service:    FeeService = Depends(get_service),
    cu:         User       = Depends(get_current_user),
):
    invoice = service.cancel_invoice(invoice_id, cu.tenant_id)
    return {"message": "Invoice cancelled", "invoice_no": invoice.invoice_no}


@router.get("/student/{student_id}")
def get_student_invoices(
    student_id: UUID,
    service:    FeeService = Depends(get_service),
    cu:         User       = Depends(get_current_user),
):
    try:
        invoices       = service.get_student_invoices(student_id, cu.tenant_id)
        total_billed   = sum(i["total_amount"] for i in invoices)
        total_paid     = sum(i["paid_amount"]  for i in invoices)
        total_balance  = sum(i["balance"]      for i in invoices)
        return {
            "student_id":    str(student_id),
            "total_billed":  total_billed,
            "total_paid":    total_paid,
            "total_balance": total_balance,
            "invoices":      invoices,
        }
    except Exception as e:
        raise HTTPException(500, f"Failed to load student invoices: {str(e)}")


# ─────────────────────────────────────────────────────────────
#  PAYMENTS
# ─────────────────────────────────────────────────────────────
@router.post("/payments", status_code=201)
def record_payment(
    data:    RecordPaymentIn,
    service: FeeService = Depends(get_service),
    cu:      User       = Depends(get_current_user),
):
    try:
        payment = service.record_payment(
            tenant_id    = cu.tenant_id,
            invoice_id   = data.invoice_id,
            amount       = Decimal(str(data.amount)),
            method       = data.method,
            payment_date = data.payment_date,
            collected_by = cu.id,
            reference_no = data.reference_no,
            remarks      = data.remarks,
        )
        return {
            "id":           str(payment.id),
            "receipt_no":   payment.receipt_no,
            "invoice_id":   str(payment.invoice_id),
            "payment_date": str(payment.payment_date),
            "amount":       float(payment.amount),
            "method":       payment.method,
            "reference_no": payment.reference_no,
            "message":      f"Payment of ₹{float(payment.amount):.2f} recorded. Receipt: {payment.receipt_no}",
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Payment failed: {str(e)}")


@router.get("/payments/invoice/{invoice_id}")
def get_invoice_payments(
    invoice_id: UUID,
    service:    FeeService = Depends(get_service),
    cu:         User       = Depends(get_current_user),
):
    payments = service.get_payments_by_invoice(invoice_id)
    return [
        {
            "id":           str(p.id),
            "receipt_no":   p.receipt_no,
            "payment_date": str(p.payment_date),
            "amount":       float(p.amount),
            "method":       p.method,
            "reference_no": p.reference_no,
            "remarks":      p.remarks,
        }
        for p in payments
    ]


@router.get("/payments/daily")
def daily_collection(
    payment_date: date       = Query(...),
    service:      FeeService = Depends(get_service),
    cu:           User       = Depends(get_current_user),
):
    try:
        return service.get_daily_collection(cu.tenant_id, payment_date)
    except Exception as e:
        raise HTTPException(500, f"Failed to load daily collection: {str(e)}")


@router.get("/summary")
def collection_summary(
    academic_year_id: UUID       = Query(...),
    service:          FeeService = Depends(get_service),
    cu:               User       = Depends(get_current_user),
):
    try:
        return service.get_collection_summary(cu.tenant_id, academic_year_id)
    except Exception as e:
        raise HTTPException(500, f"Failed to load summary: {str(e)}")
