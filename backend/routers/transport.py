# backend/routers/transport.py
from uuid import UUID
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel, field_validator

from database import get_db
from routers.auth import get_current_user
from models.user import User

router = APIRouter()


# ─────────────────────────────────────────────────────────────
#  SCHEMAS
# ─────────────────────────────────────────────────────────────
class RouteIn(BaseModel):
    name:        str
    route_no:    str
    start_point: Optional[str]   = None
    end_point:   Optional[str]   = None
    distance_km: Optional[float] = None
    fare:        float            = 0
    is_active:   bool             = True
    model_config = {"extra": "ignore"}

    @field_validator("distance_km", mode="before")
    @classmethod
    def clean_distance(cls, v):
        if v == "" or v is None: return None
        try: return float(v)
        except: return None

    @field_validator("start_point", "end_point", mode="before")
    @classmethod
    def clean_str(cls, v):
        return None if v == "" else v


class StopIn(BaseModel):
    name:        str
    stop_no:     int    = 1
    pickup_time: Optional[str] = None
    drop_time:   Optional[str] = None
    fare:        float          = 0

    @field_validator("pickup_time", "drop_time", mode="before")
    @classmethod
    def clean_time(cls, v):
        return None if v == "" else v

    @field_validator("stop_no", mode="before")
    @classmethod
    def parse_no(cls, v):
        try: return int(v)
        except: return 1


class VehicleIn(BaseModel):
    vehicle_no:       str
    vehicle_type:     str            = "bus"
    make_model:       Optional[str]  = None
    capacity:         int            = 40
    driver_name:      Optional[str]  = None
    driver_phone:     Optional[str]  = None
    conductor_name:   Optional[str]  = None
    conductor_phone:  Optional[str]  = None
    route_id:         Optional[UUID] = None
    insurance_expiry: Optional[str]  = None
    fitness_expiry:   Optional[str]  = None
    is_active:        bool           = True
    model_config = {"extra": "ignore"}

    @field_validator(
        "make_model","driver_name","driver_phone",
        "conductor_name","conductor_phone",
        "insurance_expiry","fitness_expiry", mode="before"
    )
    @classmethod
    def clean_opt(cls, v):
        return None if v == "" else v

    @field_validator("route_id", mode="before")
    @classmethod
    def clean_uuid(cls, v):
        return None if (v == "" or v is None) else v


class StudentTransportIn(BaseModel):
    student_id:       UUID
    route_id:         UUID
    stop_id:          Optional[UUID] = None
    vehicle_id:       Optional[UUID] = None
    pickup_type:      str            = "both"
    academic_year_id: Optional[UUID] = None
    is_active:        bool           = True


# ─────────────────────────────────────────────────────────────
#  DASHBOARD SUMMARY  — safe version with error handling
# ─────────────────────────────────────────────────────────────
@router.get("/summary")
def transport_summary(
    db: Session = Depends(get_db),
    cu: User    = Depends(get_current_user),
):
    tid = str(cu.tenant_id)
    try:
        routes = db.execute(text(
            "SELECT COUNT(*)::int FROM transport_routes WHERE tenant_id=:tid AND is_active=true"
        ), {"tid": tid}).scalar() or 0
    except Exception:
        routes = 0

    try:
        vehicles = db.execute(text(
            "SELECT COUNT(*)::int FROM transport_vehicles WHERE tenant_id=:tid AND is_active=true"
        ), {"tid": tid}).scalar() or 0
    except Exception:
        vehicles = 0

    try:
        students = db.execute(text(
            "SELECT COUNT(*)::int FROM student_transport WHERE tenant_id=:tid AND is_active=true"
        ), {"tid": tid}).scalar() or 0
    except Exception:
        students = 0

    try:
        expiring = db.execute(text("""
            SELECT COUNT(*)::int FROM transport_vehicles
            WHERE tenant_id=:tid
              AND (
                fitness_expiry   < CURRENT_DATE + INTERVAL '30 days'
                OR insurance_expiry < CURRENT_DATE + INTERVAL '30 days'
              )
        """), {"tid": tid}).scalar() or 0
    except Exception:
        expiring = 0

    return {
        "total_routes":   routes,
        "total_vehicles": vehicles,
        "total_students": students,
        "expiring_soon":  expiring,
    }


