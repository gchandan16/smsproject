// frontend/src/pages/StudentDetailPage.jsx
// Full student profile — guardians, enrollments, quick actions
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import {
  fetchStudent, addGuardian, deleteGuardian,
  selectSelectedStudent, selectStudentDetailLoading,
  selectStudentsError, selectStudentsSaving,
  clearError,
} from '../store/slices/studentsSlice.js'

import EnrollStudentModal from '../components/students/EnrollStudentModal.jsx'
export default function StudentDetailPage() {
  const { id }       = useParams()
  const dispatch     = useDispatch()
  const navigate     = useNavigate()
  const student      = useSelector(selectSelectedStudent)
  const loading      = useSelector(selectStudentDetailLoading)
  const error        = useSelector(selectStudentsError)
  const saving       = useSelector(selectStudentsSaving)

  const [showEnroll,       setShowEnroll]       = useState(false)
  const [showGuardianForm, setShowGuardianForm] = useState(false)
  const [guardianForm, setGuardianForm] = useState({
    first_name: '', last_name: '', relation: 'father',
    phone: '', email: '', is_primary: false, can_pickup: false,
  })

  useEffect(() => {
    dispatch(fetchStudent(id))
    return () => dispatch(clearError())
  }, [id, dispatch])

  const handleAddGuardian = async (e) => {
    e.preventDefault()
    const result = await dispatch(addGuardian({ studentId: id, data: guardianForm }))
    if (!result.error) {
      setShowGuardianForm(false)
      setGuardianForm({ first_name: '', last_name: '', relation: 'father', phone: '', email: '', is_primary: false, can_pickup: false })
    }
  }

  const handleDeleteGuardian = async (guardianId) => {
    if (window.confirm('Remove this guardian?')) {
      dispatch(deleteGuardian({ guardianId, studentId: id }))
    }
  }

  if (loading) return (
    <div className="text-center py-5">
      <div className="spinner-border text-primary"></div>
    </div>
  )

  if (!student) return (
    <div className="text-center py-5 text-muted">
      <i className="bi bi-person-x fs-1 d-block mb-3 opacity-25"></i>
      <h6>Student not found</h6>
      <button className="btn btn-primary btn-sm mt-2" onClick={() => navigate('/students')}>
        Back to Students
      </button>
    </div>
  )

  const fullName = `${student.first_name} ${student.last_name || ''}`.trim()
  const currentEnrollment = student.enrollments?.find(e => e.status === 'active')
  const isEnrolled        = !!currentEnrollment

  return (
    <div>
      {/* ── Breadcrumb ─────────────────────────────────── */}
      <nav aria-label="breadcrumb" className="mb-3">
        <ol className="breadcrumb">
          <li className="breadcrumb-item">
            <button className="btn btn-link p-0 text-decoration-none"
              onClick={() => navigate('/students')}>Students</button>
          </li>
          <li className="breadcrumb-item active">{fullName}</li>
        </ol>
      </nav>

      {error && (
        <div className="alert alert-danger py-2 mb-3">
          <i className="bi bi-exclamation-triangle-fill me-2"></i>{error}
        </div>
      )}

      <div className="row g-3">

        {/* ── Profile Card ─────────────────────────────── */}
        <div className="col-12 col-lg-4">
          <div className="card border-0 shadow-sm text-center">
            <div className="card-body py-4">
              {/* Avatar */}
              <div className="d-inline-flex align-items-center justify-content-center
                              rounded-circle mb-3 fw-bold fs-2 text-white bg-primary"
                style={{ width: 80, height: 80 }}>
                  <img
                                src={student.photo_url}
                                alt="Preview"
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              />
              </div>
              <h5 className="fw-bold mb-0">{fullName}</h5>
              <code className="small text-muted">{student.admission_no}</code>

              {/* Status badge */}
              <div className="mt-2">
                <span className={`badge ${student.is_active ? 'bg-success' : 'bg-secondary'}`}>
                  {student.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>

              {/* Current class */}
              {currentEnrollment?.section && (
                <div className="mt-3 p-2 bg-light rounded-3">
                  <div className="small text-muted">Current Class</div>
                  <div className="fw-semibold">
                    {currentEnrollment.section.grade?.name} — {currentEnrollment.section.name}
                  </div>
                  {currentEnrollment.roll_no && (
                    <div className="small text-muted">Roll No: {currentEnrollment.roll_no}</div>
                  )}
                </div>
              )}
            </div>

            {/* Details */}
            <div className="card-footer bg-white text-start">
              <DetailRow icon="bi-calendar3"       label="DOB"        value={student.dob || '—'} />
              <DetailRow icon="bi-gender-ambiguous" label="Gender"     value={student.gender || '—'} />
              <DetailRow icon="bi-droplet-fill"     label="Blood"      value={student.blood_group || '—'} />
              <DetailRow icon="bi-geo-alt"          label="City"       value={student.address?.city || '—'} />
            </div>

            {/* Actions */}
            <div className="card-footer bg-white d-grid gap-2">
               <button
                className="btn btn-success btn-sm"
                onClick={() => setShowEnroll(true)}>
                <i className="bi bi-journal-plus me-1"></i>
                {isEnrolled ? 'Change Class / Transfer' : 'Enroll in Class'}
              </button>
              <button className="btn btn-outline-primary btn-sm"
                onClick={() => navigate('/students')}>
                <i className="bi bi-arrow-left me-1"></i>Back to List
              </button>
            </div>
          </div>
        </div>

        {/* ── Right Column ─────────────────────────────── */}
        <div className="col-12 col-lg-8">

          {/* Guardians */}
          <div className="card border-0 shadow-sm mb-3">
            <div className="card-header bg-white d-flex justify-content-between align-items-center">
              <span className="fw-semibold">
                <i className="bi bi-people-fill me-2 text-primary"></i>Guardians
              </span>
              <button className="btn btn-sm btn-outline-primary"
                onClick={() => setShowGuardianForm(v => !v)}>
                <i className="bi bi-plus me-1"></i>Add Guardian
              </button>
            </div>

            {/* Add guardian inline form */}
            {showGuardianForm && (
              <div className="card-body border-bottom bg-light">
                <form onSubmit={handleAddGuardian}>
                  <div className="row g-2">
                    <div className="col-md-3">
                      <input className="form-control form-control-sm" placeholder="First name *"
                        value={guardianForm.first_name} required
                        onChange={e => setGuardianForm(f => ({ ...f, first_name: e.target.value }))} />
                    </div>
                    <div className="col-md-3">
                      <input className="form-control form-control-sm" placeholder="Last name"
                        value={guardianForm.last_name}
                        onChange={e => setGuardianForm(f => ({ ...f, last_name: e.target.value }))} />
                    </div>
                    <div className="col-md-2">
                      <select className="form-select form-select-sm"
                        value={guardianForm.relation}
                        onChange={e => setGuardianForm(f => ({ ...f, relation: e.target.value }))}>
                        <option value="father">Father</option>
                        <option value="mother">Mother</option>
                        <option value="guardian">Guardian</option>
                      </select>
                    </div>
                    <div className="col-md-4">
                      <input className="form-control form-control-sm" placeholder="Phone"
                        value={guardianForm.phone}
                        onChange={e => setGuardianForm(f => ({ ...f, phone: e.target.value }))} />
                    </div>
                    <div className="col-12 d-flex gap-2">
                      <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                        {saving ? 'Saving...' : 'Save Guardian'}
                      </button>
                      <button type="button" className="btn btn-light btn-sm"
                        onClick={() => setShowGuardianForm(false)}>Cancel</button>
                    </div>
                  </div>
                </form>
              </div>
            )}

            <div className="card-body p-0">
              {!student.guardians?.length ? (
                <div className="text-center py-4 text-muted small">
                  No guardians added yet.
                </div>
              ) : (
                <table className="table table-sm align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Name</th><th>Relation</th><th>Phone</th><th>Primary</th><th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {student.guardians.map(g => (
                      <tr key={g.id}>
                        <td className="fw-medium">{g.first_name} {g.last_name || ''}</td>
                        <td><span className="badge bg-light text-dark border text-capitalize">{g.relation}</span></td>
                        <td>{g.phone || '—'}</td>
                        <td>
                          {g.is_primary
                            ? <i className="bi bi-check-circle-fill text-success"></i>
                            : <i className="bi bi-circle text-muted"></i>}
                        </td>
                        <td>
                          <button className="btn btn-sm btn-outline-danger py-0 px-1"
                            onClick={() => handleDeleteGuardian(g.id)}>
                            <i className="bi bi-trash small"></i>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Enrollments */}
          <div className="card border-0 shadow-sm">
              <div className="card-header bg-white d-flex justify-content-between align-items-center">
                    <span className="fw-semibold">
                      <i className="bi bi-journal-text me-2 text-primary"></i>
                      Enrollment History
                    </span>
                    {!isEnrolled && (
                      <button className="btn btn-sm btn-success"
                        onClick={() => setShowEnroll(true)}>
                        <i className="bi bi-plus me-1"></i>Enroll Now
                      </button>
                    )}
                  </div>
            <div className="card-body p-0">
              {!student.enrollments?.length ? (
                <div className="text-center py-4 text-muted small">
                  Not enrolled in any class yet.
                </div>
              ) : (
                <table className="table table-sm align-middle mb-0">
                  <thead className="table-light">
                    <tr><th>Class</th><th>Section</th><th>Roll No</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {student.enrollments.map(e => (
                      <tr key={e.id}>
                        <td>{e.section?.grade?.name || '—'}</td>
                        <td>{e.section?.name || '—'}</td>
                        <td>{e.roll_no || '—'}</td>
                        <td>
                          <span className={`badge ${
                            e.status === 'active'      ? 'bg-success' :
                            e.status === 'transferred' ? 'bg-warning text-dark' : 'bg-secondary'
                          }`}>{e.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Enrollment Modal */}
      {showEnroll && (
        <EnrollStudentModal
          student={student}
          onClose={() => setShowEnroll(false)}
          onSuccess={() => {
            dispatch(fetchStudent(id))
            setShowEnroll(false)
          }}
        />
      )}
    </div>
  )
}

function DetailRow({ icon, label, value }) {
  return (
    <div className="d-flex align-items-center gap-2 py-1">
      <i className={`bi ${icon} text-muted`} style={{ width: 16 }}></i>
      <span className="text-muted small">{label}:</span>
      <span className="small fw-medium text-capitalize">{value}</span>
    </div>
  )
}
