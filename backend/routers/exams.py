# backend/routers/exams.py
from uuid import UUID
from datetime import date, time
from decimal import Decimal
from typing import Optional, List
from fastapi import APIRouter, Depends, Query, status, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, field_validator

from database import get_db
from routers.auth import get_current_user
from models.user import User
from services.exam_service import ExamService

router = APIRouter()


def get_service(db: Session = Depends(get_db)) -> ExamService:
    return ExamService(db)


# ─────────────────────────────────────────────────────────────
#  SCHEMAS
# ─────────────────────────────────────────────────────────────
class ExamTypeIn(BaseModel):
    name:       str
    short_code: Optional[str]  = None
    max_marks:  float          = 100.0
    pass_marks: float          = 33.0
    weightage:  float          = 100.0
    model_config = {"extra": "ignore"}


class ScheduleIn(BaseModel):
    subject_id: UUID
    exam_date:  date
    max_marks:  float          = 100.0
    pass_marks: float          = 33.0
    start_time: Optional[str]  = None
    end_time:   Optional[str]  = None
    room_no:    Optional[str]  = None


class CreateExamIn(BaseModel):
    exam_type_id:     UUID
    academic_year_id: UUID
    grade_id:         UUID
    name:             str
    start_date:       date
    end_date:         date
    remarks:          Optional[str]       = None
    schedules:        List[ScheduleIn]    = []
    model_config = {"extra": "ignore"}

    @field_validator("end_date")
    @classmethod
    def end_after_start(cls, v, info):
        if "start_date" in info.data and v < info.data["start_date"]:
            raise ValueError("end_date must be on or after start_date")
        return v


class UpdateExamIn(BaseModel):
    name:       Optional[str]  = None
    start_date: Optional[date] = None
    end_date:   Optional[date] = None
    status:     Optional[str]  = None
    remarks:    Optional[str]  = None
    model_config = {"extra": "ignore"}

    @field_validator("status")
    @classmethod
    def valid_status(cls, v):
        valid = {"scheduled", "ongoing", "completed", "cancelled"}
        if v and v not in valid:
            raise ValueError(f"status must be one of: {', '.join(sorted(valid))}")
        return v


class ResultRecord(BaseModel):
    enrollment_id:  UUID
    marks_obtained: Optional[float] = None
    is_absent:      bool            = False
    is_exempted:    bool            = False
    remarks:        Optional[str]   = None

    @field_validator("marks_obtained")
    @classmethod
    def non_negative(cls, v):
        if v is not None and v < 0:
            raise ValueError("marks cannot be negative")
        return v


class BulkResultIn(BaseModel):
    schedule_id: UUID
    records:     List[ResultRecord]

    @field_validator("records")
    @classmethod
    def has_records(cls, v):
        if not v:
            raise ValueError("records list cannot be empty")
        return v


class SingleResultIn(BaseModel):
    schedule_id:    UUID
    enrollment_id:  UUID
    marks_obtained: Optional[float] = None
    is_absent:      bool            = False
    is_exempted:    bool            = False
    remarks:        Optional[str]   = None


# ─────────────────────────────────────────────────────────────
#  HELPERS
# ─────────────────────────────────────────────────────────────
def _serialize_exam(exam) -> dict:
    return {
        "id":               str(exam.id),
        "name":             exam.name,
        "exam_type_id":     str(exam.exam_type_id),
        "exam_type_name":   exam.exam_type.name if exam.exam_type else "",
        "exam_type_code":   exam.exam_type.short_code if exam.exam_type else "",
        "academic_year_id": str(exam.academic_year_id),
        "grade_id":         str(exam.grade_id),
        "start_date":       str(exam.start_date),
        "end_date":         str(exam.end_date),
        "status":           exam.status,
        "remarks":          exam.remarks,
        "schedules": [
            {
                "id":          str(s.id),
                "subject_id":  str(s.subject_id),
                "subject_name":s.subject.name if s.subject else "",
                "subject_code":s.subject.code if s.subject else "",
                "exam_date":   str(s.exam_date),
                "start_time":  str(s.start_time) if s.start_time else None,
                "end_time":    str(s.end_time)   if s.end_time   else None,
                "max_marks":   float(s.max_marks),
                "pass_marks":  float(s.pass_marks),
                "room_no":     s.room_no,
            }
            for s in (exam.schedules or [])
        ],
    }


# ─────────────────────────────────────────────────────────────
#  EXAM TYPES
# ─────────────────────────────────────────────────────────────
@router.get("/types")
def list_exam_types(
    service: ExamService = Depends(get_service),
    cu:      User        = Depends(get_current_user),
):
    types = service.list_exam_types(cu.tenant_id)
    return [
        {
            "id":         str(t.id),
            "name":       t.name,
            "short_code": t.short_code,
            "max_marks":  float(t.max_marks),
            "pass_marks": float(t.pass_marks),
            "weightage":  float(t.weightage),
        }
        for t in types
    ]


