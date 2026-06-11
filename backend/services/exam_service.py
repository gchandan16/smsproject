# backend/services/exam_service.py
from uuid import UUID
from decimal import Decimal
from typing import List, Optional, Dict
from fastapi import HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text

from repositories.exam_repository import (
    ExamTypeRepository, ExamRepository,
    ExamResultRepository
)
from models.exam import (
    ExamType, Exam, ExamSchedule, ExamResult, ReportCard
)


# ── CBSE 10-point grading scale ──────────────────────────────
GRADE_SCALE = [
    (91, 100, "A1", 10.0, "Outstanding"),
    (81,  90, "A2",  9.0, "Excellent"),
    (71,  80, "B1",  8.0, "Very Good"),
    (61,  70, "B2",  7.0, "Good"),
    (51,  60, "C1",  6.0, "Average"),
    (41,  50, "C2",  5.0, "Below Average"),
    (33,  40, "D",   4.0, "Pass"),
    ( 0,  32, "E",   0.0, "Fail"),
]

def calculate_grade(percentage: float) -> Dict:
    """Return grade letter, points and remarks from percentage."""
    pct = float(percentage)
    for lo, hi, grade, points, remark in GRADE_SCALE:
        if lo <= pct <= hi:
            return {
                "grade":       grade,
                "grade_points":points,
                "remarks":     remark,
                "passed":      grade != "E",
            }
    return {"grade": "E", "grade_points": 0.0, "remarks": "Fail", "passed": False}


