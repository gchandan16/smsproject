# backend/repositories/student_repository.py
from uuid import UUID
from typing import Optional, List, Tuple
from sqlalchemy.orm import Session, joinedload, contains_eager
from sqlalchemy import or_, func, text

from repositories.base import BaseRepository
from models.student import Student, Guardian, Grade, Section, StudentEnrollment


class StudentRepository(BaseRepository[Student]):
    def __init__(self, db: Session):
        super().__init__(Student, db)

    # ── Single fetch ──────────────────────────────────────────
    def get_by_id_full(self, student_id: UUID, tenant_id: UUID) -> Optional[Student]:
        """Fetch student with guardians + enrollments + section + grade."""
        return (
            self.db.query(Student)
            .options(
                joinedload(Student.guardians),
                joinedload(Student.enrollments)
                    .joinedload(StudentEnrollment.section)
                    .joinedload(Section.grade),
            )
            .filter(Student.id == student_id, Student.tenant_id == tenant_id)
            .first()
        )

    def get_by_admission_no(self, admission_no: str, tenant_id: UUID) -> Optional[Student]:
        return (
            self.db.query(Student)
            .filter(Student.admission_no == admission_no.upper(),
                    Student.tenant_id == tenant_id)
            .first()
        )

    # ── List with search + pagination (via stored function) ──
    def list_students(
        self,
        tenant_id:   UUID,
        search:      Optional[str] = None,
        gender:      Optional[str] = None,
        is_active:   Optional[bool] = True,
        grade_id:    Optional[UUID] = None,
        section_id:  Optional[UUID] = None,
        academic_year_id: Optional[UUID] = None,
        skip:        int = 0,
        limit:       int = 50,
    ) -> Tuple[List[dict], int]:
        """
        Returns (students, total_count) for pagination.

        Calls fn_list_students(...) — a Postgres function that returns the
        paginated rows AND the total count (via a window function) in a
        single round-trip, instead of running a separate COUNT(*) query.

        NOTE: this returns plain dicts (not SQLAlchemy Student ORM objects),
        since the function already joins in the section/grade label directly.
        The service layer's StudentOut mapping must read from dict keys
        instead of ORM attributes when this path is used.
        """
        rows = self.db.execute(
            text("""
                SELECT * FROM fn_list_students(
                    :tenant_id, :search, :gender, :is_active,
                    :grade_id, :section_id, :academic_year_id,
                    :skip, :limit
                )
            """),
            {
                "tenant_id": str(tenant_id),
                "search": search,
                "gender": gender,
                "is_active": is_active,
                "grade_id": str(grade_id) if grade_id else None,
                "section_id": str(section_id) if section_id else None,
                "academic_year_id": str(academic_year_id) if academic_year_id else None,
                "skip": skip,
                "limit": limit,
            },
        ).mappings().all()

        total = rows[0]["total_count"] if rows else 0
        students = [dict(r) for r in rows]
        return students, total

    # ── Counts ────────────────────────────────────────────────
    def get_active_count(self, tenant_id: UUID) -> int:
        return (
            self.db.query(func.count(Student.id))
            .filter(Student.tenant_id == tenant_id, Student.is_active == True)
            .scalar() or 0
        )

    def get_count_by_gender(self, tenant_id: UUID) -> dict:
        rows = (
            self.db.query(Student.gender, func.count(Student.id))
            .filter(Student.tenant_id == tenant_id, Student.is_active == True)
            .group_by(Student.gender)
            .all()
        )
        return {r[0] or "unknown": r[1] for r in rows}


class GuardianRepository(BaseRepository[Guardian]):
    def __init__(self, db: Session):
        super().__init__(Guardian, db)

    def get_by_student(self, student_id: UUID) -> List[Guardian]:
        return (
            self.db.query(Guardian)
            .filter(Guardian.student_id == student_id)
            .order_by(Guardian.is_primary.desc())
            .all()
        )


class GradeRepository(BaseRepository[Grade]):
    def __init__(self, db: Session):
        super().__init__(Grade, db)

    def get_all_ordered(self, tenant_id: UUID) -> List[Grade]:
        return (
            self.db.query(Grade)
            .filter(Grade.tenant_id == tenant_id)
            .order_by(Grade.order_no)
            .all()
        )


class SectionRepository(BaseRepository[Section]):
    def __init__(self, db: Session):
        super().__init__(Section, db)

    def get_by_grade(self, grade_id: UUID, academic_year_id: UUID) -> List[Section]:
        return (
            self.db.query(Section)
            .filter(Section.grade_id == grade_id,
                    Section.academic_year_id == academic_year_id)
            .all()
        )


class EnrollmentRepository(BaseRepository[StudentEnrollment]):
    def __init__(self, db: Session):
        super().__init__(StudentEnrollment, db)

    def get_current(self, student_id: UUID, academic_year_id: UUID) -> Optional[StudentEnrollment]:
        return (
            self.db.query(StudentEnrollment)
            .filter(
                StudentEnrollment.student_id == student_id,
                StudentEnrollment.academic_year_id == academic_year_id,
                StudentEnrollment.status == "active",
            )
            .first()
        )
