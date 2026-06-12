// frontend/src/pages/SettingsPage.jsx
import React, { useState, useEffect, useCallback } from 'react'

// ── API helpers — use relative /api (Vite proxy handles it) ──
const getHeaders = () => ({
  'Authorization': `Bearer ${localStorage.getItem('token')}`,
  'Content-Type':  'application/json',
})

const apiFetch = async (path) => {
  const res = await fetch(`/api${path}`, { headers: getHeaders() })
  if (res.status === 401) {
    localStorage.removeItem('token')
    window.location.href = '/login'
    throw new Error('Unauthorized')
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `Server error ${res.status}`)
  }
  const data = await res.json()
  return data
}

const apiPost = (path, body) =>
  fetch(`/api${path}`, {
    method:  'POST',
    headers: getHeaders(),
    body:    JSON.stringify(body),
  })

const apiPut = (path, body) =>
  fetch(`/api${path}`, {
    method:  'PUT',
    headers: getHeaders(),
    body:    JSON.stringify(body),
  })

const apiDelete = (path) =>
  fetch(`/api${path}`, {
    method:  'DELETE',
    headers: getHeaders(),
  })

// ─────────────────────────────────────────────────────────────
const TABS = [
  { key: 'school',       icon: 'bi-building',         label: 'School Profile'   },
  { key: 'years',        icon: 'bi-calendar-range',   label: 'Academic Years'   },
  { key: 'grades',       icon: 'bi-layers',           label: 'Grades / Classes' },
  { key: 'sections',     icon: 'bi-diagram-3',        label: 'Sections'         },
  { key: 'subjects',     icon: 'bi-book',             label: 'Subjects'         },
  { key: 'departments',  icon: 'bi-building-gear',    label: 'Departments'      },
  { key: 'designations', icon: 'bi-person-badge',     label: 'Designations'     },
  { key: 'leavetypes',   icon: 'bi-calendar-x',       label: 'Leave Types'      },
  { key: 'feecats',      icon: 'bi-cash-coin',        label: 'Fee Categories'   },
  { key: 'bookcats',     icon: 'bi-bookshelf',        label: 'Book Categories'  },
  { key: 'feestructure', icon: 'bi-table',             label: 'Fee Structures'   },
  { key: 'div_infra',    icon: '',    label: 'INFRASTRUCTURE' },
  { key: 'teachers',     icon: 'bi-person-video2',   label: 'Teachers'        },
  { key: 'rooms',        icon: 'bi-door-open',        label: 'Rooms'           },
  { key: 'div_access',   icon: '',    label: 'USER ACCESS' },
  { key: 'users',        icon: 'bi-people-fill',     label: 'User Management' },
]


class TabErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(e) { return { error: e } }
  render() {
    if (this.state.error) {
      return (
        <div className="alert alert-danger m-3">
          <i className="bi bi-exclamation-triangle-fill me-2"></i>
          <strong>Tab error:</strong> {this.state.error.message}
          <button className="btn btn-sm btn-outline-danger ms-2"
            onClick={() => this.setState({ error: null })}>Retry</button>
        </div>
      )
    }
    return this.props.children
  }
}


export default function SettingsPage() {
  const [tab, setTab] = useState('school')

  return (
    <div>
      <div className="mb-4">
        <h4 className="fw-bold mb-0">Settings</h4>
        <small className="text-muted">Manage master data for your school</small>
      </div>

      <div className="row g-3">
        <div className="col-12 col-md-3">
          <div className="card border-0 shadow-sm">
            <div className="card-body p-2">
              <nav className="nav flex-column gap-1">
                {TABS.map(t => {
                  // Render section headers (no icon, no click)
                  if (t.key.startsWith('div_') || t.key.startsWith('divider') || t.key === 'div_infra') {
                    return (
                      <div key={t.key}
                        className="px-3 pt-3 pb-1"
                        style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8',
                          textTransform: 'uppercase', letterSpacing: 1 }}>
                        {t.label}
                      </div>
                    )
                  }
                  return (
                    <button key={t.key}
                      className={`btn text-start w-100 rounded-2 px-3 py-2 d-flex align-items-center gap-2 border-0
                        ${tab === t.key ? 'btn-primary' : 'btn-light'}`}
                      onClick={() => setTab(t.key)}>
                      {t.icon && <i className={`bi ${t.icon}`} style={{ width: 18, flexShrink: 0 }}></i>}
                      <span className="small">{t.label}</span>
                    </button>
                  )
                })}
              </nav>
            </div>
          </div>
        </div>

        <div className="col-12 col-md-9">
          {tab === 'school'       && <SchoolProfileTab />}
          {tab === 'years'        && <AcademicYearsTab />}
          {tab === 'grades'       && <GradesTab />}
          {tab === 'sections'     && <SectionsTab />}
          {tab === 'subjects'     && <SubjectsTab />}
          {tab === 'departments'  && <DepartmentsTab />}
          {tab === 'designations' && <DesignationsTab />}
          {tab === 'leavetypes'   && <LeaveTypesTab />}
          {tab === 'feecats'      && <FeeCategoriesTab />}
          {tab === 'bookcats'     && <BookCategoriesTab />}
          {tab === 'feestructure' && <FeeStructureTab />}
          {tab === 'teachers'     && <TeachersTab />}
          {tab === 'rooms'        && <RoomsTab />}
          {tab === 'users'        && <TabErrorBoundary><UserManagementTab /></TabErrorBoundary>}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  REUSABLE MASTER TABLE
