# backend/models/fee.py
import uuid
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
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
