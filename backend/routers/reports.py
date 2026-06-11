# backend/routers/reports.py
# ─────────────────────────────────────────────────────────────
# All report & dashboard endpoints
# Registered at /api/reports
# ─────────────────────────────────────────────────────────────
from uuid import UUID
from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text

from database import get_db
from routers.auth import get_current_user
from models.user import User

router = APIRouter()


def tid(cu): return str(cu.tenant_id)


# ─────────────────────────────────────────────────────────────
#  1. DASHBOARD  GET /api/reports/dashboard
# ─────────────────────────────────────────────────────────────
@router.get("/dashboard")
def get_dashboard_stats(
    academic_year_id: Optional[UUID] = Query(None),
    db: Session = Depends(get_db),
    cu: User    = Depends(get_current_user),
):
    """Single endpoint for all dashboard cards."""
    tenant = tid(cu)

    # ── Student counts ───────────────────────────────────────
    students = db.execute(text("""
        SELECT
            COUNT(*)                                            AS total,
            COUNT(*) FILTER (WHERE gender = 'male')             AS male,
            COUNT(*) FILTER (WHERE gender = 'female')           AS female,
            COUNT(*) FILTER (WHERE
                admitted_on >= date_trunc('month', CURRENT_DATE)
            )                                                   AS new_this_month
        FROM students
        WHERE tenant_id = :tid AND is_active = true
    """), {"tid": tenant}).fetchone()

    # ── Today's attendance ───────────────────────────────────
    att_today = db.execute(text("""
        SELECT
            COUNT(sa.id)                                                AS total_marked,
            COUNT(sa.id) FILTER (WHERE sa.status = 'present')          AS present,
            COUNT(sa.id) FILTER (WHERE sa.status = 'absent')           AS absent,
            COUNT(sa.id) FILTER (WHERE sa.status = 'late')             AS late,
            ROUND(
                100.0 * COUNT(sa.id) FILTER (WHERE sa.status IN ('present','late'))
                / NULLIF(COUNT(sa.id), 0), 1
            )                                                           AS pct
        FROM student_attendance sa
        JOIN student_enrollments se ON se.id = sa.enrollment_id
        WHERE se.tenant_id = :tid
          AND sa.date = CURRENT_DATE
    """), {"tid": tenant}).fetchone()

    # ── This month attendance average ────────────────────────
    att_month = db.execute(text("""
        SELECT
            ROUND(
                100.0 * COUNT(sa.id) FILTER (WHERE sa.status IN ('present','late'))
                / NULLIF(COUNT(sa.id), 0), 1
            ) AS avg_pct
        FROM student_attendance sa
        JOIN student_enrollments se ON se.id = sa.enrollment_id
        WHERE se.tenant_id = :tid
          AND sa.date >= date_trunc('month', CURRENT_DATE)
          AND sa.date <= CURRENT_DATE
    """), {"tid": tenant}).fetchone()

    # ── Fee stats ────────────────────────────────────────────
    fee_params = {"tid": tenant}
    fee_where  = "tenant_id = :tid AND status != 'cancelled'"
    if academic_year_id:
        fee_where += " AND academic_year_id = :yr_id"
        fee_params["yr_id"] = str(academic_year_id)

    fees = db.execute(text(f"""
        SELECT
            COUNT(*)::int                                       AS total_invoices,
            COALESCE(SUM(total_amount), 0)::float               AS total_billed,
            COALESCE(SUM(paid_amount),  0)::float               AS total_collected,
            COALESCE(SUM(balance),      0)::float               AS total_pending,
            COUNT(*) FILTER (WHERE status = 'paid')::int        AS paid_count,
            COUNT(*) FILTER (WHERE status = 'partial')::int     AS partial_count,
            COUNT(*) FILTER (WHERE status = 'overdue')::int     AS overdue_count
        FROM fee_invoices
        WHERE {fee_where}
    """), fee_params).fetchone()

    # Today's collection
    today_fees = db.execute(text("""
        SELECT
            COALESCE(SUM(amount), 0)::float AS today_collected,
            COUNT(*)::int                   AS today_transactions
        FROM fee_payments
        WHERE tenant_id    = :tid
          AND payment_date = CURRENT_DATE
    """), {"tid": tenant}).fetchone()

    # Section count
    sections = db.execute(text("""
        SELECT COUNT(*)::int AS total
        FROM sections WHERE tenant_id = :tid
    """), {"tid": tenant}).scalar() or 0

    billed    = fees.total_billed    or 0
    collected = fees.total_collected or 0
    coll_pct  = round(collected / max(billed, 1) * 100, 1) if billed > 0 else 0

    return {
        "students": {
            "total":          students.total          or 0,
            "male":           students.male           or 0,
            "female":         students.female         or 0,
            "new_this_month": students.new_this_month or 0,
            "total_sections": sections,
        },
        "attendance": {
            "today_marked":  att_today.total_marked or 0,
            "today_present": att_today.present      or 0,
            "today_absent":  att_today.absent       or 0,
            "today_late":    att_today.late         or 0,
            "today_pct":     float(att_today.pct    or 0),
            "month_avg_pct": float(att_month.avg_pct or 0),
        },
        "fees": {
            "total_invoices":     fees.total_invoices  or 0,
            "total_billed":       billed,
            "total_collected":    collected,
            "total_pending":      fees.total_pending   or 0.0,
            "paid_count":         fees.paid_count      or 0,
            "partial_count":      fees.partial_count   or 0,
            "overdue_count":      fees.overdue_count   or 0,
            "collection_pct":     coll_pct,
            "today_collected":    today_fees.today_collected    or 0.0,
            "today_transactions": today_fees.today_transactions or 0,
        },
    }


