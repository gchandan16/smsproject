# backend/routers/master.py
from uuid import UUID
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import date

from database import get_db
from routers.auth import get_current_user
from models.user import User
from models.academic_year import AcademicYear
from models.student import Grade, Section, Subject
from models.master import (
    Department, Designation, LeaveType,
    BookCategory, GradingScheme, DiscountType, SchoolProfile
)
from models.fee import FeeCategory

router = APIRouter()


def get_tid(cu): return cu.tenant_id

def get_or_404(db, model, id, tenant_id):
    obj = db.query(model).filter(
        model.id == id,
        model.tenant_id == tenant_id
    ).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Not found")
    return obj


# ─────────────────────────────────────────────────────────────
#  SCHOOL PROFILE
# ─────────────────────────────────────────────────────────────
class SchoolProfileIn(BaseModel):
    school_name:      str
    phone:            Optional[str] = None
    email:            Optional[str] = None
    website:          Optional[str] = None
    board:            Optional[str] = None
    affiliation_no:   Optional[str] = None
    admission_prefix: Optional[str] = "ADM"
    address:          Optional[dict] = {}
    model_config = {"extra": "ignore"}


@router.get("/school-profile")
def get_school_profile(
    db: Session = Depends(get_db),
    cu: User    = Depends(get_current_user)
):
    empty = {
        "school_name": "", "phone": "", "email": "",
        "website": "", "board": "", "affiliation_no": "",
        "admission_prefix": "ADM", "address": {}
    }
    try:
        p = db.query(SchoolProfile).filter(
            SchoolProfile.tenant_id == get_tid(cu)
        ).first()
        if not p:
            return empty
        return {
            "id":               str(p.id),
            "school_name":      p.school_name      or "",
            "phone":            p.phone            or "",
            "email":            p.email            or "",
            "website":          p.website          or "",
            "board":            p.board            or "",
            "affiliation_no":   p.affiliation_no   or "",
            "admission_prefix": p.admission_prefix or "ADM",
            "logo_url":         p.logo_url,
            "address":          p.address          or {},
        }
    except Exception as e:
        # Table may not exist yet — return empty
        return empty


@router.put("/school-profile")
def upsert_school_profile(
    data: SchoolProfileIn,
    db:   Session = Depends(get_db),
    cu:   User    = Depends(get_current_user)
):
    try:
        p = db.query(SchoolProfile).filter(
            SchoolProfile.tenant_id == get_tid(cu)
        ).first()

        if not p:
            p = SchoolProfile(
                tenant_id        = get_tid(cu),
                school_name      = data.school_name,
                phone            = data.phone,
                email            = data.email,
                website          = data.website,
                board            = data.board,
                affiliation_no   = data.affiliation_no,
                admission_prefix = data.admission_prefix or "ADM",
                address          = data.address or {},
            )
            db.add(p)
        else:
            p.school_name      = data.school_name
            p.phone            = data.phone
            p.email            = data.email
            p.website          = data.website
            p.board            = data.board
            p.affiliation_no   = data.affiliation_no
            p.admission_prefix = data.admission_prefix or "ADM"
            p.address          = data.address or {}

        db.commit()
        db.refresh(p)
        return {"message": "School profile saved successfully"}

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}"
        )


# ─────────────────────────────────────────────────────────────
#  ACADEMIC YEARS
# ─────────────────────────────────────────────────────────────
class AcademicYearIn(BaseModel):
    label:      str
    start_date: date
    end_date:   date
    is_current: bool = False


@router.get("/academic-years")
def list_academic_years(
    db: Session = Depends(get_db),
    cu: User    = Depends(get_current_user)
):
    rows = db.query(AcademicYear)\
             .filter(AcademicYear.tenant_id == get_tid(cu))\
             .order_by(AcademicYear.start_date.desc()).all()
    return [
        {
            "id":         str(r.id),
            "label":      r.label,
            "start_date": str(r.start_date),
            "end_date":   str(r.end_date),
            "is_current": r.is_current,
        }
        for r in rows
    ]