@router.post("/types", status_code=201)
def create_exam_type(
    data:    ExamTypeIn,
    service: ExamService = Depends(get_service),
    cu:      User        = Depends(get_current_user),
):
    try:
        et = service.create_exam_type(
            cu.tenant_id, data.name, data.short_code,
            data.max_marks, data.pass_marks, data.weightage
        )
        return {"id": str(et.id), "name": et.name}
    except HTTPException: raise
    except Exception as e:
        if "unique" in str(e).lower():
            raise HTTPException(409, f"Exam type '{data.name}' already exists")
        raise HTTPException(500, str(e))


@router.put("/types/{type_id}")
def update_exam_type(
    type_id: UUID,
    data:    ExamTypeIn,
    service: ExamService = Depends(get_service),
    cu:      User        = Depends(get_current_user),
):
    et = service.update_exam_type(type_id, cu.tenant_id, data.model_dump(exclude_unset=True))
    return {"id": str(et.id), "name": et.name}


@router.delete("/types/{type_id}", status_code=204)
def delete_exam_type(
    type_id: UUID,
    service: ExamService = Depends(get_service),
    cu:      User        = Depends(get_current_user),
):
    service.delete_exam_type(type_id, cu.tenant_id)


# ─────────────────────────────────────────────────────────────
#  EXAMS CRUD
# ─────────────────────────────────────────────────────────────
@router.get("/")
def list_exams(
    academic_year_id: Optional[UUID] = Query(None),
    grade_id:         Optional[UUID] = Query(None),
    status:           Optional[str]  = Query(None),
    service: ExamService = Depends(get_service),
    cu:      User        = Depends(get_current_user),
):
    exams = service.list_exams(cu.tenant_id, academic_year_id, grade_id, status)
    return [_serialize_exam(e) for e in exams]


@router.post("/", status_code=201)
def create_exam(
    data:    CreateExamIn,
    service: ExamService = Depends(get_service),
    cu:      User        = Depends(get_current_user),
):
    try:
        exam = service.create_exam(
            tenant_id        = cu.tenant_id,
            exam_type_id     = data.exam_type_id,
            academic_year_id = data.academic_year_id,
            grade_id         = data.grade_id,
            name             = data.name,
            start_date       = data.start_date,
            end_date         = data.end_date,
            remarks          = data.remarks,
            created_by       = cu.id,
            schedules        = [s.model_dump() for s in data.schedules],
        )
        return _serialize_exam(exam)
    except HTTPException: raise
    except Exception as e:
        raise HTTPException(500, f"Failed to create exam: {str(e)}")


@router.get("/{exam_id}")
def get_exam(
    exam_id: UUID,
    service: ExamService = Depends(get_service),
    cu:      User        = Depends(get_current_user),
):
    exam = service.get_exam(exam_id, cu.tenant_id)
    return _serialize_exam(exam)


@router.put("/{exam_id}")
def update_exam(
    exam_id: UUID,
    data:    UpdateExamIn,
    service: ExamService = Depends(get_service),
    cu:      User        = Depends(get_current_user),
):
    try:
        exam = service.update_exam(exam_id, cu.tenant_id, data.model_dump(exclude_unset=True))
        return _serialize_exam(exam)
    except HTTPException: raise
    except Exception as e:
        raise HTTPException(500, f"Failed to update exam: {str(e)}")


@router.delete("/{exam_id}", status_code=204)
def delete_exam(
    exam_id: UUID,
    service: ExamService = Depends(get_service),
    cu:      User        = Depends(get_current_user),
):
    service.delete_exam(exam_id, cu.tenant_id)


# ─────────────────────────────────────────────────────────────
#  EXAM SCHEDULES
# ─────────────────────────────────────────────────────────────
@router.post("/{exam_id}/schedules", status_code=201)
def add_schedule(
    exam_id: UUID,
    data:    ScheduleIn,
    service: ExamService = Depends(get_service),
    cu:      User        = Depends(get_current_user),
):
    try:
        s = service.add_schedule(
            exam_id    = exam_id,
            tenant_id  = cu.tenant_id,
            subject_id = data.subject_id,
            exam_date  = data.exam_date,
            max_marks  = data.max_marks,
            pass_marks = data.pass_marks,
            start_time = data.start_time,
            end_time   = data.end_time,
            room_no    = data.room_no,
        )
        return {
            "id":          str(s.id),
            "subject_id":  str(s.subject_id),
            "exam_date":   str(s.exam_date),
            "max_marks":   float(s.max_marks),
            "pass_marks":  float(s.pass_marks),
        }
    except HTTPException: raise
    except Exception as e:
        if "unique" in str(e).lower():
            raise HTTPException(409, "Subject already scheduled for this exam")
        raise HTTPException(500, str(e))


