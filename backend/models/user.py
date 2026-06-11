# backend/models/user.py
import uuid
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from database import Base


class User(Base):
    __tablename__ = "users"

    id            = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id     = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    role_id       = Column(UUID(as_uuid=True), ForeignKey("roles.id"), nullable=True)
    email         = Column(String(255), nullable=False)
    first_name    = Column(String(80),  nullable=True)
    last_name     = Column(String(80),  nullable=True)
    phone         = Column(String(20),  nullable=True)
    password_hash = Column(String,      nullable=False)
    is_active     = Column(Boolean,     default=True, nullable=False)
    last_login_at = Column(DateTime(timezone=True), nullable=True)
    created_at    = Column(DateTime(timezone=True), server_default=func.now())
    updated_at    = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    tenant   = relationship("Tenant", back_populates="users")
    role_obj = relationship("Role", foreign_keys=[role_id])  # renamed from 'role' to avoid conflict with DB column

    @property
    def role_name(self) -> str:
        """Always returns the role name string — reads from role_obj relationship."""
        if self.role_obj:
            return self.role_obj.name or ""
        return ""