@router.post("/academic-years", status_code=201)
def create_academic_year(
    data: AcademicYearIn,
    db: Session = Depends(get_db),
    cu: User    = Depends(get_current_user)
):
    if data.is_current:
        db.query(AcademicYear)\
          .filter(AcademicYear.tenant_id == get_tid(cu))\
          .update({"is_current": False})
    ay = AcademicYear(**data.model_dump(), tenant_id=get_tid(cu))
    db.add(ay); db.commit(); db.refresh(ay)
    return {
        "id": str(ay.id), "label": ay.label,
        "start_date": str(ay.start_date),
        "end_date": str(ay.end_date),
        "is_current": ay.is_current,
    }


@router.put("/academic-years/{id}")
def update_academic_year(
    id: UUID, data: AcademicYearIn,
    db: Session = Depends(get_db),
    cu: User    = Depends(get_current_user)
):
    ay = get_or_404(db, AcademicYear, id, get_tid(cu))
    if data.is_current:
        db.query(AcademicYear)\
          .filter(AcademicYear.tenant_id == get_tid(cu),
                  AcademicYear.id != id)\
          .update({"is_current": False})
    for k, v in data.model_dump().items():
        setattr(ay, k, v)
    db.commit(); db.refresh(ay)
    return {"id": str(ay.id), "label": ay.label, "is_current": ay.is_current}


@router.delete("/academic-years/{id}", status_code=204)
def delete_academic_year(
    id: UUID,
    db: Session = Depends(get_db),
    cu: User    = Depends(get_current_user)
):
    ay = get_or_404(db, AcademicYear, id, get_tid(cu))
    db.delete(ay); db.commit()


# ─────────────────────────────────────────────────────────────
#  GRADES
# ─────────────────────────────────────────────────────────────
class GradeIn(BaseModel):
    name:     str
    order_no: int = 0


@router.get("/grades")
def list_grades(
    db: Session = Depends(get_db),
    cu: User    = Depends(get_current_user)
):
    rows = db.query(Grade)\
             .filter(Grade.tenant_id == get_tid(cu))\
             .order_by(Grade.order_no).all()
    return [{"id": str(r.id), "name": r.name, "order_no": r.order_no} for r in rows]


@router.post("/grades", status_code=201)
def create_grade(
    data: GradeIn,
    db: Session = Depends(get_db),
    cu: User    = Depends(get_current_user)
):
    g = Grade(**data.model_dump(), tenant_id=get_tid(cu))
    db.add(g); db.commit(); db.refresh(g)
    return {"id": str(g.id), "name": g.name, "order_no": g.order_no}


@router.put("/grades/{id}")
def update_grade(
    id: UUID, data: GradeIn,
    db: Session = Depends(get_db),
    cu: User    = Depends(get_current_user)
):
    g = get_or_404(db, Grade, id, get_tid(cu))
    g.name = data.name; g.order_no = data.order_no
    db.commit(); db.refresh(g)
    return {"id": str(g.id), "name": g.name, "order_no": g.order_no}


@router.delete("/grades/{id}", status_code=204)
def delete_grade(
    id: UUID,
    db: Session = Depends(get_db),
    cu: User    = Depends(get_current_user)
):
    g = get_or_404(db, Grade, id, get_tid(cu))
    db.delete(g); db.commit()


# ─────────────────────────────────────────────────────────────
#  SECTIONS
# ─────────────────────────────────────────────────────────────
class SectionIn(BaseModel):
    name:             str
    grade_id:         UUID
    academic_year_id: UUID
    capacity:         int = 40


@router.get("/sections")
def list_sections(
    grade_id:         Optional[str] = None,
    academic_year_id: Optional[str] = None,
    db: Session = Depends(get_db),
    cu: User    = Depends(get_current_user)
):
    q = db.query(Section).filter(Section.tenant_id == get_tid(cu))
    if grade_id:
        try:
            q = q.filter(Section.grade_id == UUID(grade_id))
        except Exception:
            pass
    if academic_year_id:
        try:
            q = q.filter(Section.academic_year_id == UUID(academic_year_id))
        except Exception:
            pass
    return [
        {
            "id":               str(r.id),
            "name":             r.name,
            "capacity":         r.capacity,
            "grade_id":         str(r.grade_id),
            "academic_year_id": str(r.academic_year_id),
        }
        for r in q.all()
    ]