# ─────────────────────────────────────────────────────────────
#  ROUTES
# ─────────────────────────────────────────────────────────────
@router.get("/routes")
def list_routes(
    db: Session = Depends(get_db),
    cu: User    = Depends(get_current_user),
):
    try:
        rows = db.execute(text("""
            SELECT
                r.id, r.name, r.route_no, r.start_point, r.end_point,
                r.distance_km, r.fare, r.is_active,
                COUNT(DISTINCT s.id)::int  AS stop_count,
                COUNT(DISTINCT v.id)::int  AS vehicle_count
            FROM transport_routes r
            LEFT JOIN transport_stops    s ON s.route_id = r.id
            LEFT JOIN transport_vehicles v ON v.route_id = r.id
            WHERE r.tenant_id = :tid
            GROUP BY r.id, r.name, r.route_no, r.start_point,
                     r.end_point, r.distance_km, r.fare, r.is_active
            ORDER BY r.route_no
        """), {"tid": str(cu.tenant_id)}).fetchall()
    except Exception as e:
        raise HTTPException(500, f"Failed to load routes: {str(e)}")

    return [
        {
            "id":            str(r.id),
            "name":          r.name,
            "route_no":      r.route_no,
            "start_point":   r.start_point,
            "end_point":     r.end_point,
            "distance_km":   float(r.distance_km) if r.distance_km else None,
            "fare":          float(r.fare),
            "is_active":     r.is_active,
            "stop_count":    r.stop_count,
            "vehicle_count": r.vehicle_count,
        }
        for r in rows
    ]


@router.post("/routes", status_code=201)
def create_route(
    data: RouteIn,
    db:   Session = Depends(get_db),
    cu:   User    = Depends(get_current_user),
):
    try:
        r = db.execute(text("""
            INSERT INTO transport_routes
                (tenant_id, name, route_no, start_point, end_point,
                 distance_km, fare, is_active)
            VALUES (:tid,:name,:route_no,:start,:end,:dist,:fare,:active)
            RETURNING id
        """), {
            "tid":     str(cu.tenant_id),
            "name":    data.name,
            "route_no":data.route_no,
            "start":   data.start_point,
            "end":     data.end_point,
            "dist":    data.distance_km,
            "fare":    data.fare,
            "active":  data.is_active,
        }).fetchone()
        db.commit()
        return {"id": str(r.id), "name": data.name}
    except Exception as e:
        db.rollback()
        if "unique" in str(e).lower():
            raise HTTPException(409, f"Route No '{data.route_no}' already exists")
        raise HTTPException(500, f"Failed to create route: {str(e)}")


@router.put("/routes/{route_id}")
def update_route(
    route_id: UUID, data: RouteIn,
    db: Session = Depends(get_db),
    cu: User    = Depends(get_current_user),
):
    try:
        db.execute(text("""
            UPDATE transport_routes
            SET name=:name, route_no=:route_no, start_point=:start,
                end_point=:end, distance_km=:dist, fare=:fare, is_active=:active
            WHERE id=:id AND tenant_id=:tid
        """), {
            "id": str(route_id), "tid": str(cu.tenant_id),
            "name": data.name, "route_no": data.route_no,
            "start": data.start_point, "end": data.end_point,
            "dist": data.distance_km, "fare": data.fare,
            "active": data.is_active,
        })
        db.commit()
        return {"message": "Updated"}
    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"Failed to update route: {str(e)}")


@router.delete("/routes/{route_id}", status_code=204)
def delete_route(
    route_id: UUID,
    db: Session = Depends(get_db),
    cu: User    = Depends(get_current_user),
):
    try:
        db.execute(text(
            "DELETE FROM transport_routes WHERE id=:id AND tenant_id=:tid"
        ), {"id": str(route_id), "tid": str(cu.tenant_id)})
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(500, str(e))


