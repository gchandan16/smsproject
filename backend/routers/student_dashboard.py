# backend/routers/student_dashboard.py
# ─────────────────────────────────────────────────────────────
# Personalized dashboard for student & parent roles.
# Registered at /api/my
# ─────────────────────────────────────────────────────────────
from uuid import UUID
from datetime import date, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text

from database import get_db
from routers.auth import get_current_user
from models.user import User

router = APIRouter()

DAY_NAMES = {1:"Monday",2:"Tuesday",3:"Wednesday",4:"Thursday",5:"Friday",6:"Saturday",7:"Sunday"}


def _resolve_student(db: Session, cu: User) -> dict:
    """
    Resolve the student record for the logged-in user.
    - If the user IS a student (students.user_id = user.id), use that.
    - If the user is a parent/guardian (guardians.user_id = user.id),
      return their linked student(s) — first one by default,
      with a list of all linked students for switching.
    """
    # Try direct student link first
    row = db.execute(text("""
        SELECT s.id, s.first_name, s.last_name, s.admission_no, s.photo_url,
               s.dob, s.gender, s.blood_group
        FROM students s
        WHERE s.user_id = :uid AND s.tenant_id = :tid
        LIMIT 1
    """), {"uid": str(cu.id), "tid": str(cu.tenant_id)}).fetchone()

    if row:
        return {"student": row, "is_parent": False, "linked_students": None}

    # Try guardian link
    linked = db.execute(text("""
        SELECT s.id, s.first_name, s.last_name, s.admission_no, s.photo_url,
               s.dob, s.gender, s.blood_group
        FROM guardians gu
        JOIN students s ON s.id = gu.student_id
        WHERE gu.user_id = :uid AND gu.tenant_id = :tid
        ORDER BY s.first_name
    """), {"uid": str(cu.id), "tid": str(cu.tenant_id)}).fetchall()

    if linked:
        return {"student": linked[0], "is_parent": True, "linked_students": linked}

    return {"student": None, "is_parent": False, "linked_students": None}


def _get_current_year(db: Session, cu: User):
    return db.execute(text("""
        SELECT id, label, start_date, end_date FROM academic_years
        WHERE tenant_id=:tid AND is_current=true LIMIT 1
    """), {"tid": str(cu.tenant_id)}).fetchone()


def _get_enrollment(db: Session, cu: User, student_id: UUID, year_id):
    return db.execute(text("""
        SELECT se.id AS enrollment_id, se.roll_no, se.section_id,
               sec.name AS section_name, g.name AS grade_name, g.id AS grade_id
        FROM student_enrollments se
        JOIN sections sec ON sec.id = se.section_id
        JOIN grades g     ON g.id   = sec.grade_id
        WHERE se.student_id=:sid AND se.tenant_id=:tid
          AND se.academic_year_id=:yr AND se.status='active'
        LIMIT 1
    """), {"sid": str(student_id), "tid": str(cu.tenant_id), "yr": str(year_id) if year_id else None}).fetchone()


