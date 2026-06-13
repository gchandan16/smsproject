# backend/routers/students.py
from uuid import UUID
from typing import Optional
from fastapi import APIRouter, Depends, Query, status, Body
from sqlalchemy.orm import Session

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

def to_uuid(val: Optional[str]) -> Optional[UUID]:
    if val and val.strip():
        try:
            return UUID(val.strip())
        except ValueError:
            return None
    return None

# ─────────────────────────────────────────────────────────────
#  STATIC ROUTES — must be before /{student_id} dynamic route
# ─────────────────────────────────────────────────────────────

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
    gid  = to_uuid(grade_id)
    ayid = to_uuid(academic_year_id)
    if not gid or not ayid:
        return []
    return service.list_sections(gid, ayid)


@router.get("/sections/roll-numbers")
def get_taken_roll_numbers(
    section_id:       Optional[str] = Query(None),
    academic_year_id: Optional[str] = Query(None),
    service:          StudentService = Depends(get_service),
    current_user:     User           = Depends(get_current_user),
):
    """Returns all taken roll numbers in a section — for frontend validation."""
    sid  = to_uuid(section_id)
    ayid = to_uuid(academic_year_id)
    if not sid or not ayid:
        return {"taken_roll_numbers": []}
    taken = service.enrollment_repo.get_section_roll_numbers(sid, ayid)
    return {"taken_roll_numbers": taken}


@router.post("/sections", response_model=SectionOut, status_code=201)
def create_section(
    data:         SectionCreate,
    service:      StudentService = Depends(get_service),
    current_user: User           = Depends(get_current_user),
):
    return service.create_section(data, current_user.tenant_id)


# ── Guardian routes BEFORE /{student_id} ─────────────────────

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
#  STUDENT CRUD
# ─────────────────────────────────────────────────────────────

@router.get("/", response_model=StudentListResponse)
def list_students(
    search:           Optional[str]  = Query(None),
    gender:           Optional[str]  = Query(None),
    is_active:        Optional[bool] = Query(True),
    grade_id:         Optional[str]  = Query(None),
    section_id:       Optional[str]  = Query(None),
    academic_year_id: Optional[str]  = Query(None),
    page:             int            = Query(1,  ge=1),
    limit:            int            = Query(50, ge=1, le=200),
    service:      StudentService = Depends(get_service),
    current_user: User           = Depends(get_current_user),
):
    return service.list_students(
        tenant_id        = current_user.tenant_id,
        search           = search   or None,
        gender           = gender   or None,
        is_active        = is_active,
        grade_id         = to_uuid(grade_id),
        section_id       = to_uuid(section_id),
        academic_year_id = to_uuid(academic_year_id),
        page             = page,
        limit            = limit,
    )


@router.post("/", response_model=StudentOut, status_code=status.HTTP_201_CREATED)
def create_student(
    data:         StudentCreate,
    service:      StudentService = Depends(get_service),
    current_user: User           = Depends(get_current_user),
):
    return service.create_student(data, current_user.tenant_id)


# ─────────────────────────────────────────────────────────────
#  STUDENT / GUARDIAN LOOKUP — for linking login accounts
# ─────────────────────────────────────────────────────────────
@router.get("/lookup/unlinked-students")
def lookup_unlinked_students(
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    cu: User    = Depends(get_current_user),
):
    """
    Search students that don't yet have a login account linked
    (students.user_id IS NULL) — for the 'Create Student User' flow.
    """
    from sqlalchemy import text
    params = {"tid": str(cu.tenant_id)}
    extra = ""
    if search:
        extra = " AND (s.first_name ILIKE :q OR s.last_name ILIKE :q OR s.admission_no ILIKE :q)"
        params["q"] = f"%{search}%"

    rows = db.execute(text(f"""
        SELECT s.id, s.first_name, s.last_name, s.admission_no,
               g.name AS grade_name, sec.name AS section_name
        FROM students s
        LEFT JOIN student_enrollments se ON se.student_id=s.id AND se.status='active'
        LEFT JOIN sections sec ON sec.id = se.section_id
        LEFT JOIN grades g     ON g.id   = sec.grade_id
        WHERE s.tenant_id=:tid AND s.is_active=true AND s.user_id IS NULL {extra}
        ORDER BY s.first_name
        LIMIT 50
    """), params).fetchall()

    return [
        {
            "id": str(r.id),
            "name": f"{r.first_name} {r.last_name or ''}".strip(),
            "admission_no": r.admission_no,
            "class": f"{r.grade_name or ''} {r.section_name or ''}".strip() or "—",
        }
        for r in rows
    ]


