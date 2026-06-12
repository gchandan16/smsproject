# backend/routers/teacher_room.py
from uuid import UUID
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
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
class TeacherIn(BaseModel):
    name:        str
    email:       Optional[str] = None
    phone:       Optional[str] = None
    employee_no: Optional[str] = None
    department:  Optional[str] = None
    designation: Optional[str] = None
    is_active:   bool          = True
    subject_ids: List[str]     = []   # list of subject UUIDs
    model_config = {"extra": "ignore"}


class RoomIn(BaseModel):
    name:      str
    room_no:   str
    room_type: str    = "classroom"
    capacity:  int    = 40
    floor_no:  Optional[int] = None
    building:  Optional[str] = None
    is_active: bool   = True
    model_config = {"extra": "ignore"}


# ─────────────────────────────────────────────────────────────
#  TEACHERS
# ─────────────────────────────────────────────────────────────
@router.get("/teachers")
def list_teachers(
    db: Session = Depends(get_db),
    cu: User    = Depends(get_current_user),
):
    rows = db.execute(text("""
        SELECT
            t.id, t.name, t.email, t.phone,
            t.employee_no, t.department, t.designation,
            t.is_active,
            COALESCE(
                JSON_AGG(
                    JSON_BUILD_OBJECT(
                        'subject_id',   ts.subject_id,
                        'subject_name', s.name,
                        'subject_code', s.code
                    )
                ) FILTER (WHERE ts.subject_id IS NOT NULL),
                '[]'
            ) AS subjects
        FROM teachers t
        LEFT JOIN teacher_subjects ts ON ts.teacher_id = t.id
        LEFT JOIN subjects s          ON s.id = ts.subject_id
        WHERE t.tenant_id = :tid
        GROUP BY t.id, t.name, t.email, t.phone,
                 t.employee_no, t.department, t.designation, t.is_active
        ORDER BY t.name
    """), {"tid": str(cu.tenant_id)}).fetchall()

    return [
        {
            "id":          str(r.id),
            "name":        r.name,
            "email":       r.email,
            "phone":       r.phone,
            "employee_no": r.employee_no,
            "department":  r.department,
            "designation": r.designation,
            "is_active":   r.is_active,
            "subjects":    r.subjects if r.subjects else [],
        }
        for r in rows
    ]


@router.post("/teachers", status_code=201)
def create_teacher(
    data: TeacherIn,
    db:   Session = Depends(get_db),
    cu:   User    = Depends(get_current_user),
):
    try:
        result = db.execute(text("""
            INSERT INTO teachers
                (tenant_id, name, email, phone, employee_no,
                 department, designation, is_active)
            VALUES
                (:tid, :name, :email, :phone, :emp_no,
                 :dept, :desig, :active)
            RETURNING id
        """), {
            "tid":    str(cu.tenant_id),
            "name":   data.name,
            "email":  data.email,
            "phone":  data.phone,
            "emp_no": data.employee_no,
            "dept":   data.department,
            "desig":  data.designation,
            "active": data.is_active,
        }).fetchone()

        teacher_id = str(result.id)

        # Link subjects
        for sid in data.subject_ids:
            db.execute(text("""
                INSERT INTO teacher_subjects (teacher_id, subject_id)
                VALUES (:tid, :sid)
                ON CONFLICT DO NOTHING
            """), {"tid": teacher_id, "sid": sid})

        db.commit()
        return {"id": teacher_id, "name": data.name, "message": "Teacher created"}

    except Exception as e:
        db.rollback()
        err = str(e).lower()
        if "unique" in err or "duplicate" in err:
            raise HTTPException(409, f"Employee No '{data.employee_no}' already exists")
        raise HTTPException(500, f"Failed: {str(e)}")


@router.put("/teachers/{teacher_id}")
def update_teacher(
    teacher_id: UUID,
    data:       TeacherIn,
    db:         Session = Depends(get_db),
    cu:         User    = Depends(get_current_user),
):
    db.execute(text("""
        UPDATE teachers
        SET name=:name, email=:email, phone=:phone,
            employee_no=:emp_no, department=:dept,
            designation=:desig, is_active=:active
        WHERE id=:id AND tenant_id=:tid
    """), {
        "id": str(teacher_id), "tid": str(cu.tenant_id),
        "name": data.name,   "email": data.email,
        "phone": data.phone, "emp_no": data.employee_no,
        "dept":  data.department, "desig": data.designation,
        "active": data.is_active,
    })

    # Replace subject links
    db.execute(text("DELETE FROM teacher_subjects WHERE teacher_id = :tid"),
               {"tid": str(teacher_id)})
    for sid in data.subject_ids:
        db.execute(text("""
            INSERT INTO teacher_subjects (teacher_id, subject_id)
            VALUES (:tid, :sid) ON CONFLICT DO NOTHING
        """), {"tid": str(teacher_id), "sid": sid})

    db.commit()
    return {"message": "Updated"}