@router.get("/sections/{id}")
def get_section(
    id: str,
    db: Session = Depends(get_db),
    cu: User    = Depends(get_current_user)
):
    """Fetch a single section by ID — used to resolve grade_id when only
    a section_id is known (e.g. Teacher Dashboard → Take Attendance shortcut)."""
    try:
        sid = UUID(id)
    except Exception:
        raise HTTPException(400, "Invalid section id")
    s = db.query(Section).filter(Section.id == sid, Section.tenant_id == get_tid(cu)).first()
    if not s:
        raise HTTPException(404, "Section not found")
    return {
        "id":               str(s.id),
        "name":             s.name,
        "capacity":         s.capacity,
        "grade_id":         str(s.grade_id),
        "academic_year_id": str(s.academic_year_id),
    }


@router.post("/sections", status_code=201)
def create_section(
    data: SectionIn,
    db: Session = Depends(get_db),
    cu: User    = Depends(get_current_user)
):
    s = Section(**data.model_dump(), tenant_id=get_tid(cu))
    db.add(s); db.commit(); db.refresh(s)
    return {
        "id": str(s.id), "name": s.name,
        "capacity": s.capacity,
        "grade_id": str(s.grade_id),
        "academic_year_id": str(s.academic_year_id),
    }


@router.put("/sections/{id}")
def update_section(
    id: UUID, data: SectionIn,
    db: Session = Depends(get_db),
    cu: User    = Depends(get_current_user)
):
    s = get_or_404(db, Section, id, get_tid(cu))
    for k, v in data.model_dump().items():
        setattr(s, k, v)
    db.commit(); db.refresh(s)
    return {
        "id": str(s.id), "name": s.name,
        "capacity": s.capacity,
        "grade_id": str(s.grade_id),
        "academic_year_id": str(s.academic_year_id),
    }


@router.delete("/sections/{id}", status_code=204)
def delete_section(
    id: UUID,
    db: Session = Depends(get_db),
    cu: User    = Depends(get_current_user)
):
    s = get_or_404(db, Section, id, get_tid(cu))
    db.delete(s); db.commit()


# ─────────────────────────────────────────────────────────────
#  SUBJECTS
# ─────────────────────────────────────────────────────────────
class SubjectIn(BaseModel):
    name: str
    code: Optional[str] = None
    type: str = "theory"


@router.get("/subjects")
def list_subjects(
    db: Session = Depends(get_db),
    cu: User    = Depends(get_current_user)
):
    rows = db.query(Subject)\
             .filter(Subject.tenant_id == get_tid(cu))\
             .order_by(Subject.name).all()
    return [{"id": str(r.id), "name": r.name, "code": r.code, "type": r.type} for r in rows]


@router.post("/subjects", status_code=201)
def create_subject(
    data: SubjectIn,
    db: Session = Depends(get_db),
    cu: User    = Depends(get_current_user)
):
    s = Subject(**data.model_dump(), tenant_id=get_tid(cu))
    db.add(s); db.commit(); db.refresh(s)
    return {"id": str(s.id), "name": s.name, "code": s.code, "type": s.type}


@router.put("/subjects/{id}")
def update_subject(
    id: UUID, data: SubjectIn,
    db: Session = Depends(get_db),
    cu: User    = Depends(get_current_user)
):
    s = get_or_404(db, Subject, id, get_tid(cu))
    s.name = data.name; s.code = data.code; s.type = data.type
    db.commit(); db.refresh(s)
    return {"id": str(s.id), "name": s.name, "code": s.code, "type": s.type}


@router.delete("/subjects/{id}", status_code=204)
def delete_subject(
    id: UUID,
    db: Session = Depends(get_db),
    cu: User    = Depends(get_current_user)
):
    s = get_or_404(db, Subject, id, get_tid(cu))
    db.delete(s); db.commit()


# ─────────────────────────────────────────────────────────────
#  DEPARTMENTS
# ─────────────────────────────────────────────────────────────
class DeptIn(BaseModel):
    name: str
    code: Optional[str] = None