# ─────────────────────────────────────────────────────────────
#  STOPS
# ─────────────────────────────────────────────────────────────
@router.get("/routes/{route_id}/stops")
def list_stops(
    route_id: UUID,
    db: Session = Depends(get_db),
    cu: User    = Depends(get_current_user),
):
    rows = db.execute(text("""
        SELECT id, name, stop_no, pickup_time, drop_time, fare
        FROM transport_stops
        WHERE route_id = :rid
        ORDER BY stop_no
    """), {"rid": str(route_id)}).fetchall()
    return [
        {
            "id":          str(r.id),
            "name":        r.name,
            "stop_no":     r.stop_no,
            "pickup_time": str(r.pickup_time) if r.pickup_time else None,
            "drop_time":   str(r.drop_time)   if r.drop_time   else None,
            "fare":        float(r.fare),
        }
        for r in rows
    ]


@router.post("/routes/{route_id}/stops", status_code=201)
def create_stop(
    route_id: UUID, data: StopIn,
    db: Session = Depends(get_db),
    cu: User    = Depends(get_current_user),
):
    try:
        r = db.execute(text("""
            INSERT INTO transport_stops
                (route_id, name, stop_no, pickup_time, drop_time, fare)
            VALUES (:rid,:name,:stop_no,:pickup,:drop,:fare)
            RETURNING id
        """), {
            "rid": str(route_id), "name": data.name,
            "stop_no": data.stop_no,
            "pickup": data.pickup_time,
            "drop":   data.drop_time,
            "fare":   data.fare,
        }).fetchone()
        db.commit()
        return {"id": str(r.id), "name": data.name}
    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"Failed to add stop: {str(e)}")


@router.put("/stops/{stop_id}")
def update_stop(
    stop_id: UUID, data: StopIn,
    db: Session = Depends(get_db),
    cu: User    = Depends(get_current_user),
):
    try:
        db.execute(text("""
            UPDATE transport_stops
            SET name=:name, stop_no=:stop_no,
                pickup_time=:pickup, drop_time=:drop, fare=:fare
            WHERE id=:id
        """), {
            "id": str(stop_id), "name": data.name,
            "stop_no": data.stop_no,
            "pickup": data.pickup_time,
            "drop":   data.drop_time,
            "fare":   data.fare,
        })
        db.commit()
        return {"message": "Updated"}
    except Exception as e:
        db.rollback()
        raise HTTPException(500, str(e))


@router.delete("/stops/{stop_id}", status_code=204)
def delete_stop(
    stop_id: UUID,
    db: Session = Depends(get_db),
    cu: User    = Depends(get_current_user),
):
    db.execute(text("DELETE FROM transport_stops WHERE id=:id"), {"id": str(stop_id)})
    db.commit()


# ─────────────────────────────────────────────────────────────
#  VEHICLES
# ─────────────────────────────────────────────────────────────
@router.get("/vehicles")
def list_vehicles(
    db: Session = Depends(get_db),
    cu: User    = Depends(get_current_user),
):
    try:
        rows = db.execute(text("""
            SELECT
                v.id, v.vehicle_no, v.vehicle_type, v.make_model,
                v.capacity, v.driver_name, v.driver_phone,
                v.conductor_name, v.conductor_phone,
                v.route_id, v.insurance_expiry, v.fitness_expiry, v.is_active,
                r.name     AS route_name,
                r.route_no AS route_no
            FROM transport_vehicles v
            LEFT JOIN transport_routes r ON r.id = v.route_id
            WHERE v.tenant_id = :tid
            ORDER BY v.vehicle_no
        """), {"tid": str(cu.tenant_id)}).fetchall()
    except Exception as e:
        raise HTTPException(500, f"Failed to load vehicles: {str(e)}")

    return [
        {
            "id":               str(r.id),
            "vehicle_no":       r.vehicle_no,
            "vehicle_type":     r.vehicle_type,
            "make_model":       r.make_model,
            "capacity":         r.capacity,
            "driver_name":      r.driver_name,
            "driver_phone":     r.driver_phone,
            "conductor_name":   r.conductor_name,
            "conductor_phone":  r.conductor_phone,
            "route_id":         str(r.route_id) if r.route_id else None,
            "route_name":       r.route_name,
            "route_no":         r.route_no,
            "insurance_expiry": str(r.insurance_expiry) if r.insurance_expiry else None,
            "fitness_expiry":   str(r.fitness_expiry)   if r.fitness_expiry   else None,
            "is_active":        r.is_active,
        }
        for r in rows
    ]