# ─────────────────────────────────────────────────────────────
#  2. ATTENDANCE SUMMARY  GET /api/reports/attendance/summary
# ─────────────────────────────────────────────────────────────
@router.get("/attendance/summary")
def attendance_summary(
    from_date:        date           = Query(...),
    to_date:          date           = Query(...),
    academic_year_id: Optional[UUID] = Query(None),
    grade_id:         Optional[UUID] = Query(None),
    section_id:       Optional[UUID] = Query(None),
    db: Session = Depends(get_db),
    cu: User    = Depends(get_current_user),
):
    """Section-wise attendance breakdown + daily trend for a date range."""
    if (to_date - from_date).days > 366:
        raise HTTPException(400, "Date range cannot exceed 1 year")

    params = {"tid": tid(cu), "from_date": from_date, "to_date": to_date}
    filters = ["se.tenant_id = :tid"]

    if academic_year_id:
        filters.append("se.academic_year_id = :yr_id")
        params["yr_id"] = str(academic_year_id)
    if grade_id:
        filters.append("sec.grade_id = :grade_id")
        params["grade_id"] = str(grade_id)
    if section_id:
        filters.append("se.section_id = :section_id")
        params["section_id"] = str(section_id)

    where = " AND ".join(filters)

    # Per-section summary
    sections = db.execute(text(f"""
        SELECT
            sec.id                                                                  AS section_id,
            sec.name                                                                AS section_name,
            g.name                                                                  AS grade_name,
            COUNT(DISTINCT se.id)::int                                              AS enrolled,
            COUNT(sa.id)::int                                                       AS total_records,
            COUNT(sa.id) FILTER (WHERE sa.status = 'present')::int                 AS present_days,
            COUNT(sa.id) FILTER (WHERE sa.status = 'absent')::int                  AS absent_days,
            COUNT(sa.id) FILTER (WHERE sa.status = 'late')::int                    AS late_days,
            ROUND(
                100.0 * COUNT(sa.id) FILTER (WHERE sa.status IN ('present','late'))
                / NULLIF(COUNT(sa.id), 0), 1
            )                                                                       AS avg_pct
        FROM student_enrollments se
        JOIN sections sec ON sec.id = se.section_id
        JOIN grades   g   ON g.id   = sec.grade_id
        LEFT JOIN student_attendance sa
            ON sa.enrollment_id = se.id
            AND sa.date BETWEEN :from_date AND :to_date
        WHERE {where} AND se.status = 'active'
        GROUP BY sec.id, sec.name, g.name, g.order_no
        ORDER BY g.order_no, sec.name
    """), params).fetchall()

    # Daily trend
    daily = db.execute(text(f"""
        SELECT
            sa.date,
            COUNT(sa.id)::int                                                       AS total,
            COUNT(sa.id) FILTER (WHERE sa.status = 'present')::int                 AS present,
            COUNT(sa.id) FILTER (WHERE sa.status = 'absent')::int                  AS absent,
            COUNT(sa.id) FILTER (WHERE sa.status = 'late')::int                    AS late,
            ROUND(
                100.0 * COUNT(sa.id) FILTER (WHERE sa.status IN ('present','late'))
                / NULLIF(COUNT(sa.id), 0), 1
            )                                                                       AS pct
        FROM student_attendance sa
        JOIN student_enrollments se ON se.id = sa.enrollment_id
        JOIN sections sec ON sec.id = se.section_id
        JOIN grades   g   ON g.id   = sec.grade_id
        WHERE {where} AND sa.date BETWEEN :from_date AND :to_date AND se.status = 'active'
        GROUP BY sa.date
        ORDER BY sa.date
    """), params).fetchall()

    return {
        "period":   {"from": str(from_date), "to": str(to_date)},
        "sections": [
            {
                "section_id":    str(r.section_id),
                "section_name":  r.section_name,
                "grade_name":    r.grade_name,
                "enrolled":      r.enrolled       or 0,
                "total_records": r.total_records  or 0,
                "present_days":  r.present_days   or 0,
                "absent_days":   r.absent_days    or 0,
                "late_days":     r.late_days      or 0,
                "avg_pct":       float(r.avg_pct  or 0),
            }
            for r in sections
        ],
        "daily_trend": [
            {
                "date":    str(r.date),
                "total":   r.total   or 0,
                "present": r.present or 0,
                "absent":  r.absent  or 0,
                "late":    r.late    or 0,
                "pct":     float(r.pct or 0),
            }
            for r in daily
        ],
    }


