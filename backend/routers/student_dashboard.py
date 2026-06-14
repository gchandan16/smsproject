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

    # Try guardian link — look for guardians where user_id matches this user.
    # Note: we JOIN on student_id only (not tenant_id) to avoid silent failures
    # if there's a tenant_id mismatch on the guardian row.
    linked = db.execute(text("""
        SELECT s.id, s.first_name, s.last_name, s.admission_no, s.photo_url,
               s.dob, s.gender, s.blood_group
        FROM guardians gu
        JOIN students s ON s.id = gu.student_id
        WHERE gu.user_id  = :uid
          AND gu.tenant_id = :tid
        ORDER BY s.first_name
    """), {"uid": str(cu.id), "tid": str(cu.tenant_id)}).fetchall()

    if linked:
        return {"student": linked[0], "is_parent": True, "linked_students": linked}

    # ── Nothing found — gather diagnostic info for the error message ──
    # Check if a guardian record exists for this tenant but user_id is NULL
    unlinked_guardian = db.execute(text("""
        SELECT gu.id, gu.first_name, gu.last_name, gu.relation,
               s.first_name AS student_first, s.last_name AS student_last,
               s.admission_no
        FROM guardians gu
        JOIN students s ON s.id = gu.student_id
        WHERE gu.tenant_id = :tid
          AND gu.user_id IS NULL
          AND (
            LOWER(gu.first_name) LIKE LOWER(SPLIT_PART(:email, '@', 1) || '%')
            OR gu.email = :email
          )
        LIMIT 1
    """), {"tid": str(cu.tenant_id), "email": cu.email}).fetchone()

    hint = ""
    if unlinked_guardian:
        hint = (
            f" A guardian record exists for "
            f"{unlinked_guardian.first_name} {unlinked_guardian.last_name or ''} "
            f"({unlinked_guardian.relation} of {unlinked_guardian.student_first} "
            f"{unlinked_guardian.student_last or ''} — {unlinked_guardian.admission_no}) "
            f"but it is not linked to your login. Ask the school admin to link your account "
            f"in Settings → User Management."
        )

    return {"student": None, "is_parent": False, "linked_students": None, "hint": hint}


def _get_current_year(db: Session, cu: User):
    return db.execute(text("""
        SELECT id, label, start_date, end_date FROM academic_years
        WHERE tenant_id=:tid AND is_current=true LIMIT 1
    """), {"tid": str(cu.tenant_id)}).fetchone()


def _get_enrollment(db: Session, cu: User, student_id: UUID, year_id):
    return db.execute(text("""
        SELECT se.id AS enrollment_id, se.roll_no, se.section_id,
               sec.name AS section_name, g.name AS grade_name, g.id AS grade_id,
               se.status
        FROM student_enrollments se
        JOIN sections sec ON sec.id = se.section_id
        JOIN grades g     ON g.id   = sec.grade_id
        WHERE se.student_id = :sid AND se.tenant_id = :tid
          AND se.academic_year_id = :yr
        ORDER BY
            CASE se.status WHEN 'active' THEN 0 ELSE 1 END
        LIMIT 1
    """), {
        "sid": str(student_id),
        "tid": str(cu.tenant_id),
        "yr":  str(year_id) if year_id else None,
    }).fetchone()


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
        raise HTTPException(404, "No student profile linked to this account." + resolved.get("hint", ""))

    # If parent has multiple children and requested a specific one
    student = resolved["student"]
    if resolved["is_parent"] and student_id:
        match = next((s for s in resolved["linked_students"] if str(s.id) == str(student_id)), None)
        if match:
            student = match

    # DEBUG — log the resolved student so we can verify the IDs are correct
    import logging
    _log = logging.getLogger(__name__)
    _log.warning(
        f"[my_dashboard] user={cu.id} role={getattr(cu,'role_name','?')} "
        f"is_parent={resolved['is_parent']} "
        f"resolved_student_id={student.id} "
        f"student_name={student.first_name} {student.last_name or ''} "
        f"tenant_id={cu.tenant_id}"
    )

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
        raise HTTPException(404, "No student profile linked to this account." + resolved.get("hint", ""))

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
        raise HTTPException(404, "No student profile linked to this account." + resolved.get("hint", ""))

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


