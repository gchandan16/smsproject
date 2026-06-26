# backend/services/attendance_service.py
from uuid import UUID
from datetime import date
from typing import Optional, List
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from logger_config import logger

from repositories.attendance_repository import AttendanceRepository, HolidayRepository
from models.attendance import Holiday


class AttendanceService:
    def __init__(self, db: Session):
        self.repo         = AttendanceRepository(db)
        self.holiday_repo = HolidayRepository(db)
        self.db           = db

    # ── Mark single ───────────────────────────────────────────
    def mark(self, tenant_id, enrollment_id, att_date,
             att_status, marked_by, period_no=None, remarks=None):
        self._validate_status(att_status)
        try:
            self.repo.upsert(
                tenant_id=tenant_id, enrollment_id=enrollment_id,
                att_date=att_date, status=att_status,
                marked_by=marked_by, period_no=period_no, remarks=remarks,
            )
            self.db.commit()
            return {"message": "Attendance marked", "status": att_status}
        except Exception as e:
            self.db.rollback()
            raise HTTPException(500, f"Failed to mark attendance: {str(e)}")

    # ── Bulk mark ─────────────────────────────────────────────
    def bulk_mark(self, tenant_id, section_id, att_date,
                  records, marked_by, period_no=None):

        logger.info(
            "Attandance record created - tenant_id=%s, section_id=%s, att_date=%s, period_no=%s, records=%s,marked_by=%s,period_no=%s",
            tenant_id,
            section_id,
            att_date,
            period_no,
            records,
            marked_by,
            period_no
        )          
        if not records:
            raise HTTPException(400, "No records provided")
        for rec in records:
            self._validate_status(rec.get("status", "present"))
        try:
            count = self.repo.bulk_upsert(
                tenant_id=tenant_id, records=records,
                att_date=att_date, marked_by=marked_by
                #, period_no=period_no,
            )
            self.db.commit()
            summary = {}
            for rec in records:
                s = rec.get("status", "present")
                summary[s] = summary.get(s, 0) + 1
            return {
                "message": f"Attendance saved for {count} students",
                "date":    str(att_date),
                "total":   count,
                "summary": summary,
            }
        except Exception as e:
            self.db.rollback()
            raise HTTPException(500, f"Failed to save attendance: {str(e)}")

    # ── Get section attendance ────────────────────────────────
    def get_section_attendance(self, section_id, tenant_id, att_date, period_no=None):
        try:
            logger.info(
                    "section_id=%s, tenant_id=%s, att_date=%s, period_no=%s",
                    section_id,
                    tenant_id,
                    att_date,
                    period_no
                )

            students       = self.repo.get_section_date_attendance(section_id, tenant_id, att_date, period_no)
            already_marked = self.repo.check_already_marked(section_id, att_date, period_no)
            is_holiday     = self.holiday_repo.is_holiday(tenant_id, att_date)
            result = {
                "date":           str(att_date),
                "section_id":     str(section_id),
                "already_marked": already_marked,
                "is_holiday":     is_holiday,
                "students":       students,
                "total":          len(students),
            }
            logger.info(
                    "students=%s, already_marked=%s, is_holiday=%s",
                   result["students"], result["already_marked"], result["is_holiday"]
                )
            return result
        except Exception as e:
            raise HTTPException(500, f"Failed to load attendance: {str(e)}")

    # ── Student summary ───────────────────────────────────────
    def get_student_summary(self, enrollment_id, from_date, to_date):
        try:
            return self.repo.get_student_summary_raw(enrollment_id, from_date, to_date)
        except Exception as e:
            raise HTTPException(500, f"Student summary error: {str(e)}")

    # ── Section summary ───────────────────────────────────────
    def get_section_summary(self, section_id, from_date, to_date):
        try:
            return self.repo.get_section_summary_raw(section_id, from_date, to_date)
        except Exception as e:
            raise HTTPException(500, f"Section summary error: {str(e)}")

    # ── Monthly heatmap ───────────────────────────────────────
    def get_monthly(self, enrollment_id, year, month):
        try:
            return self.repo.get_monthly_raw(enrollment_id, year, month)
        except Exception as e:
            raise HTTPException(500, f"Monthly error: {str(e)}")

    # ── Low attendance ────────────────────────────────────────
    def get_low_attendance(self, tenant_id, academic_year_id, threshold=75.0):
        try:
            return self.repo.get_low_attendance_raw(tenant_id, academic_year_id, threshold)
        except Exception as e:
            raise HTTPException(500, f"Low attendance error: {str(e)}")

    # ── Holidays ──────────────────────────────────────────────
    def list_holidays(self, tenant_id, from_date, to_date):
        return self.holiday_repo.get_holidays_in_range(tenant_id, from_date, to_date)

    def add_holiday(self, tenant_id, att_date, name, htype):
        try:
            h = Holiday(tenant_id=tenant_id, date=att_date, name=name, type=htype)
            result = self.holiday_repo.create(h)
            return result
        except Exception as e:
            self.db.rollback()
            raise HTTPException(500, f"Failed to add holiday: {str(e)}")

    def delete_holiday(self, holiday_id, tenant_id):
        h = self.db.query(Holiday).filter(
            Holiday.id == holiday_id, Holiday.tenant_id == tenant_id
        ).first()
        if not h:
            raise HTTPException(404, "Holiday not found")
        try:
            self.holiday_repo.delete(h)
        except Exception as e:
            self.db.rollback()
            raise HTTPException(500, f"Failed to delete holiday: {str(e)}")

    @staticmethod
    def _validate_status(s):
        valid = {"present", "absent", "late", "holiday"}
        if s not in valid:
            raise HTTPException(400, f"Invalid status '{s}'. Use: {', '.join(sorted(valid))}")
