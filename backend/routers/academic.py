# backend/routers/academic.py
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
from routers.auth import get_current_user
from models.user import User
from models.academic_year import AcademicYear

router= APIRouter()

@router.get("/")
def list_academic_years(
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    years = (
        db.query(AcademicYear)
        .filter(AcademicYear.tenant_id == current_user.tenant_id)
        .order_by(AcademicYear.start_date.desc())
        .all()
    )
    return [
        {
            "id":         str(y.id),
            "label":      y.label,
            "start_date": str(y.start_date),
            "end_date":   str(y.end_date),
            "is_current": y.is_current,
        }
        for y in years
    ]