@router.delete("/{exam_id}/schedules/{schedule_id}", status_code=204)
def delete_schedule(
    exam_id:     UUID,
    schedule_id: UUID,
    service:     ExamService = Depends(get_service),
    cu:          User        = Depends(get_current_user),
):
    service.delete_schedule(schedule_id, cu.tenant_id)


# ─────────────────────────────────────────────────────────────
#  RESULTS — GET students for entry grid
# ─────────────────────────────────────────────────────────────
@router.get("/{exam_id}/schedules/{schedule_id}/students")
def get_schedule_students(
    exam_id:     UUID,
    schedule_id: UUID,
    service:     ExamService = Depends(get_service),
    cu:          User        = Depends(get_current_user),
):
    """
    Returns all students in the exam's grade/section
    with their current marks (if entered).
    Used to pre-fill the marks entry grid.
    """
    return service.get_schedule_students(schedule_id, exam_id)


# ─────────────────────────────────────────────────────────────
#  RESULTS — SINGLE ENTRY
# ─────────────────────────────────────────────────────────────
@router.post("/{exam_id}/results", status_code=200)
def enter_single_result(
    exam_id: UUID,
    data:    SingleResultIn,
    service: ExamService = Depends(get_service),
    cu:      User        = Depends(get_current_user),
):
    """Enter or update marks for a single student."""
    return service.enter_result(
        tenant_id      = cu.tenant_id,
        exam_id        = exam_id,
        schedule_id    = data.schedule_id,
        enrollment_id  = data.enrollment_id,
        marks_obtained = data.marks_obtained,
        is_absent      = data.is_absent,
        is_exempted    = data.is_exempted,
        entered_by     = cu.id,
        remarks        = data.remarks,
    )


# ─────────────────────────────────────────────────────────────
#  RESULTS — BULK ENTRY  ← main endpoint for marks entry grid
# ─────────────────────────────────────────────────────────────
@router.post("/{exam_id}/results/bulk", status_code=200)
def bulk_enter_results(
    exam_id: UUID,
    data:    BulkResultIn,
    service: ExamService = Depends(get_service),
    cu:      User        = Depends(get_current_user),
):
    """
    Bulk enter/update marks for ALL students in a subject at once.
    Safe to call multiple times (upsert).

    Body:
    {
      "schedule_id": "uuid-of-exam-schedule",
      "records": [
        { "enrollment_id": "uuid", "marks_obtained": 75.0 },
        { "enrollment_id": "uuid", "is_absent": true },
        { "enrollment_id": "uuid", "marks_obtained": 88.5, "remarks": "Good work" }
      ]
    }
    """
    return service.bulk_enter_results(
        tenant_id   = cu.tenant_id,
        exam_id     = exam_id,
        schedule_id = data.schedule_id,
        records     = [r.model_dump() for r in data.records],
        entered_by  = cu.id,
    )


# ─────────────────────────────────────────────────────────────
#  STUDENT RESULT CARD
# ─────────────────────────────────────────────────────────────
@router.get("/{exam_id}/results/{enrollment_id}")
def get_student_result(
    exam_id:       UUID,
    enrollment_id: UUID,
    service:       ExamService = Depends(get_service),
    cu:            User        = Depends(get_current_user),
):
    """Get full result with grade calculation for one student."""
    return service.get_student_results(enrollment_id, exam_id, cu.tenant_id)


# ─────────────────────────────────────────────────────────────
#  REPORT CARDS
# ─────────────────────────────────────────────────────────────
@router.post("/{exam_id}/report-cards/generate", status_code=200)
def generate_report_cards(
    exam_id: UUID,
    service: ExamService = Depends(get_service),
    cu:      User        = Depends(get_current_user),
):
    """
    Generate report cards for all students.
    Calculates grades, ranks, and pass/fail status.
    Marks exam as 'completed'.
    """
    try:
        return service.generate_report_cards(exam_id, cu.tenant_id)
    except HTTPException: raise
    except Exception as e:
        raise HTTPException(500, f"Failed to generate report cards: {str(e)}")


@router.get("/{exam_id}/report-cards")
def get_report_cards(
    exam_id: UUID,
    service: ExamService = Depends(get_service),
    cu:      User        = Depends(get_current_user),
):
    """Get all report cards for an exam, ranked by percentage."""
    return service.get_report_cards(exam_id, cu.tenant_id)