# ─────────────────────────────────────────────────────────────
#  3. LOW ATTENDANCE  GET /api/reports/attendance/low
# ─────────────────────────────────────────────────────────────
@router.get("/attendance/low")
def low_attendance_report(
    academic_year_id: UUID           = Query(...),
    threshold:        float          = Query(75.0, ge=0, le=100),
    grade_id:         Optional[UUID] = Query(None),
    db: Session = Depends(get_db),
    cu: User    = Depends(get_current_user),
):
    """Students below attendance threshold."""
    params = {"tid": tid(cu), "yr_id": str(academic_year_id), "threshold": threshold}
    extra  = "AND sec.grade_id = :grade_id" if grade_id else ""
    if grade_id: params["grade_id"] = str(grade_id)

    rows = db.execute(text(f"""
        SELECT
            s.id                                                                        AS student_id,
            se.id                                                                       AS enrollment_id,
            s.first_name, s.last_name, s.admission_no,
            sec.name                                                                    AS section_name,
            g.name                                                                      AS grade_name,
            COUNT(sa.id)::int                                                           AS total_days,
            COUNT(sa.id) FILTER (WHERE sa.status IN ('present','late'))::int            AS present_days,
            COUNT(sa.id) FILTER (WHERE sa.status = 'absent')::int                      AS absent_days,
            ROUND(
                100.0 * COUNT(sa.id) FILTER (WHERE sa.status IN ('present','late'))
                / NULLIF(COUNT(sa.id), 0), 1
            )                                                                           AS percentage
        FROM student_enrollments se
        JOIN students s   ON s.id   = se.student_id
        JOIN sections sec ON sec.id = se.section_id
        JOIN grades   g   ON g.id   = sec.grade_id
        LEFT JOIN student_attendance sa ON sa.enrollment_id = se.id
        WHERE se.tenant_id        = :tid
          AND se.academic_year_id = :yr_id
          AND se.status = 'active' AND s.is_active = true {extra}
        GROUP BY s.id, s.first_name, s.last_name, s.admission_no,
                 se.id, sec.name, g.name, g.order_no
        HAVING
            ROUND(
                100.0 * COUNT(sa.id) FILTER (WHERE sa.status IN ('present','late'))
                / NULLIF(COUNT(sa.id), 0), 1
            ) < :threshold OR COUNT(sa.id) = 0
        ORDER BY percentage ASC NULLS FIRST, g.order_no, s.first_name
    """), params).fetchall()

    return {
        "threshold": threshold,
        "total":     len(rows),
        "students": [
            {
                "student_id":    str(r.student_id),
                "enrollment_id": str(r.enrollment_id),
                "first_name":    r.first_name,
                "last_name":     r.last_name,
                "admission_no":  r.admission_no,
                "section_name":  r.section_name,
                "grade_name":    r.grade_name,
                "total_days":    r.total_days    or 0,
                "present_days":  r.present_days  or 0,
                "absent_days":   r.absent_days   or 0,
                "percentage":    float(r.percentage or 0),
            }
            for r in rows
        ],
    }


