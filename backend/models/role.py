# backend/models/role.py
import uuid
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from database import Base

class Role(Base):
    __tablename__ = "roles"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id   = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    name        = Column(String(60), nullable=False)   # superadmin|admin|teacher|parent
    permissions = Column(JSONB, default=[])
    is_system   = Column(Boolean, default=False)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())
