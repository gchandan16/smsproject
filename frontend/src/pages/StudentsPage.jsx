// frontend/src/pages/StudentsPage.jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import {
  fetchStudents, fetchStudent, fetchGrades,
  createStudent, updateStudent, deleteStudent,
  addGuardian, deleteGuardian,
  setFilter, setPage, clearError, clearSuccess,
  selectStudents, selectStudentsTotal, selectStudentsPage,
  selectStudentsLimit, selectGrades, selectStudentsLoading,
  selectStudentsSaving, selectStudentsError,
  selectStudentsSuccess, selectStudentsFilters,
  selectSelectedStudent, selectStudentDetailLoading,
} from '../store/slices/studentsSlice.js'

// ─────────────────────────────────────────────────────────────
//  CONSTANTS & HELPERS
// ─────────────────────────────────────────────────────────────
const BLOOD_GROUPS = ['A+','A-','B+','B-','AB+','AB-','O+','O-']

// ── CHANGE 1: Replace emptyForm() ────────────────────────────
const emptyForm = () => ({
  admission_no: '',
  first_name:   '',
  last_name:    '',
  dob:          '',
  gender:       '',
  blood_group:  '',
  photo_url:    '',  
  aadhar_no:    '',  
  address: { street: '', city: '', state: '', pin: '' },
})

const emptyGuardian = () => ({
  first_name: '', last_name: '', relation: 'father',
  phone: '', email: '', is_primary: true, can_pickup: false,
})

const studentToForm = (s) => ({
  admission_no: s?.admission_no  || '',
  first_name:   s?.first_name    || '',
  last_name:    s?.last_name     || '',
  dob:          s?.dob           || '',
  gender:       s?.gender        || '',
  blood_group:  s?.blood_group   || '',
  photo_url:    s?.photo_url     || '',  
  aadhar_no:    s?.aadhar_no     || '',  
  address: {
    street: s?.address?.street || '',
    city:   s?.address?.city   || '',
    state:  s?.address?.state  || '',
    pin:    s?.address?.pin    || '',
  },
})

