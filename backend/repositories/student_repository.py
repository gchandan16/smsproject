# backend/repositories/student_repository.py
from uuid import UUID
from typing import Optional, List, Tuple
from sqlalchemy.orm import Session, joinedload, contains_eager
from sqlalchemy import or_, func

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

    # ── List with search + pagination ────────────────────────
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
    ) -> Tuple[List[Student], int]:
        """Returns (students, total_count) for pagination."""
        q = (
            self.db.query(Student)
            .filter(Student.tenant_id == tenant_id)
        )

        if is_active is not None:
            q = q.filter(Student.is_active == is_active)

        if gender:
            q = q.filter(Student.gender == gender)

        if search:
            term = f"%{search}%"
            q = q.filter(or_(
                Student.first_name.ilike(term),
                Student.last_name.ilike(term),
                Student.admission_no.ilike(term),
            ))

        # Filter by grade or section via enrollment join
        if grade_id or section_id or academic_year_id:
            q = q.join(StudentEnrollment,
                       StudentEnrollment.student_id == Student.id)
            if academic_year_id:
                q = q.filter(StudentEnrollment.academic_year_id == academic_year_id)
            if section_id:
                q = q.filter(StudentEnrollment.section_id == section_id)
            if grade_id:
                q = q.join(Section, Section.id == StudentEnrollment.section_id)
                q = q.filter(Section.grade_id == grade_id)

        # Count on the bare filtered query — no eager-load joins attached yet,
        # so this is a single lightweight COUNT(*) instead of scanning joined rows.
        total = q.with_entities(func.count(func.distinct(Student.id))).scalar()

        students = (
            q.options(
                # Only eager-load the ACTIVE enrollment's section/grade — this is
                # the only enrollment _build_section_label() ever actually reads.
                # Loading every historical enrollment per student (the old behavior)
                # multiplied join rows for no reason and was the main cause of the
                # slow list page.
                joinedload(
                    Student.enrollments.and_(StudentEnrollment.status == "active")
                ).joinedload(StudentEnrollment.section)
                 .joinedload(Section.grade)
            )
            .order_by(Student.first_name)
            .offset(skip)
            .limit(limit)
            .all()
        )
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
