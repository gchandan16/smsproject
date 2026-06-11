# backend/models/fee.py
import uuid
from sqlalchemy import (
    Column, String, Boolean, Date, DateTime,
    ForeignKey, Numeric, Text, SmallInteger
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from database import Base


class FeeCategory(Base):
    __tablename__ = "fee_categories"
    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id    = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    name         = Column(String(80), nullable=False)
    description  = Column(Text)
    is_recurring = Column(Boolean, default=True)
    frequency    = Column(String(20), default="monthly")
    created_at   = Column(DateTime(timezone=True), server_default=func.now())

    structures = relationship("FeeStructure", back_populates="category")
    items      = relationship("FeeInvoiceItem", back_populates="category")


class FeeStructure(Base):
    __tablename__ = "fee_structures"
    id               = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id        = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    fee_category_id  = Column(UUID(as_uuid=True), ForeignKey("fee_categories.id"), nullable=False)
    grade_id         = Column(UUID(as_uuid=True), ForeignKey("grades.id"), nullable=True)
    academic_year_id = Column(UUID(as_uuid=True), ForeignKey("academic_years.id"), nullable=False)
    amount           = Column(Numeric(10, 2), default=0, nullable=False)
    due_day          = Column(SmallInteger, default=10)
    late_fine        = Column(Numeric(8, 2), default=0)
    created_at       = Column(DateTime(timezone=True), server_default=func.now())

    category = relationship("FeeCategory", back_populates="structures")


class FeeInvoice(Base):
    __tablename__ = "fee_invoices"
    id               = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id        = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    invoice_no       = Column(String(30), nullable=False)
    student_id       = Column(UUID(as_uuid=True), ForeignKey("students.id"), nullable=False)
    academic_year_id = Column(UUID(as_uuid=True), ForeignKey("academic_years.id"), nullable=False)
    issue_date       = Column(Date, server_default=func.current_date(), nullable=False)
    due_date         = Column(Date, nullable=False)
    subtotal         = Column(Numeric(10, 2), default=0, nullable=False)
    discount_amount  = Column(Numeric(10, 2), default=0)
    fine_amount      = Column(Numeric(10, 2), default=0)
    total_amount     = Column(Numeric(10, 2), default=0, nullable=False)
    paid_amount      = Column(Numeric(10, 2), default=0)
    balance          = Column(Numeric(10, 2), default=0)
    status           = Column(String(15), default="draft", nullable=False)
    notes            = Column(Text)
    created_by       = Column(UUID(as_uuid=True), nullable=True)
    created_at       = Column(DateTime(timezone=True), server_default=func.now())
    updated_at       = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    student  = relationship("Student")
    items    = relationship("FeeInvoiceItem", back_populates="invoice", cascade="all, delete-orphan")
    payments = relationship("FeePayment",     back_populates="invoice")


class FeeInvoiceItem(Base):
    __tablename__ = "fee_invoice_items"
    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invoice_id      = Column(UUID(as_uuid=True), ForeignKey("fee_invoices.id", ondelete="CASCADE"), nullable=False)
    fee_category_id = Column(UUID(as_uuid=True), ForeignKey("fee_categories.id"), nullable=True)
    description     = Column(String(200), nullable=False)
    amount          = Column(Numeric(10, 2), default=0, nullable=False)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())

    invoice  = relationship("FeeInvoice",  back_populates="items")
    category = relationship("FeeCategory", back_populates="items")


class FeePayment(Base):
    __tablename__ = "fee_payments"
    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id    = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    invoice_id   = Column(UUID(as_uuid=True), ForeignKey("fee_invoices.id"), nullable=False)
    receipt_no   = Column(String(30), nullable=False)
    payment_date = Column(Date, server_default=func.current_date(), nullable=False)
    amount       = Column(Numeric(10, 2), nullable=False)
    method       = Column(String(20), default="cash", nullable=False)
    reference_no = Column(String(50), nullable=True)
    remarks      = Column(Text, nullable=True)
    collected_by = Column(UUID(as_uuid=True), nullable=True)
    created_at   = Column(DateTime(timezone=True), server_default=func.now())

    invoice = relationship("FeeInvoice", back_populates="payments")
