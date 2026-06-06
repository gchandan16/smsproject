# backend/models/master.py
import uuid
from sqlalchemy import (
    Column, String, Boolean, SmallInteger,
    DateTime, ForeignKey, Numeric, Text
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from database import Base


class Department(Base):
    __tablename__ = "departments"
    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id  = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    name       = Column(String(80), nullable=False)
    code       = Column(String(10), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Designation(Base):
    __tablename__ = "designations"
    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id  = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    name       = Column(String(80), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class LeaveType(Base):
    __tablename__ = "leave_types"
    id                = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id         = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    name              = Column(String(60), nullable=False)
    max_days_per_year = Column(SmallInteger, default=0, nullable=False)
    is_paid           = Column(Boolean, default=True, nullable=False)
    created_at        = Column(DateTime(timezone=True), server_default=func.now())


class BookCategory(Base):
    __tablename__ = "book_categories"
    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id  = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    name       = Column(String(80), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class GradingScheme(Base):
    __tablename__ = "grading_schemes"
    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id  = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    name       = Column(String(60), nullable=False)
    grades     = Column(JSONB, default=list)
    is_default = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class DiscountType(Base):
    __tablename__ = "discount_types"
    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id  = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    name       = Column(String(80), nullable=False)
    type       = Column(String(10), default="percent")
    value      = Column(Numeric(8, 2), default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class SchoolProfile(Base):
    __tablename__ = "school_profile"
    id               = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id        = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, unique=True)
    school_name      = Column(String(200), nullable=False)
    address          = Column(JSONB, default=dict)
    phone            = Column(String(20), nullable=True)
    email            = Column(String(255), nullable=True)
    website          = Column(String(255), nullable=True)
    board            = Column(String(40), nullable=True)
    affiliation_no   = Column(String(30), nullable=True)
    logo_url         = Column(Text, nullable=True)
    signature_url    = Column(Text, nullable=True)
    admission_prefix = Column(String(20), default="ADM")
    admission_format = Column(String(50), default="ADM-{YYYY}-{SEQ}")
    created_at       = Column(DateTime(timezone=True), server_default=func.now())
    updated_at       = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
