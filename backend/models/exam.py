# backend/models/exam.py
import uuid
from sqlalchemy import (
    Column, String, Boolean, Date, Time, DateTime,
    ForeignKey, Numeric, SmallInteger, Text
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from database import Base


class ExamType(Base):
    __tablename__ = "exam_types"

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id  = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    name       = Column(String(60),  nullable=False)
    short_code = Column(String(10))
    max_marks  = Column(Numeric(6, 2), default=100)
    pass_marks = Column(Numeric(6, 2), default=33)
    weightage  = Column(Numeric(5, 2), default=100)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    exams = relationship("Exam", back_populates="exam_type")


class Exam(Base):
    __tablename__ = "exams"

    id               = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id        = Column(UUID(as_uuid=True), ForeignKey("tenants.id",     ondelete="CASCADE"), nullable=False)
    exam_type_id     = Column(UUID(as_uuid=True), ForeignKey("exam_types.id"),  nullable=False)
    academic_year_id = Column(UUID(as_uuid=True), ForeignKey("academic_years.id"), nullable=False)
    grade_id         = Column(UUID(as_uuid=True), ForeignKey("grades.id"),      nullable=False)
    name             = Column(String(100), nullable=False)
    start_date       = Column(Date, nullable=False)
    end_date         = Column(Date, nullable=False)
    status           = Column(String(20), default="scheduled", nullable=False)
    remarks          = Column(Text)
    created_by       = Column(UUID(as_uuid=True))
    created_at       = Column(DateTime(timezone=True), server_default=func.now())
    updated_at       = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    exam_type  = relationship("ExamType",    back_populates="exams")
    schedules  = relationship("ExamSchedule",back_populates="exam", cascade="all, delete-orphan")
    results    = relationship("ExamResult",  back_populates="exam",  cascade="all, delete-orphan")
    report_cards = relationship("ReportCard",back_populates="exam",  cascade="all, delete-orphan")


class ExamSchedule(Base):
    __tablename__ = "exam_schedules"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    exam_id     = Column(UUID(as_uuid=True), ForeignKey("exams.id",    ondelete="CASCADE"), nullable=False)
    subject_id  = Column(UUID(as_uuid=True), ForeignKey("subjects.id"), nullable=False)
    exam_date   = Column(Date, nullable=False)
    start_time  = Column(Time)
    end_time    = Column(Time)
    max_marks   = Column(Numeric(6, 2), default=100, nullable=False)
    pass_marks  = Column(Numeric(6, 2), default=33,  nullable=False)
    room_no     = Column(String(20))
    created_at  = Column(DateTime(timezone=True), server_default=func.now())

    exam    = relationship("Exam",    back_populates="schedules")
    subject = relationship("Subject")
    results = relationship("ExamResult", back_populates="schedule")


class ExamResult(Base):
    __tablename__ = "exam_results"

    id             = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id      = Column(UUID(as_uuid=True), ForeignKey("tenants.id",          ondelete="CASCADE"), nullable=False)
    exam_id        = Column(UUID(as_uuid=True), ForeignKey("exams.id",            ondelete="CASCADE"), nullable=False)
    schedule_id    = Column(UUID(as_uuid=True), ForeignKey("exam_schedules.id"),   nullable=False)
    enrollment_id  = Column(UUID(as_uuid=True), ForeignKey("student_enrollments.id"), nullable=False)
    marks_obtained = Column(Numeric(6, 2))
    is_absent      = Column(Boolean, default=False, nullable=False)
    is_exempted    = Column(Boolean, default=False, nullable=False)
    remarks        = Column(Text)
    entered_by     = Column(UUID(as_uuid=True))
    entered_at     = Column(DateTime(timezone=True), server_default=func.now())
    updated_at     = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    exam       = relationship("Exam",           back_populates="results")
    schedule   = relationship("ExamSchedule",   back_populates="results")
    enrollment = relationship("StudentEnrollment")


class ReportCard(Base):
    __tablename__ = "report_cards"

    id             = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id      = Column(UUID(as_uuid=True), ForeignKey("tenants.id",          ondelete="CASCADE"), nullable=False)
    exam_id        = Column(UUID(as_uuid=True), ForeignKey("exams.id",            ondelete="CASCADE"), nullable=False)
    enrollment_id  = Column(UUID(as_uuid=True), ForeignKey("student_enrollments.id"), nullable=False)
    total_marks    = Column(Numeric(8, 2), default=0)
    obtained_marks = Column(Numeric(8, 2), default=0)
    percentage     = Column(Numeric(5, 2), default=0)
    grade          = Column(String(5))
    grade_points   = Column(Numeric(4, 2), default=0)
    rank           = Column(SmallInteger)
    result         = Column(String(10), default="pass")
    remarks        = Column(Text)
    generated_at   = Column(DateTime(timezone=True), server_default=func.now())

    exam       = relationship("Exam",              back_populates="report_cards")
    enrollment = relationship("StudentEnrollment")
