# backend/repositories/exam_repository.py
from uuid import UUID
from typing import List, Optional
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import text

from repositories.base import BaseRepository
from models.exam import ExamType, Exam, ExamSchedule, ExamResult, ReportCard


class ExamTypeRepository(BaseRepository[ExamType]):
    def __init__(self, db: Session):
        super().__init__(ExamType, db)

    def get_all(self, tenant_id: UUID) -> List[ExamType]:
        return (
            self.db.query(ExamType)
            .filter(ExamType.tenant_id == tenant_id)
            .order_by(ExamType.name)
            .all()
        )


class ExamRepository(BaseRepository[Exam]):
    def __init__(self, db: Session):
        super().__init__(Exam, db)

    def get_full(self, exam_id: UUID, tenant_id: UUID) -> Optional[Exam]:
        return (
            self.db.query(Exam)
            .options(
                joinedload(Exam.exam_type),
                joinedload(Exam.schedules).joinedload(ExamSchedule.subject),
            )
            .filter(Exam.id == exam_id, Exam.tenant_id == tenant_id)
            .first()
        )

    def list_exams(
        self,
        tenant_id:        UUID,
        academic_year_id: Optional[UUID] = None,
        grade_id:         Optional[UUID] = None,
        status:           Optional[str]  = None,
    ) -> List[Exam]:
        q = (
            self.db.query(Exam)
            .options(joinedload(Exam.exam_type))
            .filter(Exam.tenant_id == tenant_id)
        )
        if academic_year_id: q = q.filter(Exam.academic_year_id == academic_year_id)
        if grade_id:         q = q.filter(Exam.grade_id == grade_id)
        if status:           q = q.filter(Exam.status == status)
        return q.order_by(Exam.start_date.desc()).all()

    def get_results_for_exam(self, exam_id: UUID) -> List[dict]:
        """Get all results for an exam with student info."""
        rows = self.db.execute(text("""
            SELECT
                er.id            AS result_id,
                er.schedule_id,
                er.enrollment_id,
                er.marks_obtained,
                er.is_absent,
                er.is_exempted,
                er.remarks,
                es.max_marks,
                es.pass_marks,
                subj.name        AS subject_name,
                subj.code        AS subject_code,
                s.first_name,
                s.last_name,
                s.admission_no,
                se.roll_no
            FROM exam_results er
            JOIN exam_schedules es  ON es.id  = er.schedule_id
            JOIN subjects subj      ON subj.id = es.subject_id
            JOIN student_enrollments se ON se.id = er.enrollment_id
            JOIN students s         ON s.id  = se.student_id
            WHERE er.exam_id = :exam_id
            ORDER BY se.roll_no NULLS LAST, s.first_name, subj.name
        """), {"exam_id": str(exam_id)}).fetchall()

        return [
            {
                "result_id":     str(r.result_id),
                "schedule_id":   str(r.schedule_id),
                "enrollment_id": str(r.enrollment_id),
                "marks_obtained":float(r.marks_obtained) if r.marks_obtained is not None else None,
                "is_absent":     r.is_absent,
                "is_exempted":   r.is_exempted,
                "remarks":       r.remarks,
                "max_marks":     float(r.max_marks),
                "pass_marks":    float(r.pass_marks),
                "subject_name":  r.subject_name,
                "subject_code":  r.subject_code,
                "first_name":    r.first_name,
                "last_name":     r.last_name,
                "admission_no":  r.admission_no,
                "roll_no":       r.roll_no,
            }
            for r in rows
        ]

    def get_schedule_students(self, schedule_id: UUID, exam_id: UUID) -> List[dict]:
        """Get all enrolled students for a schedule (subject)."""
        rows = self.db.execute(text("""
            SELECT
                se.id            AS enrollment_id,
                s.id             AS student_id,
                s.first_name,
                s.last_name,
                s.admission_no,
                se.roll_no,
                er.id            AS result_id,
                er.marks_obtained,
                er.is_absent,
                er.is_exempted,
                er.remarks
            FROM student_enrollments se
            JOIN students s    ON s.id = se.student_id
            -- join to exam's grade/year via the exam schedule
            JOIN exam_schedules es ON es.id = :schedule_id
            JOIN exams ex       ON ex.id = es.exam_id
            LEFT JOIN exam_results er
                ON  er.enrollment_id = se.id
                AND er.schedule_id   = :schedule_id
            WHERE se.section_id IN (
                SELECT id FROM sections
                WHERE grade_id         = ex.grade_id
                  AND academic_year_id = ex.academic_year_id
            )
              AND se.status  = 'active'
              AND s.is_active = true
            ORDER BY se.roll_no NULLS LAST, s.first_name
        """), {"schedule_id": str(schedule_id)}).fetchall()

        return [
            {
                "enrollment_id":  str(r.enrollment_id),
                "student_id":     str(r.student_id),
                "first_name":     r.first_name,
                "last_name":      r.last_name,
                "admission_no":   r.admission_no,
                "roll_no":        r.roll_no,
                "result_id":      str(r.result_id) if r.result_id else None,
                "marks_obtained": float(r.marks_obtained) if r.marks_obtained is not None else None,
                "is_absent":      r.is_absent  or False,
                "is_exempted":    r.is_exempted or False,
                "remarks":        r.remarks,
            }
            for r in rows
        ]


