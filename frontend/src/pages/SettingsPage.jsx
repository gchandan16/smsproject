// frontend/src/pages/SettingsPage.jsx
import { useState, useEffect, useCallback } from 'react'

// ── API helpers ───────────────────────────────────────────────
const BASE = 'http://localhost:8000'   // direct — no proxy needed

const getHeaders = () => ({
  'Authorization': `Bearer ${localStorage.getItem('token')}`,
  'Content-Type':  'application/json',
})

const apiFetch = async (path) => {
  const res = await fetch(`${BASE}${path}`, { headers: getHeaders() })
  if (res.status === 401) {
    localStorage.removeItem('token')
    window.location.href = '/login'
    return []
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

const apiPost = async (path, body) => {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(body),
  })
  return res
}

const apiPut = async (path, body) => {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(body),
  })
  return res
}

const apiDelete = async (path) => {
  const res = await fetch(`${BASE}${path}`, {
    method: 'DELETE',
    headers: getHeaders(),
  })
  return res
}

// ── Sidebar tabs ──────────────────────────────────────────────
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
]

export default function SettingsPage() {
  const [tab, setTab] = useState('school')

  return (
    <div>
      <div className="mb-4">
        <h4 className="fw-bold mb-0">Settings</h4>
        <small className="text-muted">Manage master data for your school</small>
      </div>

      <div className="row g-3">
        {/* Sidebar */}
        <div className="col-12 col-md-3">
          <div className="card border-0 shadow-sm">
            <div className="card-body p-2">
              <nav className="nav flex-column gap-1">
                {TABS.map(t => (
                  <button key={t.key}
                    className={`nav-link text-start w-100 rounded-2 px-3 py-2 border-0 d-flex align-items-center gap-2
                      ${tab === t.key ? 'bg-primary text-white' : 'text-body bg-transparent'}`}
                    onClick={() => setTab(t.key)}>
                    <i className={`bi ${t.icon}`} style={{ width: 18 }}></i>
                    <span className="small">{t.label}</span>
                  </button>
                ))}
              </nav>
            </div>
          </div>
        </div>

        {/* Content */}
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
      setError(`Failed to load: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }, [endpoint])

  useEffect(() => { load() }, [load])

  const openAdd  = () => {
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
    setSaving(true)
    setError('')
    try {
      const res = editing
        ? await apiPut(`${endpoint}/${editing.id}`, form)
        : await apiPost(endpoint, form)

      if (res.ok) {
        setShowForm(false)
        setSuccess(editing ? 'Updated successfully!' : 'Added successfully!')
        setTimeout(() => setSuccess(''), 3000)
        load()
      } else {
        const d = await res.json().catch(() => ({}))
        setError(d.detail || `Error ${res.status}`)
      }
    } catch (e) {
      setError(`Network error: ${e.message}`)
    }
    setSaving(false)
  }

  const handleDelete = async (row) => {
    if (!window.confirm(`Delete "${row.name}"?`)) return
    try {
      const res = await apiDelete(`${endpoint}/${row.id}`)
      if (res.ok) {
        load()
      } else {
        setError('Delete failed — this item may be in use')
      }
    } catch (e) {
      setError(`Delete failed: ${e.message}`)
    }
  }

  return (
    <div className="card border-0 shadow-sm">
      <div className="card-header bg-white d-flex justify-content-between align-items-center">
        <span className="fw-semibold">
          {title}
          {rows.length > 0 && (
            <span className="badge bg-secondary ms-2">{rows.length}</span>
          )}
        </span>
        <button className="btn btn-primary btn-sm" onClick={openAdd}>
          <i className="bi bi-plus-lg me-1"></i>Add
        </button>
      </div>

      {/* Form */}
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
              <div className="col-auto">
                <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                  {saving
                    ? <><span className="spinner-border spinner-border-sm me-1"></span>Saving...</>
                    : editing ? 'Update' : 'Save'}
                </button>
              </div>
              <div className="col-auto">
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
            <button className="btn btn-sm btn-link p-0 ms-2" onClick={load}>Retry</button>
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
            <small>No {title.toLowerCase()} added yet. Click Add to get started.</small>
          </div>
        ) : rows.length > 0 ? (
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
                        <button className="btn btn-outline-primary" title="Edit"
                          onClick={() => openEdit(row)}>
                          <i className="bi bi-pencil"></i>
                        </button>
                        <button className="btn btn-outline-danger" title="Delete"
                          onClick={() => handleDelete(row)}>
                          <i className="bi bi-trash"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  SCHOOL PROFILE
// ─────────────────────────────────────────────────────────────
function SchoolProfileTab() {
  const empty = {
    school_name: '', phone: '', email: '', website: '',
    board: '', affiliation_no: '', admission_prefix: 'ADM',
    address: { street: '', city: '', state: '', pin: '' },
  }
  const [form,    setForm]    = useState(empty)
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [msg,     setMsg]     = useState('')
  const [error,   setError]   = useState('')

  useEffect(() => {
    apiFetch('/api/master/school-profile')
      .then(d => {
        if (d && Object.keys(d).length > 0) {
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
      const res = await apiPut('/api/master/school-profile', form)
      if (res.ok) {
        setMsg('Saved successfully!')
        setTimeout(() => setMsg(''), 3000)
      } else {
        const d = await res.json().catch(() => ({}))
        setError(d.detail || 'Save failed')
      }
    } catch (e) {
      setError(e.message)
    }
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
            <div className="col-12"><hr className="my-1" /><p className="text-muted small fw-medium mb-2">Address</p></div>
            <div className="col-12"><input className="form-control form-control-sm" placeholder="Street" value={form.address.street} onChange={e => setAddr('street', e.target.value)} /></div>
            <div className="col-md-5"><input className="form-control form-control-sm" placeholder="City"  value={form.address.city}   onChange={e => setAddr('city',   e.target.value)} /></div>
            <div className="col-md-4"><input className="form-control form-control-sm" placeholder="State" value={form.address.state}  onChange={e => setAddr('state',  e.target.value)} /></div>
            <div className="col-md-3"><input className="form-control form-control-sm" placeholder="PIN"   value={form.address.pin}    onChange={e => setAddr('pin',    e.target.value)} /></div>
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
      endpoint="/api/master/academic-years"
      columns={['Label', 'Start Date', 'End Date', 'Status']}
      emptyForm={{ label: '', start_date: '', end_date: '', is_current: false }}
      renderForm={(form, setForm) => (<>
        <div className="col-md-3">
          <label className="form-label fw-medium small">Label <span className="text-danger">*</span></label>
          <input className="form-control form-control-sm" placeholder="2025-26" value={form.label || ''} required onChange={e => setForm(p => ({ ...p, label: e.target.value }))} />
        </div>
        <div className="col-md-3">
          <label className="form-label fw-medium small">Start Date <span className="text-danger">*</span></label>
          <input type="date" className="form-control form-control-sm" value={form.start_date || ''} required onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))} />
        </div>
        <div className="col-md-3">
          <label className="form-label fw-medium small">End Date <span className="text-danger">*</span></label>
          <input type="date" className="form-control form-control-sm" value={form.end_date || ''} required onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))} />
        </div>
        <div className="col-md-2">
          <label className="form-label fw-medium small">Current?</label>
          <div className="form-check mt-1">
            <input className="form-check-input" type="checkbox" checked={form.is_current || false} onChange={e => setForm(p => ({ ...p, is_current: e.target.checked }))} />
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
      endpoint="/api/master/grades"
      columns={['Name', 'Order']}
      emptyForm={{ name: '', order_no: 0 }}
      renderForm={(form, setForm) => (<>
        <div className="col-md-5">
          <label className="form-label fw-medium small">Grade Name <span className="text-danger">*</span></label>
          <input className="form-control form-control-sm" placeholder="e.g. Class 1" value={form.name || ''} required onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
        </div>
        <div className="col-md-3">
          <label className="form-label fw-medium small">Order No</label>
          <input type="number" className="form-control form-control-sm" value={form.order_no ?? 0} min={0} onChange={e => setForm(p => ({ ...p, order_no: parseInt(e.target.value) || 0 }))} />
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
      apiFetch('/api/master/grades'),
      apiFetch('/api/master/academic-years'),
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
      let url = '/api/master/sections?x=1'
      if (filterGrade) url += `&grade_id=${filterGrade}`
      if (filterYear)  url += `&academic_year_id=${filterYear}`
      const d = await apiFetch(url)
      setRows(Array.isArray(d) ? d : [])
    } catch (e) {
      setError(e.message)
    }
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
        ? await apiPut(`/api/master/sections/${editing.id}`, form)
        : await apiPost('/api/master/sections', form)
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
    await apiDelete(`/api/master/sections/${row.id}`)
    load()
  }

  return (
    <div className="card border-0 shadow-sm">
      <div className="card-header bg-white d-flex justify-content-between align-items-center flex-wrap gap-2">
        <span className="fw-semibold">Sections {rows.length > 0 && <span className="badge bg-secondary ms-2">{rows.length}</span>}</span>
        <div className="d-flex gap-2 flex-wrap">
          <select className="form-select form-select-sm" style={{ width: 130 }} value={filterGrade} onChange={e => setFilterGrade(e.target.value)}>
            <option value="">All Classes</option>
            {grades.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <select className="form-select form-select-sm" style={{ width: 120 }} value={filterYear} onChange={e => setFilterYear(e.target.value)}>
            <option value="">All Years</option>
            {years.map(y => <option key={y.id} value={y.id}>{y.label}</option>)}
          </select>
          <button className="btn btn-primary btn-sm" onClick={openAdd}><i className="bi bi-plus-lg me-1"></i>Add</button>
        </div>
      </div>

      {showForm && (
        <div className="card-body border-bottom bg-light">
          <form onSubmit={handleSave}>
            <div className="row g-2 align-items-end">
              <div className="col-md-2">
                <label className="form-label fw-medium small">Name <span className="text-danger">*</span></label>
                <input className="form-control form-control-sm" placeholder="A" value={form.name} required onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
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
                <input type="number" className="form-control form-control-sm" min={1} value={form.capacity} onChange={e => setForm(p => ({ ...p, capacity: parseInt(e.target.value) || 40 }))} />
              </div>
              {error && <div className="col-12"><div className="alert alert-danger py-1 px-2 mb-0 small">{error}</div></div>}
              <div className="col-auto d-flex gap-2">
                <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>{saving ? 'Saving...' : editing ? 'Update' : 'Save'}</button>
                <button type="button" className="btn btn-light btn-sm" onClick={() => setShowForm(false)}>Cancel</button>
              </div>
            </div>
          </form>
        </div>
      )}

      <div className="card-body p-0">
        {success && <div className="alert alert-success py-2 px-3 mb-0 rounded-0 small"><i className="bi bi-check-circle-fill me-2"></i>{success}</div>}
        {error && !showForm && <div className="alert alert-danger py-2 px-3 mb-0 rounded-0 small">{error} <button className="btn btn-sm btn-link p-0 ms-1" onClick={load}>Retry</button></div>}
        {loading ? (
          <div className="text-center py-4"><div className="spinner-border spinner-border-sm text-primary"></div></div>
        ) : rows.length === 0 ? (
          <div className="text-center py-5 text-muted"><i className="bi bi-diagram-3 fs-2 d-block mb-2 opacity-25"></i><small>No sections found. Filter by class and year, then add.</small></div>
        ) : (
          <table className="table table-sm table-hover align-middle mb-0">
            <thead className="table-light">
              <tr><th style={{ width: 40 }}>#</th><th>Section</th><th>Class</th><th>Year</th><th>Capacity</th><th style={{ width: 90 }}>Actions</th></tr>
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
                      <button className="btn btn-outline-danger"  onClick={() => handleDelete(row)}><i className="bi bi-trash"></i></button>
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
    <MasterTable
      title="Subjects"
      endpoint="/api/master/subjects"
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
        <td><span className={`badge ${row.type === 'theory' ? 'bg-info text-dark' : row.type === 'practical' ? 'bg-success' : 'bg-warning text-dark'}`}>{row.type}</span></td>
      </>)}
    />
  )
}

// ─────────────────────────────────────────────────────────────
//  DEPARTMENTS
// ─────────────────────────────────────────────────────────────
function DepartmentsTab() {
  return (
    <MasterTable
      title="Departments"
      endpoint="/api/master/departments"
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
    <MasterTable
      title="Designations"
      endpoint="/api/master/designations"
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
    <MasterTable
      title="Leave Types"
      endpoint="/api/master/leave-types"
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
    <MasterTable
      title="Fee Categories"
      endpoint="/api/master/fee-categories"
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
    <MasterTable
      title="Book Categories"
      endpoint="/api/master/book-categories"
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