# ─────────────────────────────────────────────────────────────
#  4. FEE COLLECTION REPORT  GET /api/reports/fees/collection
# ─────────────────────────────────────────────────────────────
@router.get("/fees/collection")
def fee_collection_report(
    academic_year_id: UUID           = Query(...),
    from_date:        Optional[date] = Query(None),
    to_date:          Optional[date] = Query(None),
    grade_id:         Optional[UUID] = Query(None),
    status:           Optional[str]  = Query(None),
    db: Session = Depends(get_db),
    cu: User    = Depends(get_current_user),
):
    params = {"tid": tid(cu), "yr_id": str(academic_year_id)}
    filters = [
        "fi.tenant_id = :tid",
        "fi.academic_year_id = :yr_id",
        "fi.status != 'cancelled'",
    ]

    if from_date: filters.append("fi.issue_date >= :from_date"); params["from_date"] = from_date
    if to_date:   filters.append("fi.issue_date <= :to_date");   params["to_date"]   = to_date
    if status:    filters.append("fi.status = :status");         params["status"]    = status
    if grade_id:  filters.append("sec.grade_id = :grade_id");    params["grade_id"]  = str(grade_id)

    where = " AND ".join(filters)

    rows = db.execute(text(f"""
        SELECT
            fi.id, fi.invoice_no, fi.issue_date, fi.due_date,
            fi.total_amount, fi.paid_amount, fi.balance, fi.status,
            s.first_name, s.last_name, s.admission_no,
            sec.name AS section_name, g.name AS grade_name
        FROM fee_invoices fi
        JOIN students s ON s.id = fi.student_id
        LEFT JOIN student_enrollments se
            ON se.student_id = s.id
            AND se.academic_year_id = fi.academic_year_id
            AND se.status = 'active'
        LEFT JOIN sections sec ON sec.id = se.section_id
        LEFT JOIN grades   g   ON g.id   = sec.grade_id
        WHERE {where}
        ORDER BY g.order_no NULLS LAST, s.first_name, fi.issue_date DESC
    """), params).fetchall()

    totals = db.execute(text(f"""
        SELECT
            COUNT(fi.id)::int                       AS invoice_count,
            COALESCE(SUM(fi.total_amount), 0)::float AS total_billed,
            COALESCE(SUM(fi.paid_amount),  0)::float AS total_collected,
            COALESCE(SUM(fi.balance),      0)::float AS total_pending
        FROM fee_invoices fi
        JOIN students s ON s.id = fi.student_id
        LEFT JOIN student_enrollments se
            ON se.student_id = s.id
            AND se.academic_year_id = fi.academic_year_id
            AND se.status = 'active'
        LEFT JOIN sections sec ON sec.id = se.section_id
        LEFT JOIN grades   g   ON g.id   = sec.grade_id
        WHERE {where}
    """), params).fetchone()

    billed    = totals.total_billed     or 0
    collected = totals.total_collected  or 0

    return {
        "period":  {"from": str(from_date) if from_date else None, "to": str(to_date) if to_date else None},
        "summary": {
            "invoice_count":   totals.invoice_count  or 0,
            "total_billed":    billed,
            "total_collected": collected,
            "total_pending":   totals.total_pending   or 0.0,
            "collection_pct":  round(collected / max(billed, 1) * 100, 1),
        },
        "invoices": [
            {
                "id":           str(r.id),
                "invoice_no":   r.invoice_no,
                "student_name": f"{r.first_name} {r.last_name or ''}".strip(),
                "admission_no": r.admission_no,
                "grade_name":   r.grade_name   or "—",
                "section_name": r.section_name or "—",
                "issue_date":   str(r.issue_date),
                "due_date":     str(r.due_date),
                "total_amount": float(r.total_amount),
                "paid_amount":  float(r.paid_amount),
                "balance":      float(r.balance),
                "status":       r.status,
            }
            for r in rows
        ],
    }