# ═══════════════════════════════════════════════════════════════
#  MAIN DASHBOARD SUMMARY
# ═══════════════════════════════════════════════════════════════
@router.get("/dashboard")
def my_dashboard(
    student_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
    cu: User    = Depends(get_current_user),
):
    resolved = _resolve_student(db, cu)
    if not resolved["student"]:
        raise HTTPException(404, "No student profile linked to this account. Please contact the school office.")

    # If parent has multiple children and requested a specific one
    student = resolved["student"]
    if resolved["is_parent"] and student_id:
        match = next((s for s in resolved["linked_students"] if str(s.id) == str(student_id)), None)
        if match:
            student = match

    year = _get_current_year(db, cu)
    enrollment = _get_enrollment(db, cu, student.id, year.id if year else None)

    # ── Attendance summary (current month) ──
    today = date.today()
    month_start = today.replace(day=1)
    att = None
    if enrollment:
        att = db.execute(text("""
            SELECT
                COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE status='present')::int AS present,
                COUNT(*) FILTER (WHERE status='absent')::int  AS absent,
                COUNT(*) FILTER (WHERE status='late')::int    AS late
            FROM student_attendance
            WHERE enrollment_id=:eid AND date BETWEEN :start AND :end
        """), {"eid": str(enrollment.enrollment_id), "start": month_start, "end": today}).fetchone()

    attendance_pct = None
    if att and att.total > 0:
        attendance_pct = round(((att.present + att.late) / att.total) * 100, 1)

    # ── Fee summary: next due invoice ──
    next_due = db.execute(text("""
        SELECT invoice_no, due_date, total_amount, paid_amount, balance, status
        FROM fee_invoices
        WHERE student_id=:sid AND tenant_id=:tid AND status NOT IN ('paid','cancelled')
        ORDER BY due_date ASC
        LIMIT 1
    """), {"sid": str(student.id), "tid": str(cu.tenant_id)}).fetchone()

    total_outstanding = db.execute(text("""
        SELECT COALESCE(SUM(balance),0)::float FROM fee_invoices
        WHERE student_id=:sid AND tenant_id=:tid AND status NOT IN ('paid','cancelled')
    """), {"sid": str(student.id), "tid": str(cu.tenant_id)}).scalar() or 0

    # ── Transport info ──
    transport = db.execute(text("""
        SELECT tr.name AS route_name, tr.route_no, ts.name AS stop_name,
               ts.pickup_time, ts.drop_time, v.vehicle_no, v.driver_name, v.driver_phone
        FROM student_transport st
        JOIN transport_routes tr ON tr.id = st.route_id
        LEFT JOIN transport_stops ts ON ts.id = st.stop_id
        LEFT JOIN transport_vehicles v ON v.id = st.vehicle_id
        WHERE st.student_id=:sid AND st.tenant_id=:tid AND st.is_active=true
        LIMIT 1
    """), {"sid": str(student.id), "tid": str(cu.tenant_id)}).fetchone()

    # ── Today's timetable ──
    today_dow = today.isoweekday()  # 1=Mon..7=Sun
    today_classes = []
    if enrollment:
        rows = db.execute(text("""
            SELECT tp.period_no, tp.name AS period_name, tp.start_time, tp.end_time,
                   sub.name AS subject_name, te.teacher_name, te.room_no, tp.is_break
            FROM timetable_entries te
            JOIN timetable_periods tp ON tp.id = te.period_id
            LEFT JOIN subjects sub ON sub.id = te.subject_id
            WHERE te.section_id=:sec AND te.day_of_week=:dow
              AND te.academic_year_id=:yr
            ORDER BY tp.period_no
        """), {
            "sec": str(enrollment.section_id), "dow": today_dow,
            "yr": str(year.id) if year else None,
        }).fetchall()
        today_classes = [
            {
                "period_no":  r.period_no,
                "period_name":r.period_name,
                "time": f"{str(r.start_time)[:5]} - {str(r.end_time)[:5]}",
                "subject": r.subject_name or ("Break" if r.is_break else "—"),
                "teacher": r.teacher_name,
                "room": r.room_no,
                "is_break": r.is_break,
            }
            for r in rows
        ]

    # ── Library books currently held ──
    library_books = db.execute(text("""
        SELECT lb.title, li.due_date,
               (li.due_date < CURRENT_DATE) AS is_overdue
        FROM library_issues li
        JOIN library_books lb ON lb.id = li.book_id
        JOIN library_members lm ON lm.id = li.member_id
        WHERE lm.student_id=:sid AND lm.tenant_id=:tid AND li.status='issued'
        ORDER BY li.due_date
    """), {"sid": str(student.id), "tid": str(cu.tenant_id)}).fetchall()

    return {
        "student": {
            "id":           str(student.id),
            "name":         f"{student.first_name} {student.last_name or ''}".strip(),
            "admission_no": student.admission_no,
            "photo_url":    student.photo_url,
            "blood_group":  student.blood_group,
            "class":        f"{enrollment.grade_name} - {enrollment.section_name}" if enrollment else "—",
            "roll_no":      enrollment.roll_no if enrollment else None,
        },
        "is_parent": resolved["is_parent"],
        "linked_students": (
            [{"id": str(s.id), "name": f"{s.first_name} {s.last_name or ''}".strip(), "admission_no": s.admission_no}
             for s in resolved["linked_students"]]
            if resolved["is_parent"] else None
        ),
        "academic_year": year.label if year else None,
        "attendance": {
            "month_pct": attendance_pct,
            "present":   att.present if att else 0,
            "absent":    att.absent  if att else 0,
            "late":      att.late    if att else 0,
            "total":     att.total   if att else 0,
        },
        "fees": {
            "next_due": (
                {
                    "invoice_no": next_due.invoice_no,
                    "due_date":   str(next_due.due_date),
                    "amount":     float(next_due.balance),
                    "total":      float(next_due.total_amount),
                    "status":     next_due.status,
                    "days_until_due": (next_due.due_date - today).days,
                }
                if next_due else None
            ),
            "total_outstanding": float(total_outstanding),
        },
        "transport": (
            {
                "route": f"{transport.route_no or ''} {transport.route_name or ''}".strip(),
                "stop":  transport.stop_name,
                "pickup_time": str(transport.pickup_time)[:5] if transport.pickup_time else None,
                "drop_time":   str(transport.drop_time)[:5]   if transport.drop_time   else None,
                "vehicle_no":  transport.vehicle_no,
                "driver_name": transport.driver_name,
                "driver_phone":transport.driver_phone,
            }
            if transport else None
        ),
        "today": {
            "day_name": DAY_NAMES.get(today_dow, ""),
            "date":     str(today),
            "classes":  today_classes,
        },
        "library_books": [
            {"title": b.title, "due_date": str(b.due_date), "is_overdue": b.is_overdue}
            for b in library_books
        ],
    }