@router.get("/departments")
def list_departments(
    db: Session = Depends(get_db),
    cu: User    = Depends(get_current_user)
):
    rows = db.query(Department)\
             .filter(Department.tenant_id == get_tid(cu))\
             .order_by(Department.name).all()
    return [{"id": str(r.id), "name": r.name, "code": r.code} for r in rows]


@router.post("/departments", status_code=201)
def create_department(
    data: DeptIn,
    db: Session = Depends(get_db),
    cu: User    = Depends(get_current_user)
):
    d = Department(**data.model_dump(), tenant_id=get_tid(cu))
    db.add(d); db.commit(); db.refresh(d)
    return {"id": str(d.id), "name": d.name, "code": d.code}


@router.put("/departments/{id}")
def update_department(
    id: UUID, data: DeptIn,
    db: Session = Depends(get_db),
    cu: User    = Depends(get_current_user)
):
    d = get_or_404(db, Department, id, get_tid(cu))
    d.name = data.name; d.code = data.code
    db.commit(); db.refresh(d)
    return {"id": str(d.id), "name": d.name, "code": d.code}


@router.delete("/departments/{id}", status_code=204)
def delete_department(
    id: UUID,
    db: Session = Depends(get_db),
    cu: User    = Depends(get_current_user)
):
    d = get_or_404(db, Department, id, get_tid(cu))
    db.delete(d); db.commit()


# ─────────────────────────────────────────────────────────────
#  DESIGNATIONS
# ─────────────────────────────────────────────────────────────
class DesigIn(BaseModel):
    name: str


@router.get("/designations")
def list_designations(
    db: Session = Depends(get_db),
    cu: User    = Depends(get_current_user)
):
    rows = db.query(Designation)\
             .filter(Designation.tenant_id == get_tid(cu))\
             .order_by(Designation.name).all()
    return [{"id": str(r.id), "name": r.name} for r in rows]


@router.post("/designations", status_code=201)
def create_designation(
    data: DesigIn,
    db: Session = Depends(get_db),
    cu: User    = Depends(get_current_user)
):
    d = Designation(name=data.name, tenant_id=get_tid(cu))
    db.add(d); db.commit(); db.refresh(d)
    return {"id": str(d.id), "name": d.name}


@router.put("/designations/{id}")
def update_designation(
    id: UUID, data: DesigIn,
    db: Session = Depends(get_db),
    cu: User    = Depends(get_current_user)
):
    d = get_or_404(db, Designation, id, get_tid(cu))
    d.name = data.name
    db.commit(); db.refresh(d)
    return {"id": str(d.id), "name": d.name}


@router.delete("/designations/{id}", status_code=204)
def delete_designation(
    id: UUID,
    db: Session = Depends(get_db),
    cu: User    = Depends(get_current_user)
):
    d = get_or_404(db, Designation, id, get_tid(cu))
    db.delete(d); db.commit()


# ─────────────────────────────────────────────────────────────
#  LEAVE TYPES
# ─────────────────────────────────────────────────────────────
class LeaveIn(BaseModel):
    name:              str
    max_days_per_year: int  = 0
    is_paid:           bool = True


@router.get("/leave-types")
def list_leave_types(
    db: Session = Depends(get_db),
    cu: User    = Depends(get_current_user)
):
    rows = db.query(LeaveType)\
             .filter(LeaveType.tenant_id == get_tid(cu))\
             .order_by(LeaveType.name).all()
    return [
        {
            "id":                str(r.id),
            "name":              r.name,
            "max_days_per_year": r.max_days_per_year,
            "is_paid":           r.is_paid,
        }
        for r in rows
    ]


@router.post("/leave-types", status_code=201)
def create_leave_type(
    data: LeaveIn,
    db: Session = Depends(get_db),
    cu: User    = Depends(get_current_user)
):
    l = LeaveType(**data.model_dump(), tenant_id=get_tid(cu))
    db.add(l); db.commit(); db.refresh(l)
    return {
        "id": str(l.id), "name": l.name,
        "max_days_per_year": l.max_days_per_year, "is_paid": l.is_paid,
    }


@router.put("/leave-types/{id}")
def update_leave_type(
    id: UUID, data: LeaveIn,
    db: Session = Depends(get_db),
    cu: User    = Depends(get_current_user)
):
    l = get_or_404(db, LeaveType, id, get_tid(cu))
    for k, v in data.model_dump().items():
        setattr(l, k, v)
    db.commit(); db.refresh(l)
    return {
        "id": str(l.id), "name": l.name,
        "max_days_per_year": l.max_days_per_year, "is_paid": l.is_paid,
    }