# ─────────────────────────────────────────────────────────────
#  5. DAILY FEE COLLECTION  GET /api/reports/fees/daily
# ─────────────────────────────────────────────────────────────
@router.get("/fees/daily")
def daily_fee_report(
    from_date: date = Query(...),
    to_date:   date = Query(...),
    db: Session = Depends(get_db),
    cu: User    = Depends(get_current_user),
):
    if (to_date - from_date).days > 93:
        raise HTTPException(400, "Date range cannot exceed 3 months")

    rows = db.execute(text("""
        SELECT
            payment_date,
            method,
            COUNT(*)::int                   AS transactions,
            COALESCE(SUM(amount), 0)::float AS total_amount
        FROM fee_payments
        WHERE tenant_id    = :tid
          AND payment_date BETWEEN :from_date AND :to_date
        GROUP BY payment_date, method
        ORDER BY payment_date, method
    """), {"tid": tid(cu), "from_date": from_date, "to_date": to_date}).fetchall()

    by_date: dict = {}
    for r in rows:
        d = str(r.payment_date)
        if d not in by_date:
            by_date[d] = {"date": d, "total": 0.0, "transactions": 0, "methods": {}}
        by_date[d]["total"]        += r.total_amount
        by_date[d]["transactions"] += r.transactions
        by_date[d]["methods"][r.method] = {
            "amount": r.total_amount, "transactions": r.transactions
        }

    return {
        "period":      {"from": str(from_date), "to": str(to_date)},
        "grand_total": sum(v["total"] for v in by_date.values()),
        "days":        list(by_date.values()),
    }


# ─────────────────────────────────────────────────────────────
#  6. OUTSTANDING FEES  GET /api/reports/fees/outstanding
# ─────────────────────────────────────────────────────────────
@router.get("/fees/outstanding")
def outstanding_fees_report(
    academic_year_id: UUID           = Query(...),
    grade_id:         Optional[UUID] = Query(None),
    db: Session = Depends(get_db),
    cu: User    = Depends(get_current_user),
):
    params = {"tid": tid(cu), "yr_id": str(academic_year_id)}
    extra  = "AND sec.grade_id = :grade_id" if grade_id else ""
    if grade_id: params["grade_id"] = str(grade_id)

    rows = db.execute(text(f"""
        SELECT
            s.first_name, s.last_name, s.admission_no,
            sec.name    AS section_name,
            g.name      AS grade_name,
            COUNT(fi.id)::int                            AS invoice_count,
            COALESCE(SUM(fi.total_amount), 0)::float     AS total_billed,
            COALESCE(SUM(fi.paid_amount),  0)::float     AS total_paid,
            COALESCE(SUM(fi.balance),      0)::float     AS outstanding,
            MAX(fi.due_date)                             AS latest_due,
            BOOL_OR(fi.status = 'overdue')               AS has_overdue
        FROM students s
        JOIN student_enrollments se
            ON se.student_id = s.id
            AND se.academic_year_id = :yr_id
            AND se.status = 'active'
        JOIN sections sec ON sec.id = se.section_id
        JOIN grades   g   ON g.id   = sec.grade_id
        JOIN fee_invoices fi
            ON fi.student_id = s.id
            AND fi.academic_year_id = :yr_id
            AND fi.status NOT IN ('paid','cancelled')
        WHERE s.tenant_id = :tid {extra}
        GROUP BY s.id, s.first_name, s.last_name, s.admission_no,
                 sec.name, g.name, g.order_no
        HAVING COALESCE(SUM(fi.balance), 0) > 0
        ORDER BY outstanding DESC, g.order_no, s.first_name
    """), params).fetchall()

    return {
        "total_outstanding": sum(float(r.outstanding) for r in rows),
        "student_count":     len(rows),
        "students": [
            {
                "first_name":    r.first_name,
                "last_name":     r.last_name,
                "admission_no":  r.admission_no,
                "grade_name":    r.grade_name,
                "section_name":  r.section_name,
                "invoice_count": r.invoice_count,
                "total_billed":  r.total_billed,
                "total_paid":    r.total_paid,
                "outstanding":   float(r.outstanding),
                "latest_due":    str(r.latest_due) if r.latest_due else None,
                "has_overdue":   r.has_overdue,
            }
            for r in rows
        ],
    }


