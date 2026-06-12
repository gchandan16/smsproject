// frontend/src/pages/TimetablePage.jsx
// ─────────────────────────────────────────────────────────────
// Full timetable: grid view, inline editing, period management
// ─────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react'
import api from '../api/client.js'

const DAYS = [
  { no: 1, label: 'Mon' },
  { no: 2, label: 'Tue' },
  { no: 3, label: 'Wed' },
  { no: 4, label: 'Thu' },
  { no: 5, label: 'Fri' },
  { no: 6, label: 'Sat' },
]

const DAY_COLORS = {
  1: '#dbeafe', 2: '#dcfce7', 3: '#fef9c3',
  4: '#fce7f3', 5: '#ede9fe', 6: '#f0fdf4',
}

export default function TimetablePage() {
  const [tab, setTab] = useState('timetable')
  return (
    <div>
      <div className="mb-4">
        <h4 className="fw-bold mb-0">Timetable</h4>
        <small className="text-muted">Manage class schedules and periods</small>
      </div>
      <ul className="nav nav-tabs mb-4">
        {[
          { key: 'timetable', icon: 'bi-grid-3x3',   label: 'Class Timetable' },
          { key: 'periods',   icon: 'bi-clock',       label: 'Manage Periods'  },
        ].map(t => (
          <li key={t.key} className="nav-item">
            <button className={`nav-link ${tab === t.key ? 'active' : ''}`}
              onClick={() => setTab(t.key)}>
              <i className={`bi ${t.icon} me-2`}></i>{t.label}
            </button>
          </li>
        ))}
      </ul>
      {tab === 'timetable' && <TimetableTab />}
      {tab === 'periods'   && <PeriodsTab />}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  TAB 1 — TIMETABLE GRID
// ─────────────────────────────────────────────────────────────
function TimetableTab() {
  const [years,    setYears]    = useState([])
  const [grades,   setGrades]   = useState([])
  const [sections, setSections] = useState([])
  const [subjects,  setSubjects]  = useState([])
  const [teachers,  setTeachers]  = useState([])
  const [rooms,     setRooms]     = useState([])
  const [yearId,    setYearId]    = useState('')
  const [gradeId,  setGradeId]  = useState('')
  const [sectionId,setSectionId]= useState('')
  const [grid,     setGrid]     = useState(null)
  const [loading,  setLoading]  = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')
  const [success,  setSuccess]  = useState('')
  // localGrid: { "periodId-dayNo": { subject_id, teacher_name, room_no } }
  const [localGrid, setLocalGrid] = useState({})
  const [editCell, setEditCell] = useState(null) // { periodId, day }

  useEffect(() => {
    Promise.all([
      api.get('/master/academic-years').then(r => r.data),
      api.get('/master/grades').then(r => r.data),
      api.get('/master/subjects').then(r => r.data),
      api.get('/teachers').then(r => r.data).catch(() => []),
      api.get('/rooms').then(r => r.data).catch(() => []),
    ]).then(([y, g, s, t, rm]) => {
      const ys = Array.isArray(y) ? y : []
      setYears(ys)
      setGrades(Array.isArray(g) ? g : [])
      setSubjects(Array.isArray(s) ? s : [])
      setTeachers(Array.isArray(t) ? t.filter(x => x.is_active) : [])
      setRooms(Array.isArray(rm) ? rm.filter(x => x.is_active) : [])
      const cur = ys.find(x => x.is_current)
      if (cur) setYearId(cur.id)
    })
  }, [])

  useEffect(() => {
    if (!gradeId || !yearId) return
    api.get('/master/sections', { params: { grade_id: gradeId, academic_year_id: yearId } })
      .then(r => {
        const secs = Array.isArray(r.data) ? r.data : []
        setSections(secs)
        if (secs.length > 0) setSectionId(secs[0].id)
        else setSectionId('')
      }).catch(() => setSections([]))
  }, [gradeId, yearId])

  const loadGrid = async () => {
    if (!sectionId || !yearId) return
    setLoading(true); setError('')
    try {
      const r = await api.get('/timetable/', {
        params: { section_id: sectionId, academic_year_id: yearId }
      })
      setGrid(r.data)
      // Pre-fill localGrid from existing data
      const lg = {}
      r.data.periods.forEach(p => {
        Object.entries(p.days).forEach(([day, entry]) => {
          const key = `${p.period_id}-${day}`
          lg[key] = {
            subject_id:   entry.subject_id   || '',
            teacher_name: entry.teacher_name || '',
            room_no:      entry.room_no      || '',
          }
        })
      })
      setLocalGrid(lg)
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to load timetable')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadGrid() }, [sectionId, yearId])

  const getCell = (periodId, day) =>
    localGrid[`${periodId}-${day}`] || {}

  const setCell = (periodId, day, field, value) => {
    const key = `${periodId}-${day}`
    setLocalGrid(p => ({
      ...p,
      [key]: { ...p[key], [field]: value }
    }))
  }

  const saveAll = async () => {
    if (!sectionId || !yearId || !grid) return
    setSaving(true); setError('')
    try {
      const entries = []
      grid.periods.filter(p => !p.is_break).forEach(p => {
        DAYS.forEach(d => {
          const cell = localGrid[`${p.period_id}-${d.no}`]
          if (cell?.subject_id) {
            entries.push({
              period_id:    p.period_id,
              day_of_week:  d.no,
              subject_id:   cell.subject_id   || null,
              teacher_name: cell.teacher_name || '',
              room_no:      cell.room_no      || '',
            })
          }
        })
      })
      await api.post('/timetable/bulk-save', {
        section_id:       sectionId,
        academic_year_id: yearId,
        entries,
      })
      setSuccess(`Timetable saved! ${entries.length} slots updated.`)
      setTimeout(() => setSuccess(''), 3000)
      loadGrid()
    } catch (e) {
      setError(e.response?.data?.detail || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const clearCell = async (periodId, day) => {
    const key = `${periodId}-${day}`
    setLocalGrid(p => {
      const n = { ...p }
      delete n[key]
      return n
    })
    try {
      await api.delete('/timetable/entry', {
        params: {
          section_id: sectionId, academic_year_id: yearId,
          period_id: periodId, day_of_week: day,
        }
      })
    } catch {}
  }

  const subjectName = (id) =>
    subjects.find(s => s.id === id)?.name || ''

  return (
    <div>
      {/* Filters */}
      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body py-2">
          <div className="row g-2 align-items-end">
            <div className="col-md-3">
              <label className="form-label fw-medium small">Academic Year</label>
              <select className="form-select form-select-sm" value={yearId}
                onChange={e => setYearId(e.target.value)}>
                {years.map(y => (
                  <option key={y.id} value={y.id}>{y.label}{y.is_current?' ★':''}</option>
                ))}
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label fw-medium small">Grade / Class</label>
              <select className="form-select form-select-sm" value={gradeId}
                onChange={e => setGradeId(e.target.value)}>
                <option value="">Select grade</option>
                {grades.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label fw-medium small">Section</label>
              <select className="form-select form-select-sm" value={sectionId}
                onChange={e => setSectionId(e.target.value)}
                disabled={!sections.length}>
                <option value="">Select</option>
                {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="col-auto">
              <button className="btn btn-outline-secondary btn-sm" onClick={loadGrid}>
                <i className="bi bi-arrow-clockwise me-1"></i>Refresh
              </button>
            </div>
            {grid && (
              <div className="col-auto ms-auto">
                <button className="btn btn-success btn-sm" onClick={saveAll} disabled={saving}>
                  {saving
                    ? <><span className="spinner-border spinner-border-sm me-1"></span>Saving...</>
                    : <><i className="bi bi-save me-1"></i>Save Timetable</>}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {error   && <div className="alert alert-danger small">{error}</div>}
      {success && <div className="alert alert-success small">{success}</div>}

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary"></div>
        </div>
      ) : !grid ? (
        <div className="card border-0 shadow-sm">
          <div className="card-body text-center py-5 text-muted">
            <i className="bi bi-grid-3x3 fs-1 d-block mb-3 opacity-25"></i>
            <h6>Select a class and section to view the timetable</h6>
          </div>
        </div>
      ) : (
        <div className="card border-0 shadow-sm">
          <div className="card-header bg-white d-flex align-items-center justify-content-between">
            <span className="fw-semibold">
              <i className="bi bi-grid-3x3 me-2 text-primary"></i>
              Weekly Timetable
            </span>
            <small className="text-muted">Click any cell to assign a subject</small>
          </div>
          <div className="table-responsive">
            <table className="table table-bordered align-middle mb-0"
              style={{ minWidth: 700, tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: 130 }} />
                {DAYS.map(d => <col key={d.no} />)}
              </colgroup>
              <thead>
                <tr>
                  <th className="text-center bg-light" style={{ fontSize: 12 }}>
                    Period
                  </th>
                  {DAYS.map(d => (
                    <th key={d.no} className="text-center"
                      style={{ background: DAY_COLORS[d.no], fontSize: 13, fontWeight: 600 }}>
                      {d.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {grid.periods.map(p => (
                  <tr key={p.period_id}
                    style={{ background: p.is_break ? '#f8fafc' : 'white' }}>
                    {/* Period label */}
                    <td className="text-center" style={{ background: '#f8fafc' }}>
                      <div className="fw-medium small">{p.period_name}</div>
                      <div className="text-muted" style={{ fontSize: 10 }}>
                        {p.start_time?.slice(0,5)} – {p.end_time?.slice(0,5)}
                      </div>
                      {p.is_break && (
                        <span className="badge bg-secondary" style={{ fontSize: 9 }}>BREAK</span>
                      )}
                    </td>

                    {/* Day cells */}
                    {DAYS.map(d => {
                      if (p.is_break) {
                        return (
                          <td key={d.no} className="text-center text-muted"
                            style={{ background: '#f1f5f9', fontSize: 11 }}>
                            —
                          </td>
                        )
                      }
                      const cell = getCell(p.period_id, d.no)
                      const isEditing = editCell?.periodId === p.period_id && editCell?.day === d.no

                      return (
                        <td key={d.no}
                          style={{
                            padding: 4,
                            background: cell.subject_id ? DAY_COLORS[d.no] : '#fff',
                            cursor: 'pointer',
                            verticalAlign: 'top',
                          }}
                          onClick={() => !isEditing && setEditCell({ periodId: p.period_id, day: d.no })}>

                          {isEditing ? (
                            /* Edit mode */
                            <div onClick={e => e.stopPropagation()}>
                              <select className="form-select form-select-sm mb-1"
                                style={{ fontSize: 11 }}
                                value={cell.subject_id || ''}
                                onChange={e => {
                                  setCell(p.period_id, d.no, 'subject_id', e.target.value)
                                  // Auto-fill teacher if only one teacher teaches this subject
                                  const subTeachers = teachers.filter(t =>
                                    (t.subjects || []).some(s => s.subject_id === e.target.value)
                                  )
                                  if (subTeachers.length === 1) {
                                    setCell(p.period_id, d.no, 'teacher_name', subTeachers[0].name)
                                  }
                                }}
                                autoFocus>
                                <option value="">-- Subject --</option>
                                {subjects.map(s => (
                                  <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                              </select>
                              <select className="form-select form-select-sm mb-1"
                                style={{ fontSize: 11 }}
                                value={cell.teacher_name || ''}
                                onChange={e => setCell(p.period_id, d.no, 'teacher_name', e.target.value)}>
                                <option value="">-- Teacher --</option>
                                {teachers.length > 0
                                  ? teachers.map(t => (
                                      <option key={t.id} value={t.name}>{t.name}</option>
                                    ))
                                  : <option disabled>No teachers — add in Settings</option>
                                }
                              </select>
                              <select className="form-select form-select-sm mb-1"
                                style={{ fontSize: 11 }}
                                value={cell.room_no || ''}
                                onChange={e => setCell(p.period_id, d.no, 'room_no', e.target.value)}>
                                <option value="">-- Room --</option>
                                {rooms.length > 0
                                  ? rooms.map(r => (
                                      <option key={r.id} value={r.room_no}>
                                        {r.name} ({r.room_no})
                                      </option>
                                    ))
                                  : <option disabled>No rooms — add in Settings</option>
                                }
                              </select>
                              <div className="d-flex gap-1">
                                <button className="btn btn-primary btn-sm flex-grow-1"
                                  style={{ fontSize: 10, padding: '1px 4px' }}
                                  onClick={() => setEditCell(null)}>
                                  ✓ Done
                                </button>
                                <button className="btn btn-outline-danger btn-sm"
                                  style={{ fontSize: 10, padding: '1px 4px' }}
                                  onClick={() => { clearCell(p.period_id, d.no); setEditCell(null) }}>
                                  ✕
                                </button>
                              </div>
                            </div>
                          ) : cell.subject_id ? (
                            /* Filled cell */
                            <div style={{ minHeight: 56, padding: '4px 6px' }}>
                              <div className="fw-semibold" style={{ fontSize: 12, color: '#1e3a5f' }}>
                                {subjectName(cell.subject_id)}
                              </div>
                              {cell.teacher_name && (
                                <div className="text-muted" style={{ fontSize: 10 }}>
                                  <i className="bi bi-person me-1"></i>{cell.teacher_name}
                                </div>
                              )}
                              {cell.room_no && (
                                <div className="text-muted" style={{ fontSize: 10 }}>
                                  <i className="bi bi-door-open me-1"></i>{cell.room_no}
                                </div>
                              )}
                            </div>
                          ) : (
                            /* Empty cell */
                            <div style={{ minHeight: 56, display: 'flex',
                              alignItems: 'center', justifyContent: 'center' }}>
                              <span className="text-muted" style={{ fontSize: 18, opacity: 0.2 }}>+</span>
                            </div>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card-footer bg-light small text-muted">
            <i className="bi bi-info-circle me-1"></i>
            Click any cell to assign a subject and teacher. Click <strong>Save Timetable</strong> to save all changes at once.
          </div>
        </div>
      )}

      {/* Edit modal for cell */}
      {editCell && (
        <div onClick={() => setEditCell(null)} />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  TAB 2 — MANAGE PERIODS
// ─────────────────────────────────────────────────────────────
function PeriodsTab() {
  const [periods,  setPeriods]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')
  const [success,  setSuccess]  = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing,  setEditing]  = useState(null)
  const [form,     setForm]     = useState({
    name: '', period_no: '', start_time: '', end_time: '', is_break: false
  })

  const load = async () => {
    try {
      const r = await api.get('/timetable/periods')
      setPeriods(Array.isArray(r.data) ? r.data : [])
    } catch (e) {
      setError('Failed to load periods')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const openAdd = () => {
    setEditing(null)
    setForm({ name:'', period_no: periods.length + 1,
              start_time:'', end_time:'', is_break: false })
    setShowForm(true)
  }

  const openEdit = (p) => {
    setEditing(p)
    setForm({
      name:       p.name,
      period_no:  p.period_no,
      start_time: p.start_time?.slice(0,5) || '',
      end_time:   p.end_time?.slice(0,5)   || '',
      is_break:   p.is_break,
    })
    setShowForm(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true); setError('')
    try {
      if (editing) {
        await api.put(`/timetable/periods/${editing.id}`, form)
      } else {
        await api.post('/timetable/periods', form)
      }
      setShowForm(false)
      setSuccess(editing ? 'Period updated' : 'Period added')
      setTimeout(() => setSuccess(''), 2500)
      load()
    } catch (e) {
      setError(e.response?.data?.detail || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const deletePeriod = async (p) => {
    if (!window.confirm(`Delete "${p.name}"?`)) return
    try {
      await api.delete(`/timetable/periods/${p.id}`)
      load()
    } catch (e) {
      setError(e.response?.data?.detail || 'Delete failed')
    }
  }

  return (
    <div className="card border-0 shadow-sm">
      <div className="card-header bg-white d-flex justify-content-between align-items-center">
        <span className="fw-semibold">
          <i className="bi bi-clock me-2 text-primary"></i>
          Period / Time Slots
        </span>
        <button className="btn btn-primary btn-sm" onClick={openAdd}>
          <i className="bi bi-plus-lg me-1"></i>Add Period
        </button>
      </div>

      {showForm && (
        <div className="card-body border-bottom bg-light">
          <div className="fw-medium small text-muted mb-2">
            {editing ? 'Edit Period' : 'New Period'}
          </div>
          <form onSubmit={handleSave}>
            <div className="row g-2 align-items-end">
              <div className="col-md-3">
                <label className="form-label fw-medium small">Name *</label>
                <input className="form-control form-control-sm"
                  placeholder="e.g. Period 1 / Lunch"
                  value={form.name} required
                  onChange={e => setForm(p => ({...p, name: e.target.value}))} />
              </div>
              <div className="col-md-1">
                <label className="form-label fw-medium small">Order</label>
                <input type="number" className="form-control form-control-sm"
                  min="1" value={form.period_no} required
                  onChange={e => setForm(p => ({...p, period_no: parseInt(e.target.value)}))} />
              </div>
              <div className="col-md-2">
                <label className="form-label fw-medium small">Start *</label>
                <input type="time" className="form-control form-control-sm"
                  value={form.start_time} required
                  onChange={e => setForm(p => ({...p, start_time: e.target.value}))} />
              </div>
              <div className="col-md-2">
                <label className="form-label fw-medium small">End *</label>
                <input type="time" className="form-control form-control-sm"
                  value={form.end_time} required
                  onChange={e => setForm(p => ({...p, end_time: e.target.value}))} />
              </div>
              <div className="col-md-2">
                <div className="form-check mt-4">
                  <input type="checkbox" className="form-check-input"
                    checked={form.is_break}
                    onChange={e => setForm(p => ({...p, is_break: e.target.checked}))} />
                  <label className="form-check-label small">Is Break / Lunch</label>
                </div>
              </div>
              <div className="col-auto">
                <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                  {saving ? 'Saving...' : editing ? 'Update' : 'Add'}
                </button>
                <button type="button" className="btn btn-light btn-sm ms-1"
                  onClick={() => { setShowForm(false); setError('') }}>
                  Cancel
                </button>
              </div>
            </div>
            {error && (
              <div className="alert alert-danger py-1 mt-2 mb-0 small">{error}</div>
            )}
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
          <div className="text-center py-4">
            <div className="spinner-border spinner-border-sm text-primary"></div>
          </div>
        ) : periods.length === 0 ? (
          <div className="text-center py-5 text-muted">
            <i className="bi bi-clock fs-1 d-block mb-3 opacity-25"></i>
            <h6>No periods defined</h6>
            <small>Click "Add Period" to define your school's daily schedule</small>
          </div>
        ) : (
          <table className="table table-sm table-hover align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th style={{ width: 50 }}>#</th>
                <th>Name</th>
                <th>Start</th>
                <th>End</th>
                <th>Duration</th>
                <th>Type</th>
                <th style={{ width: 90 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {periods.map(p => {
                const [sh, sm] = (p.start_time || '').slice(0,5).split(':').map(Number)
                const [eh, em] = (p.end_time   || '').slice(0,5).split(':').map(Number)
                const dur = ((eh*60+em) - (sh*60+sm))
                return (
                  <tr key={p.id}
                    style={{ background: p.is_break ? '#f8fafc' : 'white' }}>
                    <td className="text-muted small fw-bold">{p.period_no}</td>
                    <td className="fw-medium">{p.name}</td>
                    <td className="text-muted small">{p.start_time?.slice(0,5)}</td>
                    <td className="text-muted small">{p.end_time?.slice(0,5)}</td>
                    <td className="text-muted small">{dur > 0 ? `${dur} min` : '—'}</td>
                    <td>
                      {p.is_break
                        ? <span className="badge bg-secondary small">Break</span>
                        : <span className="badge bg-primary small">Class</span>}
                    </td>
                    <td>
                      <div className="btn-group btn-group-sm">
                        <button className="btn btn-outline-primary"
                          onClick={() => openEdit(p)}>
                          <i className="bi bi-pencil"></i>
                        </button>
                        <button className="btn btn-outline-danger"
                          onClick={() => deletePeriod(p)}>
                          <i className="bi bi-trash"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