class ExamService:
    def __init__(self, db: Session):
        self.type_repo   = ExamTypeRepository(db)
        self.exam_repo   = ExamRepository(db)
        self.result_repo = ExamResultRepository(db)
        self.db          = db

    # ── Exam Types ────────────────────────────────────────────
    def list_exam_types(self, tenant_id: UUID) -> List[ExamType]:
        return self.type_repo.get_all(tenant_id)

    def create_exam_type(
        self, tenant_id: UUID, name: str, short_code: str,
        max_marks: float, pass_marks: float, weightage: float
    ) -> ExamType:
        et = ExamType(
            tenant_id  = tenant_id,
            name       = name,
            short_code = short_code,
            max_marks  = Decimal(str(max_marks)),
            pass_marks = Decimal(str(pass_marks)),
            weightage  = Decimal(str(weightage)),
        )
        return self.type_repo.create(et)

    def update_exam_type(self, et_id: UUID, tenant_id: UUID, data: dict) -> ExamType:
        et = self._get_exam_type_or_404(et_id, tenant_id)
        return self.type_repo.update(et, data)

    def delete_exam_type(self, et_id: UUID, tenant_id: UUID) -> None:
        et = self._get_exam_type_or_404(et_id, tenant_id)
        self.type_repo.delete(et)

    # ── Exams ─────────────────────────────────────────────────
    def list_exams(
        self, tenant_id: UUID,
        academic_year_id: Optional[UUID] = None,
        grade_id:         Optional[UUID] = None,
        status:           Optional[str]  = None,
    ) -> List[Exam]:
        return self.exam_repo.list_exams(tenant_id, academic_year_id, grade_id, status)

    def get_exam(self, exam_id: UUID, tenant_id: UUID) -> Exam:
        exam = self.exam_repo.get_full(exam_id, tenant_id)
        if not exam:
            raise HTTPException(404, "Exam not found")
        return exam

    def create_exam(
        self,
        tenant_id:        UUID,
        exam_type_id:     UUID,
        academic_year_id: UUID,
        grade_id:         UUID,
        name:             str,
        start_date,
        end_date,
        remarks:          Optional[str] = None,
        created_by:       Optional[UUID] = None,
        schedules:        Optional[List[dict]] = None,
    ) -> Exam:
        exam = Exam(
            tenant_id        = tenant_id,
            exam_type_id     = exam_type_id,
            academic_year_id = academic_year_id,
            grade_id         = grade_id,
            name             = name,
            start_date       = start_date,
            end_date         = end_date,
            status           = "scheduled",
            remarks          = remarks,
            created_by       = created_by,
        )
        self.db.add(exam)
        self.db.flush()

        # Add subject schedules
        for sch in (schedules or []):
            s = ExamSchedule(
                exam_id    = exam.id,
                subject_id = UUID(str(sch["subject_id"])),
                exam_date  = sch["exam_date"],
                start_time = sch.get("start_time"),
                end_time   = sch.get("end_time"),
                max_marks  = Decimal(str(sch.get("max_marks",  100))),
                pass_marks = Decimal(str(sch.get("pass_marks", 33))),
                room_no    = sch.get("room_no"),
            )
            self.db.add(s)

        self.db.commit()
        self.db.refresh(exam)
        return self.exam_repo.get_full(exam.id, tenant_id)

    def update_exam(self, exam_id: UUID, tenant_id: UUID, data: dict) -> Exam:
        exam = self._get_exam_or_404(exam_id, tenant_id)
        allowed = {"name", "start_date", "end_date", "status", "remarks"}
        clean   = {k: v for k, v in data.items() if k in allowed and v is not None}
        self.exam_repo.update(exam, clean)
        return self.exam_repo.get_full(exam_id, tenant_id)

    def delete_exam(self, exam_id: UUID, tenant_id: UUID) -> None:
        exam = self._get_exam_or_404(exam_id, tenant_id)
        if exam.status == "completed":
            raise HTTPException(400, "Cannot delete a completed exam")
        self.exam_repo.delete(exam)

    # ── Schedules ─────────────────────────────────────────────
    def add_schedule(
        self, exam_id: UUID, tenant_id: UUID,
        subject_id: UUID, exam_date,
        max_marks: float = 100, pass_marks: float = 33,
        start_time = None, end_time = None, room_no: str = None,
    ) -> ExamSchedule:
        self._get_exam_or_404(exam_id, tenant_id)
        s = ExamSchedule(
            exam_id    = exam_id,
            subject_id = subject_id,
            exam_date  = exam_date,
            max_marks  = Decimal(str(max_marks)),
            pass_marks = Decimal(str(pass_marks)),
            start_time = start_time,
            end_time   = end_time,
            room_no    = room_no,
        )
        self.db.add(s)
        self.db.commit()
        self.db.refresh(s)
        return s

    def delete_schedule(self, schedule_id: UUID, tenant_id: UUID) -> None:
        s = self.db.query(ExamSchedule).join(Exam).filter(
            ExamSchedule.id == schedule_id,
            Exam.tenant_id  == tenant_id,
        ).first()
        if not s:
            raise HTTPException(404, "Schedule not found")
        self.db.delete(s); self.db.commit()

    # ── Results — SINGLE ──────────────────────────────────────
    def enter_result(
        self,
        tenant_id:     UUID,
        exam_id:       UUID,
        schedule_id:   UUID,
        enrollment_id: UUID,
        marks_obtained: Optional[float],
        is_absent:     bool,
        is_exempted:   bool,
        entered_by:    UUID,
        remarks:       Optional[str] = None,
    ) -> dict:
        exam = self._get_exam_or_404(exam_id, tenant_id)
        if exam.status == "cancelled":
            raise HTTPException(400, "Cannot enter results for a cancelled exam")

        # Validate marks
        if not is_absent and not is_exempted and marks_obtained is not None:
            schedule = self.db.query(ExamSchedule).filter(
                ExamSchedule.id == schedule_id
            ).first()
            if schedule and marks_obtained > float(schedule.max_marks):
                raise HTTPException(
                    400,
                    f"Marks ({marks_obtained}) cannot exceed max marks ({float(schedule.max_marks)})"
                )

        self.result_repo.upsert_result(
            tenant_id, exam_id, schedule_id, enrollment_id,
            marks_obtained, is_absent, is_exempted, entered_by, remarks
        )
        self.db.commit()
        return {"message": "Result saved"}

    # ── Results — BULK ────────────────────────────────────────
    def bulk_enter_results(
        self,
        tenant_id:   UUID,
        exam_id:     UUID,
        schedule_id: UUID,
        records:     List[dict],
        entered_by:  UUID,
    ) -> dict:
        """
        Bulk upsert results for an entire class for one subject.
        Validates each mark against max_marks.
        """
        if not records:
            raise HTTPException(400, "No records provided")

        exam = self._get_exam_or_404(exam_id, tenant_id)
        if exam.status == "cancelled":
            raise HTTPException(400, "Cannot enter results for a cancelled exam")

        schedule = self.db.query(ExamSchedule).filter(
            ExamSchedule.id == schedule_id
        ).first()
        if not schedule:
            raise HTTPException(404, "Exam schedule not found")

        max_marks = float(schedule.max_marks)

        # Validate all marks before saving any
        errors = []
        for i, rec in enumerate(records):
            marks = rec.get("marks_obtained")
            absent  = bool(rec.get("is_absent",   False))
            exempt  = bool(rec.get("is_exempted",  False))
            if not absent and not exempt and marks is not None:
                try:
                    m = float(marks)
                    if m < 0:
                        errors.append(f"Row {i+1}: marks cannot be negative")
                    elif m > max_marks:
                        errors.append(
                            f"Row {i+1}: marks ({m}) exceed max ({max_marks})"
                        )
                except (ValueError, TypeError):
                    errors.append(f"Row {i+1}: invalid marks value '{marks}'")

        if errors:
            raise HTTPException(422, detail="; ".join(errors))

        # Save all records
        count = self.result_repo.bulk_upsert(
            tenant_id, exam_id, schedule_id, records, entered_by
        )
        self.db.commit()

        # Auto-update exam status to ongoing if still scheduled
        if exam.status == "scheduled":
            self.exam_repo.update(exam, {"status": "ongoing"})

        saved     = sum(1 for r in records if not r.get("is_absent"))
        absent    = sum(1 for r in records if r.get("is_absent"))
        exempted  = sum(1 for r in records if r.get("is_exempted"))

        return {
            "message":    f"Results saved for {count} students",
            "total":      count,
            "saved":      saved,
            "absent":     absent,
            "exempted":   exempted,
            "schedule_id":str(schedule_id),
            "subject":    schedule.subject.name if schedule.subject else None,
        }

    def get_schedule_students(self, schedule_id: UUID, exam_id: UUID) -> List[dict]:
        return self.exam_repo.get_schedule_students(schedule_id, exam_id)

    def get_student_results(
        self, enrollment_id: UUID, exam_id: UUID, tenant_id: UUID
    ) -> dict:
        self._get_exam_or_404(exam_id, tenant_id)
        results = self.result_repo.get_student_results(enrollment_id, exam_id)
        if not results:
            return {"enrollment_id": str(enrollment_id), "results": [], "summary": None}

        # Calculate totals
        total_max  = sum(r["max_marks"] for r in results
                         if not r["is_absent"] and not r["is_exempted"])
        total_got  = sum(
            r["marks_obtained"] for r in results
            if r["marks_obtained"] is not None
            and not r["is_absent"]
            and not r["is_exempted"]
        )
        pct        = (total_got / total_max * 100) if total_max > 0 else 0
        grade_info = calculate_grade(pct)
        any_fail   = any(
            r["marks_obtained"] is not None
            and not r["is_absent"]
            and not r["is_exempted"]
            and r["marks_obtained"] < r["pass_marks"]
            for r in results
        )

        return {
            "enrollment_id": str(enrollment_id),
            "results":       results,
            "summary": {
                "total_max":     total_max,
                "total_obtained":total_got,
                "percentage":    round(pct, 2),
                "grade":         grade_info["grade"],
                "grade_points":  grade_info["grade_points"],
                "remarks":       grade_info["remarks"],
                "result":        "fail" if any_fail else ("pass" if grade_info["passed"] else "fail"),
            },
        }

    # ── Report Cards ──────────────────────────────────────────
    def generate_report_cards(self, exam_id: UUID, tenant_id: UUID) -> dict:
        """
        Generate/regenerate report cards for ALL students in an exam.
        Calculates grade, rank, and result for each student.
        """
        exam = self._get_exam_or_404(exam_id, tenant_id)
        if exam.status not in ("ongoing", "completed"):
            raise HTTPException(
                400, "Results must be entered before generating report cards"
            )

        # Fetch all results grouped by enrollment
        rows = self.db.execute(text("""
            SELECT
                er.enrollment_id,
                SUM(es.max_marks)  FILTER (
                    WHERE NOT er.is_absent AND NOT er.is_exempted
                )                                             AS total_max,
                SUM(er.marks_obtained) FILTER (
                    WHERE er.marks_obtained IS NOT NULL
                    AND NOT er.is_absent AND NOT er.is_exempted
                )                                             AS total_obtained,
                BOOL_OR(
                    er.marks_obtained IS NOT NULL
                    AND NOT er.is_absent
                    AND NOT er.is_exempted
                    AND er.marks_obtained < es.pass_marks
                )                                             AS any_fail,
                BOOL_OR(er.is_absent)                        AS all_absent
            FROM exam_results er
            JOIN exam_schedules es ON es.id = er.schedule_id
            WHERE er.exam_id = :exam_id
            GROUP BY er.enrollment_id
        """), {"exam_id": str(exam_id)}).fetchall()

        if not rows:
            raise HTTPException(400, "No results found for this exam")

        # Build report cards list with scores
        card_data = []
        for r in rows:
            total_max = float(r.total_max or 0)
            total_got = float(r.total_obtained or 0)
            pct       = (total_got / total_max * 100) if total_max > 0 else 0
            gi        = calculate_grade(pct)
            result    = "absent" if r.all_absent else (
                "fail" if r.any_fail else (
                    "pass" if gi["passed"] else "fail"
                )
            )
            card_data.append({
                "enrollment_id": r.enrollment_id,
                "total_marks":   total_max,
                "obtained_marks":total_got,
                "percentage":    round(pct, 2),
                "grade":         gi["grade"],
                "grade_points":  gi["grade_points"],
                "remarks":       gi["remarks"],
                "result":        result,
            })

        # Assign ranks (by percentage, desc)
        card_data.sort(key=lambda x: x["percentage"], reverse=True)
        for i, card in enumerate(card_data):
            card["rank"] = i + 1

        # Upsert report cards
        for card in card_data:
            self.db.execute(text("""
                INSERT INTO report_cards
                    (tenant_id, exam_id, enrollment_id, total_marks,
                     obtained_marks, percentage, grade, grade_points,
                     rank, result, remarks, generated_at)
                VALUES
                    (:tenant_id, :exam_id, :enrollment_id, :total_marks,
                     :obtained_marks, :percentage, :grade, :grade_points,
                     :rank, :result, :remarks, NOW())
                ON CONFLICT (exam_id, enrollment_id)
                DO UPDATE SET
                    total_marks    = EXCLUDED.total_marks,
                    obtained_marks = EXCLUDED.obtained_marks,
                    percentage     = EXCLUDED.percentage,
                    grade          = EXCLUDED.grade,
                    grade_points   = EXCLUDED.grade_points,
                    rank           = EXCLUDED.rank,
                    result         = EXCLUDED.result,
                    remarks        = EXCLUDED.remarks,
                    generated_at   = NOW()
            """), {
                "tenant_id":     str(tenant_id),
                "exam_id":       str(exam_id),
                "enrollment_id": str(card["enrollment_id"]),
                "total_marks":   card["total_marks"],
                "obtained_marks":card["obtained_marks"],
                "percentage":    card["percentage"],
                "grade":         card["grade"],
                "grade_points":  card["grade_points"],
                "rank":          card["rank"],
                "result":        card["result"],
                "remarks":       card["remarks"],
            })

        # Mark exam as completed
        self.exam_repo.update(exam, {"status": "completed"})
        self.db.commit()

        pass_count = sum(1 for c in card_data if c["result"] == "pass")
        fail_count = sum(1 for c in card_data if c["result"] == "fail")

        return {
            "message":     f"Report cards generated for {len(card_data)} students",
            "total":       len(card_data),
            "pass_count":  pass_count,
            "fail_count":  fail_count,
            "pass_pct":    round(pass_count / len(card_data) * 100, 1),
        }

    def get_report_cards(self, exam_id: UUID, tenant_id: UUID) -> List[dict]:
        """Fetch all report cards for an exam."""
        rows = self.db.execute(text("""
            SELECT
                rc.enrollment_id,
                rc.total_marks,
                rc.obtained_marks,
                rc.percentage,
                rc.grade,
                rc.grade_points,
                rc.rank,
                rc.result,
                rc.remarks,
                rc.generated_at,
                s.first_name,
                s.last_name,
                s.admission_no,
                se.roll_no,
                sec.name  AS section_name,
                g.name    AS grade_name
            FROM report_cards rc
            JOIN student_enrollments se ON se.id  = rc.enrollment_id
            JOIN students s             ON s.id   = se.student_id
            JOIN sections sec           ON sec.id = se.section_id
            JOIN grades   g             ON g.id   = sec.grade_id
            WHERE rc.exam_id   = :exam_id
              AND rc.tenant_id = :tenant_id
            ORDER BY rc.rank ASC
        """), {"exam_id": str(exam_id), "tenant_id": str(tenant_id)}).fetchall()

        return [
            {
                "enrollment_id": str(r.enrollment_id),
                "student_name":  f"{r.first_name} {r.last_name or ''}".strip(),
                "admission_no":  r.admission_no,
                "roll_no":       r.roll_no,
                "section_name":  r.section_name,
                "grade_name":    r.grade_name,
                "total_marks":   float(r.total_marks),
                "obtained_marks":float(r.obtained_marks),
                "percentage":    float(r.percentage),
                "grade":         r.grade,
                "grade_points":  float(r.grade_points),
                "rank":          r.rank,
                "result":        r.result,
                "remarks":       r.remarks,
            }
            for r in rows
        ]

    # ── Helpers ───────────────────────────────────────────────
    def _get_exam_or_404(self, exam_id: UUID, tenant_id: UUID) -> Exam:
        exam = self.db.query(Exam).filter(
            Exam.id == exam_id, Exam.tenant_id == tenant_id
        ).first()
        if not exam:
            raise HTTPException(404, "Exam not found")
        return exam

    def _get_exam_type_or_404(self, et_id: UUID, tenant_id: UUID) -> ExamType:
        et = self.db.query(ExamType).filter(
            ExamType.id == et_id, ExamType.tenant_id == tenant_id
        ).first()
        if not et:
            raise HTTPException(404, "Exam type not found")
        return et