# ─────────────────────────────────────────────────────────────
#  7. STUDENT STRENGTH  GET /api/reports/students/strength
# ─────────────────────────────────────────────────────────────
@router.get("/students/strength")
def student_strength_report(
    academic_year_id: UUID = Query(...),
    db: Session = Depends(get_db),
    cu: User    = Depends(get_current_user),
):
    rows = db.execute(text("""
        SELECT
            g.name                                                          AS grade_name,
            g.order_no,
            sec.name                                                        AS section_name,
            COUNT(se.id)::int                                               AS enrolled,
            COUNT(se.id) FILTER (WHERE s.gender = 'male')::int             AS male,
            COUNT(se.id) FILTER (WHERE s.gender = 'female')::int           AS female,
            sec.capacity
        FROM student_enrollments se
        JOIN students s   ON s.id   = se.student_id
        JOIN sections sec ON sec.id = se.section_id
        JOIN grades   g   ON g.id   = sec.grade_id
        WHERE se.tenant_id        = :tid
          AND se.academic_year_id = :yr_id
          AND se.status = 'active' AND s.is_active = true
        GROUP BY g.id, g.name, g.order_no, sec.id, sec.name, sec.capacity
        ORDER BY g.order_no, sec.name
    """), {"tid": tid(cu), "yr_id": str(academic_year_id)}).fetchall()

    total = sum(r.enrolled for r in rows)
    return {
        "summary": {
            "total_enrolled": total,
            "total_male":     sum(r.male   for r in rows),
            "total_female":   sum(r.female for r in rows),
        },
        "by_section": [
            {
                "grade_name":    r.grade_name,
                "section_name":  r.section_name,
                "enrolled":      r.enrolled,
                "male":          r.male,
                "female":        r.female,
                "capacity":      r.capacity or 0,
                "occupancy_pct": round(r.enrolled / max(r.capacity or 1, 1) * 100, 1),
            }
            for r in rows
        ],
    }


# ─────────────────────────────────────────────────────────────
#  8. MONTHLY FEE TREND  GET /api/reports/fees/monthly-trend
# ─────────────────────────────────────────────────────────────
@router.get("/fees/monthly-trend")
def monthly_fee_trend(
    academic_year_id: UUID = Query(...),
    db: Session = Depends(get_db),
    cu: User    = Depends(get_current_user),
):
    rows = db.execute(text("""
        SELECT
            TO_CHAR(fp.payment_date, 'YYYY-MM')   AS month,
            TO_CHAR(fp.payment_date, 'Mon YYYY')  AS month_label,
            COUNT(*)::int                          AS transactions,
            COALESCE(SUM(fp.amount), 0)::float     AS collected
        FROM fee_payments fp
        JOIN fee_invoices fi ON fi.id = fp.invoice_id
        WHERE fp.tenant_id        = :tid
          AND fi.academic_year_id = :yr_id
        GROUP BY TO_CHAR(fp.payment_date, 'YYYY-MM'),
                 TO_CHAR(fp.payment_date, 'Mon YYYY')
        ORDER BY month
    """), {"tid": tid(cu), "yr_id": str(academic_year_id)}).fetchall()

    return {
        "months": [
            {
                "month":        r.month,
                "month_label":  r.month_label,
                "transactions": r.transactions,
                "collected":    r.collected,
            }
            for r in rows
        ],
    }


