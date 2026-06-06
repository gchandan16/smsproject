# backend/schemas/student.py
from pydantic import BaseModel, EmailStr, field_validator
from uuid import UUID
from datetime import date, datetime
from typing import Optional, List, Dict, Any


# ── Guardian schemas ──────────────────────────────────────────
class GuardianBase(BaseModel):
    first_name: str
    last_name:  Optional[str] = None
    relation:   str                     # father | mother | guardian
    phone:      Optional[str] = None
    email:      Optional[str] = None
    occupation: Optional[str] = None
    is_primary: bool = False
    can_pickup: bool = False

class GuardianCreate(GuardianBase):
    pass

class GuardianUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name:  Optional[str] = None
    relation:   Optional[str] = None
    phone:      Optional[str] = None
    email:      Optional[str] = None
    occupation: Optional[str] = None
    is_primary: Optional[bool] = None
    can_pickup: Optional[bool] = None

class GuardianOut(GuardianBase):
    id:         UUID
    student_id: UUID
    tenant_id:  UUID
    created_at: datetime

    class Config:
        from_attributes = True


# ── Grade schemas ─────────────────────────────────────────────
class GradeOut(BaseModel):
    id:       UUID
    name:     str
    order_no: int

    class Config:
        from_attributes = True


# ── Section schemas ───────────────────────────────────────────
class SectionOut(BaseModel):
    id:               UUID
    name:             str
    capacity:         int
    grade:            Optional[GradeOut] = None

    class Config:
        from_attributes = True


# ── Enrollment schemas ────────────────────────────────────────
class EnrollmentCreate(BaseModel):
    section_id:       UUID
    academic_year_id: UUID
    roll_no:          Optional[int] = None

class EnrollmentOut(BaseModel):
    id:               UUID
    section_id:       UUID
    academic_year_id: UUID
    roll_no:          Optional[int]
    status:           str
    section:          Optional[SectionOut] = None

    class Config:
        from_attributes = True


# ── Student schemas ───────────────────────────────────────────
class StudentBase(BaseModel):
    admission_no:  str
    first_name:    str
    last_name:     Optional[str] = None
    dob:           Optional[date] = None
    gender:        Optional[str] = None     # male | female | other
    blood_group:   Optional[str] = None
    photo_url:     Optional[str] = None
    aadhar_no:     Optional[str] = None
    address:       Dict[str, Any] = {}
    custom_fields: Dict[str, Any] = {}

    @field_validator("gender")
    @classmethod
    def validate_gender(cls, v):
        if v and v not in ("male", "female", "other"):
            raise ValueError("gender must be male, female, or other")
        return v

    @field_validator("admission_no")
    @classmethod
    def validate_admission_no(cls, v):
        if not v or not v.strip():
            raise ValueError("admission_no cannot be empty")
        return v.strip().upper()

    @field_validator('aadhar_no')
    @classmethod
    def validate_aadhar(cls, v):
        if v and (not v.isdigit() or len(v) != 12):
            raise ValueError('Aadhar number must be exactly 12 digits')
        return v    


class StudentCreate(StudentBase):
    admitted_on:    Optional[date]          = None
    guardians:      List[GuardianCreate]    = []
    enrollment:     Optional[EnrollmentCreate] = None


class StudentUpdate(BaseModel):
    first_name:    Optional[str]            = None
    last_name:     Optional[str]            = None
    dob:           Optional[date]           = None
    gender:        Optional[str]            = None
    blood_group:   Optional[str]            = None
    photo_url:     Optional[str]            = None   
    aadhar_no:     Optional[str]            = None   
    address:       Optional[Dict[str, Any]] = None
    custom_fields: Optional[Dict[str, Any]] = None
    is_active:     Optional[bool]           = None

    # Extra fields the frontend might send -just ignore
    @field_validator('aadhar_no')
    @classmethod
    def validate_aadhar(cls, v):
        if v and (not v.isdigit() or len(v) != 12):
            raise ValueError('Aadhar number must be exactly 12 digits')
        return v

 


class StudentOut(BaseModel):
    id:            UUID
    tenant_id:     UUID
    admission_no:  str
    first_name:    str
    last_name:     Optional[str] = None
    dob:           Optional[date] = None
    gender:        Optional[str] = None
    blood_group:   Optional[str] = None
    photo_url:     Optional[str] = None
    aadhar_no:     Optional[str] = None   # ← NEW
    address:       Dict[str, Any] = {}
    custom_fields: Dict[str, Any] = {}
    is_active:     bool
    admitted_on:   Optional[date] = None
    created_at:    datetime
    updated_at:    datetime
    guardians:     List[GuardianOut] = []
    enrollments:   List[EnrollmentOut] = []
    class Config:
        from_attributes = True


class StudentListOut(BaseModel):
    id:              UUID
    admission_no:    str
    first_name:      str
    last_name:       Optional[str] = None
    gender:          Optional[str] = None
    photo_url:       Optional[str] = None   # ← show photo in list
    aadhar_no:       Optional[str] = None   # ← show photo in list
    is_active:       bool
    admitted_on:     Optional[date] = None
    current_section: Optional[str] = None
    class Config:
        from_attributes = True


class StudentListResponse(BaseModel):
    total:    int
    page:     int
    limit:    int
    students: List[StudentListOut]


# ── Grade & Section create ────────────────────────────────────
class GradeCreate(BaseModel):
    name:     str
    order_no: int = 0

class SectionCreate(BaseModel):
    grade_id:         UUID
    academic_year_id: UUID
    name:             str
    capacity:         int = 40
