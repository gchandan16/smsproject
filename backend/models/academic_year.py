# backend/models/academic_year.py
import uuid
from sqlalchemy import Column, String, Boolean, Date, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from database import Base


class AcademicYear(Base):
    __tablename__ = "academic_years"

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id  = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    label      = Column(String(20), nullable=False)   # e.g. "2024-25"
    start_date = Column(Date, nullable=False)
    end_date   = Column(Date, nullable=False)
    is_current = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())