@router.post("/vehicles", status_code=201)
def create_vehicle(
    data: VehicleIn,
    db:   Session = Depends(get_db),
    cu:   User    = Depends(get_current_user),
):
    try:
        r = db.execute(text("""
            INSERT INTO transport_vehicles
                (tenant_id, vehicle_no, vehicle_type, make_model, capacity,
                 driver_name, driver_phone, conductor_name, conductor_phone,
                 route_id, insurance_expiry, fitness_expiry, is_active)
            VALUES
                (:tid,:vno,:vtype,:model,:cap,
                 :dname,:dphone,:cname,:cphone,
                 :rid,:ins,:fit,:active)
            RETURNING id
        """), {
            "tid":    str(cu.tenant_id),
            "vno":    data.vehicle_no,
            "vtype":  data.vehicle_type,
            "model":  data.make_model,
            "cap":    data.capacity,
            "dname":  data.driver_name,
            "dphone": data.driver_phone,
            "cname":  data.conductor_name,
            "cphone": data.conductor_phone,
            "rid":    str(data.route_id) if data.route_id else None,
            "ins":    data.insurance_expiry,
            "fit":    data.fitness_expiry,
            "active": data.is_active,
        }).fetchone()
        db.commit()
        return {"id": str(r.id), "vehicle_no": data.vehicle_no}
    except Exception as e:
        db.rollback()
        if "unique" in str(e).lower():
            raise HTTPException(409, f"Vehicle '{data.vehicle_no}' already exists")
        raise HTTPException(500, f"Failed to create vehicle: {str(e)}")


@router.put("/vehicles/{vehicle_id}")
def update_vehicle(
    vehicle_id: UUID, data: VehicleIn,
    db: Session = Depends(get_db),
    cu: User    = Depends(get_current_user),
):
    try:
        db.execute(text("""
            UPDATE transport_vehicles
            SET vehicle_no=:vno, vehicle_type=:vtype, make_model=:model,
                capacity=:cap, driver_name=:dname, driver_phone=:dphone,
                conductor_name=:cname, conductor_phone=:cphone,
                route_id=:rid, insurance_expiry=:ins,
                fitness_expiry=:fit, is_active=:active
            WHERE id=:id AND tenant_id=:tid
        """), {
            "id":     str(vehicle_id),
            "tid":    str(cu.tenant_id),
            "vno":    data.vehicle_no,
            "vtype":  data.vehicle_type,
            "model":  data.make_model,
            "cap":    data.capacity,
            "dname":  data.driver_name,
            "dphone": data.driver_phone,
            "cname":  data.conductor_name,
            "cphone": data.conductor_phone,
            "rid":    str(data.route_id) if data.route_id else None,
            "ins":    data.insurance_expiry,
            "fit":    data.fitness_expiry,
            "active": data.is_active,
        })
        db.commit()
        return {"message": "Updated"}
    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"Failed to update vehicle: {str(e)}")


@router.delete("/vehicles/{vehicle_id}", status_code=204)
def delete_vehicle(
    vehicle_id: UUID,
    db: Session = Depends(get_db),
    cu: User    = Depends(get_current_user),
):
    try:
        db.execute(text(
            "DELETE FROM transport_vehicles WHERE id=:id AND tenant_id=:tid"
        ), {"id": str(vehicle_id), "tid": str(cu.tenant_id)})
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(500, str(e))


