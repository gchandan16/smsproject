# backend/models/tenant.py
import uuid
from sqlalchemy import Column, String, Boolean, DateTime
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from database import Base

class Tenant(Base):
    __tablename__ = "tenants"

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug       = Column(String(60), unique=True, nullable=False)
    name       = Column(String(200), nullable=False)
    plan       = Column(String(20), default="basic")
    logo_url   = Column(String, nullable=True)
    settings   = Column(JSONB, default={})
    is_active  = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    users = relationship("User", back_populates="tenant")
