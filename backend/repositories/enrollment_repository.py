# backend/repositories/enrollment_repository.py
# ─────────────────────────────────────────────────────────────
# Separate file for enrollment repository with roll number checks
# ─────────────────────────────────────────────────────────────
from uuid import UUID
from typing import Optional
from sqlalchemy.orm import Session
from models.student import StudentEnrollment
from repositories.base import BaseRepository


class EnrollmentRepository(BaseRepository[StudentEnrollment]):
    def __init__(self, db: Session):
        super().__init__(StudentEnrollment, db)

    def get_current(
        self, student_id: UUID, academic_year_id: UUID
    ) -> Optional[StudentEnrollment]:
        """Get active enrollment for a student in a given year."""
        return (
            self.db.query(StudentEnrollment)
            .filter(
                StudentEnrollment.student_id       == student_id,
                StudentEnrollment.academic_year_id == academic_year_id,
                StudentEnrollment.status           == "active",
            )
            .first()
        )

    def roll_no_exists(
        self,
        section_id:       UUID,
        academic_year_id: UUID,
        roll_no:          int,
        exclude_student_id: Optional[UUID] = None,
    ) -> bool:
        """
        Check if a roll number is already taken in this section+year.
        Pass exclude_student_id to allow a student to keep their own roll number.
        """
        q = (
            self.db.query(StudentEnrollment)
            .filter(
                StudentEnrollment.section_id       == section_id,
                StudentEnrollment.academic_year_id == academic_year_id,
                StudentEnrollment.roll_no          == roll_no,
                StudentEnrollment.status           == "active",
            )
        )
        if exclude_student_id:
            q = q.filter(StudentEnrollment.student_id != exclude_student_id)
        return q.first() is not None

    def update_roll_no(
        self,
        student_id:       UUID,
        section_id:       UUID,
        academic_year_id: UUID,
        roll_no:          int,
    ) -> Optional[StudentEnrollment]:
        """Update just the roll number for an existing active enrollment."""
        enrollment = (
            self.db.query(StudentEnrollment)
            .filter(
                StudentEnrollment.student_id       == student_id,
                StudentEnrollment.section_id       == section_id,
                StudentEnrollment.academic_year_id == academic_year_id,
                StudentEnrollment.status           == "active",
            )
            .first()
        )
        if enrollment:
            enrollment.roll_no = roll_no
            self.db.commit()
            self.db.refresh(enrollment)
        return enrollment

    def get_section_roll_numbers(
        self, section_id: UUID, academic_year_id: UUID
    ) -> list[int]:
        """Return all taken roll numbers in a section."""
        rows = (
            self.db.query(StudentEnrollment.roll_no)
            .filter(
                StudentEnrollment.section_id       == section_id,
                StudentEnrollment.academic_year_id == academic_year_id,
                StudentEnrollment.status           == "active",
                StudentEnrollment.roll_no          != None,
            )
            .all()
        )
        return sorted([r[0] for r in rows])