# ═══════════════════════════════════════════════════════════════
#  WEEKLY TIMETABLE
# ═══════════════════════════════════════════════════════════════
@router.get("/timetable")
def my_timetable(
    student_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
    cu: User    = Depends(get_current_user),
):
    resolved = _resolve_student(db, cu)
    if not resolved["student"]:
        raise HTTPException(404, "No student profile linked to this account.")

    student = resolved["student"]
    if resolved["is_parent"] and student_id:
        match = next((s for s in resolved["linked_students"] if str(s.id) == str(student_id)), None)
        if match:
            student = match

    year = _get_current_year(db, cu)
    enrollment = _get_enrollment(db, cu, student.id, year.id if year else None)
    if not enrollment:
        return {"periods": [], "entries": [], "class": None}

    periods = db.execute(text("""
        SELECT id, name, period_no, start_time, end_time, is_break
        FROM timetable_periods WHERE tenant_id=:tid ORDER BY period_no
    """), {"tid": str(cu.tenant_id)}).fetchall()

    entries = db.execute(text("""
        SELECT te.day_of_week, tp.period_no, sub.name AS subject_name,
               te.teacher_name, te.room_no
        FROM timetable_entries te
        JOIN timetable_periods tp ON tp.id = te.period_id
        LEFT JOIN subjects sub ON sub.id = te.subject_id
        WHERE te.section_id=:sec AND te.academic_year_id=:yr
    """), {"sec": str(enrollment.section_id), "yr": str(year.id) if year else None}).fetchall()

    return {
        "class": f"{enrollment.grade_name} - {enrollment.section_name}",
        "periods": [
            {
                "period_no": p.period_no, "name": p.name,
                "time": f"{str(p.start_time)[:5]} - {str(p.end_time)[:5]}",
                "is_break": p.is_break,
            }
            for p in periods
        ],
        "entries": [
            {
                "day": e.day_of_week, "period_no": e.period_no,
                "subject": e.subject_name, "teacher": e.teacher_name, "room": e.room_no,
            }
            for e in entries
        ],
    }


# ═══════════════════════════════════════════════════════════════
#  FEE HISTORY — all invoices for the student
# ═══════════════════════════════════════════════════════════════
@router.get("/fees")
def my_fees(
    student_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
    cu: User    = Depends(get_current_user),
):
    resolved = _resolve_student(db, cu)
    if not resolved["student"]:
        raise HTTPException(404, "No student profile linked to this account.")

    student = resolved["student"]
    if resolved["is_parent"] and student_id:
        match = next((s for s in resolved["linked_students"] if str(s.id) == str(student_id)), None)
        if match:
            student = match

    invoices = db.execute(text("""
        SELECT id, invoice_no, issue_date, due_date, total_amount, paid_amount, balance, status
        FROM fee_invoices
        WHERE student_id=:sid AND tenant_id=:tid
        ORDER BY issue_date DESC
    """), {"sid": str(student.id), "tid": str(cu.tenant_id)}).fetchall()

    result = []
    for inv in invoices:
        items = db.execute(text("""
            SELECT fii.description, fii.amount, fc.name AS category
            FROM fee_invoice_items fii
            LEFT JOIN fee_categories fc ON fc.id = fii.fee_category_id
            WHERE fii.invoice_id=:iid
        """), {"iid": str(inv.id)}).fetchall()

        result.append({
            "id": str(inv.id),
            "invoice_no": inv.invoice_no,
            "issue_date": str(inv.issue_date),
            "due_date":   str(inv.due_date),
            "total":      float(inv.total_amount),
            "paid":       float(inv.paid_amount),
            "balance":    float(inv.balance),
            "status":     inv.status,
            "items": [
                {"description": i.description, "category": i.category or "General", "amount": float(i.amount)}
                for i in items
            ],
        })

    return {"invoices": result}
