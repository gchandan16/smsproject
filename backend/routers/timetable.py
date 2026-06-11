# backend/routers/timetable.py
from uuid import UUID
from typing import Optional, List
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel

from database import get_db
from routers.auth import get_current_user
from models.user import User

router = APIRouter()


# ─────────────────────────────────────────────────────────────
#  SCHEMAS
# ─────────────────────────────────────────────────────────────
class PeriodIn(BaseModel):
    name:       str
    period_no:  int
    start_time: str   # "08:00"
    end_time:   str   # "08:45"
    is_break:   bool  = False


class EntryIn(BaseModel):
    section_id:       UUID
    academic_year_id: UUID
    period_id:        UUID
    day_of_week:      int   # 1=Mon..6=Sat
    subject_id:       Optional[UUID] = None
    teacher_name:     Optional[str]  = None
    room_no:          Optional[str]  = None


class BulkEntryIn(BaseModel):
    section_id:       UUID
    academic_year_id: UUID
    entries: List[dict]   # [{period_id, day_of_week, subject_id, teacher_name, room_no}]


# ─────────────────────────────────────────────────────────────
#  PERIODS
# ─────────────────────────────────────────────────────────────
@router.get("/periods")
def list_periods(
    db: Session = Depends(get_db),
    cu: User    = Depends(get_current_user),
):
    rows = db.execute(text("""
        SELECT id, name, period_no, start_time, end_time, is_break
        FROM timetable_periods
        WHERE tenant_id = :tid
        ORDER BY period_no
    """), {"tid": str(cu.tenant_id)}).fetchall()

    return [
        {
            "id":         str(r.id),
            "name":       r.name,
            "period_no":  r.period_no,
            "start_time": str(r.start_time),
            "end_time":   str(r.end_time),
            "is_break":   r.is_break,
        }
        for r in rows
    ]


@router.post("/periods", status_code=201)
def create_period(
    data: PeriodIn,
    db:   Session = Depends(get_db),
    cu:   User    = Depends(get_current_user),
):
    try:
        result = db.execute(text("""
            INSERT INTO timetable_periods
                (tenant_id, name, period_no, start_time, end_time, is_break)
            VALUES
                (:tid, :name, :period_no, :start_time, :end_time, :is_break)
            RETURNING id, name, period_no, start_time, end_time, is_break
        """), {
            "tid":        str(cu.tenant_id),
            "name":       data.name,
            "period_no":  data.period_no,
            "start_time": data.start_time,
            "end_time":   data.end_time,
            "is_break":   data.is_break,
        }).fetchone()
        db.commit()
        return {"id": str(result.id), "name": result.name}
    except Exception as e:
        db.rollback()
        if "unique" in str(e).lower():
            raise HTTPException(409, f"Period {data.period_no} already exists")
        raise HTTPException(500, str(e))


@router.put("/periods/{period_id}")
def update_period(
    period_id: UUID,
    data:      PeriodIn,
    db:        Session = Depends(get_db),
    cu:        User    = Depends(get_current_user),
):
    db.execute(text("""
        UPDATE timetable_periods
        SET name=:name, period_no=:period_no,
            start_time=:start_time, end_time=:end_time, is_break=:is_break
        WHERE id=:id AND tenant_id=:tid
    """), {
        "id": str(period_id), "tid": str(cu.tenant_id),
        "name": data.name, "period_no": data.period_no,
        "start_time": data.start_time, "end_time": data.end_time,
        "is_break": data.is_break,
    })
    db.commit()
    return {"message": "Updated"}


@router.delete("/periods/{period_id}", status_code=204)
def delete_period(
    period_id: UUID,
    db: Session = Depends(get_db),
    cu: User    = Depends(get_current_user),
):
    db.execute(text("""
        DELETE FROM timetable_periods WHERE id=:id AND tenant_id=:tid
    """), {"id": str(period_id), "tid": str(cu.tenant_id)})
    db.commit()