# ═══════════════════════════════════════════════════════════════
#  MY ATTENDANCE — student's own attendance history
# ═══════════════════════════════════════════════════════════════
@router.get("/attendance")
def my_attendance(
    student_id:      Optional[UUID] = None,
    academic_year_id:Optional[UUID] = None,
    month:           Optional[int]  = None,   # 1-12, defaults to current month
    year:            Optional[int]  = None,   # calendar year
    db:    Session = Depends(get_db),
    cu:    User    = Depends(get_current_user),
):
    resolved = _resolve_student(db, cu)
    if not resolved["student"]:
        raise HTTPException(404, "No student profile linked to this account." + resolved.get("hint", ""))

    student = resolved["student"]
    if resolved["is_parent"] and student_id:
        match = next((s for s in resolved["linked_students"] if str(s.id) == str(student_id)), None)
        if match:
            student = match

    # Resolve academic year
    yr = None
    if academic_year_id:
        yr = db.execute(text("""
            SELECT id, label FROM academic_years WHERE id=:id AND tenant_id=:tid
        """), {"id": str(academic_year_id), "tid": str(cu.tenant_id)}).fetchone()
    if not yr:
        yr = _get_current_year(db, cu)

    # Get enrollment
    enr = _get_enrollment(db, cu, student.id, yr.id if yr else None) if yr else None

    today = date.today()
    cal_month = month or today.month
    cal_year  = year  or today.year

    # Build month date range
    import calendar
    _, days_in_month = calendar.monthrange(cal_year, cal_month)
    from_date = date(cal_year, cal_month, 1)
    to_date   = date(cal_year, cal_month, days_in_month)

    # Fetch daily attendance records for this student this month
    # Use DISTINCT ON (date) to handle period-wise attendance — take the worst status per day
    # Priority: absent > late > present (so if any period is absent, day shows absent)
    if enr:
        records = db.execute(text("""
            SELECT DISTINCT ON (date)
                date,
                status,
                remarks
            FROM student_attendance
            WHERE enrollment_id = :eid
              AND tenant_id = :tid
              AND date BETWEEN :from_d AND :to_d
            ORDER BY date,
                CASE status
                    WHEN 'absent'  THEN 1
                    WHEN 'late'    THEN 2
                    WHEN 'present' THEN 3
                    ELSE 4
                END
        """), {
            "eid":    str(enr.enrollment_id),
            "tid":    str(cu.tenant_id),
            "from_d": str(from_date),
            "to_d":   str(to_date),
        }).fetchall()
    else:
        records = []

    # Build a day-keyed map
    att_map = {str(r.date): {"status": r.status, "remark": r.remarks or ""} for r in records}

    # Monthly summary
    statuses = [r.status for r in records]
    present  = statuses.count("present") + statuses.count("late")
    absent   = statuses.count("absent")
    late     = statuses.count("late")
    total    = len(statuses)
    pct      = round((present / total) * 100, 1) if total > 0 else None

    # Fetch all academic years for the dropdown
    all_years = db.execute(text("""
        SELECT id, label, is_current FROM academic_years
        WHERE tenant_id=:tid ORDER BY start_date DESC
    """), {"tid": str(cu.tenant_id)}).fetchall()

    # Monthly totals for the whole academic year (for the year overview chart)
    # Aggregate per-day first (worst status), then count days
    monthly_summary = []
    if enr and yr:
        rows = db.execute(text("""
            WITH daily AS (
                SELECT DISTINCT ON (date)
                    date,
                    EXTRACT(MONTH FROM date)::int AS m,
                    EXTRACT(YEAR  FROM date)::int AS y,
                    status
                FROM student_attendance
                WHERE enrollment_id = :eid
                  AND tenant_id = :tid
                ORDER BY date,
                    CASE status
                        WHEN 'absent'  THEN 1
                        WHEN 'late'    THEN 2
                        WHEN 'present' THEN 3
                        ELSE 4
                    END
            )
            SELECT
                m, y,
                COUNT(*) FILTER (WHERE status IN ('present','late')) AS present,
                COUNT(*) FILTER (WHERE status = 'absent')           AS absent,
                COUNT(*)                                             AS total
            FROM daily
            GROUP BY y, m
            ORDER BY y, m
        """), {"eid": str(enr.enrollment_id), "tid": str(cu.tenant_id)}).fetchall()

        import calendar as _cal
        monthly_summary = [
            {
                "month":   r.m,
                "year":    r.y,
                "label":   _cal.month_abbr[r.m],
                "present": r.present,
                "absent":  r.absent,
                "total":   r.total,
                "pct":     round((r.present / r.total) * 100, 1) if r.total > 0 else 0,
            }
            for r in rows
        ]

    return {
        "student": {
            "id":           str(student.id),
            "name":         f"{student.first_name} {student.last_name}",
            "admission_no": student.admission_no,
            "class":        f"{enr.grade_name} - {enr.section_name}" if enr else None,
        },
        "academic_year": {
            "id":    str(yr.id)    if yr else None,
            "label": yr.label      if yr else None,
        },
        "all_years": [
            {"id": str(a.id), "label": a.label, "is_current": a.is_current}
            for a in all_years
        ],
        "month": {
            "month":         cal_month,
            "year":          cal_year,
            "days_in_month": days_in_month,
            "summary": {
                "present":  present,
                "absent":   absent,
                "late":     late,
                "total":    total,
                "pct":      pct,
            },
            "days": att_map,   # {"2026-06-01": {"status": "present"}, ...}
        },
        "monthly_summary": monthly_summary,
        "is_parent": resolved["is_parent"],
        "linked_students": [
            {"id": str(s.id), "name": f"{s.first_name} {s.last_name}", "admission_no": s.admission_no}
            for s in (resolved["linked_students"] or [])
        ],
    }