class ExamResultRepository(BaseRepository[ExamResult]):
    def __init__(self, db: Session):
        super().__init__(ExamResult, db)

    def upsert_result(
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
    ) -> None:
        """
        Upsert a single result using ON CONFLICT.
        Unique constraint: (exam_id, schedule_id, enrollment_id)
        """
        self.db.execute(text("""
            INSERT INTO exam_results
                (tenant_id, exam_id, schedule_id, enrollment_id,
                 marks_obtained, is_absent, is_exempted, remarks, entered_by)
            VALUES
                (:tenant_id, :exam_id, :schedule_id, :enrollment_id,
                 :marks_obtained, :is_absent, :is_exempted, :remarks, :entered_by)
            ON CONFLICT (exam_id, schedule_id, enrollment_id)
            DO UPDATE SET
                marks_obtained = EXCLUDED.marks_obtained,
                is_absent      = EXCLUDED.is_absent,
                is_exempted    = EXCLUDED.is_exempted,
                remarks        = EXCLUDED.remarks,
                entered_by     = EXCLUDED.entered_by,
                updated_at     = NOW()
        """), {
            "tenant_id":     str(tenant_id),
            "exam_id":       str(exam_id),
            "schedule_id":   str(schedule_id),
            "enrollment_id": str(enrollment_id),
            "marks_obtained":marks_obtained,
            "is_absent":     is_absent,
            "is_exempted":   is_exempted,
            "remarks":       remarks,
            "entered_by":    str(entered_by),
        })

    def bulk_upsert(
        self,
        tenant_id:   UUID,
        exam_id:     UUID,
        schedule_id: UUID,
        records:     List[dict],
        entered_by:  UUID,
    ) -> int:
        """
        Bulk upsert results for all students in one subject.
        records = [{ enrollment_id, marks_obtained, is_absent, is_exempted, remarks }]
        """
        for rec in records:
            marks = rec.get("marks_obtained")
            if marks is not None:
                marks = float(marks)
            self.upsert_result(
                tenant_id     = tenant_id,
                exam_id       = exam_id,
                schedule_id   = schedule_id,
                enrollment_id = UUID(str(rec["enrollment_id"])),
                marks_obtained= marks,
                is_absent     = bool(rec.get("is_absent",   False)),
                is_exempted   = bool(rec.get("is_exempted", False)),
                entered_by    = entered_by,
                remarks       = rec.get("remarks"),
            )
        return len(records)

    def get_student_results(self, enrollment_id: UUID, exam_id: UUID) -> List[dict]:
        rows = self.db.execute(text("""
            SELECT
                er.id,
                er.marks_obtained,
                er.is_absent,
                er.is_exempted,
                er.remarks,
                es.max_marks,
                es.pass_marks,
                es.exam_date,
                subj.name  AS subject_name,
                subj.code  AS subject_code
            FROM exam_results er
            JOIN exam_schedules es ON es.id   = er.schedule_id
            JOIN subjects subj     ON subj.id = es.subject_id
            WHERE er.enrollment_id = :enrollment_id
              AND er.exam_id       = :exam_id
            ORDER BY subj.name
        """), {
            "enrollment_id": str(enrollment_id),
            "exam_id":       str(exam_id),
        }).fetchall()

        return [
            {
                "result_id":     str(r.id),
                "subject_name":  r.subject_name,
                "subject_code":  r.subject_code,
                "marks_obtained":float(r.marks_obtained) if r.marks_obtained is not None else None,
                "max_marks":     float(r.max_marks),
                "pass_marks":    float(r.pass_marks),
                "is_absent":     r.is_absent,
                "is_exempted":   r.is_exempted,
                "remarks":       r.remarks,
                "exam_date":     str(r.exam_date),
            }
            for r in rows
        ]
