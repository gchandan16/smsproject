# backend/repositories/attendance_repository.py
from uuid import UUID
from datetime import date
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import text

from models.attendance import StudentAttendance, Holiday
from repositories.base import BaseRepository


class AttendanceRepository(BaseRepository[StudentAttendance]):
    def __init__(self, db: Session):
        super().__init__(StudentAttendance, db)

    # ── Single upsert ─────────────────────────────────────────
    def upsert(
        self,
        tenant_id:     UUID,
        enrollment_id: UUID,
        att_date:      date,
        status:        str,
        marked_by:     UUID,
        period_no:     Optional[int] = None,
        remarks:       Optional[str] = None,
    ) -> dict:
        self.db.execute(text("""
            INSERT INTO student_attendance
                (tenant_id, enrollment_id, date, status, period_no, remarks, marked_by)
            VALUES
                (:tenant_id, :enrollment_id, :att_date, :status, :period_no, :remarks, :marked_by)
            ON CONFLICT (enrollment_id, date, COALESCE(period_no, -1))
            DO UPDATE SET
                status    = EXCLUDED.status,
                remarks   = EXCLUDED.remarks,
                marked_by = EXCLUDED.marked_by
        """), {
            "tenant_id":     str(tenant_id),
            "enrollment_id": str(enrollment_id),
            "att_date":      att_date,
            "status":        status,
            "period_no":     period_no,
            "remarks":       remarks,
            "marked_by":     str(marked_by),
        })
        return {"enrollment_id": str(enrollment_id), "status": status}

    # ── Bulk upsert ───────────────────────────────────────────
    def bulk_upsert(
        self,
        tenant_id:  UUID,
        records:    List[dict],
        att_date:   date,
        marked_by:  UUID,
        period_no:  Optional[int] = None,
    ) -> int:
        if not records:
            return 0
        for rec in records:
            self.db.execute(text("""
                INSERT INTO student_attendance
                    (tenant_id, enrollment_id, date, status, period_no, remarks, marked_by)
                VALUES
                    (:tenant_id, :enrollment_id, :att_date, :status, :period_no, :remarks, :marked_by)
                ON CONFLICT (enrollment_id, date, COALESCE(period_no, -1))
                DO UPDATE SET
                    status    = EXCLUDED.status,
                    remarks   = EXCLUDED.remarks,
                    marked_by = EXCLUDED.marked_by
            """), {
                "tenant_id":     str(tenant_id),
                "enrollment_id": str(rec["enrollment_id"]),
                "att_date":      att_date,
                "status":        rec.get("status", "present"),
                "period_no":     period_no,
                "remarks":       rec.get("remarks"),
                "marked_by":     str(marked_by),
            })
        return len(records)

    # ── Section date attendance ───────────────────────────────
    def get_section_date_attendance(
        self,
        section_id: UUID,
        tenant_id:  UUID,
        att_date:   date,
        period_no:  Optional[int] = None,
    ) -> List[dict]:
        rows = self.db.execute(text("""
            SELECT
                se.id          AS enrollment_id,
                s.id           AS student_id,
                s.first_name,
                s.last_name,
                s.admission_no,
                s.photo_url,
                s.gender,
                se.roll_no,
                sa.id          AS attendance_id,
                sa.status,
                sa.remarks
            FROM student_enrollments se
            JOIN students s ON s.id = se.student_id
            LEFT JOIN student_attendance sa
                ON  sa.enrollment_id = se.id
                AND sa.date = :att_date
                AND COALESCE(sa.period_no, -1) = COALESCE(:period_no, -1)
            WHERE se.section_id = :section_id
              AND se.tenant_id  = :tenant_id
              AND se.status     = 'active'
              AND s.is_active   = true
            ORDER BY se.roll_no NULLS LAST, s.first_name
        """), {
            "section_id": str(section_id),
            "tenant_id":  str(tenant_id),
            "att_date":   att_date,
            "period_no":  period_no,
        }).fetchall()

        return [
            {
                "enrollment_id":  str(r.enrollment_id),
                "student_id":     str(r.student_id),
                "first_name":     r.first_name,
                "last_name":      r.last_name,
                "admission_no":   r.admission_no,
                "photo_url":      r.photo_url,
                "gender":         r.gender,
                "roll_no":        r.roll_no,
                "attendance_id":  str(r.attendance_id) if r.attendance_id else None,
                "status":         r.status,
                "remarks":        r.remarks,
            }
            for r in rows
        ]

    def check_already_marked(
        self,
        section_id: UUID,
        att_date:   date,
        period_no:  Optional[int] = None,
    ) -> bool:
        count = self.db.execute(text("""
            SELECT COUNT(sa.id)
            FROM student_attendance sa
            JOIN student_enrollments se ON se.id = sa.enrollment_id
            WHERE se.section_id = :section_id
              AND sa.date = :att_date
              AND COALESCE(sa.period_no, -1) = COALESCE(:period_no, -1)
        """), {
            "section_id": str(section_id),
            "att_date":   att_date,
            "period_no":  period_no,
        }).scalar()
        return (count or 0) > 0

    # ── Section summary — RAW SQL instead of PG function ──────
    def get_section_summary_raw(
        self,
        section_id: UUID,
        from_date:  date,
        to_date:    date,
    ) -> List[dict]:
        """
        Calculate section attendance summary using raw SQL aggregation.
        Avoids ::UUID cast syntax that breaks SQLAlchemy text().
        """
        rows = self.db.execute(text("""
            SELECT
                s.id                                                                 AS student_id,
                se.id                                                                AS enrollment_id,
                s.first_name,
                s.last_name,
                s.admission_no,
                se.roll_no,
                COUNT(sa.id)::int                                                    AS total_days,
                COUNT(sa.id) FILTER (WHERE sa.status = 'present')::int              AS present_days,
                COUNT(sa.id) FILTER (WHERE sa.status = 'absent')::int               AS absent_days,
                COUNT(sa.id) FILTER (WHERE sa.status = 'late')::int                 AS late_days,
                ROUND(
                    100.0 * COUNT(sa.id) FILTER (WHERE sa.status IN ('present','late'))
                    / NULLIF(COUNT(sa.id), 0)
                , 2)                                                                 AS percentage
            FROM student_enrollments se
            JOIN students s   ON s.id = se.student_id
            LEFT JOIN student_attendance sa
                ON  sa.enrollment_id = se.id
                AND sa.date BETWEEN :from_date AND :to_date
            WHERE se.section_id = :section_id
              AND se.status     = 'active'
            GROUP BY s.id, s.first_name, s.last_name, s.admission_no, se.id, se.roll_no
            ORDER BY se.roll_no NULLS LAST, s.first_name
        """), {
            "section_id": str(section_id),
            "from_date":  from_date,
            "to_date":    to_date,
        }).fetchall()

        return [
            {
                "student_id":    str(r.student_id),
                "enrollment_id": str(r.enrollment_id),
                "first_name":    r.first_name,
                "last_name":     r.last_name,
                "admission_no":  r.admission_no,
                "roll_no":       r.roll_no,
                "total_days":    r.total_days or 0,
                "present_days":  r.present_days or 0,
                "absent_days":   r.absent_days or 0,
                "late_days":     r.late_days or 0,
                "percentage":    float(r.percentage or 0),
            }
            for r in rows
        ]

    # ── Student summary — RAW SQL instead of PG function ──────
    def get_student_summary_raw(
        self,
        enrollment_id: UUID,
        from_date:     date,
        to_date:       date,
    ) -> dict:
        """
        Calculate single student attendance using raw SQL.
        """
        result = self.db.execute(text("""
            SELECT
                COUNT(*)::int                                                     AS total_days,
                COUNT(*) FILTER (WHERE status = 'present')::int                  AS present_days,
                COUNT(*) FILTER (WHERE status = 'absent')::int                   AS absent_days,
                COUNT(*) FILTER (WHERE status = 'late')::int                     AS late_days,
                ROUND(
                    100.0 * COUNT(*) FILTER (WHERE status IN ('present', 'late'))
                    / NULLIF(COUNT(*), 0)
                , 2)                                                              AS percentage
            FROM student_attendance
            WHERE enrollment_id = :enrollment_id
              AND date BETWEEN :from_date AND :to_date
        """), {
            "enrollment_id": str(enrollment_id),
            "from_date":     from_date,
            "to_date":       to_date,
        }).fetchone()

        if not result:
            return {"total_days": 0, "present_days": 0, "absent_days": 0, "late_days": 0, "percentage": 0.0}

        return {
            "total_days":   result.total_days   or 0,
            "present_days": result.present_days or 0,
            "absent_days":  result.absent_days  or 0,
            "late_days":    result.late_days    or 0,
            "percentage":   float(result.percentage or 0),
        }

    # ── Low attendance — RAW SQL instead of PG function ───────
    def get_low_attendance_raw(
        self,
        tenant_id:        UUID,
        academic_year_id: UUID,
        threshold:        float,
    ) -> List[dict]:
        """
        Find students below attendance threshold using raw SQL.
        """
        rows = self.db.execute(text("""
            SELECT
                s.id          AS student_id,
                se.id         AS enrollment_id,
                s.first_name,
                s.last_name,
                s.admission_no,
                sec.name      AS section_name,
                g.name        AS grade_name,
                COUNT(sa.id)::int                                                      AS total_days,
                COUNT(sa.id) FILTER (WHERE sa.status IN ('present','late'))::int       AS present_days,
                ROUND(
                    100.0 * COUNT(sa.id) FILTER (WHERE sa.status IN ('present','late'))
                    / NULLIF(COUNT(sa.id), 0)
                , 2)                                                                    AS percentage
            FROM student_enrollments se
            JOIN students s   ON s.id   = se.student_id
            JOIN sections sec ON sec.id = se.section_id
            JOIN grades   g   ON g.id   = sec.grade_id
            LEFT JOIN student_attendance sa ON sa.enrollment_id = se.id
            WHERE se.tenant_id        = :tenant_id
              AND se.academic_year_id = :academic_year_id
              AND se.status           = 'active'
            GROUP BY s.id, s.first_name, s.last_name, s.admission_no,
                     se.id, sec.name, g.name
            HAVING
                ROUND(
                    100.0 * COUNT(sa.id) FILTER (WHERE sa.status IN ('present','late'))
                    / NULLIF(COUNT(sa.id), 0)
                , 2) < :threshold
                OR COUNT(sa.id) = 0
            ORDER BY percentage ASC NULLS FIRST
        """), {
            "tenant_id":        str(tenant_id),
            "academic_year_id": str(academic_year_id),
            "threshold":        threshold,
        }).fetchall()

        return [
            {
                "student_id":    str(r.student_id),
                "enrollment_id": str(r.enrollment_id),
                "first_name":    r.first_name,
                "last_name":     r.last_name,
                "admission_no":  r.admission_no,
                "section_name":  r.section_name,
                "grade_name":    r.grade_name,
                "total_days":    r.total_days   or 0,
                "present_days":  r.present_days or 0,
                "percentage":    float(r.percentage or 0),
            }
            for r in rows
        ]

    # ── Monthly attendance ────────────────────────────────────
    def get_monthly_raw(
        self,
        enrollment_id: UUID,
        year:          int,
        month:         int,
    ) -> List[dict]:
        rows = self.db.execute(text("""
            SELECT
                date,
                status,
                EXTRACT(DOW FROM date)::int AS day_of_week
            FROM student_attendance
            WHERE enrollment_id = :enrollment_id
              AND EXTRACT(YEAR  FROM date) = :year
              AND EXTRACT(MONTH FROM date) = :month
            ORDER BY date
        """), {
            "enrollment_id": str(enrollment_id),
            "year":          year,
            "month":         month,
        }).fetchall()

        return [
            {
                "date":        str(r.date),
                "status":      r.status,
                "day_of_week": r.day_of_week,
            }
            for r in rows
        ]


class HolidayRepository(BaseRepository[Holiday]):
    def __init__(self, db: Session):
        super().__init__(Holiday, db)

    def get_holidays_in_range(
        self,
        tenant_id:  UUID,
        from_date:  date,
        to_date:    date,
    ) -> List[Holiday]:
        return (
            self.db.query(Holiday)
            .filter(
                Holiday.tenant_id == tenant_id,
                Holiday.date.between(from_date, to_date),
            )
            .order_by(Holiday.date)
            .all()
        )

    def is_holiday(self, tenant_id: UUID, check_date: date) -> bool:
        return (
            self.db.query(Holiday)
            .filter(
                Holiday.tenant_id == tenant_id,
                Holiday.date      == check_date,
            )
            .first()
        ) is not None
