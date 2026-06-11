# backend/routers/attendance.py
from uuid import UUID
from datetime import date, datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, Query, status, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, field_validator

from database import get_db
from routers.auth import get_current_user
from models.user import User
from services.attendance_service import AttendanceService

router = APIRouter()


def get_service(db: Session = Depends(get_db)) -> AttendanceService:
    return AttendanceService(db)


# ─────────────────────────────────────────────────────────────
#  SCHEMAS
# ─────────────────────────────────────────────────────────────
class AttendanceRecord(BaseModel):
    enrollment_id: UUID
    status:        str = "present"
    remarks:       Optional[str] = None

    @field_validator("status")
    @classmethod
    def valid_status(cls, v):
        allowed = {"present", "absent", "late", "holiday"}
        if v not in allowed:
            raise ValueError(f"status must be one of: {', '.join(sorted(allowed))}")
        return v


class MarkAttendanceIn(BaseModel):
    enrollment_id: UUID
    date:          date
    status:        str
    period_no:     Optional[int] = None
    remarks:       Optional[str] = None

    @field_validator("status")
    @classmethod
    def valid_status(cls, v):
        allowed = {"present", "absent", "late", "holiday"}
        if v not in allowed:
            raise ValueError(f"status must be one of: {', '.join(sorted(allowed))}")
        return v

    @field_validator("date")
    @classmethod
    def not_future(cls, v):
        if v > datetime.now().date():
            raise ValueError("Cannot mark attendance for a future date")
        return v


class BulkMarkIn(BaseModel):
    section_id: UUID
    date:       date
    period_no:  Optional[int]          = None
    records:    List[AttendanceRecord]

    @field_validator("date")
    @classmethod
    def not_future(cls, v):
        if v > datetime.now().date():
            raise ValueError("Cannot mark attendance for a future date")
        return v

    @field_validator("records")
    @classmethod
    def has_records(cls, v):
        if not v:
            raise ValueError("At least one attendance record required")
        return v


class HolidayIn(BaseModel):
    date: date
    name: str
    type: str = "public"


# ─────────────────────────────────────────────────────────────
#  MARK SINGLE
# ─────────────────────────────────────────────────────────────
@router.post("/mark", status_code=200)
def mark_attendance(
    data:    MarkAttendanceIn,
    service: AttendanceService = Depends(get_service),
    cu:      User              = Depends(get_current_user),
):
    return service.mark(
        tenant_id     = cu.tenant_id,
        enrollment_id = data.enrollment_id,
        att_date      = data.date,
        att_status    = data.status,
        marked_by     = cu.id,
        period_no     = data.period_no,
        remarks       = data.remarks,
    )


# ─────────────────────────────────────────────────────────────
#  BULK MARK
# ─────────────────────────────────────────────────────────────
@router.post("/bulk-mark", status_code=200)
def bulk_mark_attendance(
    data:    BulkMarkIn,
    service: AttendanceService = Depends(get_service),
    cu:      User              = Depends(get_current_user),
):
    return service.bulk_mark(
        tenant_id  = cu.tenant_id,
        section_id = data.section_id,
        att_date   = data.date,
        records    = [r.model_dump() for r in data.records],
        marked_by  = cu.id,
        period_no  = data.period_no,
    )


# ─────────────────────────────────────────────────────────────
#  GET SECTION ATTENDANCE FOR A DATE
# ─────────────────────────────────────────────────────────────
@router.get("/section/{section_id}")
def get_section_attendance(
    section_id: UUID,
    att_date:   date          = Query(..., alias="att_date"),
    period_no:  Optional[int] = Query(None),
    service:    AttendanceService = Depends(get_service),
    cu:         User              = Depends(get_current_user),
):
    return service.get_section_attendance(
        section_id = section_id,
        tenant_id  = cu.tenant_id,
        att_date   = att_date,
        period_no  = period_no,
    )


# ─────────────────────────────────────────────────────────────
#  STUDENT SUMMARY
# ─────────────────────────────────────────────────────────────
@router.get("/summary/student/{enrollment_id}")
def get_student_summary(
    enrollment_id: UUID,
    from_date:     date    = Query(...),
    to_date:       date    = Query(...),
    service:       AttendanceService = Depends(get_service),
    cu:            User              = Depends(get_current_user),
):
    return service.get_student_summary(enrollment_id, from_date, to_date)


# ─────────────────────────────────────────────────────────────
#  SECTION SUMMARY
# ─────────────────────────────────────────────────────────────
@router.get("/summary/section/{section_id}")
def get_section_summary(
    section_id: UUID,
    from_date:  date    = Query(...),
    to_date:    date    = Query(...),
    service:    AttendanceService = Depends(get_service),
    cu:         User              = Depends(get_current_user),
):
    return service.get_section_summary(section_id, from_date, to_date)


# ─────────────────────────────────────────────────────────────
#  MONTHLY HEATMAP
# ─────────────────────────────────────────────────────────────
@router.get("/monthly/{enrollment_id}")
def get_monthly(
    enrollment_id: UUID,
    year:          int  = Query(...),
    month:         int  = Query(..., ge=1, le=12),
    service:       AttendanceService = Depends(get_service),
    cu:            User              = Depends(get_current_user),
):
    return service.get_monthly(enrollment_id, year, month)


# ─────────────────────────────────────────────────────────────
#  LOW ATTENDANCE
# ─────────────────────────────────────────────────────────────
@router.get("/low-attendance")
def get_low_attendance(
    academic_year_id: UUID  = Query(...),
    threshold:        float = Query(75.0, ge=0, le=100),
    service:          AttendanceService = Depends(get_service),
    cu:               User              = Depends(get_current_user),
):
    return service.get_low_attendance(
        tenant_id        = cu.tenant_id,
        academic_year_id = academic_year_id,
        threshold        = threshold,
    )


# ─────────────────────────────────────────────────────────────
#  HOLIDAYS
# ─────────────────────────────────────────────────────────────
@router.get("/holidays")
def list_holidays(
    from_date: date    = Query(...),
    to_date:   date    = Query(...),
    service:   AttendanceService = Depends(get_service),
    cu:        User              = Depends(get_current_user),
):
    holidays = service.list_holidays(cu.tenant_id, from_date, to_date)
    return [
        {"id": str(h.id), "date": str(h.date), "name": h.name, "type": h.type}
        for h in holidays
    ]


@router.post("/holidays", status_code=201)
def add_holiday(
    data:    HolidayIn,
    service: AttendanceService = Depends(get_service),
    cu:      User              = Depends(get_current_user),
):
    h = service.add_holiday(cu.tenant_id, data.date, data.name, data.type)
    return {"id": str(h.id), "date": str(h.date), "name": h.name, "type": h.type}


@router.delete("/holidays/{holiday_id}", status_code=204)
def delete_holiday(
    holiday_id: UUID,
    service:    AttendanceService = Depends(get_service),
    cu:         User              = Depends(get_current_user),
):
    service.delete_holiday(holiday_id, cu.tenant_id)