// ─────────────────────────────────────────────────────────────
function MasterTable({ title, endpoint, columns, renderRow, renderForm, emptyForm }) {
  const [rows,     setRows]     = useState([])
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editing,  setEditing]  = useState(null)
  const [form,     setForm]     = useState(emptyForm)
  const [error,    setError]    = useState('')
  const [success,  setSuccess]  = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await apiFetch(endpoint)
      setRows(Array.isArray(data) ? data : [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [endpoint])

  useEffect(() => { load() }, [load])

  const openAdd = () => {
    setEditing(null)
    setForm({ ...emptyForm })
    setError('')
    setShowForm(true)
  }

  const openEdit = (row) => {
    setEditing(row)
    setForm({ ...row })
    setError('')
    setShowForm(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true); setError('')
    try {
      const res = editing
        ? await apiPut(`${endpoint}/${editing.id}`, form)
        : await apiPost(endpoint, form)
      if (res.ok) {
        setShowForm(false)
        setSuccess(editing ? 'Updated!' : 'Added!')
        setTimeout(() => setSuccess(''), 3000)
        load()
      } else {
        const d = await res.json().catch(() => ({}))
        setError(d.detail || `Error ${res.status}`)
      }
    } catch (e) { setError(e.message) }
    setSaving(false)
  }

  const handleDelete = async (row) => {
    if (!window.confirm(`Delete "${row.name}"?`)) return
    try {
      await apiDelete(`${endpoint}/${row.id}`)
      load()
    } catch (e) { setError(e.message) }
  }

  return (
    <div className="card border-0 shadow-sm">
      <div className="card-header bg-white d-flex justify-content-between align-items-center">
        <span className="fw-semibold">
          {title}
          {rows.length > 0 && <span className="badge bg-secondary ms-2">{rows.length}</span>}
        </span>
        <button className="btn btn-primary btn-sm" onClick={openAdd}>
          <i className="bi bi-plus-lg me-1"></i>Add
        </button>
      </div>

      {showForm && (
        <div className="card-body border-bottom bg-light">
          <form onSubmit={handleSave}>
            <div className="row g-2 align-items-end">
              {renderForm(form, setForm)}
              {error && (
                <div className="col-12">
                  <div className="alert alert-danger py-1 px-2 mb-0 small">
                    <i className="bi bi-exclamation-triangle-fill me-1"></i>{error}
                  </div>
                </div>
              )}
              <div className="col-auto d-flex gap-2">
                <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                  {saving ? <><span className="spinner-border spinner-border-sm me-1"></span>Saving...</> : editing ? 'Update' : 'Save'}
                </button>
                <button type="button" className="btn btn-light btn-sm"
                  onClick={() => { setShowForm(false); setError('') }}>
                  Cancel
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      <div className="card-body p-0">
        {success && (
          <div className="alert alert-success py-2 px-3 mb-0 rounded-0 small border-0">
            <i className="bi bi-check-circle-fill me-2"></i>{success}
          </div>
        )}
        {error && !showForm && (
          <div className="alert alert-danger py-2 px-3 mb-0 rounded-0 small border-0">
            <i className="bi bi-exclamation-triangle-fill me-2"></i>{error}
            <button className="btn btn-sm btn-link py-0 ms-1" onClick={load}>Retry</button>
          </div>
        )}
        {loading ? (
          <div className="text-center py-4">
            <div className="spinner-border spinner-border-sm text-primary me-2"></div>
            <span className="text-muted small">Loading...</span>
          </div>
        ) : rows.length === 0 && !error ? (
          <div className="text-center py-5 text-muted">
            <i className="bi bi-inbox fs-2 d-block mb-2 opacity-25"></i>
            <small>No {title.toLowerCase()} yet. Click Add to get started.</small>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-sm table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  {columns.map(c => <th key={c}>{c}</th>)}
                  <th style={{ width: 90 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={row.id}>
                    <td className="text-muted small">{i + 1}</td>
                    {renderRow(row)}
                    <td>
                      <div className="btn-group btn-group-sm">
                        <button className="btn btn-outline-primary" onClick={() => openEdit(row)}>
                          <i className="bi bi-pencil"></i>
                        </button>
                        <button className="btn btn-outline-danger" onClick={() => handleDelete(row)}>
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
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  SCHOOL PROFILE
// ─────────────────────────────────────────────────────────────
function SchoolProfileTab() {
  const [form, setForm] = useState({
    school_name: '', phone: '', email: '', website: '',
    board: '', affiliation_no: '', admission_prefix: 'ADM',
    address: { street: '', city: '', state: '', pin: '' },
  })
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [msg,     setMsg]     = useState('')
  const [error,   setError]   = useState('')

  useEffect(() => {
    apiFetch('/master/school-profile')
      .then(d => {
        if (d) {
          setForm({
            school_name:      d.school_name      || '',
            phone:            d.phone            || '',
            email:            d.email            || '',
            website:          d.website          || '',
            board:            d.board            || '',
            affiliation_no:   d.affiliation_no   || '',
            admission_prefix: d.admission_prefix || 'ADM',
            address: {
              street: d.address?.street || '',
              city:   d.address?.city   || '',
              state:  d.address?.state  || '',
              pin:    d.address?.pin    || '',
            },
          })
        }
        setLoading(false)
      })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  const set     = (f, v) => setForm(p => ({ ...p, [f]: v }))
  const setAddr = (f, v) => setForm(p => ({ ...p, address: { ...p.address, [f]: v } }))

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true); setError('')
    try {
      const res = await apiPut('/master/school-profile', form)
      if (res.ok) {
        setMsg('Saved successfully!')
        setTimeout(() => setMsg(''), 3000)
      } else {
        const d = await res.json().catch(() => ({}))
        setError(d.detail || 'Save failed')
      }
    } catch (e) { setError(e.message) }
    setSaving(false)
  }

  if (loading) return (
    <div className="card border-0 shadow-sm">
      <div className="card-body text-center py-5">
        <div className="spinner-border text-primary"></div>
      </div>
    </div>
  )

  return (
    <div className="card border-0 shadow-sm">
      <div className="card-header bg-white fw-semibold">
        <i className="bi bi-building me-2 text-primary"></i>School Profile
      </div>
      <div className="card-body">
        {msg   && <div className="alert alert-success py-2 mb-3 small"><i className="bi bi-check-circle-fill me-2"></i>{msg}</div>}
        {error && <div className="alert alert-danger  py-2 mb-3 small"><i className="bi bi-exclamation-triangle-fill me-2"></i>{error}</div>}
        <form onSubmit={handleSave}>
          <div className="row g-3">
            <div className="col-md-8">
              <label className="form-label fw-medium small">School Name <span className="text-danger">*</span></label>
              <input className="form-control" value={form.school_name} required onChange={e => set('school_name', e.target.value)} />
            </div>
            <div className="col-md-4">
              <label className="form-label fw-medium small">Board</label>
              <select className="form-select" value={form.board} onChange={e => set('board', e.target.value)}>
                <option value="">Select board</option>
                {['CBSE','ICSE','State Board','IB','IGCSE'].map(b => <option key={b}>{b}</option>)}
              </select>
            </div>
            <div className="col-md-4">
              <label className="form-label fw-medium small">Phone</label>
              <input className="form-control" value={form.phone} onChange={e => set('phone', e.target.value)} />
            </div>
            <div className="col-md-4">
              <label className="form-label fw-medium small">Email</label>
              <input className="form-control" type="email" value={form.email} onChange={e => set('email', e.target.value)} />
            </div>
            <div className="col-md-4">
              <label className="form-label fw-medium small">Admission Prefix</label>
              <input className="form-control" value={form.admission_prefix} onChange={e => set('admission_prefix', e.target.value)} />
            </div>
            <div className="col-md-6">
              <label className="form-label fw-medium small">Affiliation No</label>
              <input className="form-control" value={form.affiliation_no} onChange={e => set('affiliation_no', e.target.value)} />
            </div>
            <div className="col-md-6">
              <label className="form-label fw-medium small">Website</label>
              <input className="form-control" value={form.website} onChange={e => set('website', e.target.value)} />
            </div>
            <div className="col-12">
              <hr className="my-1" />
              <p className="text-muted small fw-medium mb-2">Address</p>
            </div>
            <div className="col-12">
              <input className="form-control form-control-sm" placeholder="Street" value={form.address.street} onChange={e => setAddr('street', e.target.value)} />
            </div>
            <div className="col-md-5">
              <input className="form-control form-control-sm" placeholder="City"  value={form.address.city}  onChange={e => setAddr('city',  e.target.value)} />
            </div>
            <div className="col-md-4">
              <input className="form-control form-control-sm" placeholder="State" value={form.address.state} onChange={e => setAddr('state', e.target.value)} />
            </div>
            <div className="col-md-3">
              <input className="form-control form-control-sm" placeholder="PIN"   value={form.address.pin}   onChange={e => setAddr('pin',   e.target.value)} />
            </div>
            <div className="col-12">
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? <><span className="spinner-border spinner-border-sm me-2"></span>Saving...</> : <><i className="bi bi-check-lg me-2"></i>Save Profile</>}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  ACADEMIC YEARS
// ─────────────────────────────────────────────────────────────
function AcademicYearsTab() {
  return (
    <MasterTable
      title="Academic Years"
      endpoint="/master/academic-years"
      columns={['Label', 'Start Date', 'End Date', 'Status']}
      emptyForm={{ label: '', start_date: '', end_date: '', is_current: false }}
      renderForm={(form, setForm) => (<>
        <div className="col-md-3">
          <label className="form-label fw-medium small">Label <span className="text-danger">*</span></label>
          <input className="form-control form-control-sm" placeholder="2025-26"
            value={form.label || ''} required
            onChange={e => setForm(p => ({ ...p, label: e.target.value }))} />
        </div>
        <div className="col-md-3">
          <label className="form-label fw-medium small">Start Date <span className="text-danger">*</span></label>
          <input type="date" className="form-control form-control-sm"
            value={form.start_date || ''} required
            onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))} />
        </div>
        <div className="col-md-3">
          <label className="form-label fw-medium small">End Date <span className="text-danger">*</span></label>
          <input type="date" className="form-control form-control-sm"
            value={form.end_date || ''} required
            onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))} />
        </div>
        <div className="col-md-2">
          <label className="form-label fw-medium small">Current?</label>
          <div className="form-check mt-1">
            <input className="form-check-input" type="checkbox"
              checked={form.is_current || false}
              onChange={e => setForm(p => ({ ...p, is_current: e.target.checked }))} />
            <label className="form-check-label small">Yes</label>
          </div>
        </div>
      </>)}
      renderRow={(row) => (<>
        <td className="fw-medium">{row.label}</td>
        <td className="text-muted small">{row.start_date}</td>
        <td className="text-muted small">{row.end_date}</td>
        <td>{row.is_current ? <span className="badge bg-success">Current</span> : <span className="text-muted small">—</span>}</td>
      </>)}
    />
  )
}

// ─────────────────────────────────────────────────────────────
//  GRADES
// ─────────────────────────────────────────────────────────────
function GradesTab() {
  return (
    <MasterTable
      title="Grades / Classes"
      endpoint="/master/grades"
      columns={['Name', 'Order']}
      emptyForm={{ name: '', order_no: 0 }}
      renderForm={(form, setForm) => (<>
        <div className="col-md-5">
          <label className="form-label fw-medium small">Grade Name <span className="text-danger">*</span></label>
          <input className="form-control form-control-sm" placeholder="e.g. Class 1"
            value={form.name || ''} required
            onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
        </div>
        <div className="col-md-3">
          <label className="form-label fw-medium small">Order No</label>
          <input type="number" className="form-control form-control-sm"
            value={form.order_no ?? 0} min={0}
            onChange={e => setForm(p => ({ ...p, order_no: parseInt(e.target.value) || 0 }))} />
        </div>
      </>)}
      renderRow={(row) => (<>
        <td className="fw-medium">{row.name}</td>
        <td className="text-muted small">{row.order_no}</td>
      </>)}
    />
  )
}

// ─────────────────────────────────────────────────────────────
//  SECTIONS
// ─────────────────────────────────────────────────────────────
function SectionsTab() {
  const [rows,        setRows]        = useState([])
  const [grades,      setGrades]      = useState([])
  const [years,       setYears]       = useState([])
  const [loading,     setLoading]     = useState(true)
  const [saving,      setSaving]      = useState(false)
  const [showForm,    setShowForm]    = useState(false)
  const [editing,     setEditing]     = useState(null)
  const [error,       setError]       = useState('')
  const [success,     setSuccess]     = useState('')
  const [filterGrade, setFilterGrade] = useState('')
  const [filterYear,  setFilterYear]  = useState('')
  const [form, setForm] = useState({ name: '', grade_id: '', academic_year_id: '', capacity: 40 })

  useEffect(() => {
    Promise.all([
      apiFetch('/master/grades'),
      apiFetch('/master/academic-years'),
    ]).then(([g, y]) => {
      const gr = Array.isArray(g) ? g : []
      const yr = Array.isArray(y) ? y : []
      setGrades(gr)
      setYears(yr)
      const cur = yr.find(x => x.is_current)
      if (cur) setFilterYear(cur.id)
      setLoading(false)
    }).catch(e => { setError(e.message); setLoading(false) })
  }, [])

  const load = useCallback(async () => {
    try {
      let url = '/master/sections?x=1'
      if (filterGrade) url += `&grade_id=${filterGrade}`
      if (filterYear)  url += `&academic_year_id=${filterYear}`
      const d = await apiFetch(url)
      setRows(Array.isArray(d) ? d : [])
      setError('')
    } catch (e) { setError(e.message) }
  }, [filterGrade, filterYear])

  useEffect(() => { if (!loading) load() }, [load, loading])

  const gradeName = (id) => grades.find(g => g.id === id)?.name || '—'
  const yearLabel = (id) => years.find(y => y.id === id)?.label || '—'

  const openAdd = () => {
    setEditing(null)
    setForm({
      name: '',
      grade_id:         grades[0]?.id || '',
      academic_year_id: years.find(y => y.is_current)?.id || years[0]?.id || '',
      capacity: 40,
    })
    setError(''); setShowForm(true)
  }

  const openEdit = (row) => {
    setEditing(row)
    setForm({ name: row.name, grade_id: row.grade_id, academic_year_id: row.academic_year_id, capacity: row.capacity })
    setError(''); setShowForm(true)
  }

  const handleSave = async (e) => {
    e.preventDefault(); setSaving(true); setError('')
    try {
      const res = editing
        ? await apiPut(`/master/sections/${editing.id}`, form)
        : await apiPost('/master/sections', form)
      if (res.ok) {
        setShowForm(false)
        setSuccess(editing ? 'Updated!' : 'Section added!')
        setTimeout(() => setSuccess(''), 2500)
        load()
      } else {
        const d = await res.json().catch(() => ({}))
        setError(d.detail || `Error ${res.status}`)
      }
    } catch (e) { setError(e.message) }
    setSaving(false)
  }

  const handleDelete = async (row) => {
    if (!window.confirm(`Delete Section "${row.name}"?`)) return
    await apiDelete(`/master/sections/${row.id}`)
    load()
  }

  return (
    <div className="card border-0 shadow-sm">
      <div className="card-header bg-white d-flex justify-content-between align-items-center flex-wrap gap-2">
        <span className="fw-semibold">
          Sections {rows.length > 0 && <span className="badge bg-secondary ms-2">{rows.length}</span>}
        </span>
        <div className="d-flex gap-2 flex-wrap">
          <select className="form-select form-select-sm" style={{ width: 130 }}
            value={filterGrade} onChange={e => setFilterGrade(e.target.value)}>
            <option value="">All Classes</option>
            {grades.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <select className="form-select form-select-sm" style={{ width: 120 }}
            value={filterYear} onChange={e => setFilterYear(e.target.value)}>
            <option value="">All Years</option>
            {years.map(y => <option key={y.id} value={y.id}>{y.label}</option>)}
          </select>
          <button className="btn btn-primary btn-sm" onClick={openAdd}>
            <i className="bi bi-plus-lg me-1"></i>Add
          </button>
        </div>
      </div>

      {showForm && (
        <div className="card-body border-bottom bg-light">
          <form onSubmit={handleSave}>
            <div className="row g-2 align-items-end">
              <div className="col-md-2">
                <label className="form-label fw-medium small">Name <span className="text-danger">*</span></label>
                <input className="form-control form-control-sm" placeholder="A"
                  value={form.name} required onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div className="col-md-3">
                <label className="form-label fw-medium small">Class <span className="text-danger">*</span></label>
                <select className="form-select form-select-sm" value={form.grade_id} required onChange={e => setForm(p => ({ ...p, grade_id: e.target.value }))}>
                  <option value="">Select</option>
                  {grades.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
              <div className="col-md-3">
                <label className="form-label fw-medium small">Year <span className="text-danger">*</span></label>
                <select className="form-select form-select-sm" value={form.academic_year_id} required onChange={e => setForm(p => ({ ...p, academic_year_id: e.target.value }))}>
                  <option value="">Select</option>
                  {years.map(y => <option key={y.id} value={y.id}>{y.label}</option>)}
                </select>
              </div>
              <div className="col-md-2">
                <label className="form-label fw-medium small">Capacity</label>
                <input type="number" className="form-control form-control-sm" min={1}
                  value={form.capacity} onChange={e => setForm(p => ({ ...p, capacity: parseInt(e.target.value) || 40 }))} />
              </div>
              {error && (
                <div className="col-12">
                  <div className="alert alert-danger py-1 px-2 mb-0 small">{error}</div>
                </div>
              )}
              <div className="col-auto d-flex gap-2">
                <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                  {saving ? 'Saving...' : editing ? 'Update' : 'Save'}
                </button>
                <button type="button" className="btn btn-light btn-sm" onClick={() => setShowForm(false)}>Cancel</button>
              </div>
            </div>
          </form>
        </div>
      )}

      <div className="card-body p-0">
        {success && <div className="alert alert-success py-2 px-3 mb-0 rounded-0 small"><i className="bi bi-check-circle-fill me-2"></i>{success}</div>}
        {error && !showForm && <div className="alert alert-danger py-2 px-3 mb-0 rounded-0 small">{error} <button className="btn btn-sm btn-link py-0 ms-1" onClick={load}>Retry</button></div>}

        {loading ? (
          <div className="text-center py-4">
            <div className="spinner-border spinner-border-sm text-primary me-2"></div>
            <span className="text-muted small">Loading...</span>
          </div>
        ) : rows.length === 0 && !error ? (
          <div className="text-center py-5 text-muted">
            <i className="bi bi-diagram-3 fs-2 d-block mb-2 opacity-25"></i>
            <small>No sections found. Select a class and year, then add.</small>
          </div>
        ) : (
          <table className="table table-sm table-hover align-middle mb-0">
            <thead className="table-light">
              <tr><th style={{width:40}}>#</th><th>Section</th><th>Class</th><th>Year</th><th>Capacity</th><th style={{width:90}}>Actions</th></tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.id}>
                  <td className="text-muted small">{i + 1}</td>
                  <td><span className="badge bg-primary">{row.name}</span></td>
                  <td>{gradeName(row.grade_id)}</td>
                  <td><span className="badge bg-light text-dark border">{yearLabel(row.academic_year_id)}</span></td>
                  <td className="text-muted small">{row.capacity}</td>
                  <td>
                    <div className="btn-group btn-group-sm">
                      <button className="btn btn-outline-primary" onClick={() => openEdit(row)}><i className="bi bi-pencil"></i></button>
                      <button className="btn btn-outline-danger" onClick={() => handleDelete(row)}><i className="bi bi-trash"></i></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  SUBJECTS
// ─────────────────────────────────────────────────────────────
function SubjectsTab() {
  return (
    <MasterTable title="Subjects" endpoint="/master/subjects"
      columns={['Name', 'Code', 'Type']}
      emptyForm={{ name: '', code: '', type: 'theory' }}
      renderForm={(form, setForm) => (<>
        <div className="col-md-4">
          <label className="form-label fw-medium small">Subject Name <span className="text-danger">*</span></label>
          <input className="form-control form-control-sm" value={form.name || ''} required onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
        </div>
        <div className="col-md-2">
          <label className="form-label fw-medium small">Code</label>
          <input className="form-control form-control-sm" placeholder="MATH" value={form.code || ''} onChange={e => setForm(p => ({ ...p, code: e.target.value }))} />
        </div>
        <div className="col-md-3">
          <label className="form-label fw-medium small">Type</label>
          <select className="form-select form-select-sm" value={form.type || 'theory'} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
            <option value="theory">Theory</option>
            <option value="practical">Practical</option>
            <option value="language">Language</option>
          </select>
        </div>
      </>)}
      renderRow={(row) => (<>
        <td className="fw-medium">{row.name}</td>
        <td><code className="small">{row.code || '—'}</code></td>
        <td><span className={`badge ${row.type==='theory'?'bg-info text-dark':row.type==='practical'?'bg-success':'bg-warning text-dark'}`}>{row.type}</span></td>
      </>)}
    />
  )
}

// ─────────────────────────────────────────────────────────────
//  DEPARTMENTS
// ─────────────────────────────────────────────────────────────
function DepartmentsTab() {
  return (
    <MasterTable title="Departments" endpoint="/master/departments"
      columns={['Name', 'Code']}
      emptyForm={{ name: '', code: '' }}
      renderForm={(form, setForm) => (<>
        <div className="col-md-5">
          <label className="form-label fw-medium small">Name <span className="text-danger">*</span></label>
          <input className="form-control form-control-sm" value={form.name || ''} required onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
        </div>
        <div className="col-md-3">
          <label className="form-label fw-medium small">Code</label>
          <input className="form-control form-control-sm" value={form.code || ''} onChange={e => setForm(p => ({ ...p, code: e.target.value }))} />
        </div>
      </>)}
      renderRow={(row) => (<>
        <td className="fw-medium">{row.name}</td>
        <td><code className="small">{row.code || '—'}</code></td>
      </>)}
    />
  )
}

// ─────────────────────────────────────────────────────────────
//  DESIGNATIONS
// ─────────────────────────────────────────────────────────────
function DesignationsTab() {
  return (
    <MasterTable title="Designations" endpoint="/master/designations"
      columns={['Name']}
      emptyForm={{ name: '' }}
      renderForm={(form, setForm) => (
        <div className="col-md-6">
          <label className="form-label fw-medium small">Designation Name <span className="text-danger">*</span></label>
          <input className="form-control form-control-sm" value={form.name || ''} required onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
        </div>
      )}
      renderRow={(row) => <td className="fw-medium">{row.name}</td>}
    />
  )
}

// ─────────────────────────────────────────────────────────────
//  LEAVE TYPES
// ─────────────────────────────────────────────────────────────
function LeaveTypesTab() {
  return (
    <MasterTable title="Leave Types" endpoint="/master/leave-types"
      columns={['Name', 'Max Days/Year', 'Type']}
      emptyForm={{ name: '', max_days_per_year: 0, is_paid: true }}
      renderForm={(form, setForm) => (<>
        <div className="col-md-4">
          <label className="form-label fw-medium small">Name <span className="text-danger">*</span></label>
          <input className="form-control form-control-sm" value={form.name || ''} required onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
        </div>
        <div className="col-md-2">
          <label className="form-label fw-medium small">Max Days</label>
          <input type="number" className="form-control form-control-sm" min={0} value={form.max_days_per_year ?? 0} onChange={e => setForm(p => ({ ...p, max_days_per_year: parseInt(e.target.value) || 0 }))} />
        </div>
        <div className="col-md-2">
          <label className="form-label fw-medium small">Paid?</label>
          <div className="form-check mt-1">
            <input className="form-check-input" type="checkbox" checked={form.is_paid !== false} onChange={e => setForm(p => ({ ...p, is_paid: e.target.checked }))} />
            <label className="form-check-label small">Paid</label>
          </div>
        </div>
      </>)}
      renderRow={(row) => (<>
        <td className="fw-medium">{row.name}</td>
        <td className="text-muted small">{row.max_days_per_year} days</td>
        <td>{row.is_paid ? <span className="badge bg-success">Paid</span> : <span className="badge bg-secondary">Unpaid</span>}</td>
      </>)}
    />
  )
}

// ─────────────────────────────────────────────────────────────
//  FEE CATEGORIES
// ─────────────────────────────────────────────────────────────
function FeeCategoriesTab() {
  return (
    <MasterTable title="Fee Categories" endpoint="/master/fee-categories"
      columns={['Name', 'Frequency', 'Recurring']}
      emptyForm={{ name: '', frequency: 'monthly', is_recurring: true }}
      renderForm={(form, setForm) => (<>
        <div className="col-md-4">
          <label className="form-label fw-medium small">Name <span className="text-danger">*</span></label>
          <input className="form-control form-control-sm" value={form.name || ''} required onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
        </div>
        <div className="col-md-3">
          <label className="form-label fw-medium small">Frequency</label>
          <select className="form-select form-select-sm" value={form.frequency || 'monthly'} onChange={e => setForm(p => ({ ...p, frequency: e.target.value }))}>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="annual">Annual</option>
            <option value="once">One Time</option>
          </select>
        </div>
        <div className="col-md-2">
          <label className="form-label fw-medium small">Recurring?</label>
          <div className="form-check mt-1">
            <input className="form-check-input" type="checkbox" checked={form.is_recurring !== false} onChange={e => setForm(p => ({ ...p, is_recurring: e.target.checked }))} />
            <label className="form-check-label small">Yes</label>
          </div>
        </div>
      </>)}
      renderRow={(row) => (<>
        <td className="fw-medium">{row.name}</td>
        <td><span className="badge bg-light text-dark border text-capitalize">{row.frequency}</span></td>
        <td>{row.is_recurring ? <i className="bi bi-check-circle-fill text-success"></i> : <span className="text-muted">—</span>}</td>
      </>)}
    />
  )
}

// ─────────────────────────────────────────────────────────────
//  BOOK CATEGORIES
// ─────────────────────────────────────────────────────────────
function BookCategoriesTab() {
  return (
    <MasterTable title="Book Categories" endpoint="/master/book-categories"
      columns={['Name']}
      emptyForm={{ name: '' }}
      renderForm={(form, setForm) => (
        <div className="col-md-6">
          <label className="form-label fw-medium small">Category Name <span className="text-danger">*</span></label>
          <input className="form-control form-control-sm" value={form.name || ''} required onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
        </div>
      )}
      renderRow={(row) => <td className="fw-medium">{row.name}</td>}
    />
  )
}


function FeeStructureTab() {
  const [structures,   setStructures]   = useState([])
  const [grades,       setGrades]       = useState([])
  const [years,        setYears]        = useState([])
  const [feeCats,      setFeeCats]      = useState([])
  const [loading,      setLoading]      = useState(true)
  const [saving,       setSaving]       = useState(false)
  const [showForm,     setShowForm]     = useState(false)
  const [editing,      setEditing]      = useState(null)
  const [error,        setError]        = useState('')
  const [success,      setSuccess]      = useState('')
  const [filterYear,   setFilterYear]   = useState('')

  const [form, setForm] = useState({
    fee_category_id:  '',
    academic_year_id: '',
    grade_id:         '',
    amount:           '',
    due_day:          10,
    late_fine:        0,
  })

  // Load all dropdowns + structures
  useEffect(() => {
    Promise.all([
      apiFetch('/master/grades'),
      apiFetch('/master/academic-years'),
      apiFetch('/master/fee-categories'),
    ]).then(([g, y, f]) => {
      setGrades(Array.isArray(g) ? g : [])
      const ys = Array.isArray(y) ? y : []
      setYears(ys)
      setFeeCats(Array.isArray(f) ? f : [])
      const cur = ys.find(x => x.is_current)
      if (cur) setFilterYear(cur.id)
      setLoading(false)
    }).catch(e => { setError(e.message); setLoading(false) })
  }, [])

  // Load structures when year filter changes
  useEffect(() => {
    if (!filterYear || loading) return
    loadStructures()
  }, [filterYear, loading])

  const loadStructures = async () => {
    if (!filterYear) return
    try {
      const data = await apiFetch(`/fees/structures?academic_year_id=${filterYear}`)
      setStructures(Array.isArray(data) ? data : [])
      setError('')
    } catch (e) {
      setError(`Failed to load: ${e.message}`)
    }
  }

  const gradeName   = (id) => grades.find(g => g.id === id)?.name   || 'All Grades'
  const yearLabel   = (id) => years.find(y => y.id === id)?.label   || '—'
  const catName     = (id) => feeCats.find(f => f.id === id)?.name  || '—'

  const openAdd = () => {
    setEditing(null)
    setForm({
      fee_category_id:  feeCats[0]?.id || '',
      academic_year_id: filterYear     || years.find(y => y.is_current)?.id || '',
      grade_id:         '',
      amount:           '',
      due_day:          10,
      late_fine:        0,
    })
    setError('')
    setShowForm(true)
  }

  const openEdit = (row) => {
    setEditing(row)
    setForm({
      fee_category_id:  row.fee_category_id  || '',
      academic_year_id: row.academic_year_id || filterYear,
      grade_id:         row.grade_id         || '',
      amount:           row.amount            || '',
      due_day:          row.due_day           || 10,
      late_fine:        row.late_fine         || 0,
    })
    setError('')
    setShowForm(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.fee_category_id) { setError('Select a fee category'); return }
    if (!form.academic_year_id) { setError('Select academic year'); return }
    if (!form.amount || parseFloat(form.amount) < 0) { setError('Enter a valid amount'); return }

    setSaving(true); setError('')
    try {
      const payload = {
        fee_category_id:  form.fee_category_id,
        academic_year_id: form.academic_year_id,
        grade_id:         form.grade_id || null,
        amount:           parseFloat(form.amount),
        due_day:          parseInt(form.due_day) || 10,
        late_fine:        parseFloat(form.late_fine) || 0,
      }

      let res
      if (editing) {
        res = await apiPut(`/fees/structures/${editing.id}`, payload)
      } else {
        res = await apiPost('/fees/structures', payload)
      }

      if (res.ok) {
        setShowForm(false)
        setSuccess(editing ? 'Fee structure updated!' : 'Fee structure added!')
        setTimeout(() => setSuccess(''), 3000)
        loadStructures()
      } else {
        let errMsg = `Server error ${res.status}`
        try {
          const d = await res.json()
          errMsg = typeof d.detail === 'string'
            ? d.detail
            : Array.isArray(d.detail)
              ? d.detail.map(e => e.msg || e.message || JSON.stringify(e)).join(', ')
              : JSON.stringify(d.detail)
        } catch {}
        setError(errMsg)
      }
    } catch (e) {
      setError(e.message)
    }
    setSaving(false)
  }

  const handleDelete = async (row) => {
    const name = catName(row.fee_category_id)
    if (!window.confirm(`Delete "${name}" fee structure?`)) return
    try {
      const res = await apiDelete(`/fees/structures/${row.id}`)
      if (res.ok) {
        loadStructures()
        setSuccess('Deleted!')
        setTimeout(() => setSuccess(''), 2000)
      } else {
        let errMsg = 'Delete failed'
        try {
          const d = await res.json()
          errMsg = d.detail || errMsg
        } catch {}
        setError(errMsg)
      }
    } catch (e) {
      setError(e.message || 'Delete failed')
    }
  }

  // Group structures by grade for display
  const grouped = {}
  structures.forEach(s => {
    const key = s.grade_id || 'all'
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(s)
  })

  return (
    <div className="card border-0 shadow-sm">
      <div className="card-header bg-white d-flex justify-content-between align-items-center flex-wrap gap-2">
        <span className="fw-semibold">
          Fee Structures
          {structures.length > 0 && (
            <span className="badge bg-secondary ms-2">{structures.length}</span>
          )}
        </span>
        <div className="d-flex gap-2 align-items-center flex-wrap">
          {/* Year filter */}
          <select className="form-select form-select-sm" style={{ width: 140 }}
            value={filterYear}
            onChange={e => setFilterYear(e.target.value)}>
            <option value="">Select year</option>
            {years.map(y => (
              <option key={y.id} value={y.id}>
                {y.label}{y.is_current ? ' ★' : ''}
              </option>
            ))}
          </select>
          <button className="btn btn-primary btn-sm" onClick={openAdd}
            disabled={!filterYear || feeCats.length === 0}>
            <i className="bi bi-plus-lg me-1"></i>Add Structure
          </button>
        </div>
      </div>

      {/* Inline form */}
      {showForm && (
        <div className="card-body border-bottom bg-light">
          <div className="fw-medium small text-muted mb-2">
            {editing ? 'Edit Fee Structure' : 'New Fee Structure'}
          </div>
          <form onSubmit={handleSave}>
            <div className="row g-2 align-items-end">

              {/* Fee Category */}
              <div className="col-md-3">
                <label className="form-label fw-medium small">
                  Fee Category <span className="text-danger">*</span>
                </label>
                {feeCats.length === 0 ? (
                  <div className="alert alert-warning py-1 px-2 mb-0 small">
                    No fee categories. Add them first in Fee Categories tab.
                  </div>
                ) : (
                  <select className="form-select form-select-sm"
                    value={form.fee_category_id} required
                    onChange={e => setForm(p => ({ ...p, fee_category_id: e.target.value }))}>
                    <option value="">Select category</option>
                    {feeCats.map(f => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Academic Year */}
              <div className="col-md-2">
                <label className="form-label fw-medium small">
                  Year <span className="text-danger">*</span>
                </label>
                <select className="form-select form-select-sm"
                  value={form.academic_year_id} required
                  onChange={e => setForm(p => ({ ...p, academic_year_id: e.target.value }))}>
                  <option value="">Select year</option>
                  {years.map(y => (
                    <option key={y.id} value={y.id}>{y.label}</option>
                  ))}
                </select>
              </div>

              {/* Grade (optional) */}
              <div className="col-md-2">
                <label className="form-label fw-medium small">
                  Class
                  <span className="text-muted ms-1" style={{ fontSize: 10 }}>(optional)</span>
                </label>
                <select className="form-select form-select-sm"
                  value={form.grade_id}
                  onChange={e => setForm(p => ({ ...p, grade_id: e.target.value }))}>
                  <option value="">All Classes</option>
                  {grades.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>

              {/* Amount */}
              <div className="col-md-2">
                <label className="form-label fw-medium small">
                  Amount (₹) <span className="text-danger">*</span>
                </label>
                <div className="input-group input-group-sm">
                  <span className="input-group-text">₹</span>
                  <input type="number" className="form-control" required
                    placeholder="5000" min="0" step="0.01"
                    value={form.amount}
                    onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} />
                </div>
              </div>

              {/* Due Day */}
              <div className="col-md-1">
                <label className="form-label fw-medium small">Due Day</label>
                <input type="number" className="form-control form-control-sm"
                  min="1" max="31" value={form.due_day}
                  onChange={e => setForm(p => ({ ...p, due_day: e.target.value }))} />
              </div>

              {/* Late Fine */}
              <div className="col-md-1">
                <label className="form-label fw-medium small">Late Fine</label>
                <input type="number" className="form-control form-control-sm"
                  min="0" step="0.01" value={form.late_fine}
                  onChange={e => setForm(p => ({ ...p, late_fine: e.target.value }))} />
              </div>

              {error && (
                <div className="col-12">
                  <div className="alert alert-danger py-1 px-2 mb-0 small">
                    <i className="bi bi-exclamation-triangle-fill me-1"></i>{error}
                  </div>
                </div>
              )}

              <div className="col-auto d-flex gap-2">
                <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                  {saving
                    ? <><span className="spinner-border spinner-border-sm me-1"></span>Saving...</>
                    : editing ? 'Update' : 'Save'}
                </button>
                <button type="button" className="btn btn-light btn-sm"
                  onClick={() => { setShowForm(false); setError('') }}>
                  Cancel
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      <div className="card-body p-0">
        {success && (
          <div className="alert alert-success py-2 px-3 mb-0 rounded-0 small border-0">
            <i className="bi bi-check-circle-fill me-2"></i>{success}
          </div>
        )}
        {error && !showForm && (
          <div className="alert alert-danger py-2 px-3 mb-0 rounded-0 small border-0">
            <i className="bi bi-exclamation-triangle-fill me-2"></i>{error}
            <button className="btn btn-sm btn-link py-0 ms-1" onClick={loadStructures}>Retry</button>
          </div>
        )}

        {!filterYear ? (
          <div className="text-center py-5 text-muted">
            <i className="bi bi-calendar-range fs-2 d-block mb-2 opacity-25"></i>
            <small>Select an academic year to view fee structures</small>
          </div>
        ) : loading ? (
          <div className="text-center py-4">
            <div className="spinner-border spinner-border-sm text-primary"></div>
          </div>
        ) : feeCats.length === 0 ? (
          <div className="text-center py-5 text-muted">
            <i className="bi bi-exclamation-circle fs-2 d-block mb-2 opacity-25 text-warning"></i>
            <h6>No fee categories found</h6>
            <small>Go to <strong>Fee Categories</strong> tab first and add categories like Tuition, Library Fee etc.</small>
          </div>
        ) : structures.length === 0 ? (
          <div className="text-center py-5 text-muted">
            <i className="bi bi-table fs-2 d-block mb-2 opacity-25"></i>
            <h6>No fee structures for {yearLabel(filterYear)}</h6>
            <small>Click <strong>Add Structure</strong> to define how much each grade pays for each fee category.</small>
            <div className="mt-3">
              <button className="btn btn-primary btn-sm" onClick={openAdd}>
                <i className="bi bi-plus-lg me-1"></i>Add First Structure
              </button>
            </div>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-sm table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th>Fee Category</th>
                  <th>Class / Grade</th>
                  <th>Academic Year</th>
                  <th className="text-end">Amount</th>
                  <th className="text-center">Due Day</th>
                  <th className="text-end">Late Fine</th>
                  <th style={{ width: 90 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {structures.map((s, i) => (
                  <tr key={s.id}>
                    <td className="text-muted small">{i + 1}</td>
                    <td className="fw-medium">{catName(s.fee_category_id)}</td>
                    <td>
                      {s.grade_id ? (
                        <span className="badge bg-light text-dark border">
                          {gradeName(s.grade_id)}
                        </span>
                      ) : (
                        <span className="badge bg-secondary">All Classes</span>
                      )}
                    </td>
                    <td className="text-muted small">{yearLabel(s.academic_year_id)}</td>
                    <td className="text-end fw-bold text-success">
                      ₹{parseFloat(s.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="text-center text-muted small">
                      {s.due_day || 10}th
                    </td>
                    <td className="text-end text-muted small">
                      {s.late_fine > 0 ? `₹${s.late_fine}` : '—'}
                    </td>
                    <td>
                      <div className="btn-group btn-group-sm">
                        <button className="btn btn-outline-primary" title="Edit"
                          onClick={() => openEdit(s)}>
                          <i className="bi bi-pencil"></i>
                        </button>
                        <button className="btn btn-outline-danger" title="Delete"
                          onClick={() => handleDelete(s)}>
                          <i className="bi bi-trash"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              {/* Summary footer */}
              <tfoot className="table-light">
                <tr>
                  <td colSpan="4" className="text-muted small fw-medium">
                    Total per student ({yearLabel(filterYear)})
                  </td>
                  <td className="text-end fw-bold">
                    ₹{structures.reduce((sum, s) => sum + parseFloat(s.amount || 0), 0)
                        .toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td colSpan="3"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  USER MANAGEMENT TAB (embedded in Settings)
// ─────────────────────────────────────────────────────────────
function UserManagementTab() {
  const [users,      setUsers]      = useState([])
  const [apiRoles,   setApiRoles]   = useState([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState('')
  const [success,    setSuccess]    = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [editUser,   setEditUser]   = useState(null)
  const [resetUser,  setResetUser]  = useState(null)
  const [filterRole, setFilterRole] = useState('')
  const [search,     setSearch]     = useState('')

  const FALLBACK_ROLES = [
    { value:'admin',      label:'Admin',       icon:'bi-shield-lock-fill',  bg:'#fee2e2', color:'#dc2626', desc:'Full access — all modules, settings, user management' },
    { value:'teacher',    label:'Teacher',     icon:'bi-person-video2',     bg:'#dbeafe', color:'#1d4ed8', desc:'Mark attendance, enter marks, view students'          },
    { value:'accountant', label:'Accountant',  icon:'bi-cash-coin',         bg:'#dcfce7', color:'#16a34a', desc:'Fee collection, invoices, fee reports'                },
    { value:'student',    label:'Student',     icon:'bi-mortarboard-fill',  bg:'#fef9c3', color:'#d97706', desc:'Own attendance, results and fee invoices only'        },
    { value:'parent',     label:'Parent',      icon:'bi-people-fill',       bg:'#f1f5f9', color:'#64748b', desc:"View child's attendance, results and fee status"      },
  ]
  const ROLES = apiRoles.length > 0 ? apiRoles : FALLBACK_ROLES

  const badge = (role) => {
    const r = ROLES.find(x => x.value === role)
    if (!r) return <span className="badge bg-secondary small">{role}</span>
    return (
      <span className="badge small"
        style={{ background: r.bg, color: r.color, border: `1px solid ${r.color}33` }}>
        <i className={`bi ${r.icon} me-1`}></i>{r.label}
      </span>
    )
  }

  const load = async () => {
    setLoading(true); setError('')
    try {
      const params = new URLSearchParams()
      if (filterRole) params.set('role', filterRole)
      if (search)     params.set('search', search)

      // Fetch users — catch separately so one failure doesn't crash both
      const userRes = await apiFetch(`/users/?${params}`).catch(e => {
        setError(e.message || 'Failed to load users')
        return []
      })
      setUsers(Array.isArray(userRes) ? userRes : [])

      // Fetch roles — optional, never crash if it fails
      const roleRes = await apiFetch('/users/roles').catch(() => [])
      if (Array.isArray(roleRes) && roleRes.length > 0) {
        const knownMeta = {
          admin:      { icon:'bi-shield-lock-fill', bg:'#fee2e2', color:'#dc2626', desc:'Full access — all modules, settings, user management' },
          superadmin: { icon:'bi-shield-lock-fill', bg:'#fee2e2', color:'#dc2626', desc:'Full access' },
          teacher:    { icon:'bi-person-video2',    bg:'#dbeafe', color:'#1d4ed8', desc:'Mark attendance, enter marks, view students' },
          accountant: { icon:'bi-cash-coin',        bg:'#dcfce7', color:'#16a34a', desc:'Fee collection, invoices, fee reports' },
          student:    { icon:'bi-mortarboard-fill', bg:'#fef9c3', color:'#d97706', desc:'Own attendance, results and fee invoices only' },
          parent:     { icon:'bi-people-fill',      bg:'#f1f5f9', color:'#64748b', desc:"View child's attendance, results and fee status" },
        }
        setApiRoles(roleRes.map(r => ({
          value: r.name,   // exact DB name - sent to backend as-is
          label: r.name.charAt(0).toUpperCase() + r.name.slice(1).replace(/_/g, ' '),
          ...(knownMeta[r.name] || knownMeta[r.name.replace('super','').trim()] || 
              { icon:'bi-person-fill', bg:'#f1f5f9', color:'#64748b', desc:'Portal access' }),
        })))
      }
    } catch (e) {
      setError(e.message || 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [filterRole])

  const deactivate = async (u) => {
    if (!window.confirm(`Deactivate ${u.first_name}'s account? They will lose portal access.`)) return
    try {
      const res = await fetch(`/api/users/${u.id}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      })
      if (res.ok || res.status === 204) { load(); setSuccess('Account deactivated.') }
      else setError('Failed to deactivate')
    } catch { setError('Failed to deactivate') }
    setTimeout(() => setSuccess(''), 3000)
  }

  const reactivate = async (u) => {
    try {
      await apiPut(`/users/${u.id}`, { is_active: true })
      load(); setSuccess('Account reactivated.')
      setTimeout(() => setSuccess(''), 3000)
    } catch { setError('Failed to reactivate') }
  }

  const filteredUsers = users.filter(u =>
    !search ||
    u.first_name?.toLowerCase().includes(search.toLowerCase()) ||
    u.last_name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="card border-0 shadow-sm">
      <div className="card-header bg-white">
        <div className="row align-items-center g-2">
          <div className="col">
            <span className="fw-semibold">
              <i className="bi bi-people-fill me-2 text-primary"></i>
              User Management
              {users.length > 0 && <span className="badge bg-secondary ms-2">{users.length}</span>}
            </span>
          </div>
          <div className="col-auto">
            <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>
              <i className="bi bi-person-plus-fill me-1"></i>Add User
            </button>
          </div>
        </div>
      </div>

      {/* Role summary chips */}
      <div className="card-body border-bottom pb-2 pt-3">
        <div className="d-flex gap-2 flex-wrap align-items-center">
          <small className="text-muted fw-medium">Filter:</small>
          <button
            className={`btn btn-sm py-1 px-2 ${filterRole === '' ? 'btn-dark' : 'btn-outline-secondary'}`}
            onClick={() => setFilterRole('')}>
            All ({users.length})
          </button>
          {ROLES.map(r => {
            const count = users.filter(u => u.role === r.value).length
            return (
              <button key={r.value}
                className={`btn btn-sm py-1 px-2 ${filterRole === r.value ? 'btn-dark' : 'btn-outline-secondary'}`}
                onClick={() => setFilterRole(filterRole === r.value ? '' : r.value)}>
                <i className={`bi ${r.icon} me-1`} style={{ color: r.color }}></i>
                {r.label} ({count})
              </button>
            )
          })}
          <div className="input-group input-group-sm ms-auto" style={{ maxWidth: 200 }}>
            <input type="text" className="form-control"
              placeholder="Search..."
              value={search}
              onChange={e => setSearch(e.target.value)} />
            {search && (
              <button className="btn btn-outline-secondary" onClick={() => setSearch('')}>
                <i className="bi bi-x"></i>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Alerts */}
      <div className="card-body p-0">
        {success && (
          <div className="alert alert-success py-2 px-3 mb-0 rounded-0 small border-0">
            <i className="bi bi-check-circle-fill me-2"></i>{success}
          </div>
        )}
        {error && (
          <div className="alert alert-danger py-2 px-3 mb-0 rounded-0 small border-0">
            <i className="bi bi-exclamation-triangle-fill me-2"></i>{error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-4">
            <div className="spinner-border spinner-border-sm text-primary"></div>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-5 text-muted">
            <i className="bi bi-people fs-1 d-block mb-2 opacity-25"></i>
            <h6>No users found</h6>
            <small>Click "Add User" to create the first account</small>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-sm table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th className="text-center">Status</th>
                  <th>Last Login</th>
                  <th style={{ width: 120 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(u => (
                  <tr key={u.id} className={!u.is_active ? 'opacity-50' : ''}>
                    <td>
                      <div className="d-flex align-items-center gap-2">
                        {/* Avatar */}
                        {(() => {
                          const r = ROLES.find(x => x.value === u.role)
                          const initials = ((u.first_name?.[0] || '') + (u.last_name?.[0] || '')).toUpperCase() || '?'
                          return (
                            <div className="rounded-circle d-flex align-items-center justify-content-center fw-bold flex-shrink-0"
                              style={{ width: 30, height: 30, background: r?.bg || '#f1f5f9', color: r?.color || '#64748b', fontSize: 11 }}>
                              {initials}
                            </div>
                          )
                        })()}
                        <div>
                          <div className="fw-medium small">{u.first_name} {u.last_name || ''}</div>
                          {u.phone && <div className="text-muted" style={{ fontSize: 10 }}>{u.phone}</div>}
                        </div>
                      </div>
                    </td>
                    <td><code className="small text-muted">{u.email}</code></td>
                    <td>{badge(u.role)}</td>
                    <td className="text-center">
                      {u.is_active
                        ? <span className="badge bg-success small">Active</span>
                        : <span className="badge bg-secondary small">Inactive</span>}
                    </td>
                    <td className="text-muted small">
                      {u.last_login
                        ? new Date(u.last_login).toLocaleDateString('en-IN')
                        : 'Never'}
                    </td>
                    <td>
                      <div className="btn-group btn-group-sm">
                        <button className="btn btn-outline-primary" title="Edit role"
                          onClick={() => setEditUser(u)}>
                          <i className="bi bi-pencil"></i>
                        </button>
                        <button className="btn btn-outline-warning" title="Reset password"
                          onClick={() => setResetUser(u)}>
                          <i className="bi bi-key"></i>
                        </button>
                        {u.is_active
                          ? <button className="btn btn-outline-danger" title="Deactivate"
                              onClick={() => deactivate(u)}>
                              <i className="bi bi-person-x"></i>
                            </button>
                          : <button className="btn btn-outline-success" title="Reactivate"
                              onClick={() => reactivate(u)}>
                              <i className="bi bi-person-check"></i>
                            </button>
                        }
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE MODAL */}
      {showCreate && (
        <UMCreateModal
          roles={ROLES}
          onSuccess={() => { setShowCreate(false); load(); setSuccess('User created successfully!'); setTimeout(() => setSuccess(''), 3000) }}
          onClose={() => setShowCreate(false)}
        />
      )}

      {/* EDIT ROLE MODAL */}
      {editUser && (
        <UMEditModal
          user={editUser}
          roles={ROLES}
          onSuccess={() => { setEditUser(null); load(); setSuccess('User updated.'); setTimeout(() => setSuccess(''), 3000) }}
          onClose={() => setEditUser(null)}
        />
      )}

      {/* RESET PASSWORD MODAL */}
      {resetUser && (
        <UMResetModal
          user={resetUser}
          onSuccess={() => setResetUser(null)}
          onClose={() => setResetUser(null)}
        />
      )}
    </div>
  )
}

function UMCreateModal({ roles, onSuccess, onClose }) {
  const [form, setForm] = useState({ first_name:'', last_name:'', email:'', password:'', role:'', phone:'' })
  const [saving, setSaving]   = useState(false)
  const [error,  setError]    = useState('')
  const [showPw, setShowPw]   = useState(false)
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const selectedRole = roles.find(r => r.value === form.role)

  const submit = async (e) => {
    e.preventDefault()
    if (!form.first_name || !form.email || !form.password) { setError('Name, email and password are required'); return }
    if (form.password.length < 6) { setError('Password must be at least 6 characters'); return }
    setSaving(true); setError('')
    try {
      const res = await apiPost('/users/', form)
      if (res.ok) onSuccess()
      else {
        const d = await res.json().catch(() => ({}))
        setError(d.detail || `Error ${res.status}`)
      }
    } catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="modal show d-block" style={{ background:'rgba(0,0,0,0.5)', zIndex:1055 }}>
      <div className="modal-dialog modal-dialog-centered" style={{ maxWidth:500 }}>
        <div className="modal-content border-0 shadow">
          <div className="modal-header border-0 pb-0">
            <h5 className="modal-title fw-bold">
              <i className="bi bi-person-plus-fill me-2 text-primary"></i>Create User Account
            </h5>
            <button className="btn-close" onClick={onClose}></button>
          </div>
          <div className="modal-body">
            {error && <div className="alert alert-danger py-2 small mb-3"><i className="bi bi-exclamation-triangle-fill me-2"></i>{error}</div>}
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label fw-medium small">First Name <span className="text-danger">*</span></label>
                <input className="form-control" value={form.first_name} required onChange={e => set('first_name', e.target.value)} />
              </div>
              <div className="col-md-6">
                <label className="form-label fw-medium small">Last Name</label>
                <input className="form-control" value={form.last_name} onChange={e => set('last_name', e.target.value)} />
              </div>
              <div className="col-12">
                <label className="form-label fw-medium small">Email <span className="text-danger">*</span></label>
                <input type="email" className="form-control" value={form.email} required onChange={e => set('email', e.target.value)} />
              </div>
              <div className="col-md-6">
                <label className="form-label fw-medium small">Password <span className="text-danger">*</span></label>
                <div className="input-group">
                  <input type={showPw ? 'text' : 'password'} className="form-control" value={form.password}
                    minLength={6} required onChange={e => set('password', e.target.value)} />
                  <button type="button" className="btn btn-outline-secondary" onClick={() => setShowPw(s => !s)}>
                    <i className={`bi ${showPw ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                  </button>
                </div>
                <div className="form-text">Min 6 characters</div>
              </div>
              <div className="col-md-6">
                <label className="form-label fw-medium small">Phone</label>
                <input className="form-control" value={form.phone} placeholder="Optional" onChange={e => set('phone', e.target.value)} />
              </div>
              <div className="col-12">
                <label className="form-label fw-medium small">Role <span className="text-danger">*</span></label>
                <select className="form-select" value={form.role || roles[0]?.value || ''} required
                  onChange={e => set('role', e.target.value)}>
                  <option value="">Select role...</option>
                  {roles.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              {selectedRole && (
                <div className="col-12">
                  <div className="rounded-3 p-2 small d-flex align-items-start gap-2"
                    style={{ background: selectedRole.bg, color: selectedRole.color }}>
                    <i className={`bi ${selectedRole.icon} mt-1`}></i>
                    <div><strong>{selectedRole.label}:</strong> {selectedRole.desc}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="modal-footer border-0 pt-0">
            <button className="btn btn-light" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={submit} disabled={saving}>
              {saving ? <><span className="spinner-border spinner-border-sm me-2"></span>Creating...</> : <><i className="bi bi-person-check me-2"></i>Create Account</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function UMEditModal({ user, roles, onSuccess, onClose }) {
  const [form,   setForm]   = useState({ role: user.role, is_active: user.is_active })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')
  const r = roles.find(x => x.value === user.role)
  const initials = ((user.first_name?.[0] || '') + (user.last_name?.[0] || '')).toUpperCase() || '?'

  const submit = async () => {
    setSaving(true); setError('')
    try {
      const res = await apiPut(`/users/${user.id}`, form)
      if (res.ok) onSuccess()
      else { const d = await res.json().catch(() => ({})); setError(d.detail || 'Update failed') }
    } catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="modal show d-block" style={{ background:'rgba(0,0,0,0.5)', zIndex:1055 }}>
      <div className="modal-dialog modal-dialog-centered" style={{ maxWidth:420 }}>
        <div className="modal-content border-0 shadow">
          <div className="modal-header border-0 pb-0">
            <h5 className="modal-title fw-bold"><i className="bi bi-pencil me-2 text-primary"></i>Edit User</h5>
            <button className="btn-close" onClick={onClose}></button>
          </div>
          <div className="modal-body">
            <div className="d-flex align-items-center gap-3 p-3 rounded-3 mb-3"
              style={{ background: r?.bg || '#f1f5f9' }}>
              <div className="rounded-circle d-flex align-items-center justify-content-center fw-bold"
                style={{ width:44, height:44, background: r?.color || '#64748b', color:'#fff', fontSize:16, flexShrink:0 }}>
                {initials}
              </div>
              <div>
                <div className="fw-semibold">{user.first_name} {user.last_name || ''}</div>
                <code className="small" style={{ color: r?.color || '#64748b' }}>{user.email}</code>
              </div>
            </div>
            {error && <div className="alert alert-danger py-2 small mb-3">{error}</div>}
            <div className="mb-3">
              <label className="form-label fw-medium small">Role</label>
              <select className="form-select" value={form.role}
                onChange={e => setForm(p => ({ ...p, role: e.target.value }))}>
                {roles.map(r => <option key={r.value} value={r.value}>{r.label} — {r.desc}</option>)}
              </select>
            </div>
            <div className="form-check form-switch">
              <input className="form-check-input" type="checkbox" checked={form.is_active}
                onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} />
              <label className="form-check-label small fw-medium">Account Active</label>
              <div className="text-muted small">Uncheck to block portal access without deleting the account</div>
            </div>
          </div>
          <div className="modal-footer border-0 pt-0">
            <button className="btn btn-light" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={submit} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function UMResetModal({ user, onSuccess, onClose }) {
  const [pwd,    setPwd]    = useState('')
  const [showPw, setShowPw] = useState(false)
  const [saving, setSaving] = useState(false)
  const [done,   setDone]   = useState(false)
  const [error,  setError]  = useState('')

  const submit = async () => {
    if (!pwd || pwd.length < 6) { setError('Minimum 6 characters'); return }
    setSaving(true); setError('')
    try {
      const res = await apiPut(`/users/${user.id}/reset-password`, { new_password: pwd })
      if (res.ok) setDone(true)
      else { const d = await res.json().catch(() => ({})); setError(d.detail || 'Reset failed') }
    } catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="modal show d-block" style={{ background:'rgba(0,0,0,0.5)', zIndex:1055 }}>
      <div className="modal-dialog modal-dialog-centered" style={{ maxWidth:400 }}>
        <div className="modal-content border-0 shadow">
          <div className="modal-header border-0 pb-0">
            <h5 className="modal-title fw-bold"><i className="bi bi-key me-2 text-warning"></i>Reset Password</h5>
            <button className="btn-close" onClick={onClose}></button>
          </div>
          <div className="modal-body">
            <div className="p-3 bg-light rounded-3 mb-3 small">
              <i className="bi bi-person-circle me-2 text-muted"></i>
              <strong>{user.first_name} {user.last_name || ''}</strong>
              <code className="ms-2 text-muted">{user.email}</code>
            </div>
            {done ? (
              <div className="alert alert-success py-2 small">
                <i className="bi bi-check-circle-fill me-2"></i>
                Password reset! Share the new password with the user directly.
              </div>
            ) : (
              <>
                {error && <div className="alert alert-danger py-2 small mb-2">{error}</div>}
                <label className="form-label fw-medium small">New Password</label>
                <div className="input-group">
                  <input type={showPw ? 'text' : 'password'} className="form-control"
                    placeholder="Enter new password (min 6 chars)"
                    value={pwd} onChange={e => setPwd(e.target.value)} />
                  <button type="button" className="btn btn-outline-secondary" onClick={() => setShowPw(s => !s)}>
                    <i className={`bi ${showPw ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                  </button>
                </div>
              </>
            )}
          </div>
          <div className="modal-footer border-0 pt-0">
            <button className="btn btn-light" onClick={onClose}>{done ? 'Close' : 'Cancel'}</button>
            {!done && (
              <button className="btn btn-warning" onClick={submit} disabled={saving}>
                {saving ? 'Resetting...' : <><i className="bi bi-key me-2"></i>Reset Password</>}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  TEACHERS TAB
// ─────────────────────────────────────────────────────────────
function TeachersTab() {
  const [teachers, setTeachers] = useState([])
  const [subjects, setSubjects] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')
  const [success,  setSuccess]  = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing,  setEditing]  = useState(null)
  const [form, setForm] = useState({
    name:'', email:'', phone:'', employee_no:'',
    department:'', designation:'', is_active: true, subject_ids: []
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([
      apiFetch('/teachers').catch(() => []),
      apiFetch('/master/subjects').catch(() => []),
    ]).then(([t, s]) => {
      setTeachers(Array.isArray(t) ? t : [])
      setSubjects(Array.isArray(s) ? s : [])
      setLoading(false)
    })
  }, [])

  const load = async () => {
    const t = await apiFetch('/teachers').catch(() => [])
    setTeachers(Array.isArray(t) ? t : [])
  }

  const openAdd = () => {
    setEditing(null)
    setForm({ name:'', email:'', phone:'', employee_no:'',
              department:'', designation:'', is_active:true, subject_ids:[] })
    setError('')
    setShowForm(true)
  }

  const openEdit = (t) => {
    setEditing(t)
    setForm({
      name:        t.name        || '',
      email:       t.email       || '',
      phone:       t.phone       || '',
      employee_no: t.employee_no || '',
      department:  t.department  || '',
      designation: t.designation || '',
      is_active:   t.is_active,
      subject_ids: (t.subjects || []).map(s => s.subject_id),
    })
    setError('')
    setShowForm(true)
  }

  const toggleSubject = (sid) => {
    setForm(f => ({
      ...f,
      subject_ids: f.subject_ids.includes(sid)
        ? f.subject_ids.filter(x => x !== sid)
        : [...f.subject_ids, sid],
    }))
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('Name is required'); return }
    setSaving(true); setError('')
    try {
      const res = editing
        ? await apiPut(`/teachers/${editing.id}`, form)
        : await apiPost('/teachers', form)
      if (res.ok) {
        setShowForm(false)
        setSuccess(editing ? 'Teacher updated!' : 'Teacher added!')
        setTimeout(() => setSuccess(''), 3000)
        load()
      } else {
        const d = await res.json().catch(() => ({}))
        setError(d.detail || `Error ${res.status}`)
      }
    } catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }

  const handleDelete = async (t) => {
    if (!window.confirm(`Delete teacher "${t.name}"?`)) return
    const res = await fetch(`/api/teachers/${t.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    })
    if (res.ok || res.status === 204) { load(); setSuccess('Deleted!'); setTimeout(() => setSuccess(''), 2000) }
    else setError('Delete failed')
  }

  return (
    <div className="card border-0 shadow-sm">
      <div className="card-header bg-white d-flex justify-content-between align-items-center">
        <span className="fw-semibold">
          <i className="bi bi-person-video2 me-2 text-primary"></i>
          Teachers
          {teachers.length > 0 && <span className="badge bg-secondary ms-2">{teachers.length}</span>}
        </span>
        <button className="btn btn-primary btn-sm" onClick={openAdd}>
          <i className="bi bi-plus-lg me-1"></i>Add Teacher
        </button>
      </div>

      {/* Inline form */}
      {showForm && (
        <div className="card-body border-bottom bg-light">
          <div className="fw-medium small text-muted mb-3">
            {editing ? 'Edit Teacher' : 'New Teacher'}
          </div>
          <form onSubmit={handleSave}>
            <div className="row g-3">
              <div className="col-md-4">
                <label className="form-label fw-medium small">Full Name *</label>
                <input className="form-control" value={form.name} required
                  onChange={e => setForm(f => ({...f, name: e.target.value}))} />
              </div>
              <div className="col-md-4">
                <label className="form-label fw-medium small">Email</label>
                <input type="email" className="form-control" value={form.email}
                  onChange={e => setForm(f => ({...f, email: e.target.value}))} />
              </div>
              <div className="col-md-4">
                <label className="form-label fw-medium small">Phone</label>
                <input className="form-control" value={form.phone}
                  onChange={e => setForm(f => ({...f, phone: e.target.value}))} />
              </div>
              <div className="col-md-3">
                <label className="form-label fw-medium small">Employee No</label>
                <input className="form-control" value={form.employee_no} placeholder="EMP001"
                  onChange={e => setForm(f => ({...f, employee_no: e.target.value}))} />
              </div>
              <div className="col-md-3">
                <label className="form-label fw-medium small">Department</label>
                <input className="form-control" value={form.department}
                  onChange={e => setForm(f => ({...f, department: e.target.value}))} />
              </div>
              <div className="col-md-3">
                <label className="form-label fw-medium small">Designation</label>
                <input className="form-control" value={form.designation}
                  onChange={e => setForm(f => ({...f, designation: e.target.value}))} />
              </div>
              <div className="col-md-3">
                <label className="form-label fw-medium small">Status</label>
                <select className="form-select" value={form.is_active}
                  onChange={e => setForm(f => ({...f, is_active: e.target.value === 'true'}))}>
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </div>
              {/* Subjects */}
              <div className="col-12">
                <label className="form-label fw-medium small">
                  Subjects Taught
                  <span className="text-muted ms-1 small">(select all that apply)</span>
                </label>
                <div className="d-flex flex-wrap gap-2">
                  {subjects.map(s => (
                    <button key={s.id} type="button"
                      className={`btn btn-sm ${form.subject_ids.includes(s.id) ? 'btn-primary' : 'btn-outline-secondary'}`}
                      onClick={() => toggleSubject(s.id)}>
                      {form.subject_ids.includes(s.id) && <i className="bi bi-check me-1"></i>}
                      {s.name}
                      {s.code && <span className="ms-1 opacity-75">({s.code})</span>}
                    </button>
                  ))}
                  {subjects.length === 0 && (
                    <span className="text-muted small">No subjects found. Add them in the Subjects tab first.</span>
                  )}
                </div>
              </div>
              {error && (
                <div className="col-12">
                  <div className="alert alert-danger py-1 mb-0 small">{error}</div>
                </div>
              )}
              <div className="col-auto">
                <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                  {saving ? 'Saving...' : editing ? 'Update' : 'Save Teacher'}
                </button>
                <button type="button" className="btn btn-light btn-sm ms-2"
                  onClick={() => { setShowForm(false); setError('') }}>
                  Cancel
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      <div className="card-body p-0">
        {success && (
          <div className="alert alert-success py-2 px-3 mb-0 rounded-0 small border-0">
            <i className="bi bi-check-circle-fill me-2"></i>{success}
          </div>
        )}
        {loading ? (
          <div className="text-center py-4"><div className="spinner-border spinner-border-sm text-primary"></div></div>
        ) : teachers.length === 0 ? (
          <div className="text-center py-5 text-muted">
            <i className="bi bi-person-video2 fs-1 d-block mb-3 opacity-25"></i>
            <h6>No teachers added yet</h6>
            <small>Click "Add Teacher" to create the teacher master list</small>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-sm table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>Name</th>
                  <th>Employee No</th>
                  <th>Department</th>
                  <th>Phone</th>
                  <th>Subjects</th>
                  <th className="text-center">Status</th>
                  <th style={{width:90}}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {teachers.map(t => (
                  <tr key={t.id}>
                    <td>
                      <div className="fw-medium small">{t.name}</div>
                      {t.email && <div className="text-muted" style={{fontSize:10}}>{t.email}</div>}
                    </td>
                    <td><code className="small">{t.employee_no || '—'}</code></td>
                    <td className="text-muted small">{t.department || '—'}</td>
                    <td className="text-muted small">{t.phone || '—'}</td>
                    <td>
                      <div className="d-flex flex-wrap gap-1">
                        {(t.subjects || []).map(s => (
                          <span key={s.subject_id} className="badge bg-primary-subtle text-primary border border-primary-subtle small"
                            style={{fontSize:10}}>
                            {s.subject_name}
                          </span>
                        ))}
                        {(!t.subjects || t.subjects.length === 0) && (
                          <span className="text-muted small">—</span>
                        )}
                      </div>
                    </td>
                    <td className="text-center">
                      {t.is_active
                        ? <span className="badge bg-success small">Active</span>
                        : <span className="badge bg-secondary small">Inactive</span>}
                    </td>
                    <td>
                      <div className="btn-group btn-group-sm">
                        <button className="btn btn-outline-primary" onClick={() => openEdit(t)}>
                          <i className="bi bi-pencil"></i>
                        </button>
                        <button className="btn btn-outline-danger" onClick={() => handleDelete(t)}>
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
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  ROOMS TAB
// ─────────────────────────────────────────────────────────────
function RoomsTab() {
  const [rooms,    setRooms]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')
  const [success,  setSuccess]  = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing,  setEditing]  = useState(null)
  const [saving,   setSaving]   = useState(false)
  const [form, setForm] = useState({
    name:'', room_no:'', room_type:'classroom',
    capacity: 40, floor_no: null, building:'', is_active: true
  })

  const ROOM_TYPES = [
    { value:'classroom', label:'Classroom',  icon:'bi-door-open'    },
    { value:'lab',       label:'Lab',        icon:'bi-eyedropper'   },
    { value:'hall',      label:'Hall',       icon:'bi-building'     },
    { value:'library',   label:'Library',    icon:'bi-book'         },
    { value:'sports',    label:'Sports',     icon:'bi-trophy'       },
  ]

  const load = async () => {
    setLoading(true)
    const r = await apiFetch('/rooms').catch(() => [])
    setRooms(Array.isArray(r) ? r : [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const openAdd = () => {
    setEditing(null)
    setForm({ name:'', room_no:'', room_type:'classroom',
              capacity:40, floor_no: null, building:'', is_active:true })
    setError(''); setShowForm(true)
  }

  const openEdit = (r) => {
    setEditing(r)
    setForm({
      name: r.name, room_no: r.room_no, room_type: r.room_type,
      capacity: r.capacity || 40, floor_no: r.floor_no !== undefined ? r.floor_no : null,
      building: r.building || '', is_active: r.is_active,
    })
    setError(''); setShowForm(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.name || !form.room_no) { setError('Name and Room No are required'); return }
    setSaving(true); setError('')
    try {
      const res = editing
        ? await apiPut(`/rooms/${editing.id}`, form)
        : await apiPost('/rooms', form)
      if (res.ok) {
        setShowForm(false)
        setSuccess(editing ? 'Room updated!' : 'Room added!')
        setTimeout(() => setSuccess(''), 3000)
        load()
      } else {
        const d = await res.json().catch(() => ({}))
        setError(d.detail || `Error ${res.status}`)
      }
    } catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }

  const handleDelete = async (r) => {
    if (!window.confirm(`Delete room "${r.name}"?`)) return
    const res = await fetch(`/api/rooms/${r.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    })
    if (res.ok || res.status === 204) { load(); setSuccess('Deleted!'); setTimeout(() => setSuccess(''), 2000) }
    else setError('Delete failed')
  }

  const typeInfo = (type) => ROOM_TYPES.find(t => t.value === type) || ROOM_TYPES[0]

  return (
    <div className="card border-0 shadow-sm">
      <div className="card-header bg-white d-flex justify-content-between align-items-center">
        <span className="fw-semibold">
          <i className="bi bi-door-open me-2 text-primary"></i>
          Rooms
          {rooms.length > 0 && <span className="badge bg-secondary ms-2">{rooms.length}</span>}
        </span>
        <button className="btn btn-primary btn-sm" onClick={openAdd}>
          <i className="bi bi-plus-lg me-1"></i>Add Room
        </button>
      </div>

      {showForm && (
        <div className="card-body border-bottom bg-light">
          <div className="fw-medium small text-muted mb-3">
            {editing ? 'Edit Room' : 'New Room'}
          </div>
          <form onSubmit={handleSave}>
            <div className="row g-3">
              <div className="col-md-3">
                <label className="form-label fw-medium small">Room Name *</label>
                <input className="form-control" value={form.name}
                  placeholder="e.g. Maths Lab" required
                  onChange={e => setForm(f => ({...f, name: e.target.value}))} />
              </div>
              <div className="col-md-2">
                <label className="form-label fw-medium small">Room No *</label>
                <input className="form-control" value={form.room_no}
                  placeholder="101" required
                  onChange={e => setForm(f => ({...f, room_no: e.target.value}))} />
              </div>
              <div className="col-md-2">
                <label className="form-label fw-medium small">Type</label>
                <select className="form-select" value={form.room_type}
                  onChange={e => setForm(f => ({...f, room_type: e.target.value}))}>
                  {ROOM_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-2">
                <label className="form-label fw-medium small">Capacity</label>
                <input type="number" className="form-control"
                  value={form.capacity || 40} min="1"
                  onChange={e => setForm(f => ({
                    ...f,
                    capacity: parseInt(e.target.value) || 40
                  }))} />
              </div>
              <div className="col-md-1">
                <label className="form-label fw-medium small">Floor</label>
                <input type="number" className="form-control"
                  value={form.floor_no === null || form.floor_no === undefined ? '' : form.floor_no}
                  min="0" placeholder="0"
                  onChange={e => setForm(f => ({
                    ...f,
                    floor_no: e.target.value === '' ? null : parseInt(e.target.value)
                  }))} />
              </div>
              <div className="col-md-2">
                <label className="form-label fw-medium small">Building</label>
                <input className="form-control" value={form.building}
                  onChange={e => setForm(f => ({...f, building: e.target.value}))} />
              </div>
              {error && (
                <div className="col-12">
                  <div className="alert alert-danger py-1 mb-0 small">{error}</div>
                </div>
              )}
              <div className="col-auto">
                <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                  {saving ? 'Saving...' : editing ? 'Update' : 'Save Room'}
                </button>
                <button type="button" className="btn btn-light btn-sm ms-2"
                  onClick={() => { setShowForm(false); setError('') }}>
                  Cancel
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      <div className="card-body p-0">
        {success && (
          <div className="alert alert-success py-2 px-3 mb-0 rounded-0 small border-0">
            <i className="bi bi-check-circle-fill me-2"></i>{success}
          </div>
        )}
        {loading ? (
          <div className="text-center py-4"><div className="spinner-border spinner-border-sm text-primary"></div></div>
        ) : rooms.length === 0 ? (
          <div className="text-center py-5 text-muted">
            <i className="bi bi-door-open fs-1 d-block mb-3 opacity-25"></i>
            <h6>No rooms added yet</h6>
            <small>Click "Add Room" to create the room master list</small>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-sm table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>Room Name</th>
                  <th>Room No</th>
                  <th>Type</th>
                  <th className="text-center">Capacity</th>
                  <th>Floor / Building</th>
                  <th className="text-center">Status</th>
                  <th style={{width:90}}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rooms.map(r => {
                  const ti = typeInfo(r.room_type)
                  return (
                    <tr key={r.id}>
                      <td className="fw-medium small">{r.name}</td>
                      <td><code className="small">{r.room_no}</code></td>
                      <td>
                        <span className="badge bg-light text-dark border small">
                          <i className={`bi ${ti.icon} me-1`}></i>{ti.label}
                        </span>
                      </td>
                      <td className="text-center small">{r.capacity}</td>
                      <td className="text-muted small">
                        {r.floor_no !== null ? `Floor ${r.floor_no}` : ''}
                        {r.building ? ` · ${r.building}` : ''}
                        {!r.floor_no && !r.building ? '—' : ''}
                      </td>
                      <td className="text-center">
                        {r.is_active
                          ? <span className="badge bg-success small">Active</span>
                          : <span className="badge bg-secondary small">Inactive</span>}
                      </td>
                      <td>
                        <div className="btn-group btn-group-sm">
                          <button className="btn btn-outline-primary" onClick={() => openEdit(r)}>
                            <i className="bi bi-pencil"></i>
                          </button>
                          <button className="btn btn-outline-danger" onClick={() => handleDelete(r)}>
                            <i className="bi bi-trash"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