@router.get("/lookup/unlinked-guardians")
def lookup_unlinked_guardians(
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    cu: User    = Depends(get_current_user),
):
    """
    Search guardians that don't yet have a login account linked
    (guardians.user_id IS NULL) — for the 'Create Parent User' flow.
    Returns guardian + the student(s) they're linked to, for context.
    """
    from sqlalchemy import text
    params = {"tid": str(cu.tenant_id)}
    extra = ""
    if search:
        extra = """ AND (
            gu.first_name ILIKE :q OR gu.last_name ILIKE :q
            OR gu.phone ILIKE :q OR gu.email ILIKE :q
            OR s.first_name ILIKE :q OR s.admission_no ILIKE :q
        )"""
        params["q"] = f"%{search}%"

    rows = db.execute(text(f"""
        SELECT gu.id, gu.first_name, gu.last_name, gu.relation, gu.phone, gu.email,
               s.first_name AS student_first, s.last_name AS student_last, s.admission_no
        FROM guardians gu
        JOIN students s ON s.id = gu.student_id
        WHERE gu.tenant_id=:tid AND gu.user_id IS NULL {extra}
        ORDER BY gu.first_name
        LIMIT 50
    """), params).fetchall()

    return [
        {
            "id": str(r.id),
            "name": f"{r.first_name} {r.last_name or ''}".strip(),
            "relation": r.relation,
            "phone": r.phone,
            "email": r.email,
            "student_name": f"{r.student_first} {r.student_last or ''}".strip(),
            "admission_no": r.admission_no,
        }
        for r in rows
    ]


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
    return service.update_student(student_id, data, current_user.tenant_id)


@router.delete("/{student_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_student(
    student_id:   UUID,
    service:      StudentService = Depends(get_service),
    current_user: User           = Depends(get_current_user),
):
    service.delete_student(student_id, current_user.tenant_id)


# ── Guardians ─────────────────────────────────────────────────

@router.post("/{student_id}/guardians", response_model=GuardianOut, status_code=201)
def add_guardian(
    student_id:   UUID,
    data:         GuardianCreate,
    service:      StudentService = Depends(get_service),
    current_user: User           = Depends(get_current_user),
):
    return service.add_guardian(student_id, data, current_user.tenant_id)


# ── Enrollment ────────────────────────────────────────────────

@router.post("/{student_id}/enroll", response_model=EnrollmentOut, status_code=201)
def enroll_student(
    student_id:   UUID,
    data:         EnrollmentCreate,
    service:      StudentService = Depends(get_service),
    current_user: User           = Depends(get_current_user),
):
    return service.enroll_student(student_id, data, current_user.tenant_id)


@router.patch("/{student_id}/roll-number", response_model=EnrollmentOut)
def update_roll_number(
    student_id:       UUID,
    section_id:       UUID = Body(...),
    academic_year_id: UUID = Body(...),
    roll_no:          int  = Body(..., ge=1, le=999),
    service:          StudentService = Depends(get_service),
    current_user:     User           = Depends(get_current_user),
):
    """Update only the roll number without changing the section."""
    return service.update_roll_number(
        student_id       = student_id,
        section_id       = section_id,
        academic_year_id = academic_year_id,
        roll_no          = roll_no,
        tenant_id        = current_user.tenant_id,
    )
