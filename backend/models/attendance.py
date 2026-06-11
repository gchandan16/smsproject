# backend/models/attendance.py
import uuid
from sqlalchemy import (
    Column, String, Boolean, Date, DateTime,
    ForeignKey, SmallInteger, Text
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from database import Base


class StudentAttendance(Base):
    __tablename__ = "student_attendance"

    id            = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id     = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    enrollment_id = Column(UUID(as_uuid=True), ForeignKey("student_enrollments.id"), nullable=False)
    date          = Column(Date, nullable=False)
    period_no     = Column(SmallInteger, nullable=True)
    # present | absent | late | holiday
    status        = Column(String(10), nullable=False, default="present")
    remarks       = Column(Text, nullable=True)
    marked_by     = Column(UUID(as_uuid=True), nullable=True)
    created_at    = Column(DateTime(timezone=True), server_default=func.now())

    enrollment = relationship("StudentEnrollment")


class StaffAttendance(Base):
    __tablename__ = "staff_attendance"

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id  = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    staff_id   = Column(UUID(as_uuid=True), nullable=False)   # FK to staff — added when Staff module built
    date       = Column(Date, nullable=False)
    check_in   = Column(DateTime(timezone=True), nullable=True)
    check_out  = Column(DateTime(timezone=True), nullable=True)
    # present | absent | half_day | leave
    status     = Column(String(10), nullable=False, default="present")
    leave_type = Column(String(20), nullable=True)
    remarks    = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Holiday(Base):
    __tablename__ = "holidays"

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id  = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    date       = Column(Date, nullable=False)
    name       = Column(String(100), nullable=False)
    # public | school | optional
    type       = Column(String(20), nullable=False, default="public")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
