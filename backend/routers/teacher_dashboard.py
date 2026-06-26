# backend/routers/teacher_dashboard.py
"""
Teacher's personal dashboard — shows only what a teacher needs:
  - Today's classes (from timetable_entries matched to their name)
  - Total classes/sections they teach
  - Quick attendance shortcut for today's classes
  - Their full weekly timetable

NOTE ON DATA MODEL: timetable_entries.teacher_name is a free-text column
(not a foreign key to teachers.id) in the current schema. We match it
against the teacher's name from the teachers table. This means exact
name matching is required — if a teacher's name in Settings → Teachers
doesn't exactly match what's typed into the timetable grid, their classes
won't show up here. See the 'name_mismatch_warning' field in the response.
"""
import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text, bindparam
from typing import Optional
from uuid import UUID
from datetime import date

from database import get_db
from models.user import User
from routers.auth import get_current_user

router = APIRouter()
logger = logging.getLogger(__name__)

DAY_NAMES = {1: "Monday", 2: "Tuesday", 3: "Wednesday", 4: "Thursday",
             5: "Friday", 6: "Saturday", 7: "Sunday"}


def _resolve_teacher(db: Session, cu: User):
    """Find the teacher record linked to this logged-in user."""
    teacher = db.execute(text("""
        SELECT id, name, email, phone, employee_no, department, designation
        FROM teachers
        WHERE user_id = :uid AND tenant_id = :tid AND is_active = true
    """), {"uid": str(cu.id), "tid": str(cu.tenant_id)}).fetchone()
    return teacher


@router.get("/dashboard")
def teacher_dashboard(
    db: Session = Depends(get_db),
    cu: User    = Depends(get_current_user),
):
    teacher = _resolve_teacher(db, cu)
    if not teacher:
        raise HTTPException(
            404,
            "No teacher profile linked to this account. "
            "Ask your administrator to link your account in Settings → User Management, "
            "or check that a Teacher record exists for you in Settings → Teachers."
        )

    # Get current academic year
    year = db.execute(text("""
        SELECT id, label FROM academic_years
        WHERE tenant_id = :tid AND is_current = true LIMIT 1
    """), {"tid": str(cu.tenant_id)}).fetchone()

    today = date.today()
    day_of_week = today.isoweekday()  # 1=Mon..7=Sun

    name_mismatch_warning = None
    today_classes = []
    all_sections  = []

    if year:
        try:
            # Today's classes — match by teacher_name (free text field)
            today_classes = db.execute(text("""
                SELECT
                    tp.period_no, tp.name AS period_name,
                    tp.start_time, tp.end_time,
                    te.room_no,
                    sub.name AS subject_name,
                    g.name AS grade_name, sec.name AS section_name,
                    sec.id AS section_id
                FROM timetable_entries te
                JOIN timetable_periods tp ON tp.id = te.period_id
                JOIN sections sec ON sec.id = te.section_id
                JOIN grades g     ON g.id   = sec.grade_id
                LEFT JOIN subjects sub ON sub.id = te.subject_id
                WHERE te.tenant_id = :tid
                  AND te.academic_year_id = :yr
                  AND te.day_of_week = :dow
                  AND LOWER(TRIM(te.teacher_name)) = LOWER(TRIM(:tname))
                ORDER BY tp.period_no
            """), {
                "tid": str(cu.tenant_id), "yr": str(year.id),
                "dow": day_of_week, "tname": teacher.name or "",
            }).fetchall()
        except Exception:
            logger.exception("teacher_dashboard: today_classes query failed")
            raise HTTPException(500, "Failed to load today's classes — check server logs for details.")

        try:
            # Total distinct sections this teacher teaches (any day)
            all_sections = db.execute(text("""
                SELECT DISTINCT sec.id, g.name AS grade_name, sec.name AS section_name
                FROM timetable_entries te
                JOIN sections sec ON sec.id = te.section_id
                JOIN grades g     ON g.id   = sec.grade_id
                WHERE te.tenant_id = :tid
                  AND te.academic_year_id = :yr
                  AND LOWER(TRIM(te.teacher_name)) = LOWER(TRIM(:tname))
            """), {"tid": str(cu.tenant_id), "yr": str(year.id), "tname": teacher.name or ""}).fetchall()
        except Exception:
            logger.exception("teacher_dashboard: all_sections query failed")
            raise HTTPException(500, "Failed to load your sections — check server logs for details.")

        # Sanity check: does ANY timetable entry exist with a similar but
        # not-exact-matching name? Helps admins fix data entry mismatches.
        if not today_classes and not all_sections and teacher.name:
            try:
                first_token = teacher.name.split()[0] if teacher.name.split() else teacher.name
                similar = db.execute(text("""
                    SELECT DISTINCT teacher_name FROM timetable_entries
                    WHERE tenant_id = :tid AND academic_year_id = :yr
                      AND teacher_name IS NOT NULL
                      AND (
                        teacher_name ILIKE :partial
                        OR :tname ILIKE '%' || SPLIT_PART(teacher_name, ' ', 1) || '%'
                      )
                    LIMIT 3
                """), {
                    "tid": str(cu.tenant_id), "yr": str(year.id),
                    "partial": f"%{first_token}%",
                    "tname": teacher.name,
                }).fetchall()
                if similar:
                    name_mismatch_warning = (
                        f"No timetable entries found for '{teacher.name}', but similar names exist: "
                        f"{', '.join(r.teacher_name for r in similar)}. "
                        f"Ask your admin to check the Timetable for spelling consistency."
                    )
            except Exception:
                # Non-critical — log but don't fail the whole dashboard over a hint message
                logger.exception("teacher_dashboard: name_mismatch_warning query failed (non-fatal)")
                name_mismatch_warning = None

    # Total students across all sections this teacher teaches
    total_students = 0
    if all_sections:
        try:
            section_ids = [str(s.id) for s in all_sections]
            # IMPORTANT: ANY(:sids) with a plain list parameter fails in
            # SQLAlchemy — must use bindparam(expanding=True) with IN instead.
            stmt = text("""
                SELECT COUNT(*) AS cnt FROM student_enrollments
                WHERE section_id IN :sids AND status = 'active'
            """).bindparams(bindparam("sids", expanding=True))
            cnt = db.execute(stmt, {"sids": tuple(section_ids)}).fetchone()
            total_students = cnt.cnt if cnt else 0
        except Exception:
            logger.exception("teacher_dashboard: total_students query failed")
            raise HTTPException(500, "Failed to count students — check server logs for details.")

    # Has this teacher already marked attendance today for their classes?
    attendance_marked_sections = set()
    if today_classes:
        try:
            section_ids_today = list({c.section_id for c in today_classes})
            stmt = text("""
                SELECT DISTINCT se.section_id
                FROM student_attendance sa
                JOIN student_enrollments se ON se.id = sa.enrollment_id
                WHERE sa.date = :today AND se.section_id IN :sids
            """).bindparams(bindparam("sids", expanding=True))
            marked = db.execute(stmt, {
                "today": today,
                "sids": tuple(str(s) for s in section_ids_today),
            }).fetchall()
            attendance_marked_sections = {str(r.section_id) for r in marked}
        except Exception:
            logger.exception("teacher_dashboard: attendance_marked query failed")
            raise HTTPException(500, "Failed to check attendance status — check server logs for details.")

    return {
        "teacher": {
            "id":          str(teacher.id),
            "name":        teacher.name,
            "employee_no": teacher.employee_no,
            "department":  teacher.department,
            "designation": teacher.designation,
        },
        "academic_year": {"id": str(year.id) if year else None, "label": year.label if year else None},
        "today": {
            "day_name": DAY_NAMES.get(day_of_week, ""),
            "date":     str(today),
            "classes": [
                {
                    "period_no":    c.period_no,
                    "period_name":  c.period_name,
                    "start_time":   str(c.start_time),
                    "end_time":     str(c.end_time),
                    "subject":      c.subject_name or "—",
                    "class":        f"{c.grade_name} - {c.section_name}",
                    "section_id":   str(c.section_id),
                    "room":         c.room_no or "—",
                    "attendance_marked": str(c.section_id) in attendance_marked_sections,
                }
                for c in today_classes
            ],
        },
        "summary": {
            "total_classes_today": len(today_classes),
            "total_sections":      len(all_sections),
            "total_students":      total_students,
        },
        "sections": [
            {"id": str(s.id), "class": f"{s.grade_name} - {s.section_name}"}
            for s in all_sections
        ],
        "name_mismatch_warning": name_mismatch_warning,
    }