# ─────────────────────────────────────────────────────────────
#  TIMETABLE ENTRIES
# ─────────────────────────────────────────────────────────────
@router.get("/")
def get_timetable(
    section_id:       UUID           = Query(...),
    academic_year_id: UUID           = Query(...),
    db: Session = Depends(get_db),
    cu: User    = Depends(get_current_user),
):
    """Get full timetable grid for a section."""
    rows = db.execute(text("""
        SELECT
            te.id,
            te.day_of_week,
            te.teacher_name,
            te.room_no,
            tp.id          AS period_id,
            tp.name        AS period_name,
            tp.period_no,
            tp.start_time,
            tp.end_time,
            tp.is_break,
            s.id           AS subject_id,
            s.name         AS subject_name,
            s.code         AS subject_code
        FROM timetable_periods tp
        LEFT JOIN timetable_entries te
            ON  te.period_id        = tp.id
            AND te.section_id       = :section_id
            AND te.academic_year_id = :year_id
        LEFT JOIN subjects s ON s.id = te.subject_id
        WHERE tp.tenant_id = :tid
        ORDER BY tp.period_no, te.day_of_week
    """), {
        "tid":        str(cu.tenant_id),
        "section_id": str(section_id),
        "year_id":    str(academic_year_id),
    }).fetchall()

    # Build grid: { period_id: { day: entry } }
    periods = {}
    for r in rows:
        pid = str(r.period_id)
        if pid not in periods:
            periods[pid] = {
                "period_id":   pid,
                "period_name": r.period_name,
                "period_no":   r.period_no,
                "start_time":  str(r.start_time),
                "end_time":    str(r.end_time),
                "is_break":    r.is_break,
                "days":        {},
            }
        if r.day_of_week:
            periods[pid]["days"][str(r.day_of_week)] = {
                "entry_id":    str(r.id) if r.id else None,
                "subject_id":  str(r.subject_id)   if r.subject_id   else None,
                "subject_name":r.subject_name,
                "subject_code":r.subject_code,
                "teacher_name":r.teacher_name,
                "room_no":     r.room_no,
            }

    return {
        "section_id":       str(section_id),
        "academic_year_id": str(academic_year_id),
        "periods":          list(periods.values()),
    }


@router.post("/entry", status_code=201)
def save_entry(
    data: EntryIn,
    db:   Session = Depends(get_db),
    cu:   User    = Depends(get_current_user),
):
    """Upsert a single timetable cell."""
    try:
        db.execute(text("""
            INSERT INTO timetable_entries
                (tenant_id, academic_year_id, section_id, period_id,
                 day_of_week, subject_id, teacher_name, room_no)
            VALUES
                (:tid, :year_id, :section_id, :period_id,
                 :day_of_week, :subject_id, :teacher_name, :room_no)
            ON CONFLICT (section_id, period_id, day_of_week, academic_year_id)
            DO UPDATE SET
                subject_id   = EXCLUDED.subject_id,
                teacher_name = EXCLUDED.teacher_name,
                room_no      = EXCLUDED.room_no,
                updated_at   = NOW()
        """), {
            "tid":          str(cu.tenant_id),
            "year_id":      str(data.academic_year_id),
            "section_id":   str(data.section_id),
            "period_id":    str(data.period_id),
            "day_of_week":  data.day_of_week,
            "subject_id":   str(data.subject_id) if data.subject_id else None,
            "teacher_name": data.teacher_name,
            "room_no":      data.room_no,
        })
        db.commit()
        return {"message": "Saved"}
    except Exception as e:
        db.rollback()
        raise HTTPException(500, str(e))


@router.delete("/entry")
def delete_entry(
    section_id:       UUID = Query(...),
    academic_year_id: UUID = Query(...),
    period_id:        UUID = Query(...),
    day_of_week:      int  = Query(...),
    db: Session = Depends(get_db),
    cu: User    = Depends(get_current_user),
):
    """Clear a timetable cell."""
    db.execute(text("""
        DELETE FROM timetable_entries
        WHERE section_id       = :section_id
          AND academic_year_id = :year_id
          AND period_id        = :period_id
          AND day_of_week      = :day
          AND tenant_id        = :tid
    """), {
        "section_id": str(section_id),
        "year_id":    str(academic_year_id),
        "period_id":  str(period_id),
        "day":        day_of_week,
        "tid":        str(cu.tenant_id),
    })
    db.commit()
    return {"message": "Cleared"}


@router.post("/bulk-save")
def bulk_save(
    data: BulkEntryIn,
    db:   Session = Depends(get_db),
    cu:   User    = Depends(get_current_user),
):
    """Save all entries for a section at once."""
    saved = 0
    for entry in data.entries:
        try:
            db.execute(text("""
                INSERT INTO timetable_entries
                    (tenant_id, academic_year_id, section_id, period_id,
                     day_of_week, subject_id, teacher_name, room_no)
                VALUES
                    (:tid, :year_id, :section_id, :period_id,
                     :day_of_week, :subject_id, :teacher_name, :room_no)
                ON CONFLICT (section_id, period_id, day_of_week, academic_year_id)
                DO UPDATE SET
                    subject_id   = EXCLUDED.subject_id,
                    teacher_name = EXCLUDED.teacher_name,
                    room_no      = EXCLUDED.room_no,
                    updated_at   = NOW()
            """), {
                "tid":          str(cu.tenant_id),
                "year_id":      str(data.academic_year_id),
                "section_id":   str(data.section_id),
                "period_id":    str(entry["period_id"]),
                "day_of_week":  entry["day_of_week"],
                "subject_id":   entry.get("subject_id"),
                "teacher_name": entry.get("teacher_name"),
                "room_no":      entry.get("room_no"),
            })
            saved += 1
        except Exception:
            continue
    db.commit()
    return {"message": f"Saved {saved} entries"}
