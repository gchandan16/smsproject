# backend/models/student.py
import uuid
from sqlalchemy import Column,String,Boolean,Date,DateTime,ForeignKey,SmallInteger,Text
from sqlalchemy.dialects.postgresql import UUID,JSONB
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from database import Base

class Grade(Base):
    __tablename__="grades"
    id = Column(UUID(as_uuid=True),primary_key=True,default=uuid.uuid4)
    tenant_id=Column(UUID(as_uuid=True),ForeignKey("tenants.id",ondelete="CASCADE"),nullable=False)
    name =Column(String(40),nullable=False)
    order_no   = Column(SmallInteger, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    sections  = relationship("Section", back_populates="grade")

class Section(Base):
    __tablename__ = "sections"

    id               = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id        = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    grade_id         = Column(UUID(as_uuid=True), ForeignKey("grades.id", ondelete="CASCADE"), nullable=False)
    academic_year_id = Column(UUID(as_uuid=True), ForeignKey("academic_years.id"), nullable=False)
    name             = Column(String(10), nullable=False)
    capacity         = Column(SmallInteger, default=40)
    class_teacher_id = Column(UUID(as_uuid=True), nullable=True)
    created_at       = Column(DateTime(timezone=True), server_default=func.now())

    grade       = relationship("Grade", back_populates="sections")
    enrollments = relationship("StudentEnrollment", back_populates="section")

class Subject(Base):
    __tablename__ = "subjects"
    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id  = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    name       = Column(String(80), nullable=False)
    code       = Column(String(10))
    type       = Column(String(20), default="theory")  # theory | practical | language
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    
class Student(Base):
    __tablename__ = "students"

    id            = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id     = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    user_id       = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    admission_no  = Column(String(30), nullable=False)
    first_name    = Column(String(80), nullable=False)
    last_name     = Column(String(80), nullable=True)
    dob           = Column(Date, nullable=True)
    gender        = Column(String(10), nullable=True)
    blood_group   = Column(String(5), nullable=True)
    photo_url     = Column(Text, nullable=True)
    aadhar_no     = Column(String(12),nullable=True)
    address       = Column(JSONB, default={})
    custom_fields = Column(JSONB, default={})
    is_active     = Column(Boolean, default=True, nullable=False)
    admitted_on   = Column(Date, server_default=func.current_date())
    created_at    = Column(DateTime(timezone=True), server_default=func.now())
    updated_at    = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    guardians   = relationship("Guardian",          back_populates="student", cascade="all, delete-orphan")
    enrollments = relationship("StudentEnrollment", back_populates="student")

class Guardian(Base):
    __tablename__ = "guardians"

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id  = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    user_id    = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    first_name = Column(String(80), nullable=False)
    last_name  = Column(String(80), nullable=True)
    relation   = Column(String(20), nullable=False)   # father|mother|guardian
    phone      = Column(String(20), nullable=True)
    email      = Column(String(255), nullable=True)
    occupation = Column(String(100), nullable=True)
    is_primary = Column(Boolean, default=False)
    can_pickup = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    student = relationship("Student", back_populates="guardians")

class StudentEnrollment(Base):
    __tablename__ = "student_enrollments"

    id               = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id        = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    student_id       = Column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    section_id       = Column(UUID(as_uuid=True), ForeignKey("sections.id"), nullable=False)
    academic_year_id = Column(UUID(as_uuid=True), ForeignKey("academic_years.id"), nullable=False)
    roll_no          = Column(SmallInteger, nullable=True)
    status           = Column(String(20), default="active")   # active|transferred|alumni
    created_at       = Column(DateTime(timezone=True), server_default=func.now())

    student = relationship("Student",  back_populates="enrollments")
    section = relationship("Section",  back_populates="enrollments")        
