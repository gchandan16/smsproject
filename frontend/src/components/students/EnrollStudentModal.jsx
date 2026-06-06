// frontend/src/components/students/EnrollStudentModal.jsx
import { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  fetchGrades, fetchSections, enrollStudent,
  selectGrades, selectSections,
  selectStudentsSaving, selectStudentsError, clearError,
} from '../../store/slices/studentsSlice.js'

export default function EnrollStudentModal({ student, onClose, onSuccess }) {
  const dispatch = useDispatch()
  const grades   = useSelector(selectGrades)
  const sections = useSelector(selectSections)
  const saving   = useSelector(selectStudentsSaving)
  const reduxErr = useSelector(selectStudentsError)

  const [academicYears,   setAcademicYears]   = useState([])
  const [loadingYears,    setLoadingYears]     = useState(true)
  const [loadingSections, setLoadingSections]  = useState(false)
  const [takenRolls,      setTakenRolls]       = useState([])
  const [localError,      setLocalError]       = useState('')

  const [form, setForm] = useState({
    academic_year_id: '',
    grade_id:         '',
    section_id:       '',
    roll_no:          '',
  })

  useEffect(() => {
    dispatch(clearError())
    dispatch(fetchGrades())
    fetchAcademicYears()
    return () => dispatch(clearError())
  }, [dispatch])

  const fetchAcademicYears = async () => {
    try {
      setLoadingYears(true)
      const token = localStorage.getItem('token')
      const res   = await fetch('/api/academic-years/', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setAcademicYears(data)
        const current = data.find(y => y.is_current)
        if (current) setForm(f => ({ ...f, academic_year_id: current.id }))
      }
    } catch {
      setLocalError('Failed to load academic years')
    } finally {
      setLoadingYears(false)
    }
  }

  // Load sections when grade + year selected
  useEffect(() => {
    if (form.grade_id && form.academic_year_id) {
      setLoadingSections(true)
      dispatch(fetchSections({
        gradeId:        form.grade_id,
        academicYearId: form.academic_year_id,
      })).finally(() => setLoadingSections(false))
      setForm(f => ({ ...f, section_id: '', roll_no: '' }))
      setTakenRolls([])
    }
  }, [form.grade_id, form.academic_year_id, dispatch])

  // Fetch taken roll numbers when section changes
  useEffect(() => {
    if (form.section_id && form.academic_year_id) {
      fetchTakenRolls(form.section_id, form.academic_year_id)
      setForm(f => ({ ...f, roll_no: '' }))
    }
  }, [form.section_id])

  const fetchTakenRolls = async (sectionId, yearId) => {
    try {
      const token = localStorage.getItem('token')
      const res   = await fetch(
        `/api/students/sections/roll-numbers?section_id=${sectionId}&academic_year_id=${yearId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (res.ok) {
        const data = await res.json()
        setTakenRolls(data.taken_roll_numbers || [])
      }
    } catch {
      // non-critical — just won't show taken rolls
    }
  }

  const set = (f, v) => {
    setLocalError('')
    setForm(p => ({ ...p, [f]: v }))
  }

  const rollNoTaken = form.roll_no &&
    takenRolls.includes(parseInt(form.roll_no))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLocalError('')
    dispatch(clearError())

    if (!form.academic_year_id) { setLocalError('Please select an academic year'); return }
    if (!form.section_id)       { setLocalError('Please select a section');        return }

    const rollNo = form.roll_no ? parseInt(form.roll_no) : null

    // Client-side duplicate check before hitting API
    if (rollNo && takenRolls.includes(rollNo)) {
      setLocalError(
        `Roll number ${rollNo} is already taken in this section. ` +
        `Taken: ${takenRolls.join(', ')}`
      )
      return
    }

    const result = await dispatch(enrollStudent({
      studentId: student.id,
      data: {
        section_id:       form.section_id,
        academic_year_id: form.academic_year_id,
        roll_no:          rollNo,
      },
    }))

    if (result.error) {
      // Parse server error — it contains taken roll numbers
      const msg = result.payload || 'Failed to enroll student'
      setLocalError(msg)
    } else {
      if (onSuccess) onSuccess()
      onClose()
    }
  }

  const currentEnrollment = student?.enrollments?.find(e => e.status === 'active')
  const displayError      = localError || reduxErr

  return (
    <div className="modal show d-block" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: 520 }}>
        <div className="modal-content border-0 shadow">

          <div className="modal-header border-0 pb-0">
            <h5 className="modal-title fw-bold">
              <i className="bi bi-journal-plus me-2 text-primary"></i>
              Enroll Student
            </h5>
            <button className="btn-close" onClick={onClose} disabled={saving}></button>
          </div>

          <div className="modal-body">

            {/* Student strip */}
            <div className="d-flex align-items-center gap-3 p-3 bg-light rounded-3 mb-3">
              <div className="rounded-circle d-flex align-items-center justify-content-center
                              fw-bold text-white flex-shrink-0"
                style={{
                  width: 44, height: 44, fontSize: 18,
                  background: student?.gender === 'female' ? '#be185d' : '#1d4ed8',
                }}>
                {student?.first_name?.[0]?.toUpperCase()}
              </div>
              <div>
                <div className="fw-semibold">
                  {student?.first_name} {student?.last_name || ''}
                </div>
                <code className="small text-muted">{student?.admission_no}</code>
              </div>
              {currentEnrollment?.section && (
                <div className="ms-auto text-end">
                  <div className="small text-muted">Currently in</div>
                  <span className="badge bg-info text-dark">
                    {currentEnrollment.section?.grade?.name} — {currentEnrollment.section?.name}
                    {currentEnrollment.roll_no && ` · Roll ${currentEnrollment.roll_no}`}
                  </span>
                </div>
              )}
            </div>

            {/* Transfer warning */}
            {currentEnrollment && (
              <div className="alert alert-warning d-flex gap-2 py-2 mb-3 small">
                <i className="bi bi-exclamation-triangle-fill flex-shrink-0 mt-1"></i>
                <div>
                  Enrolling will mark the current class as <strong>transferred</strong>.
                </div>
              </div>
            )}

            {/* Error */}
            {displayError && (
              <div className="alert alert-danger d-flex align-items-start gap-2 py-2 mb-3">
                <i className="bi bi-exclamation-triangle-fill flex-shrink-0 mt-1"></i>
                <div className="small flex-grow-1">{displayError}</div>
                <button className="btn-close btn-sm flex-shrink-0"
                  onClick={() => { setLocalError(''); dispatch(clearError()) }}></button>
              </div>
            )}

            <form onSubmit={handleSubmit} id="enroll-form">
              <div className="row g-3">

                {/* Academic Year */}
                <div className="col-12">
                  <label className="form-label fw-medium small">
                    Academic Year <span className="text-danger">*</span>
                  </label>
                  {loadingYears ? (
                    <div className="d-flex align-items-center gap-2 text-muted small">
                      <span className="spinner-border spinner-border-sm"></span>
                      Loading...
                    </div>
                  ) : (
                    <select className="form-select"
                      value={form.academic_year_id}
                      onChange={e => set('academic_year_id', e.target.value)}
                      required>
                      <option value="">Select academic year</option>
                      {academicYears.map(y => (
                        <option key={y.id} value={y.id}>
                          {y.label}{y.is_current ? ' ★ Current' : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Grade */}
                <div className="col-md-6">
                  <label className="form-label fw-medium small">
                    Class / Grade <span className="text-danger">*</span>
                  </label>
                  <select className="form-select"
                    value={form.grade_id}
                    onChange={e => set('grade_id', e.target.value)}
                    required>
                    <option value="">Select class</option>
                    {grades.map(g => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                </div>

                {/* Section */}
                <div className="col-md-6">
                  <label className="form-label fw-medium small">
                    Section <span className="text-danger">*</span>
                  </label>
                  {loadingSections ? (
                    <div className="d-flex align-items-center gap-2 text-muted small mt-2">
                      <span className="spinner-border spinner-border-sm"></span>
                      Loading sections...
                    </div>
                  ) : (
                    <select className="form-select"
                      value={form.section_id}
                      onChange={e => set('section_id', e.target.value)}
                      required
                      disabled={!form.grade_id || !form.academic_year_id}>
                      <option value="">
                        {!form.grade_id ? 'Select class first'
                         : sections.length === 0 ? 'No sections found'
                         : 'Select section'}
                      </option>
                      {sections.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  )}
                  {form.grade_id && !loadingSections && sections.length === 0 && (
                    <div className="form-text text-warning">
                      <i className="bi bi-exclamation-triangle me-1"></i>
                      No sections for this class/year. Create one in Settings.
                    </div>
                  )}
                </div>

                {/* Roll Number */}
                <div className="col-12">
                  <label className="form-label fw-medium small">Roll Number</label>
                  <input
                    type="number"
                    className={`form-control ${rollNoTaken ? 'is-invalid' : form.roll_no && !rollNoTaken ? 'is-valid' : ''}`}
                    placeholder="e.g. 15"
                    min="1" max="999"
                    value={form.roll_no}
                    onChange={e => set('roll_no', e.target.value)}
                    disabled={!form.section_id}
                  />

                  {/* Taken roll numbers hint */}
                  {form.section_id && takenRolls.length > 0 && (
                    <div className="form-text">
                      <i className="bi bi-info-circle me-1"></i>
                      <strong>Taken roll numbers:</strong>{' '}
                      {takenRolls.map((r, i) => (
                        <span key={r}
                          className={`badge me-1 ${parseInt(form.roll_no) === r ? 'bg-danger' : 'bg-secondary'}`}>
                          {r}
                        </span>
                      ))}
                    </div>
                  )}

                  {rollNoTaken && (
                    <div className="invalid-feedback d-block">
                      Roll number {form.roll_no} is already taken.
                      Choose from available numbers.
                    </div>
                  )}

                  {form.section_id && takenRolls.length === 0 && (
                    <div className="form-text text-success">
                      <i className="bi bi-check-circle me-1"></i>
                      No roll numbers assigned yet in this section.
                    </div>
                  )}
                </div>

              </div>
            </form>
          </div>

          <div className="modal-footer border-0 pt-0">
            <button className="btn btn-light" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              form="enroll-form"
              type="submit"
              disabled={saving || !form.section_id || rollNoTaken}>
              {saving ? (
                <><span className="spinner-border spinner-border-sm me-2"></span>Enrolling...</>
              ) : (
                <><i className="bi bi-journal-check me-2"></i>Confirm Enrollment</>
              )}
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}