# ─────────────────────────────────────────────────────────────
#  9. EXAM RESULTS SUMMARY  GET /api/reports/exams/summary
# ─────────────────────────────────────────────────────────────
@router.get("/exams/summary")
def exam_results_summary(
    academic_year_id: UUID           = Query(...),
    grade_id:         Optional[UUID] = Query(None),
    db: Session = Depends(get_db),
    cu: User    = Depends(get_current_user),
):
    """Pass/fail stats per exam for a grade and year."""
    params = {"tid": tid(cu), "yr_id": str(academic_year_id)}
    extra  = "AND e.grade_id = :grade_id" if grade_id else ""
    if grade_id: params["grade_id"] = str(grade_id)

    rows = db.execute(text(f"""
        SELECT
            e.id          AS exam_id,
            e.name        AS exam_name,
            et.name       AS exam_type,
            g.name        AS grade_name,
            e.status,
            COUNT(rc.id)::int                                            AS total_students,
            COUNT(rc.id) FILTER (WHERE rc.result = 'pass')::int         AS pass_count,
            COUNT(rc.id) FILTER (WHERE rc.result = 'fail')::int         AS fail_count,
            ROUND(AVG(rc.percentage), 1)                                AS avg_pct,
            ROUND(MAX(rc.percentage), 1)                                AS highest_pct,
            ROUND(MIN(rc.percentage), 1)                                AS lowest_pct
        FROM exams e
        JOIN exam_types et ON et.id = e.exam_type_id
        JOIN grades     g  ON g.id  = e.grade_id
        LEFT JOIN report_cards rc ON rc.exam_id = e.id AND rc.tenant_id = :tid
        WHERE e.tenant_id        = :tid
          AND e.academic_year_id = :yr_id {extra}
        GROUP BY e.id, e.name, et.name, g.name, e.status, g.order_no
        ORDER BY g.order_no, e.start_date DESC
    """), params).fetchall()

    return [
        {
            "exam_id":       str(r.exam_id),
            "exam_name":     r.exam_name,
            "exam_type":     r.exam_type,
            "grade_name":    r.grade_name,
            "status":        r.status,
            "total_students":r.total_students or 0,
            "pass_count":    r.pass_count     or 0,
            "fail_count":    r.fail_count     or 0,
            "pass_pct":      round((r.pass_count or 0) / max(r.total_students or 1, 1) * 100, 1),
            "avg_pct":       float(r.avg_pct     or 0),
            "highest_pct":   float(r.highest_pct or 0),
            "lowest_pct":    float(r.lowest_pct  or 0),
        }
        for r in rows
    ]


# ─────────────────────────────────────────────────────────────
#  10. TOPPER LIST  GET /api/reports/exams/toppers
# ─────────────────────────────────────────────────────────────
@router.get("/exams/toppers")
def exam_toppers(
    exam_id: UUID = Query(...),
    top_n:   int  = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
    cu: User    = Depends(get_current_user),
):
    """Top N students for an exam by percentage."""
    rows = db.execute(text("""
        SELECT
            rc.rank,
            rc.obtained_marks,
            rc.total_marks,
            rc.percentage,
            rc.grade,
            rc.grade_points,
            rc.result,
            s.first_name, s.last_name, s.admission_no,
            sec.name AS section_name,
            g.name   AS grade_name
        FROM report_cards rc
        JOIN student_enrollments se ON se.id  = rc.enrollment_id
        JOIN students s             ON s.id   = se.student_id
        JOIN sections sec           ON sec.id = se.section_id
        JOIN grades   g             ON g.id   = sec.grade_id
        WHERE rc.exam_id   = :exam_id
          AND rc.tenant_id = :tid
          AND rc.result    = 'pass'
        ORDER BY rc.rank ASC
        LIMIT :top_n
    """), {"exam_id": str(exam_id), "tid": tid(cu), "top_n": top_n}).fetchall()

    return [
        {
            "rank":          r.rank,
            "student_name":  f"{r.first_name} {r.last_name or ''}".strip(),
            "admission_no":  r.admission_no,
            "grade_name":    r.grade_name,
            "section_name":  r.section_name,
            "obtained_marks":float(r.obtained_marks),
            "total_marks":   float(r.total_marks),
            "percentage":    float(r.percentage),
            "grade":         r.grade,
            "grade_points":  float(r.grade_points),
        }
        for r in rows
    ]