@router.delete("/leave-types/{id}", status_code=204)
def delete_leave_type(
    id: UUID,
    db: Session = Depends(get_db),
    cu: User    = Depends(get_current_user)
):
    l = get_or_404(db, LeaveType, id, get_tid(cu))
    db.delete(l); db.commit()


# ─────────────────────────────────────────────────────────────
#  FEE CATEGORIES
# ─────────────────────────────────────────────────────────────
class FeeCatIn(BaseModel):
    name:         str
    description:  Optional[str] = None
    is_recurring: bool          = True
    frequency:    str           = "monthly"


@router.get("/fee-categories")
def list_fee_categories(
    db: Session = Depends(get_db),
    cu: User    = Depends(get_current_user)
):
    rows = db.query(FeeCategory)\
             .filter(FeeCategory.tenant_id == get_tid(cu))\
             .order_by(FeeCategory.name).all()
    return [
        {
            "id":           str(r.id),
            "name":         r.name,
            "is_recurring": r.is_recurring,
            "frequency":    r.frequency,
        }
        for r in rows
    ]


@router.post("/fee-categories", status_code=201)
def create_fee_category(
    data: FeeCatIn,
    db: Session = Depends(get_db),
    cu: User    = Depends(get_current_user)
):
    f = FeeCategory(**data.model_dump(), tenant_id=get_tid(cu))
    db.add(f); db.commit(); db.refresh(f)
    return {
        "id": str(f.id), "name": f.name,
        "is_recurring": f.is_recurring, "frequency": f.frequency,
    }


@router.put("/fee-categories/{id}")
def update_fee_category(
    id: UUID, data: FeeCatIn,
    db: Session = Depends(get_db),
    cu: User    = Depends(get_current_user)
):
    f = get_or_404(db, FeeCategory, id, get_tid(cu))
    for k, v in data.model_dump().items():
        setattr(f, k, v)
    db.commit(); db.refresh(f)
    return {
        "id": str(f.id), "name": f.name,
        "is_recurring": f.is_recurring, "frequency": f.frequency,
    }


@router.delete("/fee-categories/{id}", status_code=204)
def delete_fee_category(
    id: UUID,
    db: Session = Depends(get_db),
    cu: User    = Depends(get_current_user)
):
    f = get_or_404(db, FeeCategory, id, get_tid(cu))
    db.delete(f); db.commit()


# ─────────────────────────────────────────────────────────────
#  BOOK CATEGORIES
# ─────────────────────────────────────────────────────────────
class BookCatIn(BaseModel):
    name: str


@router.get("/book-categories")
def list_book_categories(
    db: Session = Depends(get_db),
    cu: User    = Depends(get_current_user)
):
    rows = db.query(BookCategory)\
             .filter(BookCategory.tenant_id == get_tid(cu))\
             .order_by(BookCategory.name).all()
    return [{"id": str(r.id), "name": r.name} for r in rows]


@router.post("/book-categories", status_code=201)
def create_book_category(
    data: BookCatIn,
    db: Session = Depends(get_db),
    cu: User    = Depends(get_current_user)
):
    b = BookCategory(name=data.name, tenant_id=get_tid(cu))
    db.add(b); db.commit(); db.refresh(b)
    return {"id": str(b.id), "name": b.name}


@router.put("/book-categories/{id}")
def update_book_category(
    id: UUID, data: BookCatIn,
    db: Session = Depends(get_db),
    cu: User    = Depends(get_current_user)
):
    b = get_or_404(db, BookCategory, id, get_tid(cu))
    b.name = data.name
    db.commit(); db.refresh(b)
    return {"id": str(b.id), "name": b.name}


@router.delete("/book-categories/{id}", status_code=204)
def delete_book_category(
    id: UUID,
    db: Session = Depends(get_db),
    cu: User    = Depends(get_current_user)
):
    b = get_or_404(db, BookCategory, id, get_tid(cu))
    db.delete(b); db.commit()
