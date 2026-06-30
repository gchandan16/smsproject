# backend/services/student_service.py
from uuid import UUID
from typing import Optional, List
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from repositories.student_repository import (
    StudentRepository, GuardianRepository,
    GradeRepository, SectionRepository,
)
from repositories.enrollment_repository import EnrollmentRepository
from models.student import Student, Guardian, StudentEnrollment
from schemas.student import (
    StudentCreate, StudentUpdate, StudentListResponse,
    StudentListOut, GradeCreate, SectionCreate, EnrollmentCreate,
)


class StudentService:
    def __init__(self, db: Session):
        self.repo            = StudentRepository(db)
        self.guardian_repo   = GuardianRepository(db)
        self.grade_repo      = GradeRepository(db)
        self.section_repo    = SectionRepository(db)
        self.enrollment_repo = EnrollmentRepository(db)
        self.db              = db

    def _get_or_404(self, student_id: UUID, tenant_id: UUID) -> Student:
        student = self.repo.get_by_id_full(student_id, tenant_id)
        if not student:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Student not found")
        return student

    def _build_section_label(self, student: Student) -> Optional[str]:
        for e in student.enrollments:
            if e.status == "active" and e.section:
                grade_name = e.section.grade.name if e.section.grade else ""
                return f"{grade_name} - {e.section.name}"
        return None

    def list_students(
        self,
        tenant_id:        UUID,
        search:           Optional[str]  = None,
        gender:           Optional[str]  = None,
        is_active:        Optional[bool] = True,
        grade_id:         Optional[UUID] = None,
        section_id:       Optional[UUID] = None,
        academic_year_id: Optional[UUID] = None,
        page:             int = 1,
        limit:            int = 50,
    ) -> StudentListResponse:
        skip = (page - 1) * limit
        students, total = self.repo.list_students(
            tenant_id, search, gender, is_active,
            grade_id, section_id, academic_year_id, skip, limit,
        )
        items = []
        for s in students:
            # s is now a plain dict returned by fn_list_students() — the section
            # label is already pre-formatted by the SQL function, so
            # _build_section_label() is no longer called here.
            items.append(StudentListOut(
                id=s["id"],
                admission_no=s["admission_no"],
                first_name=s["first_name"],
                last_name=s["last_name"],
                gender=s["gender"],
                photo_url=s["photo_url"],
                aadhar_no=s["aadhar_no"],
                is_active=s["is_active"],
                admitted_on=s["admitted_on"],
                current_section=s["current_section"],
            ))
        return StudentListResponse(
            total=total, page=page, limit=limit, students=items
        )

    def get_student(self, student_id: UUID, tenant_id: UUID) -> Student:
        return self._get_or_404(student_id, tenant_id)

    def create_student(self, data: StudentCreate, tenant_id: UUID) -> Student:
        if self.repo.get_by_admission_no(data.admission_no, tenant_id):
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                f"Admission number '{data.admission_no}' already exists",
            )
        student_data = data.model_dump(exclude={"guardians", "enrollment"})
        student = Student(**student_data, tenant_id=tenant_id)
        self.db.add(student)
        self.db.flush()
        for g in data.guardians:
            guardian = Guardian(
                **g.model_dump(), student_id=student.id, tenant_id=tenant_id
            )
            self.db.add(guardian)
        if data.enrollment:
            self._create_enrollment(student.id, data.enrollment, tenant_id)
        self.db.commit()
        self.db.refresh(student)
        return self.repo.get_by_id_full(student.id, tenant_id)

    def update_student(
        self, student_id: UUID, data: StudentUpdate, tenant_id: UUID
    ) -> Student:
        student = self._get_or_404(student_id, tenant_id)
        update_data = data.model_dump(exclude_unset=True)
        clean_data = {k: v for k, v in update_data.items()
                      if not (k == 'address' and v is None)}
        if clean_data:
            self.repo.update(student, clean_data)
        return self.repo.get_by_id_full(student_id, tenant_id)

    def delete_student(self, student_id: UUID, tenant_id: UUID) -> None:
        student = self._get_or_404(student_id, tenant_id)
        self.repo.update(student, {"is_active": False})

    def add_guardian(self, student_id: UUID, data, tenant_id: UUID) -> Guardian:
        self._get_or_404(student_id, tenant_id)
        guardian = Guardian(
            **data.model_dump(), student_id=student_id, tenant_id=tenant_id
        )
        return self.guardian_repo.create(guardian)

    def update_guardian(self, guardian_id: UUID, data, tenant_id: UUID) -> Guardian:
        guardian = self.db.query(Guardian).filter(
            Guardian.id == guardian_id, Guardian.tenant_id == tenant_id
        ).first()
        if not guardian:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Guardian not found")
        return self.guardian_repo.update(guardian, data.model_dump(exclude_unset=True))

    def delete_guardian(self, guardian_id: UUID, tenant_id: UUID) -> None:
        guardian = self.db.query(Guardian).filter(
            Guardian.id == guardian_id, Guardian.tenant_id == tenant_id
        ).first()
        if not guardian:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Guardian not found")
        self.guardian_repo.delete(guardian)

    # ── Enrollment ────────────────────────────────────────────
    def _create_enrollment(
        self, student_id: UUID, data: EnrollmentCreate, tenant_id: UUID
    ) -> StudentEnrollment:
        enrollment = StudentEnrollment(
            student_id=student_id,
            section_id=data.section_id,
            academic_year_id=data.academic_year_id,
            roll_no=data.roll_no,
            tenant_id=tenant_id,
            status="active",
        )
        self.db.add(enrollment)
        return enrollment

    def enroll_student(
        self, student_id: UUID, data: EnrollmentCreate, tenant_id: UUID
    ) -> StudentEnrollment:
        # 1. Verify student exists
        self._get_or_404(student_id, tenant_id)

        # 2. Validate roll number uniqueness
        if data.roll_no is not None:
            taken = self.enrollment_repo.roll_no_exists(
                section_id         = data.section_id,
                academic_year_id   = data.academic_year_id,
                roll_no            = data.roll_no,
                exclude_student_id = student_id,
            )
            if taken:
                taken_rolls = self.enrollment_repo.get_section_roll_numbers(
                    data.section_id, data.academic_year_id
                )
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Roll number {data.roll_no} is already taken in this section. "
                           f"Taken roll numbers: {taken_rolls}",
                )

        # 3. Mark existing active enrollment as transferred
        existing = self.enrollment_repo.get_current(student_id, data.academic_year_id)
        if existing:
            self.enrollment_repo.update(existing, {"status": "transferred"})

        # 4. Create new enrollment
        enrollment = self._create_enrollment(student_id, data, tenant_id)
        self.db.commit()
        self.db.refresh(enrollment)
        return enrollment

    def update_roll_number(
        self,
        student_id:       UUID,
        section_id:       UUID,
        academic_year_id: UUID,
        roll_no:          int,
        tenant_id:        UUID,
    ) -> StudentEnrollment:
        """Change only the roll number without changing section."""
        self._get_or_404(student_id, tenant_id)

        taken = self.enrollment_repo.roll_no_exists(
            section_id         = section_id,
            academic_year_id   = academic_year_id,
            roll_no            = roll_no,
            exclude_student_id = student_id,
        )
        if taken:
            taken_rolls = self.enrollment_repo.get_section_roll_numbers(
                section_id, academic_year_id
            )
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Roll number {roll_no} is already taken. "
                       f"Taken roll numbers: {taken_rolls}",
            )

        enrollment = self.enrollment_repo.update_roll_no(
            student_id, section_id, academic_year_id, roll_no
        )
        if not enrollment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No active enrollment found for this student.",
            )
        return enrollment

    # ── Grades ────────────────────────────────────────────────
    def list_grades(self, tenant_id: UUID):
        return self.grade_repo.get_all_ordered(tenant_id)

    def create_grade(self, data: GradeCreate, tenant_id: UUID):
        from models.student import Grade
        grade = Grade(**data.model_dump(), tenant_id=tenant_id)
        return self.grade_repo.create(grade)

    # ── Sections ──────────────────────────────────────────────
    def list_sections(self, grade_id: UUID, academic_year_id: UUID):
        return self.section_repo.get_by_grade(grade_id, academic_year_id)

    def create_section(self, data: SectionCreate, tenant_id: UUID):
        from models.student import Section
        section = Section(**data.model_dump(), tenant_id=tenant_id)
        return self.section_repo.create(section)

    def get_stats(self, tenant_id: UUID) -> dict:
        return {
            "total_active":    self.repo.get_active_count(tenant_id),
            "count_by_gender": self.repo.get_count_by_gender(tenant_id),
        }