# ═══════════════════════════════════════════════════════════════
#  ADMIN DIAGNOSTIC — check why a user sees no dashboard data
#  GET /api/my/check-link?user_id=<uuid>
# ═══════════════════════════════════════════════════════════════
@router.get("/check-link")
def check_link(
    user_id: UUID,
    db:  Session = Depends(get_db),
    cu:  User    = Depends(get_current_user),
):
    """
    Admin/superadmin tool: given any user_id, show exactly how
    their account links (or fails to link) to student/guardian data.
    Use this to debug why a parent sees 'No student profile linked'.
    """
    from routers.users import require_admin
    require_admin(cu, db)

    # Get the user
    target = db.execute(text("""
        SELECT u.id, u.email, u.first_name, u.last_name, r.name AS role_name
        FROM users u
        LEFT JOIN roles r ON r.id = u.role_id
        WHERE u.id = :uid AND u.tenant_id = :tid
    """), {"uid": str(user_id), "tid": str(cu.tenant_id)}).fetchone()

    if not target:
        raise HTTPException(404, "User not found")

    result = {
        "user": {
            "id":    str(target.id),
            "email": target.email,
            "name":  f"{target.first_name} {target.last_name or ''}".strip(),
            "role":  target.role_name,
        },
        "student_link": None,
        "guardian_links": [],
        "diagnosis": [],
    }

    # Check direct student link
    student_row = db.execute(text("""
        SELECT s.id, s.first_name, s.last_name, s.admission_no
        FROM students s WHERE s.user_id = :uid AND s.tenant_id = :tid
    """), {"uid": str(user_id), "tid": str(cu.tenant_id)}).fetchone()

    if student_row:
        result["student_link"] = {
            "id": str(student_row.id),
            "name": f"{student_row.first_name} {student_row.last_name or ''}".strip(),
            "admission_no": student_row.admission_no,
        }
        result["diagnosis"].append("✅ Student link found — dashboard should work")
    else:
        result["diagnosis"].append("❌ No student record linked to this user_id")

    # Check guardian links
    guardian_rows = db.execute(text("""
        SELECT gu.id, gu.first_name, gu.last_name, gu.relation,
               gu.user_id AS linked_user_id,
               s.first_name AS student_first, s.last_name AS student_last,
               s.admission_no
        FROM guardians gu
        JOIN students s ON s.id = gu.student_id
        WHERE gu.user_id = :uid AND gu.tenant_id = :tid
    """), {"uid": str(user_id), "tid": str(cu.tenant_id)}).fetchall()

    if guardian_rows:
        result["guardian_links"] = [
            {
                "guardian_id": str(g.id),
                "relation": g.relation,
                "student": f"{g.student_first} {g.student_last or ''} ({g.admission_no})".strip(),
                "linked_user_id": str(g.linked_user_id),
            }
            for g in guardian_rows
        ]
        result["diagnosis"].append(f"✅ Guardian link found for {len(guardian_rows)} child(ren) — dashboard should work")
    else:
        result["diagnosis"].append("❌ No guardian record linked to this user_id")

    # Check if guardian record EXISTS but user_id is NULL (most common issue)
    unlinked = db.execute(text("""
        SELECT gu.id, gu.first_name, gu.last_name, gu.relation,
               s.first_name AS sf, s.last_name AS sl, s.admission_no
        FROM guardians gu
        JOIN students s ON s.id = gu.student_id
        WHERE gu.tenant_id = :tid
          AND gu.user_id IS NULL
          AND (gu.email = :email OR LOWER(gu.first_name || ' ' || COALESCE(gu.last_name,''))
               LIKE LOWER(:name || '%'))
    """), {
        "tid":   str(cu.tenant_id),
        "email": target.email,
        "name":  target.first_name,
    }).fetchall()

    if unlinked:
        result["unlinked_guardian_matches"] = [
            {
                "guardian_id": str(g.id),
                "name": f"{g.first_name} {g.last_name or ''}".strip(),
                "relation": g.relation,
                "student": f"{g.sf} {g.sl or ''} ({g.admission_no})".strip(),
            }
            for g in unlinked
        ]
        result["diagnosis"].append(
            f"⚠️ Found {len(unlinked)} guardian record(s) that match by name/email "
            f"but have user_id = NULL. Go to Settings → User Management → find this "
            f"user → click the Link 🔗 button to connect them."
        )

    if not student_row and not guardian_rows:
        result["diagnosis"].append(
            "ACTION REQUIRED: Go to Settings → User Management → find this user → "
            "click the Link 🔗 button next to their name."
        )

    return result