# ─────────────────────────────────────────────────────────────
#  STUDENT ASSIGNMENTS
# ─────────────────────────────────────────────────────────────
@router.get("/students")
def list_student_transport(
    route_id:         Optional[UUID] = Query(None),
    academic_year_id: Optional[UUID] = Query(None),
    db: Session = Depends(get_db),
    cu: User    = Depends(get_current_user),
):
    params = {"tid": str(cu.tenant_id)}
    extra  = ""
    if route_id:
        extra += " AND st.route_id = :route_id"
        params["route_id"] = str(route_id)
    if academic_year_id:
        extra += " AND st.academic_year_id = :yr_id"
        params["yr_id"] = str(academic_year_id)

    try:
        rows = db.execute(text(f"""
            SELECT
                st.id, st.pickup_type, st.is_active,
                s.id         AS student_id,
                s.first_name, s.last_name, s.admission_no,
                r.id         AS route_id,
                r.name       AS route_name,
                r.route_no,
                ts.id        AS stop_id,
                ts.name      AS stop_name,
                ts.pickup_time,
                ts.drop_time,
                v.vehicle_no,
                g.name       AS grade_name,
                sec.name     AS section_name
            FROM student_transport st
            JOIN students s              ON s.id  = st.student_id
            JOIN transport_routes r      ON r.id  = st.route_id
            LEFT JOIN transport_stops ts ON ts.id = st.stop_id
            LEFT JOIN transport_vehicles v ON v.id = st.vehicle_id
            LEFT JOIN student_enrollments se
                ON se.student_id = s.id AND se.status = 'active'
            LEFT JOIN sections sec ON sec.id = se.section_id
            LEFT JOIN grades   g   ON g.id   = sec.grade_id
            WHERE st.tenant_id = :tid {extra}
            ORDER BY r.route_no, ts.stop_no NULLS LAST, s.first_name
        """), params).fetchall()
    except Exception as e:
        raise HTTPException(500, f"Failed to load student transport: {str(e)}")

    return [
        {
            "id":           str(r.id),
            "student_id":   str(r.student_id),
            "student_name": f"{r.first_name} {r.last_name or ''}".strip(),
            "admission_no": r.admission_no,
            "grade_name":   r.grade_name,
            "section_name": r.section_name,
            "route_id":     str(r.route_id),
            "route_name":   r.route_name,
            "route_no":     r.route_no,
            "stop_id":      str(r.stop_id)      if r.stop_id      else None,
            "stop_name":    r.stop_name,
            "pickup_time":  str(r.pickup_time)  if r.pickup_time  else None,
            "drop_time":    str(r.drop_time)    if r.drop_time    else None,
            "vehicle_no":   r.vehicle_no,
            "pickup_type":  r.pickup_type,
            "is_active":    r.is_active,
        }
        for r in rows
    ]


@router.post("/students", status_code=201)
def assign_student(
    data: StudentTransportIn,
    db:   Session = Depends(get_db),
    cu:   User    = Depends(get_current_user),
):
    try:
        db.execute(text("""
            INSERT INTO student_transport
                (tenant_id, student_id, route_id, stop_id,
                 vehicle_id, pickup_type, academic_year_id, is_active)
            VALUES
                (:tid,:sid,:rid,:stop_id,:vid,:ptype,:yr_id,:active)
            ON CONFLICT (student_id, academic_year_id)
            DO UPDATE SET
                route_id    = EXCLUDED.route_id,
                stop_id     = EXCLUDED.stop_id,
                vehicle_id  = EXCLUDED.vehicle_id,
                pickup_type = EXCLUDED.pickup_type,
                is_active   = EXCLUDED.is_active
        """), {
            "tid":    str(cu.tenant_id),
            "sid":    str(data.student_id),
            "rid":    str(data.route_id),
            "stop_id":str(data.stop_id)       if data.stop_id       else None,
            "vid":    str(data.vehicle_id)    if data.vehicle_id    else None,
            "ptype":  data.pickup_type,
            "yr_id":  str(data.academic_year_id) if data.academic_year_id else None,
            "active": data.is_active,
        })
        db.commit()
        return {"message": "Student assigned to transport"}
    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"Assignment failed: {str(e)}")


@router.delete("/students/{assignment_id}", status_code=204)
def remove_student(
    assignment_id: UUID,
    db: Session = Depends(get_db),
    cu: User    = Depends(get_current_user),
):
    try:
        db.execute(text("""
            DELETE FROM student_transport
            WHERE id=:id AND tenant_id=:tid
        """), {"id": str(assignment_id), "tid": str(cu.tenant_id)})
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(500, str(e))
