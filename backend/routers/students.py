# backend/routers/students.py
from uuid import UUID
from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from logger_config import logger
from database import get_db
from routers.auth import get_current_user
from models.user import User
from services.student_service import StudentService
from schemas.student import (
    StudentCreate, StudentUpdate, StudentOut,
    StudentListResponse, GuardianCreate, GuardianUpdate, GuardianOut,
    GradeCreate, GradeOut, SectionCreate, SectionOut,
    EnrollmentCreate, EnrollmentOut,
)

router = APIRouter()

def get_service(db: Session = Depends(get_db)) -> StudentService:
    return StudentService(db)

# ─────────────────────────────────────────────────────────────
#  STUDENTS
# ─────────────────────────────────────────────────────────────

@router.get("/", response_model=StudentListResponse)
def list_students(
    search:           Optional[str]  = Query(None),
    gender:           Optional[str]  = Query(None),
    is_active:        Optional[bool] = Query(True),
    # UUID params typed as Optional[str] then parsed manually
    # so empty string "" does NOT cause 422 validation error
    grade_id:         Optional[str]  = Query(None),
    section_id:       Optional[str]  = Query(None),
    academic_year_id: Optional[str]  = Query(None),
    page:             int            = Query(1,  ge=1),
    limit:            int            = Query(50, ge=1, le=200),
    service: StudentService = Depends(get_service),
    current_user: User      = Depends(get_current_user),
):
    # Convert non-empty strings to UUID — ignore empty strings
    def to_uuid(val):
        if val and val.strip():
            try:
                return UUID(val)
            except ValueError:
                return None
        return None

    return service.list_students(
        tenant_id        = current_user.tenant_id,
        search           = search or None,
        gender           = gender or None,
        is_active        = is_active,
        grade_id         = to_uuid(grade_id),
        section_id       = to_uuid(section_id),
        academic_year_id = to_uuid(academic_year_id),
        page             = page,
        limit            = limit,
    )


@router.post("/", response_model=StudentOut, status_code=status.HTTP_201_CREATED)
def create_student(
    data: StudentCreate,
    service:      StudentService = Depends(get_service),
    current_user: User           = Depends(get_current_user),
):
    return service.create_student(data, current_user.tenant_id)


@router.get("/stats")
def student_stats(
    service:      StudentService = Depends(get_service),
    current_user: User           = Depends(get_current_user),
):
    return service.get_stats(current_user.tenant_id)


@router.get("/grades/all", response_model=list[GradeOut])
def list_grades(
    service:      StudentService = Depends(get_service),
    current_user: User           = Depends(get_current_user),
):
    return service.list_grades(current_user.tenant_id)


@router.post("/grades", response_model=GradeOut, status_code=201)
def create_grade(
    data:         GradeCreate,
    service:      StudentService = Depends(get_service),
    current_user: User           = Depends(get_current_user),
):
    return service.create_grade(data, current_user.tenant_id)


@router.get("/sections/by-grade", response_model=list[SectionOut])
def list_sections(
    grade_id:         Optional[str] = Query(None),
    academic_year_id: Optional[str] = Query(None),
    service:          StudentService = Depends(get_service),
    current_user:     User           = Depends(get_current_user),
):
    def to_uuid(val):
        if val and val.strip():
            try: return UUID(val)
            except ValueError: return None
        return None

    gid  = to_uuid(grade_id)
    ayid = to_uuid(academic_year_id)
    if not gid or not ayid:
        return []
    return service.list_sections(gid, ayid)


@router.post("/sections", response_model=SectionOut, status_code=201)
def create_section(
    data:         SectionCreate,
    service:      StudentService = Depends(get_service),
    current_user: User           = Depends(get_current_user),
):
    return service.create_section(data, current_user.tenant_id)


@router.get("/{student_id}", response_model=StudentOut)
def get_student(
    student_id:   UUID,
    service:      StudentService = Depends(get_service),
    current_user: User           = Depends(get_current_user),
):
    return service.get_student(student_id, current_user.tenant_id)


@router.put("/{student_id}", response_model=StudentOut)
def update_student(
    student_id:   UUID,
    data:         StudentUpdate,
    service:      StudentService = Depends(get_service),
    current_user: User           = Depends(get_current_user),
):
    logger.info(
        f"In router student_id:{student_id} | "
        f"student_data:{data.dict()} | "
        f"tenant_id:{current_user.tenant_id}"
    ) 
    return service.update_student(student_id, data, current_user.tenant_id)


@router.delete("/{student_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_student(
    student_id:   UUID,
    service:      StudentService = Depends(get_service),
    current_user: User           = Depends(get_current_user),
):
    service.delete_student(student_id, current_user.tenant_id)


# ─────────────────────────────────────────────────────────────
#  GUARDIANS
# ─────────────────────────────────────────────────────────────

@router.post("/{student_id}/guardians", response_model=GuardianOut, status_code=201)
def add_guardian(
    student_id:   UUID,
    data:         GuardianCreate,
    service:      StudentService = Depends(get_service),
    current_user: User           = Depends(get_current_user),
):
    return service.add_guardian(student_id, data, current_user.tenant_id)


@router.put("/guardians/{guardian_id}", response_model=GuardianOut)
def update_guardian(
    guardian_id:  UUID,
    data:         GuardianUpdate,
    service:      StudentService = Depends(get_service),
    current_user: User           = Depends(get_current_user),
):
    return service.update_guardian(guardian_id, data, current_user.tenant_id)


@router.delete("/guardians/{guardian_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_guardian(
    guardian_id:  UUID,
    service:      StudentService = Depends(get_service),
    current_user: User           = Depends(get_current_user),
):
    service.delete_guardian(guardian_id, current_user.tenant_id)


# ─────────────────────────────────────────────────────────────
#  ENROLLMENT
# ─────────────────────────────────────────────────────────────

@router.post("/{student_id}/enroll", response_model=EnrollmentOut, status_code=201)
def enroll_student(
    student_id:   UUID,
    data:         EnrollmentCreate,
    service:      StudentService = Depends(get_service),
    current_user: User           = Depends(get_current_user),
):
    return service.enroll_student(student_id, data, current_user.tenant_id)