# ─────────────────────────────────────────────────────────────
#  11. STUDENT REPORT CARD (full detail)  GET /api/reports/students/{enrollment_id}/report-card
# ─────────────────────────────────────────────────────────────
@router.get("/students/{enrollment_id}/report-card")
def student_full_report_card(
    enrollment_id:    UUID,
    academic_year_id: UUID = Query(...),
    db: Session = Depends(get_db),
    cu: User    = Depends(get_current_user),
):
    """
    All exam results for one student across an academic year.
    Returns subject-wise marks for every exam.
    """
    # Student info
    student = db.execute(text("""
        SELECT
            s.first_name, s.last_name, s.admission_no, s.dob, s.gender,
            sec.name  AS section_name,
            g.name    AS grade_name
        FROM student_enrollments se
        JOIN students s   ON s.id   = se.student_id
        JOIN sections sec ON sec.id = se.section_id
        JOIN grades   g   ON g.id   = sec.grade_id
        WHERE se.id = :enrollment_id
    """), {"enrollment_id": str(enrollment_id)}).fetchone()

    if not student:
        raise HTTPException(404, "Enrollment not found")

    # All exam results
    results = db.execute(text("""
        SELECT
            e.name       AS exam_name,
            et.short_code,
            subj.name    AS subject_name,
            er.marks_obtained,
            es.max_marks,
            es.pass_marks,
            er.is_absent,
            er.is_exempted,
            rc.grade,
            rc.percentage AS overall_pct,
            rc.rank
        FROM exam_results er
        JOIN exam_schedules es ON es.id = er.schedule_id
        JOIN subjects subj     ON subj.id = es.subject_id
        JOIN exams    e        ON e.id    = er.exam_id
        JOIN exam_types et     ON et.id   = e.exam_type_id
        LEFT JOIN report_cards rc
            ON rc.exam_id      = e.id
            AND rc.enrollment_id = er.enrollment_id
        WHERE er.enrollment_id   = :enrollment_id
          AND e.academic_year_id = :yr_id
        ORDER BY e.start_date, subj.name
    """), {
        "enrollment_id": str(enrollment_id),
        "yr_id":         str(academic_year_id),
    }).fetchall()

    # Group by exam
    exams: dict = {}
    for r in results:
        key = r.exam_name
        if key not in exams:
            exams[key] = {
                "exam_name":    r.exam_name,
                "short_code":   r.short_code,
                "overall_pct":  float(r.overall_pct or 0),
                "rank":         r.rank,
                "subjects":     [],
            }
        exams[key]["subjects"].append({
            "subject":         r.subject_name,
            "marks_obtained":  float(r.marks_obtained) if r.marks_obtained is not None else None,
            "max_marks":       float(r.max_marks),
            "pass_marks":      float(r.pass_marks),
            "is_absent":       r.is_absent,
            "is_exempted":     r.is_exempted,
            "passed":          (
                r.marks_obtained is not None and
                float(r.marks_obtained) >= float(r.pass_marks) and
                not r.is_absent
            ),
        })

    return {
        "student": {
            "first_name":   student.first_name,
            "last_name":    student.last_name,
            "admission_no": student.admission_no,
            "grade_name":   student.grade_name,
            "section_name": student.section_name,
        },
        "exams": list(exams.values()),
    }


# ─────────────────────────────────────────────────────────────
#  12. GENDER-WISE ATTENDANCE  GET /api/reports/attendance/gender
# ─────────────────────────────────────────────────────────────
@router.get("/attendance/gender")
def gender_attendance_report(
    from_date:        date           = Query(...),
    to_date:          date           = Query(...),
    academic_year_id: Optional[UUID] = Query(None),
    db: Session = Depends(get_db),
    cu: User    = Depends(get_current_user),
):
    """Attendance breakdown by gender."""
    params = {"tid": tid(cu), "from_date": from_date, "to_date": to_date}
    yr_filter = ""
    if academic_year_id:
        yr_filter = "AND se.academic_year_id = :yr_id"
        params["yr_id"] = str(academic_year_id)

    rows = db.execute(text(f"""
        SELECT
            s.gender,
            COUNT(sa.id)::int                                               AS total_records,
            COUNT(sa.id) FILTER (WHERE sa.status = 'present')::int         AS present,
            COUNT(sa.id) FILTER (WHERE sa.status = 'absent')::int          AS absent,
            COUNT(sa.id) FILTER (WHERE sa.status = 'late')::int            AS late,
            ROUND(
                100.0 * COUNT(sa.id) FILTER (WHERE sa.status IN ('present','late'))
                / NULLIF(COUNT(sa.id), 0), 1
            )                                                               AS pct
        FROM student_attendance sa
        JOIN student_enrollments se ON se.id = sa.enrollment_id
        JOIN students s             ON s.id  = se.student_id
        WHERE se.tenant_id = :tid
          AND sa.date BETWEEN :from_date AND :to_date
          {yr_filter}
        GROUP BY s.gender
        ORDER BY s.gender
    """), params).fetchall()

    return {
        "period": {"from": str(from_date), "to": str(to_date)},
        "by_gender": [
            {
                "gender":        r.gender or "not specified",
                "total_records": r.total_records or 0,
                "present":       r.present or 0,
                "absent":        r.absent  or 0,
                "late":          r.late    or 0,
                "pct":           float(r.pct or 0),
            }
            for r in rows
        ],
    }