// ─────────────────────────────────────────────────────────────
//  MAIN PAGE
// ─────────────────────────────────────────────────────────────
export default function StudentsPage() {
  const dispatch      = useDispatch()
  const navigate      = useNavigate()

  const students      = useSelector(selectStudents)
  const total         = useSelector(selectStudentsTotal)
  const page          = useSelector(selectStudentsPage)
  const limit         = useSelector(selectStudentsLimit)
  const grades        = useSelector(selectGrades)
  const loading       = useSelector(selectStudentsLoading)
  const saving        = useSelector(selectStudentsSaving)
  const error         = useSelector(selectStudentsError)
  const success       = useSelector(selectStudentsSuccess)
  const filters       = useSelector(selectStudentsFilters)
  const selected      = useSelector(selectSelectedStudent)
  const detailLoading = useSelector(selectStudentDetailLoading)

  const [modalMode,    setModalMode]    = useState(null)  // null | 'add' | 'edit'
  const [editId,       setEditId]       = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [searchInput,  setSearchInput]  = useState(filters.search || '')

  // Load grades once
  useEffect(() => { dispatch(fetchGrades()) }, [dispatch])

  // Fetch list when filters/page change
  useEffect(() => {
    const params = { page, limit }
    if (filters.search)   params.search   = filters.search
    if (filters.gender)   params.gender   = filters.gender
    if (filters.grade_id) params.grade_id = filters.grade_id
    if (filters.is_active !== undefined) params.is_active = filters.is_active
    dispatch(fetchStudents(params))
  }, [dispatch, page, filters])

  // Auto-dismiss success toast
  useEffect(() => {
    if (success) {
      const t = setTimeout(() => dispatch(clearSuccess()), 3000)
      return () => clearTimeout(t)
    }
  }, [success, dispatch])

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => dispatch(setFilter({ search: searchInput })), 400)
    return () => clearTimeout(t)
  }, [searchInput, dispatch])

  const refreshList = () => {
    const params = { page, limit }
    if (filters.search)   params.search   = filters.search
    if (filters.grade_id) params.grade_id = filters.grade_id
    if (filters.is_active !== undefined) params.is_active = filters.is_active
    dispatch(fetchStudents(params))
  }

  const handleAdd = () => {
    setEditId(null)
    dispatch(clearError())
    setModalMode('add')
  }

  const handleEdit = (s) => {
    setEditId(s.id)
    dispatch(clearError())
    dispatch(fetchStudent(s.id))
    setModalMode('edit')
  }

  const handleSave = async (formData, guardians) => {
    let result
    if (modalMode === 'edit') {
      result = await dispatch(updateStudent({ id: editId, data: formData }))
    } else {
      result = await dispatch(createStudent({ ...formData, guardians }))
    }
    if (!result.error) {
      setModalMode(null)
      dispatch(clearError())
      refreshList()
    }
  }

  const handleDeleteConfirm = async () => {
    await dispatch(deleteStudent(deleteTarget.id))
    setDeleteTarget(null)
    refreshList()
  }

  const totalPages = Math.ceil(total / limit)

  return (
    <div>
      {/* Header */}
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div>
          <h4 className="fw-bold mb-0">Students</h4>
          <small className="text-muted">{total} student{total !== 1 ? 's' : ''} total</small>
        </div>
        <button className="btn btn-primary" onClick={handleAdd}>
          <i className="bi bi-person-plus-fill me-2"></i>Add Student
        </button>
      </div>

      {success && (
        <div className="alert alert-success d-flex align-items-center py-2 mb-3">
          <i className="bi bi-check-circle-fill me-2"></i>{success}
        </div>
      )}
      {error && (
        <div className="alert alert-danger d-flex align-items-center py-2 mb-3">
          <i className="bi bi-exclamation-triangle-fill me-2"></i>
          <span className="flex-grow-1">{error}</span>
          <button className="btn-close btn-sm" onClick={() => dispatch(clearError())}></button>
        </div>
      )}

      {/* Filters */}
      <div className="card shadow-sm border-0 mb-3">
        <div className="card-body py-2">
          <div className="row g-2 align-items-center">
            <div className="col-12 col-md-4">
              <div className="input-group input-group-sm">
                <span className="input-group-text bg-light border-end-0">
                  <i className="bi bi-search text-muted"></i>
                </span>
                <input type="text" className="form-control border-start-0"
                  placeholder="Search name or admission no..."
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)} />
                {searchInput && (
                  <button className="btn btn-outline-secondary btn-sm"
                    onClick={() => { setSearchInput(''); dispatch(setFilter({ search: '' })) }}>
                    <i className="bi bi-x"></i>
                  </button>
                )}
              </div>
            </div>
            <div className="col-6 col-md-2">
              <select className="form-select form-select-sm"
                value={filters.grade_id || ''}
                onChange={e => dispatch(setFilter({ grade_id: e.target.value }))}>
                <option value="">All Classes</option>
                {grades.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            <div className="col-6 col-md-2">
              <select className="form-select form-select-sm"
                value={filters.gender || ''}
                onChange={e => dispatch(setFilter({ gender: e.target.value }))}>
                <option value="">All Genders</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="col-6 col-md-2">
              <select className="form-select form-select-sm"
                value={String(filters.is_active ?? true)}
                onChange={e => dispatch(setFilter({ is_active: e.target.value === 'true' }))}>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
            <div className="col-6 col-md-2">
              <button className="btn btn-outline-secondary btn-sm w-100"
                onClick={() => { setSearchInput(''); dispatch(setFilter({ search: '', gender: '', grade_id: '', is_active: true })) }}>
                <i className="bi bi-arrow-counterclockwise me-1"></i>Reset
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card shadow-sm border-0">
        <div className="card-body p-0">
          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary"></div>
              <div className="mt-2 text-muted small">Loading students...</div>
            </div>
          ) : students.length === 0 ? (
            <div className="text-center py-5 text-muted">
              <i className="bi bi-people fs-1 d-block mb-3 opacity-25"></i>
              <h6>No students found</h6>
              <p className="small mb-3">Adjust filters or add a new student.</p>
              <button className="btn btn-primary btn-sm" onClick={handleAdd}>
                <i className="bi bi-person-plus me-1"></i>Add Student
              </button>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th style={{ width: 46 }}>#</th>
                    <th>Student</th>
                    <th>Admission No</th>
                    <th>Aadhar No</th>
                    <th>Class</th>
                    <th>Gender</th>
                    <th>Status</th>
                    <th style={{ width: 120 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s, idx) => (
                    <tr key={s.id}>
                      <td className="text-muted small">{(page - 1) * limit + idx + 1}</td>
                      <td>
                        <div className="d-flex align-items-center gap-2">
                          <Avatar name={s.first_name} gender={s.gender} />
                          <span className="fw-medium">{s.first_name} {s.last_name || ''}</span>
                        </div>
                      </td>
                      <td><code className="small">{s.admission_no}</code></td>
                       <td>
                        {s.aadhar_no ? (
                          <span className="text-muted small">
                            <i className="bi bi-credit-card-2-front me-1"></i>
                            {/* Mask middle digits: XXXX XXXX 1234 */}
                            XXXX XXXX {s.aadhar_no.slice(-4)}
                          </span>
                        ) : (
                          <span className="text-muted small">—</span>
                        )}
                      </td>
                      <td>
                        {s.current_section
                          ? <span className="badge bg-light text-dark border">{s.current_section}</span>
                          : <span className="text-muted small">—</span>}
                      </td>
                      <td><GenderBadge gender={s.gender} /></td>
                      <td>
                        <span className={`badge ${s.is_active ? 'bg-success' : 'bg-secondary'}`}>
                          {s.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <div className="btn-group btn-group-sm">
                          <button className="btn btn-outline-secondary" title="View"
                            onClick={() => navigate(`/students/${s.id}`)}>
                            <i className="bi bi-eye"></i>
                          </button>
                          <button className="btn btn-outline-primary" title="Edit"
                            onClick={() => handleEdit(s)}>
                            <i className="bi bi-pencil"></i>
                          </button>
                          <button className="btn btn-outline-danger" title="Deactivate"
                            onClick={() => setDeleteTarget(s)}>
                            <i className="bi bi-trash"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <div className="card-footer bg-white d-flex align-items-center justify-content-between">
            <small className="text-muted">
              Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
            </small>
            <ul className="pagination pagination-sm mb-0">
              <li className={`page-item ${page === 1 ? 'disabled' : ''}`}>
                <button className="page-link" onClick={() => dispatch(setPage(page - 1))}>
                  <i className="bi bi-chevron-left"></i>
                </button>
              </li>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                const p = Math.max(1, Math.min(page - 2, totalPages - 4)) + i
                return (
                  <li key={p} className={`page-item ${p === page ? 'active' : ''}`}>
                    <button className="page-link" onClick={() => dispatch(setPage(p))}>{p}</button>
                  </li>
                )
              })}
              <li className={`page-item ${page === totalPages ? 'disabled' : ''}`}>
                <button className="page-link" onClick={() => dispatch(setPage(page + 1))}>
                  <i className="bi bi-chevron-right"></i>
                </button>
              </li>
            </ul>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {modalMode && (
        modalMode === 'edit' && detailLoading ? (
          <div className="modal show d-block" style={{ background: 'rgba(0,0,0,0.5)' }}>
            <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: 320 }}>
              <div className="modal-content border-0 shadow text-center p-5">
                <div className="spinner-border text-primary mx-auto mb-3"></div>
                <div className="text-muted small">Loading student data...</div>
              </div>
            </div>
          </div>
        ) : (
          <StudentFormModal
            mode={modalMode}
            student={modalMode === 'edit' ? selected : null}
            editId={editId}
            grades={grades}
            saving={saving}
            error={error}
            onSave={handleSave}
            onClose={() => { setModalMode(null); dispatch(clearError()) }}
          />
        )
      )}

      {/* Delete Confirm */}
      {deleteTarget && (
        <ConfirmModal
          title="Deactivate Student"
          message={`Deactivate ${deleteTarget.first_name} ${deleteTarget.last_name || ''}?`}
          confirmLabel="Deactivate"
          confirmClass="btn-danger"
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  STUDENT FORM MODAL
// ─────────────────────────────────────────────────────────────
function StudentFormModal({ mode, student, editId, grades, saving, error, onSave, onClose }) {
  const isEdit  = mode === 'edit'
  const dispatch = useDispatch()

  const [tab,  setTab]  = useState('basic')
  const [form, setForm] = useState(() => student ? studentToForm(student) : emptyForm())
  const [guardians, setGuardians] = useState(() =>
    student?.guardians?.length ? [] : [emptyGuardian()]  // in add mode only
  )

  // Re-init form when selected student data arrives from API
  useEffect(() => {
    if (student) {
      setForm(studentToForm(student))
    }
  }, [student?.id])

  const set     = (f, v) => setForm(p => ({ ...p, [f]: v }))
  const setAddr = (f, v) => setForm(p => ({ ...p, address: { ...p.address, [f]: v } }))

  // Add mode guardian row helpers
  const setG    = (i, f, v) => setGuardians(p => p.map((g, idx) => idx === i ? { ...g, [f]: v } : g))
  const addG    = ()        => setGuardians(p => [...p, emptyGuardian()])
  const removeG = (i)       => setGuardians(p => p.filter((_, idx) => idx !== i))

  const handleSubmit = (e) => {
    e.preventDefault()
      // Validate aadhar if provided
      if (form.aadhar_no && form.aadhar_no.length !== 12) {
        alert('Aadhar number must be exactly 12 digits')
        return
      }
      if(isEdit){
        onSave({
        first_name:   form.first_name,
        last_name:    form.last_name    || null,
        dob:          form.dob          || null,
        gender:       form.gender       || null,
        blood_group:  form.blood_group  || null,
        photo_url:    form.photo_url    || null,
        aadhar_no:    form.aadhar_no    || null,
        address:      form.address,
      }, [])

      }else{
 onSave({
        admission_no: form.admission_no,
        first_name:   form.first_name,
        last_name:    form.last_name    || null,
        dob:          form.dob          || null,
        gender:       form.gender       || null,
        blood_group:  form.blood_group  || null,
        photo_url:    form.photo_url    || null,
        aadhar_no:    form.aadhar_no    || null,
        address:      form.address,
      }, guardians.filter(g => g.first_name?.trim()))
      }
  }

  return (
    <div className="modal show d-block" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
        <div className="modal-content border-0 shadow">

          <div className="modal-header border-0 pb-0">
            <h5 className="modal-title fw-bold">
              <i className={`bi ${isEdit ? 'bi-pencil-square' : 'bi-person-plus-fill'} me-2 text-primary`}></i>
              {isEdit ? `Edit — ${student?.first_name || ''} ${student?.last_name || ''}` : 'Add New Student'}
            </h5>
            <button className="btn-close" onClick={onClose} disabled={saving}></button>
          </div>

          <div className="modal-body pt-3">
            {/* Tabs */}
            <ul className="nav nav-tabs mb-3">
              {[
                { key: 'basic',    icon: 'bi-person',  label: 'Basic Info' },
                { key: 'address',  icon: 'bi-geo-alt', label: 'Address' },
                { key: 'guardian', icon: 'bi-people',  label: 'Guardians' },
              ].map(t => (
                <li className="nav-item" key={t.key}>
                  <button className={`nav-link ${tab === t.key ? 'active' : ''}`}
                    type="button" onClick={() => setTab(t.key)}>
                    <i className={`bi ${t.icon} me-1`}></i>{t.label}
                  </button>
                </li>
              ))}
            </ul>

            <form onSubmit={handleSubmit} id="student-form">

              {/* Basic Info */}
              {tab === 'basic' && (
                <div className="row g-3">

                  {/* ── Photo Upload ─────────────────────────────────── */}
                      <div className="col-12">
                        <label className="form-label fw-medium small">Student Photo</label>
                        <div className="d-flex align-items-center gap-3">

                          {/* Preview */}
                          <div
                            className="rounded-circle border d-flex align-items-center
                                      justify-content-center overflow-hidden bg-light flex-shrink-0"
                            style={{ width: 80, height: 80 }}>
                            {form.photo_url ? (
                              <img
                                src={form.photo_url}
                                alt="Preview"
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              />
                            ) : (
                              <i className="bi bi-person-fill text-muted fs-2"></i>
                            )}
                          </div>

                          {/* Upload controls */}
                          <div className="flex-grow-1">
                            <input
                              type="file"
                              className="form-control form-control-sm"
                              accept="image/jpeg,image/png,image/webp"
                              id="photo-upload"
                              style={{ display: 'none' }}
                              onChange={async (e) => {
                                const file = e.target.files[0]
                                if (!file) return

                                // Validate size on client side
                                if (file.size > 2 * 1024 * 1024) {
                                  alert('Image must be under 2MB')
                                  return
                                }

                                // Upload to backend
                                const formData = new FormData()
                                formData.append('file', file)

                                try {
                                  const token = localStorage.getItem('token')
                                  const res   = await fetch('/api/upload/student-photo', {
                                    method:  'POST',
                                    headers: { Authorization: `Bearer ${token}` },
                                    body:    formData,
                                  })
                                  if (!res.ok) throw new Error('Upload failed')
                                  const data = await res.json()
                                  set('photo_url', data.photo_url)
                                } catch (err) {
                                  alert('Photo upload failed. Try again.')
                                }
                              }}
                            />
                            <label
                              htmlFor="photo-upload"
                              className="btn btn-outline-secondary btn-sm mb-1"
                              style={{ cursor: 'pointer' }}>
                              <i className="bi bi-upload me-1"></i>
                              {form.photo_url ? 'Change Photo' : 'Upload Photo'}
                            </label>
                            {form.photo_url && (
                              <button
                                type="button"
                                className="btn btn-outline-danger btn-sm ms-2 mb-1"
                                onClick={() => set('photo_url', '')}>
                                <i className="bi bi-x-circle me-1"></i>Remove
                              </button>
                            )}
                            <div className="form-text">JPEG, PNG or WEBP. Max 2MB.</div>
                          </div>
                        </div>
                      </div>


                  <div className="col-md-6">
                    <label className="form-label fw-medium small">
                      Admission No <span className="text-danger">*</span>
                    </label>
                    <input className={`form-control ${isEdit ? 'bg-light' : ''}`}
                      placeholder="ADM-2025-001"
                      value={form.admission_no}
                      onChange={e => set('admission_no', e.target.value)}
                      required disabled={isEdit} />
                    {isEdit && <div className="form-text">Cannot be changed after creation.</div>}
                  </div>

                   {/* Aadhar Card Number */}
                  <div className="col-md-6">
                    <label className="form-label fw-medium small">
                      Aadhar Card Number
                    </label>
                    <div className="input-group">
                      <span className="input-group-text bg-light border-end-0">
                        <i className="bi bi-credit-card-2-front text-muted"></i>
                      </span>
                      <input
                        type="text"
                        inputMode="numeric"
                        className="form-control border-start-0"
                        placeholder="12-digit Aadhar number"
                        value={form.aadhar_no}
                        maxLength={12}
                        onChange={e => set('aadhar_no', e.target.value.replace(/\D/g, ''))}
                      />
                    </div>
                    {/* Live validation feedback */}
                    {form.aadhar_no.length > 0 && form.aadhar_no.length < 12 && (
                      <div className="form-text text-warning">
                        <i className="bi bi-exclamation-triangle me-1"></i>
                        {form.aadhar_no.length}/12 digits entered
                      </div>
                    )}
                    {form.aadhar_no.length === 12 && (
                      <div className="form-text text-success">
                        <i className="bi bi-check-circle me-1"></i>
                        Valid Aadhar number
                      </div>
                    )}
                  </div>

                  <div className="col-md-6">
                    <label className="form-label fw-medium small">
                      First Name <span className="text-danger">*</span>
                    </label>
                    <input className="form-control" placeholder="First name"
                      value={form.first_name}
                      onChange={e => set('first_name', e.target.value)} required />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fw-medium small">Last Name</label>
                    <input className="form-control" placeholder="Last name"
                      value={form.last_name}
                      onChange={e => set('last_name', e.target.value)} />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fw-medium small">Date of Birth</label>
                    <input type="date" className="form-control"
                      value={form.dob}
                      onChange={e => set('dob', e.target.value)} />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fw-medium small">Gender</label>
                    <select className="form-select" value={form.gender}
                      onChange={e => set('gender', e.target.value)}>
                      <option value="">Select gender</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fw-medium small">Blood Group</label>
                    <select className="form-select" value={form.blood_group}
                      onChange={e => set('blood_group', e.target.value)}>
                      <option value="">Select blood group</option>
                      {BLOOD_GROUPS.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                </div>
              )}

              {/* Address */}
              {tab === 'address' && (
                <div className="row g-3">
                  <div className="col-12">
                    <label className="form-label fw-medium small">Street / House No</label>
                    <input className="form-control" placeholder="e.g. 42, MG Road"
                      value={form.address.street}
                      onChange={e => setAddr('street', e.target.value)} />
                  </div>
                  <div className="col-md-5">
                    <label className="form-label fw-medium small">City</label>
                    <input className="form-control" placeholder="City"
                      value={form.address.city}
                      onChange={e => setAddr('city', e.target.value)} />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label fw-medium small">State</label>
                    <input className="form-control" placeholder="State"
                      value={form.address.state}
                      onChange={e => setAddr('state', e.target.value)} />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label fw-medium small">PIN Code</label>
                    <input className="form-control" placeholder="110001"
                      value={form.address.pin}
                      onChange={e => setAddr('pin', e.target.value)} />
                  </div>
                </div>
              )}

              {/* Guardians */}
              {tab === 'guardian' && (
                isEdit
                  ? <EditGuardianTab studentId={editId} guardians={student?.guardians || []} />
                  : <AddGuardianRows guardians={guardians} setG={setG} addG={addG} removeG={removeG} />
              )}

            </form>

            {error && (
              <div className="alert alert-danger d-flex align-items-center py-2 mt-3 mb-0">
                <i className="bi bi-exclamation-triangle-fill me-2"></i>
                <span className="small">{error}</span>
              </div>
            )}
          </div>

          <div className="modal-footer border-0 pt-0">
            <button className="btn btn-light" onClick={onClose} disabled={saving}>Cancel</button>
            <button className="btn btn-primary" form="student-form" type="submit"
              disabled={saving || (tab === 'guardian' && isEdit)}>
              {saving
                ? <><span className="spinner-border spinner-border-sm me-2"></span>Saving...</>
                : <><i className={`bi ${isEdit ? 'bi-check-lg' : 'bi-person-plus'} me-1`}></i>
                    {isEdit ? 'Save Changes' : 'Add Student'}</>
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  EDIT MODE — GUARDIAN TAB
//  Completely self-contained — dispatches directly to Redux
// ─────────────────────────────────────────────────────────────
function EditGuardianTab({ studentId, guardians }) {
  const dispatch  = useDispatch()
  const saving    = useSelector(selectStudentsSaving)
  const error     = useSelector(selectStudentsError)

  const [showForm, setShowForm] = useState(false)
  const [newG,     setNewG]     = useState(emptyGuardian())
  const [localErr, setLocalErr] = useState('')

  const handleAdd = async (e) => {
    e.preventDefault()
    e.stopPropagation()   // ← prevent bubbling to outer form submit

    if (!newG.first_name.trim()) {
      setLocalErr('First name is required')
      return
    }
    setLocalErr('')

    const result = await dispatch(addGuardian({ studentId, data: newG }))
    if (!result.error) {
      // Refresh selected student so guardian list updates
      dispatch(fetchStudent(studentId))
      setNewG(emptyGuardian())
      setShowForm(false)
    }
  }

  const handleDelete = async (guardianId) => {
    if (!window.confirm('Remove this guardian?')) return
    const result = await dispatch(deleteGuardian({ guardianId, studentId }))
    if (!result.error) {
      dispatch(fetchStudent(studentId))
    }
  }

  return (
    <div>
      {/* Existing guardians table */}
      {guardians.length > 0 ? (
        <table className="table table-sm align-middle mb-3 border rounded-3 overflow-hidden">
          <thead className="table-light">
            <tr>
              <th>Name</th>
              <th>Relation</th>
              <th>Phone</th>
              <th>Primary</th>
              <th style={{ width: 60 }}></th>
            </tr>
          </thead>
          <tbody>
            {guardians.map(g => (
              <tr key={g.id}>
                <td className="fw-medium">{g.first_name} {g.last_name || ''}</td>
                <td>
                  <span className="badge bg-light text-dark border text-capitalize">
                    {g.relation}
                  </span>
                </td>
                <td className="text-muted small">{g.phone || '—'}</td>
                <td>
                  {g.is_primary
                    ? <i className="bi bi-check-circle-fill text-success"></i>
                    : <span className="text-muted">—</span>}
                </td>
                <td>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-danger py-0 px-1"
                    onClick={() => handleDelete(g.id)}>
                    <i className="bi bi-trash small"></i>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="text-center py-3 text-muted small border rounded-3 mb-3">
          No guardians added yet.
        </div>
      )}

      {/* Add guardian form — standalone, NOT inside outer <form> */}
      {showForm ? (
        <div className="border rounded-3 p-3 bg-light">
          <div className="fw-semibold small mb-2 text-muted">New Guardian</div>

          {localErr && (
            <div className="alert alert-danger py-1 px-2 mb-2 small">{localErr}</div>
          )}
          {error && (
            <div className="alert alert-danger py-1 px-2 mb-2 small">{error}</div>
          )}

          <div className="row g-2">
            <div className="col-md-4">
              <input className="form-control form-control-sm" placeholder="First name *"
                value={newG.first_name}
                onChange={e => setNewG(p => ({ ...p, first_name: e.target.value }))} />
            </div>
            <div className="col-md-4">
              <input className="form-control form-control-sm" placeholder="Last name"
                value={newG.last_name}
                onChange={e => setNewG(p => ({ ...p, last_name: e.target.value }))} />
            </div>
            <div className="col-md-4">
              <select className="form-select form-select-sm"
                value={newG.relation}
                onChange={e => setNewG(p => ({ ...p, relation: e.target.value }))}>
                <option value="father">Father</option>
                <option value="mother">Mother</option>
                <option value="guardian">Guardian</option>
                <option value="sibling">Sibling</option>
              </select>
            </div>
            <div className="col-md-6">
              <input className="form-control form-control-sm" placeholder="Phone number"
                value={newG.phone}
                onChange={e => setNewG(p => ({ ...p, phone: e.target.value }))} />
            </div>
            <div className="col-md-6">
              <input className="form-control form-control-sm" placeholder="Email"
                value={newG.email}
                onChange={e => setNewG(p => ({ ...p, email: e.target.value }))} />
            </div>
            <div className="col-12">
              <div className="form-check form-check-inline">
                <input className="form-check-input" type="checkbox" id="primary-chk"
                  checked={newG.is_primary}
                  onChange={e => setNewG(p => ({ ...p, is_primary: e.target.checked }))} />
                <label className="form-check-label small" htmlFor="primary-chk">Primary contact</label>
              </div>
              <div className="form-check form-check-inline">
                <input className="form-check-input" type="checkbox" id="pickup-chk"
                  checked={newG.can_pickup}
                  onChange={e => setNewG(p => ({ ...p, can_pickup: e.target.checked }))} />
                <label className="form-check-label small" htmlFor="pickup-chk">Can pickup</label>
              </div>
            </div>
          </div>

          <div className="d-flex gap-2 mt-3">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={saving}
              onClick={handleAdd}>
              {saving
                ? <><span className="spinner-border spinner-border-sm me-1"></span>Saving...</>
                : <><i className="bi bi-plus-circle me-1"></i>Save Guardian</>}
            </button>
            <button
              type="button"
              className="btn btn-light btn-sm"
              onClick={() => { setShowForm(false); setNewG(emptyGuardian()); setLocalErr('') }}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="btn btn-outline-secondary btn-sm"
          onClick={() => setShowForm(true)}>
          <i className="bi bi-plus-circle me-1"></i>Add Guardian
        </button>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  ADD MODE — GUARDIAN ROWS (bundled with create payload)
// ─────────────────────────────────────────────────────────────
function AddGuardianRows({ guardians, setG, addG, removeG }) {
  return (
    <div>
      {guardians.map((g, i) => (
        <div key={i} className="border rounded-3 p-3 mb-3 bg-light">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <span className="small fw-semibold text-muted">Guardian {i + 1}</span>
            {guardians.length > 1 && (
              <button type="button" className="btn btn-sm btn-outline-danger py-0"
                onClick={() => removeG(i)}>
                <i className="bi bi-x"></i>
              </button>
            )}
          </div>
          <div className="row g-2">
            <div className="col-md-4">
              <input className="form-control form-control-sm" placeholder="First name *"
                value={g.first_name}
                onChange={e => setG(i, 'first_name', e.target.value)} />
            </div>
            <div className="col-md-4">
              <input className="form-control form-control-sm" placeholder="Last name"
                value={g.last_name}
                onChange={e => setG(i, 'last_name', e.target.value)} />
            </div>
            <div className="col-md-4">
              <select className="form-select form-select-sm" value={g.relation}
                onChange={e => setG(i, 'relation', e.target.value)}>
                <option value="father">Father</option>
                <option value="mother">Mother</option>
                <option value="guardian">Guardian</option>
                <option value="sibling">Sibling</option>
              </select>
            </div>
            <div className="col-md-6">
              <input className="form-control form-control-sm" placeholder="Phone"
                value={g.phone}
                onChange={e => setG(i, 'phone', e.target.value)} />
            </div>
            <div className="col-md-6">
              <input className="form-control form-control-sm" placeholder="Email"
                value={g.email}
                onChange={e => setG(i, 'email', e.target.value)} />
            </div>
            <div className="col-12">
              <div className="form-check form-check-inline">
                <input className="form-check-input" type="checkbox"
                  id={`prim-${i}`} checked={g.is_primary}
                  onChange={e => setG(i, 'is_primary', e.target.checked)} />
                <label className="form-check-label small" htmlFor={`prim-${i}`}>Primary</label>
              </div>
              <div className="form-check form-check-inline">
                <input className="form-check-input" type="checkbox"
                  id={`pick-${i}`} checked={g.can_pickup}
                  onChange={e => setG(i, 'can_pickup', e.target.checked)} />
                <label className="form-check-label small" htmlFor={`pick-${i}`}>Can pickup</label>
              </div>
            </div>
          </div>
        </div>
      ))}
      <button type="button" className="btn btn-outline-secondary btn-sm" onClick={addG}>
        <i className="bi bi-plus-circle me-1"></i>Add Another Guardian
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  CONFIRM MODAL
// ─────────────────────────────────────────────────────────────
function ConfirmModal({ title, message, confirmLabel, confirmClass, onConfirm, onCancel }) {
  return (
    <div className="modal show d-block" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: 400 }}>
        <div className="modal-content border-0 shadow text-center p-4">
          <div className="bg-danger bg-opacity-10 rounded-circle d-inline-flex
                          align-items-center justify-content-center mx-auto mb-3"
            style={{ width: 56, height: 56 }}>
            <i className="bi bi-exclamation-triangle-fill text-danger fs-4"></i>
          </div>
          <h6 className="fw-bold mb-2">{title}</h6>
          <p className="text-muted small mb-4">{message}</p>
          <div className="d-flex gap-2 justify-content-center">
            <button className="btn btn-light px-4" onClick={onCancel}>Cancel</button>
            <button className={`btn px-4 ${confirmClass}`} onClick={onConfirm}>{confirmLabel}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  MICRO COMPONENTS
// ─────────────────────────────────────────────────────────────
function Avatar({ name, gender, photoUrl }) {
  if (photoUrl) {
    return (
      <div className="rounded-circle overflow-hidden flex-shrink-0"
        style={{ width: 34, height: 34 }}>
        <img src={photoUrl} alt={name}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    )
  }
  const c = {
    male:   ['#dbeafe','#1d4ed8'],
    female: ['#fce7f3','#be185d'],
    other:  ['#f3e8ff','#7e22ce'],
  }
  const [bg, color] = c[gender] || ['#f1f5f9','#475569']
  return (
    <div className="rounded-circle d-flex align-items-center justify-content-center fw-bold flex-shrink-0"
      style={{ width: 34, height: 34, background: bg, color, fontSize: 13 }}>
      {name?.[0]?.toUpperCase() || '?'}
    </div>
  )
}

function GenderBadge({ gender }) {
  const m = {
    male:   ['text-primary','bi-gender-male','Male'],
    female: ['text-danger', 'bi-gender-female','Female'],
    other:  ['text-secondary','bi-gender-ambiguous','Other'],
  }
  const g = m[gender]
  if (!g) return <span className="text-muted small">—</span>
  return <span className={`small ${g[0]}`}><i className={`bi ${g[1]} me-1`}></i>{g[2]}</span>
}