@router.get("/timetable")
def teacher_timetable(
    db: Session = Depends(get_db),
    cu: User    = Depends(get_current_user),
):
    """Full weekly timetable for the logged-in teacher, across all their sections."""
    teacher = _resolve_teacher(db, cu)
    if not teacher:
        raise HTTPException(404, "No teacher profile linked to this account.")

    year = db.execute(text("""
        SELECT id, label FROM academic_years
        WHERE tenant_id = :tid AND is_current = true LIMIT 1
    """), {"tid": str(cu.tenant_id)}).fetchone()

    if not year:
        return {"teacher": teacher.name, "periods": [], "entries": []}

    periods = db.execute(text("""
        SELECT id, name, period_no, start_time, end_time, is_break
        FROM timetable_periods
        WHERE tenant_id = :tid ORDER BY period_no
    """), {"tid": str(cu.tenant_id)}).fetchall()

    entries = db.execute(text("""
        SELECT te.day_of_week, tp.period_no, te.room_no,
               sub.name AS subject_name,
               g.name AS grade_name, sec.name AS section_name
        FROM timetable_entries te
        JOIN timetable_periods tp ON tp.id = te.period_id
        JOIN sections sec ON sec.id = te.section_id
        JOIN grades g     ON g.id   = sec.grade_id
        LEFT JOIN subjects sub ON sub.id = te.subject_id
        WHERE te.tenant_id = :tid AND te.academic_year_id = :yr
          AND LOWER(TRIM(te.teacher_name)) = LOWER(TRIM(:tname))
    """), {"tid": str(cu.tenant_id), "yr": str(year.id), "tname": teacher.name or ""}).fetchall()

    return {
        "teacher": teacher.name,
        "academic_year": year.label,
        "periods": [
            {
                "id": str(p.id), "name": p.name, "period_no": p.period_no,
                "start_time": str(p.start_time), "end_time": str(p.end_time),
                "is_break": p.is_break,
            }
            for p in periods
        ],
        "entries": [
            {
                "day_of_week": e.day_of_week,
                "period_no":   e.period_no,
                "subject":     e.subject_name or "—",
                "class":       f"{e.grade_name} - {e.section_name}",
                "room":        e.room_no or "—",
            }
            for e in entries
        ],
    }
