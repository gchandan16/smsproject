// frontend/src/pages/AttendancePage.jsx
// ─────────────────────────────────────────────────────────────
// Complete Attendance module UI
// Tabs: Mark Attendance | Summary | Low Attendance
// ─────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from 'react'
import attendanceApi from '../api/attendanceApi.js'
import studentsApi   from '../api/studentsApi.js'

const today = () => new Date().toISOString().slice(0, 10)

const STATUS_CONFIG = {
  present: { label: 'P',       bg: 'btn-success',   text: 'Present',  icon: 'bi-check-circle-fill',  badge: 'bg-success'  },
  absent:  { label: 'A',       bg: 'btn-danger',    text: 'Absent',   icon: 'bi-x-circle-fill',      badge: 'bg-danger'   },
  late:    { label: 'L',       bg: 'btn-warning',   text: 'Late',     icon: 'bi-clock-fill',         badge: 'bg-warning text-dark'  },
  holiday: { label: 'H',       bg: 'btn-secondary', text: 'Holiday',  icon: 'bi-calendar-x-fill',    badge: 'bg-secondary'},
  null:    { label: '—',       bg: 'btn-outline-secondary', text: 'Not marked', icon: 'bi-dash-circle', badge: 'bg-light text-muted' },
}

export default function AttendancePage() {
  const [tab, setTab] = useState('mark')

  return (
    <div>
      <div className="d-flex align-items-center mb-4">
        <div>
          <h4 className="fw-bold mb-0">Attendance</h4>
          <small className="text-muted">Mark and track student attendance</small>
        </div>
      </div>

      {/* Tab Nav */}
      <ul className="nav nav-tabs mb-4">
        {[
          { key: 'mark',    icon: 'bi-pencil-square',     label: 'Mark Attendance'  },
          { key: 'summary', icon: 'bi-bar-chart-line',    label: 'Section Summary'  },
          { key: 'low',     icon: 'bi-exclamation-triangle', label: 'Low Attendance'},
        ].map(t => (
          <li key={t.key} className="nav-item">
            <button
              className={`nav-link ${tab === t.key ? 'active' : ''}`}
              onClick={() => setTab(t.key)}>
              <i className={`bi ${t.icon} me-2`}></i>{t.label}
            </button>
          </li>
        ))}
      </ul>

      {tab === 'mark'    && <MarkAttendanceTab />}
      {tab === 'summary' && <SummaryTab />}
      {tab === 'low'     && <LowAttendanceTab />}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  MARK ATTENDANCE TAB
// ─────────────────────────────────────────────────────────────
function MarkAttendanceTab() {
  const [grades,          setGrades]          = useState([])
  const [years,           setYears]           = useState([])
  const [sections,        setSections]        = useState([])
  const [loadingSections, setLoadingSections] = useState(false)

  const [selectedGrade,   setSelectedGrade]   = useState('')
  const [selectedYear,    setSelectedYear]    = useState('')
  const [selectedSection, setSelectedSection] = useState('')
  const [selectedDate,    setSelectedDate]    = useState(today())

  const [attendanceData,  setAttendanceData]  = useState(null)
  const [localStatus,     setLocalStatus]     = useState({})  // { enrollment_id: status }
  const [localRemarks,    setLocalRemarks]    = useState({})  // { enrollment_id: remarks }
  const [loading,         setLoading]         = useState(false)
  const [saving,          setSaving]          = useState(false)
  const [saved,           setSaved]           = useState(false)
  const [error,           setError]           = useState('')

  // Load grades + years
  useEffect(() => {
    Promise.all([
      studentsApi.getGrades(),
      fetch('/api/master/academic-years', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      }).then(r => r.json()),
    ]).then(([g, y]) => {
      setGrades(Array.isArray(g) ? g : [])
      const ys = Array.isArray(y) ? y : []
      setYears(ys)
      const cur = ys.find(x => x.is_current)
      if (cur) setSelectedYear(cur.id)
    })
  }, [])

  // Load sections when grade + year selected
  useEffect(() => {
    if (!selectedGrade || !selectedYear) { setSections([]); return }
    setLoadingSections(true)
    studentsApi.getSections(selectedGrade, selectedYear)
      .then(d => { setSections(Array.isArray(d) ? d : []) })
      .finally(() => setLoadingSections(false))
    setSelectedSection('')
    setAttendanceData(null)
  }, [selectedGrade, selectedYear])

  // Load attendance when section + date selected
  const loadAttendance = useCallback(async () => {
    if (!selectedSection || !selectedDate) return
    setLoading(true); setError('')
    try {
      const data = await attendanceApi.getSectionAttendance(selectedSection, selectedDate)
      setAttendanceData(data)
      // Pre-fill local status from already-marked data
      const statusMap = {}
      const remarksMap = {}
      data.students.forEach(s => {
        statusMap[s.enrollment_id]  = s.status  || 'present'
        remarksMap[s.enrollment_id] = s.remarks || ''
      })
      setLocalStatus(statusMap)
      setLocalRemarks(remarksMap)
      setSaved(false)
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to load attendance')
    } finally {
      setLoading(false)
    }
  }, [selectedSection, selectedDate])

  useEffect(() => { loadAttendance() }, [loadAttendance])

  // Mark all present
  const markAllPresent = () => {
    if (!attendanceData) return
    const statusMap = {}
    attendanceData.students.forEach(s => { statusMap[s.enrollment_id] = 'present' })
    setLocalStatus(statusMap)
  }

  // Toggle single student status
  const cycleStatus = (enrollmentId) => {
    const order = ['present', 'absent', 'late']
    const cur   = localStatus[enrollmentId] || 'present'
    const next  = order[(order.indexOf(cur) + 1) % order.length]
    setLocalStatus(p => ({ ...p, [enrollmentId]: next }))
  }

  const setStatus = (enrollmentId, status) => {
    setLocalStatus(p => ({ ...p, [enrollmentId]: status }))
  }

  // Save bulk attendance
  const handleSave = async () => {
    if (!attendanceData || saving) return
    if (!selectedSection || !selectedDate) {
      setError('Please select a section and date')
      return
    }

    setSaving(true)
    setError('')
    setSaved(false)

    try {
      const records = attendanceData.students.map(s => ({
        enrollment_id: s.enrollment_id,
        status:        localStatus[s.enrollment_id]  || 'present',
        remarks:       localRemarks[s.enrollment_id] || null,
      }))

      // Remove null remarks to keep payload clean
      const cleanRecords = records.map(r => {
        const rec = { enrollment_id: r.enrollment_id, status: r.status }
        if (r.remarks) rec.remarks = r.remarks
        return rec
      })

      const result = await attendanceApi.bulkMark({
        section_id: selectedSection,
        date:       selectedDate,
        records:    cleanRecords,
      })

      setSaved(true)
      setTimeout(() => setSaved(false), 3000)

      // Reload to show confirmed statuses from server
      await loadAttendance()

    } catch (e) {
      const msg = e.response?.data?.detail
      setError(
        typeof msg === 'string'
          ? msg
          : Array.isArray(msg)
            ? msg.map(m => m.msg || m.message || JSON.stringify(m)).join(', ')
            : 'Failed to save attendance. Check backend logs.'
      )
    } finally {
      setSaving(false)
    }
  }

  // Summary counts from local state
  const counts = attendanceData
    ? {
        present: Object.values(localStatus).filter(s => s === 'present').length,
        absent:  Object.values(localStatus).filter(s => s === 'absent').length,
        late:    Object.values(localStatus).filter(s => s === 'late').length,
      }
    : null

  const gradeName    = (id) => grades.find(g => g.id === id)?.name   || ''
  const sectionName  = (id) => sections.find(s => s.id === id)?.name || ''

  return (
    <div className="row g-3">
      {/* ── Selector Card ─────────────────────────────────── */}
      <div className="col-12">
        <div className="card border-0 shadow-sm">
          <div className="card-body">
            <div className="row g-2 align-items-end">

              {/* Date */}
              <div className="col-12 col-md-3">
                <label className="form-label fw-medium small">Date</label>
                <input type="date" className="form-control"
                  value={selectedDate}
                  max={today()}
                  onChange={e => setSelectedDate(e.target.value)} />
              </div>

              {/* Academic Year */}
              <div className="col-12 col-md-2">
                <label className="form-label fw-medium small">Year</label>
                <select className="form-select"
                  value={selectedYear}
                  onChange={e => setSelectedYear(e.target.value)}>
                  <option value="">Select year</option>
                  {years.map(y => (
                    <option key={y.id} value={y.id}>
                      {y.label}{y.is_current ? ' ★' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Grade */}
              <div className="col-12 col-md-3">
                <label className="form-label fw-medium small">Class</label>
                <select className="form-select"
                  value={selectedGrade}
                  onChange={e => setSelectedGrade(e.target.value)}>
                  <option value="">Select class</option>
                  {grades.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>

              {/* Section */}
              <div className="col-12 col-md-2">
                <label className="form-label fw-medium small">Section</label>
                {loadingSections ? (
                  <div className="form-control bg-light text-muted small d-flex align-items-center">
                    <span className="spinner-border spinner-border-sm me-2"></span>Loading...
                  </div>
                ) : (
                  <select className="form-select"
                    value={selectedSection}
                    onChange={e => setSelectedSection(e.target.value)}
                    disabled={!selectedGrade || !selectedYear}>
                    <option value="">Select section</option>
                    {sections.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                )}
              </div>

              <div className="col-12 col-md-2">
                <button className="btn btn-outline-secondary w-100"
                  onClick={loadAttendance}
                  disabled={!selectedSection || loading}>
                  <i className="bi bi-arrow-clockwise me-1"></i>Refresh
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Attendance Grid ───────────────────────────────── */}
      <div className="col-12">
        {!selectedSection ? (
          <div className="card border-0 shadow-sm">
            <div className="card-body text-center py-5 text-muted">
              <i className="bi bi-calendar3 fs-1 d-block mb-3 opacity-25"></i>
              <h6>Select a class, section and date to mark attendance</h6>
            </div>
          </div>

        ) : loading ? (
          <div className="card border-0 shadow-sm">
            <div className="card-body text-center py-5">
              <div className="spinner-border text-primary"></div>
              <div className="mt-2 text-muted small">Loading students...</div>
            </div>
          </div>

        ) : error ? (
          <div className="alert alert-danger">
            <i className="bi bi-exclamation-triangle-fill me-2"></i>{error}
            <button className="btn btn-sm btn-link ms-2" onClick={loadAttendance}>Retry</button>
          </div>

        ) : attendanceData ? (
          <div className="card border-0 shadow-sm">
            {/* Card Header */}
            <div className="card-header bg-white d-flex align-items-center justify-content-between flex-wrap gap-2">
              <div>
                <span className="fw-semibold">
                  {gradeName(selectedGrade)} — Section {sectionName(selectedSection)}
                </span>
                <span className="text-muted small ms-2">
                  {new Date(selectedDate).toLocaleDateString('en-IN', {
                    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                  })}
                </span>
                {attendanceData.already_marked && (
                  <span className="badge bg-info text-dark ms-2">
                    <i className="bi bi-check-circle me-1"></i>Already marked
                  </span>
                )}
                {attendanceData.is_holiday && (
                  <span className="badge bg-warning text-dark ms-2">
                    <i className="bi bi-calendar-x me-1"></i>Holiday
                  </span>
                )}
              </div>

              <div className="d-flex gap-2 flex-wrap align-items-center">
                {/* Summary pills */}
                {counts && (
                  <>
                    <span className="badge bg-success">{counts.present} P</span>
                    <span className="badge bg-danger">{counts.absent} A</span>
                    <span className="badge bg-warning text-dark">{counts.late} L</span>
                  </>
                )}
                <button className="btn btn-outline-success btn-sm"
                  onClick={markAllPresent}>
                  <i className="bi bi-check-all me-1"></i>All Present
                </button>
                <button
                  className={`btn btn-sm ${saved ? 'btn-success' : 'btn-primary'}`}
                  onClick={handleSave}
                  disabled={saving || !attendanceData.students.length}>
                  {saving ? (
                    <><span className="spinner-border spinner-border-sm me-2"></span>Saving...</>
                  ) : saved ? (
                    <><i className="bi bi-check-lg me-1"></i>Saved!</>
                  ) : (
                    <><i className="bi bi-save me-1"></i>Save Attendance</>
                  )}
                </button>
              </div>
            </div>

            {/* No students */}
            {attendanceData.students.length === 0 ? (
              <div className="card-body text-center py-5 text-muted">
                <i className="bi bi-people fs-1 d-block mb-3 opacity-25"></i>
                <h6>No students enrolled in this section</h6>
                <small>Enroll students from the Students module first.</small>
              </div>
            ) : (
              <>
                {/* Legend */}
                <div className="card-body border-bottom py-2">
                  <div className="d-flex gap-3 flex-wrap align-items-center">
                    <span className="small text-muted fw-medium">Click to cycle:</span>
                    {['present','absent','late'].map(s => (
                      <span key={s} className="d-flex align-items-center gap-1 small">
                        <span className={`badge ${STATUS_CONFIG[s].badge}`}>
                          {STATUS_CONFIG[s].label}
                        </span>
                        {STATUS_CONFIG[s].text}
                      </span>
                    ))}
                    <span className="text-muted small ms-auto">
                      {attendanceData.students.length} students
                    </span>
                  </div>
                </div>

                {/* Student Grid */}
                <div className="card-body p-0">
                  <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0">
                      <thead className="table-light">
                        <tr>
                          <th style={{ width: 50 }}>Roll</th>
                          <th>Student</th>
                          <th style={{ width: 160 }}>Status</th>
                          <th>Remarks</th>
                        </tr>
                      </thead>
                      <tbody>
                        {attendanceData.students.map((student) => {
                          const st     = localStatus[student.enrollment_id]  || 'present'
                          const cfg    = STATUS_CONFIG[st] || STATUS_CONFIG['present']
                          return (
                            <tr key={student.enrollment_id}
                              className={st === 'absent' ? 'table-danger' : st === 'late' ? 'table-warning' : ''}>
                              <td className="text-center text-muted small">
                                {student.roll_no || '—'}
                              </td>
                              <td>
                                <div className="d-flex align-items-center gap-2">
                                  <StudentAvatar student={student} />
                                  <div>
                                    <div className="fw-medium small">
                                      {student.first_name} {student.last_name || ''}
                                    </div>
                                    <code className="text-muted" style={{ fontSize: 11 }}>
                                      {student.admission_no}
                                    </code>
                                  </div>
                                </div>
                              </td>
                              <td>
                                {/* Quick status buttons */}
                                <div className="btn-group btn-group-sm">
                                  {['present','absent','late'].map(s => (
                                    <button
                                      key={s}
                                      className={`btn ${st === s ? STATUS_CONFIG[s].bg : 'btn-outline-secondary'}`}
                                      onClick={() => setStatus(student.enrollment_id, s)}
                                      title={STATUS_CONFIG[s].text}>
                                      {STATUS_CONFIG[s].label}
                                    </button>
                                  ))}
                                </div>
                              </td>
                              <td>
                                <input
                                  type="text"
                                  className="form-control form-control-sm"
                                  placeholder={st === 'absent' ? 'Reason for absence...' : 'Optional remark'}
                                  value={localRemarks[student.enrollment_id] || ''}
                                  onChange={e => setLocalRemarks(p => ({
                                    ...p, [student.enrollment_id]: e.target.value
                                  }))}
                                  style={{ maxWidth: 220 }}
                                />
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Footer Save */}
                <div className="card-footer bg-white d-flex justify-content-between align-items-center">
                  <small className="text-muted">
                    <i className="bi bi-info-circle me-1"></i>
                    Changes are saved only when you click "Save Attendance"
                  </small>
                  <button
                    className={`btn ${saved ? 'btn-success' : 'btn-primary'}`}
                    onClick={handleSave}
                    disabled={saving}>
                    {saving ? (
                      <><span className="spinner-border spinner-border-sm me-2"></span>Saving...</>
                    ) : saved ? (
                      <><i className="bi bi-check-lg me-1"></i>Saved!</>
                    ) : (
                      <><i className="bi bi-save me-1"></i>Save Attendance</>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  SECTION SUMMARY TAB
// ─────────────────────────────────────────────────────────────
function SummaryTab() {
  const [grades,          setGrades]          = useState([])
  const [years,           setYears]           = useState([])
  const [sections,        setSections]        = useState([])
  const [selectedGrade,   setSelectedGrade]   = useState('')
  const [selectedYear,    setSelectedYear]    = useState('')
  const [selectedSection, setSelectedSection] = useState('')
  const [fromDate,        setFromDate]        = useState('')
  const [toDate,          setToDate]          = useState(today())
  const [summary,         setSummary]         = useState([])
  const [loading,         setLoading]         = useState(false)
  const [error,           setError]           = useState('')

  // Set default from_date to 1st of current month
  useEffect(() => {
    const d = new Date()
    setFromDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`)
  }, [])

  useEffect(() => {
    Promise.all([
      studentsApi.getGrades(),
      fetch('/api/master/academic-years', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      }).then(r => r.json()),
    ]).then(([g, y]) => {
      setGrades(Array.isArray(g) ? g : [])
      const ys = Array.isArray(y) ? y : []
      setYears(ys)
      const cur = ys.find(x => x.is_current)
      if (cur) setSelectedYear(cur.id)
    })
  }, [])

  useEffect(() => {
    if (!selectedGrade || !selectedYear) { setSections([]); return }
    studentsApi.getSections(selectedGrade, selectedYear)
      .then(d => setSections(Array.isArray(d) ? d : []))
    setSelectedSection('')
  }, [selectedGrade, selectedYear])

  const handleLoad = async () => {
    if (!selectedSection || !fromDate || !toDate) return
    setLoading(true); setError('')
    try {
      const data = await attendanceApi.getSectionSummary(selectedSection, fromDate, toDate)
      setSummary(Array.isArray(data) ? data : [])
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to load summary')
    } finally {
      setLoading(false)
    }
  }

  const getPctColor = (pct) => {
    if (pct >= 90) return 'text-success'
    if (pct >= 75) return 'text-warning'
    return 'text-danger'
  }

  const getPctBg = (pct) => {
    if (pct >= 90) return 'bg-success'
    if (pct >= 75) return 'bg-warning'
    return 'bg-danger'
  }

  return (
    <div>
      {/* Filters */}
      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body">
          <div className="row g-2 align-items-end">
            <div className="col-md-2">
              <label className="form-label fw-medium small">Year</label>
              <select className="form-select" value={selectedYear} onChange={e => setSelectedYear(e.target.value)}>
                <option value="">Select</option>
                {years.map(y => <option key={y.id} value={y.id}>{y.label}{y.is_current ? ' ★' : ''}</option>)}
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label fw-medium small">Class</label>
              <select className="form-select" value={selectedGrade} onChange={e => setSelectedGrade(e.target.value)}>
                <option value="">Select class</option>
                {grades.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label fw-medium small">Section</label>
              <select className="form-select" value={selectedSection} onChange={e => setSelectedSection(e.target.value)} disabled={!selectedGrade}>
                <option value="">Select</option>
                {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label fw-medium small">From</label>
              <input type="date" className="form-control" value={fromDate} onChange={e => setFromDate(e.target.value)} />
            </div>
            <div className="col-md-2">
              <label className="form-label fw-medium small">To</label>
              <input type="date" className="form-control" value={toDate} max={today()} onChange={e => setToDate(e.target.value)} />
            </div>
            <div className="col-md-1">
              <button className="btn btn-primary w-100"
                onClick={handleLoad}
                disabled={!selectedSection || !fromDate || loading}>
                {loading
                  ? <span className="spinner-border spinner-border-sm"></span>
                  : <i className="bi bi-search"></i>}
              </button>
            </div>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-danger small">{error}</div>}

      {summary.length > 0 && (
        <div className="card border-0 shadow-sm">
          <div className="card-header bg-white d-flex justify-content-between align-items-center">
            <span className="fw-semibold">
              Attendance Summary
              <span className="badge bg-secondary ms-2">{summary.length} students</span>
            </span>
            <small className="text-muted">{fromDate} to {toDate}</small>
          </div>
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table table-sm table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th style={{ width: 40 }}>Roll</th>
                    <th>Student</th>
                    <th className="text-center">Total</th>
                    <th className="text-center text-success">Present</th>
                    <th className="text-center text-danger">Absent</th>
                    <th className="text-center text-warning">Late</th>
                    <th style={{ width: 180 }}>Attendance %</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.map((row, i) => (
                    <tr key={row.enrollment_id}>
                      <td className="text-center text-muted small">{row.roll_no || '—'}</td>
                      <td>
                        <div className="fw-medium small">{row.first_name} {row.last_name || ''}</div>
                        <code style={{ fontSize: 10 }} className="text-muted">{row.admission_no}</code>
                      </td>
                      <td className="text-center small">{row.total_days}</td>
                      <td className="text-center">
                        <span className="badge bg-success">{row.present_days}</span>
                      </td>
                      <td className="text-center">
                        <span className="badge bg-danger">{row.absent_days}</span>
                      </td>
                      <td className="text-center">
                        <span className="badge bg-warning text-dark">{row.late_days}</span>
                      </td>
                      <td>
                        <div className="d-flex align-items-center gap-2">
                          <div className="progress flex-grow-1" style={{ height: 8 }}>
                            <div
                              className={`progress-bar ${getPctBg(row.percentage)}`}
                              style={{ width: `${row.percentage}%` }}>
                            </div>
                          </div>
                          <span className={`small fw-bold ${getPctColor(row.percentage)}`}
                            style={{ minWidth: 42 }}>
                            {row.percentage?.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {summary.length === 0 && !loading && selectedSection && (
        <div className="card border-0 shadow-sm">
          <div className="card-body text-center py-5 text-muted">
            <i className="bi bi-bar-chart-line fs-1 d-block mb-3 opacity-25"></i>
            <h6>No attendance data found for this period</h6>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  LOW ATTENDANCE TAB
// ─────────────────────────────────────────────────────────────
function LowAttendanceTab() {
  const [years,     setYears]     = useState([])
  const [yearId,    setYearId]    = useState('')
  const [threshold, setThreshold] = useState(75)
  const [students,  setStudents]  = useState([])
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')
  const [searched,  setSearched]  = useState(false)

  useEffect(() => {
    fetch('/api/master/academic-years', {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    }).then(r => r.json()).then(y => {
      const ys = Array.isArray(y) ? y : []
      setYears(ys)
      const cur = ys.find(x => x.is_current)
      if (cur) setYearId(cur.id)
    })
  }, [])

  const handleSearch = async () => {
    if (!yearId) return
    setLoading(true); setError(''); setSearched(true)
    try {
      const data = await attendanceApi.getLowAttendance(yearId, threshold)
      setStudents(Array.isArray(data) ? data : [])
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body">
          <div className="row g-2 align-items-end">
            <div className="col-md-4">
              <label className="form-label fw-medium small">Academic Year</label>
              <select className="form-select" value={yearId} onChange={e => setYearId(e.target.value)}>
                <option value="">Select year</option>
                {years.map(y => <option key={y.id} value={y.id}>{y.label}{y.is_current ? ' ★' : ''}</option>)}
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label fw-medium small">
                Threshold: <span className="text-danger fw-bold">{threshold}%</span>
              </label>
              <input type="range" className="form-range" min={50} max={95} step={5}
                value={threshold} onChange={e => setThreshold(Number(e.target.value))} />
              <div className="d-flex justify-content-between" style={{ fontSize: 10, color: '#999' }}>
                <span>50%</span><span>75%</span><span>95%</span>
              </div>
            </div>
            <div className="col-md-2">
              <button className="btn btn-danger w-100" onClick={handleSearch} disabled={!yearId || loading}>
                {loading
                  ? <><span className="spinner-border spinner-border-sm me-2"></span>Loading...</>
                  : <><i className="bi bi-exclamation-triangle me-1"></i>Find Students</>}
              </button>
            </div>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-danger small">{error}</div>}

      {searched && !loading && (
        students.length === 0 ? (
          <div className="card border-0 shadow-sm">
            <div className="card-body text-center py-5 text-muted">
              <i className="bi bi-emoji-smile fs-1 d-block mb-3 text-success opacity-50"></i>
              <h6 className="text-success">All students are above {threshold}% attendance!</h6>
            </div>
          </div>
        ) : (
          <div className="card border-0 shadow-sm">
            <div className="card-header bg-white d-flex justify-content-between">
              <span className="fw-semibold text-danger">
                <i className="bi bi-exclamation-triangle-fill me-2"></i>
                Students Below {threshold}%
              </span>
              <span className="badge bg-danger">{students.length} students</span>
            </div>
            <div className="card-body p-0">
              <div className="table-responsive">
                <table className="table table-sm table-hover align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>#</th>
                      <th>Student</th>
                      <th>Class</th>
                      <th className="text-center">Days Present</th>
                      <th className="text-center">Total Days</th>
                      <th style={{ width: 160 }}>Attendance %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((s, i) => (
                      <tr key={s.enrollment_id}>
                        <td className="text-muted small">{i + 1}</td>
                        <td>
                          <div className="fw-medium small">{s.first_name} {s.last_name || ''}</div>
                          <code style={{ fontSize: 10 }} className="text-muted">{s.admission_no}</code>
                        </td>
                        <td>
                          <span className="badge bg-light text-dark border small">
                            {s.grade_name} — {s.section_name}
                          </span>
                        </td>
                        <td className="text-center">
                          <span className="badge bg-success">{s.present_days}</span>
                        </td>
                        <td className="text-center">
                          <span className="badge bg-secondary">{s.total_days}</span>
                        </td>
                        <td>
                          <div className="d-flex align-items-center gap-2">
                            <div className="progress flex-grow-1" style={{ height: 8 }}>
                              <div className="progress-bar bg-danger"
                                style={{ width: `${s.percentage || 0}%` }}></div>
                            </div>
                            <span className="small fw-bold text-danger" style={{ minWidth: 42 }}>
                              {s.percentage?.toFixed(1) || '0.0'}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  STUDENT AVATAR COMPONENT
// ─────────────────────────────────────────────────────────────
function StudentAvatar({ student }) {
  if (student.photo_url) {
    return (
      <img src={student.photo_url} alt={student.first_name}
        className="rounded-circle flex-shrink-0"
        style={{ width: 32, height: 32, objectFit: 'cover' }}
        onError={e => { e.target.style.display = 'none' }}
      />
    )
  }
  const colors = { male: ['#dbeafe','#1d4ed8'], female: ['#fce7f3','#be185d'] }
  const [bg, color] = colors[student.gender] || ['#f1f5f9','#475569']
  return (
    <div className="rounded-circle d-flex align-items-center justify-content-center fw-bold flex-shrink-0"
      style={{ width: 32, height: 32, background: bg, color, fontSize: 12 }}>
      {student.first_name?.[0]?.toUpperCase()}
    </div>
  )
}
