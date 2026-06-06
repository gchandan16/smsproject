// frontend/src/hooks/useStudents.js
// ─────────────────────────────────────────────────────────────
// Custom hook — wraps all student Redux calls.
// Components import this instead of useDispatch/useSelector directly.
// Usage:  const { students, loading, createStudent } = useStudents()
// ─────────────────────────────────────────────────────────────
import {useEffect} from 'react'
import {useDispatch,useSelector} from 'react-redux'
import {
    fetchStudents, fetchStudent, fetchStudentStats,
  createStudent, updateStudent, deleteStudent,
  addGuardian, updateGuardian, deleteGuardian,
  enrollStudent, fetchGrades, fetchSections,
  setFilter, setPage, clearSelected,
  clearError, clearSuccess, resetFilters,
  selectStudents, selectStudentsTotal, selectStudentsPage,
  selectStudentsLimit, selectSelectedStudent, selectStudentStats,
  selectGrades, selectSections, selectStudentsLoading,
  selectStudentDetailLoading, selectStudentsSaving,
  selectStudentsError, selectStudentsSuccess, selectStudentsFilters,
} from '../store/slices/studentsSlice.js'

export function useStudents() {
    const dispatch= useDispatch()
    return {
        // ── State ────────────────────────────────────────────────
    students:      useSelector(selectStudents),
    total:         useSelector(selectStudentsTotal),
    page:          useSelector(selectStudentsPage),
    limit:         useSelector(selectStudentsLimit),
    selected:      useSelector(selectSelectedStudent),
    stats:         useSelector(selectStudentStats),
    grades:        useSelector(selectGrades),
    sections:      useSelector(selectSections),
    filters:       useSelector(selectStudentsFilters),
    loading:       useSelector(selectStudentsLoading),
    detailLoading: useSelector(selectStudentDetailLoading),
    saving:        useSelector(selectStudentsSaving),
    error:         useSelector(selectStudentsError),
    success:       useSelector(selectStudentsSuccess),
    // ── Actions ──────────────────────────────────────────────
    fetchStudents:    (params) => dispatch(fetchStudents(params)),
    fetchStudent:     (id)     => dispatch(fetchStudent(id)),
    fetchStats:       ()       => dispatch(fetchStudentStats()),
    createStudent:    (data)   => dispatch(createStudent(data)),
    updateStudent:    (id, data) => dispatch(updateStudent({ id, data })),
    deleteStudent:    (id)     => dispatch(deleteStudent(id)),

    addGuardian:    (studentId, data)   => dispatch(addGuardian({ studentId, data })),
    updateGuardian: (guardianId, data)  => dispatch(updateGuardian({ guardianId, data })),
    deleteGuardian: (guardianId, studentId) => dispatch(deleteGuardian({ guardianId, studentId })),

    enrollStudent:  (studentId, data)   => dispatch(enrollStudent({ studentId, data })),
    fetchGrades:    ()                  => dispatch(fetchGrades()),
    fetchSections:  (gradeId, yearId)   => dispatch(fetchSections({ gradeId, academicYearId: yearId })),

    setFilter:    (filters) => dispatch(setFilter(filters)),
    setPage:      (page)    => dispatch(setPage(page)),
    clearSelected: ()       => dispatch(clearSelected()),
    clearError:   ()        => dispatch(clearError()),
    clearSuccess: ()        => dispatch(clearSuccess()),
    resetFilters: ()        => dispatch(resetFilters()),
    }

}