@router.delete("/teachers/{teacher_id}", status_code=204)
def delete_teacher(
    teacher_id: UUID,
    db:  Session = Depends(get_db),
    cu:  User    = Depends(get_current_user),
):
    db.execute(text(
        "DELETE FROM teachers WHERE id=:id AND tenant_id=:tid"
    ), {"id": str(teacher_id), "tid": str(cu.tenant_id)})
    db.commit()


# ─────────────────────────────────────────────────────────────
#  ROOMS
# ─────────────────────────────────────────────────────────────
@router.get("/rooms")
def list_rooms(
    db: Session = Depends(get_db),
    cu: User    = Depends(get_current_user),
):
    rows = db.execute(text("""
        SELECT id, name, room_no, room_type, capacity,
               floor_no, building, is_active
        FROM rooms
        WHERE tenant_id = :tid
        ORDER BY room_no
    """), {"tid": str(cu.tenant_id)}).fetchall()

    return [
        {
            "id":        str(r.id),
            "name":      r.name,
            "room_no":   r.room_no,
            "room_type": r.room_type,
            "capacity":  r.capacity,
            "floor_no":  r.floor_no,
            "building":  r.building,
            "is_active": r.is_active,
        }
        for r in rows
    ]


@router.post("/rooms", status_code=201)
def create_room(
    data: RoomIn,
    db:   Session = Depends(get_db),
    cu:   User    = Depends(get_current_user),
):
    try:
        result = db.execute(text("""
            INSERT INTO rooms
                (tenant_id, name, room_no, room_type,
                 capacity, floor_no, building, is_active)
            VALUES
                (:tid, :name, :room_no, :room_type,
                 :capacity, :floor_no, :building, :active)
            RETURNING id
        """), {
            "tid":      str(cu.tenant_id),
            "name":     data.name,
            "room_no":  data.room_no,
            "room_type":data.room_type,
            "capacity": int(data.capacity) if data.capacity else 40,
            "floor_no": int(data.floor_no) if data.floor_no not in (None, '') else None,
            "building": data.building or None,
            "active":   data.is_active,
        }).fetchone()
        db.commit()
        return {"id": str(result.id), "name": data.name}
    except Exception as e:
        db.rollback()
        if "unique" in str(e).lower():
            raise HTTPException(409, f"Room No '{data.room_no}' already exists")
        raise HTTPException(500, str(e))


@router.put("/rooms/{room_id}")
def update_room(
    room_id: UUID,
    data:    RoomIn,
    db:      Session = Depends(get_db),
    cu:      User    = Depends(get_current_user),
):
    # Sanitize: floor_no must be int or None, never empty string
    floor_no = data.floor_no
    if floor_no == '' or floor_no is None:
        floor_no = None
    else:
        try:
            floor_no = int(floor_no)
        except (ValueError, TypeError):
            floor_no = None

    try:
        db.execute(text("""
            UPDATE rooms
            SET name=:name, room_no=:room_no, room_type=:room_type,
                capacity=:capacity, floor_no=:floor_no,
                building=:building, is_active=:active
            WHERE id=:id AND tenant_id=:tid
        """), {
            "id": str(room_id), "tid": str(cu.tenant_id),
            "name": data.name,   "room_no": data.room_no,
            "room_type": data.room_type,
            "capacity": int(data.capacity) if data.capacity else 40,
            "floor_no": floor_no,
            "building": data.building or None,
            "active": data.is_active,
        })
        db.commit()
        return {"message": "Updated"}
    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"Update failed: {str(e)}")


@router.delete("/rooms/{room_id}", status_code=204)
def delete_room(
    room_id: UUID,
    db:  Session = Depends(get_db),
    cu:  User    = Depends(get_current_user),
):
    db.execute(text(
        "DELETE FROM rooms WHERE id=:id AND tenant_id=:tid"
    ), {"id": str(room_id), "tid": str(cu.tenant_id)})
    db.commit()
