// frontend/src/pages/ExamsPage.jsx
// ─────────────────────────────────────────────────────────────
// Exams module: List Exams | Enter Marks | Report Cards
// ─────────────────────────────────────────────────────────────
import { useState, useEffect, useRef, useCallback } from 'react'
import examsApi from '../api/examsApi.js'

const today = () => new Date().toISOString().slice(0, 10)

const STATUS_BADGE = {
  scheduled: 'bg-secondary',
  ongoing:   'bg-primary',
  completed: 'bg-success',
  cancelled: 'bg-danger',
}

const GRADE_COLOR = {
  A1: '#15803d', A2: '#16a34a',
  B1: '#0369a1', B2: '#0284c7',
  C1: '#d97706', C2: '#f59e0b',
  D:  '#ea580c',
  E:  '#dc2626',
}

// ─────────────────────────────────────────────────────────────
export default function ExamsPage() {
  const [tab, setTab] = useState('list')

  // Shared state passed between tabs
  const [activeExam,    setActiveExam]    = useState(null)
  const [activeSchedule,setActiveSchedule]= useState(null)

  const openMarksEntry = (exam, schedule) => {
    setActiveExam(exam)
    setActiveSchedule(schedule)
    setTab('marks')
  }

  const openReportCards = (exam) => {
    setActiveExam(exam)
    setTab('cards')
  }

  return (
    <div>
      <div className="mb-4">
        <h4 className="fw-bold mb-0">Exams & Results</h4>
        <small className="text-muted">Manage exams, enter marks and generate report cards</small>
      </div>

      <ul className="nav nav-tabs mb-4">
        {[
          { key: 'list',  icon: 'bi-journal-text',    label: 'Exams'         },
          { key: 'marks', icon: 'bi-pencil-square',   label: 'Enter Marks'   },
          { key: 'cards', icon: 'bi-card-list',       label: 'Report Cards'  },
        ].map(t => (
          <li key={t.key} className="nav-item">
            <button className={`nav-link ${tab === t.key ? 'active' : ''}`}
              onClick={() => setTab(t.key)}>
              <i className={`bi ${t.icon} me-2`}></i>{t.label}
              {t.key === 'marks' && activeExam && (
                <span className="badge bg-primary ms-2">
                  {activeExam.name?.split(' ').slice(0,2).join(' ')}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>

      {tab === 'list'  && (
        <ExamsListTab
          onEnterMarks={openMarksEntry}
          onViewCards={openReportCards}
        />
      )}
      {tab === 'marks' && (
        <MarksEntryTab
          exam={activeExam}
          schedule={activeSchedule}
          onSelectExam={(e, s) => { setActiveExam(e); setActiveSchedule(s) }}
        />
      )}
      {tab === 'cards' && (
        <ReportCardsTab
          exam={activeExam}
          onSelectExam={(e) => setActiveExam(e)}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  TAB 1 — EXAMS LIST
// ─────────────────────────────────────────────────────────────
function ExamsListTab({ onEnterMarks, onViewCards }) {
  const [exams,     setExams]     = useState([])
  const [years,     setYears]     = useState([])
  const [grades,    setGrades]    = useState([])
  const [examTypes, setExamTypes] = useState([])
  const [yearId,    setYearId]    = useState('')
  const [gradeId,   setGradeId]   = useState('')
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')
  const [showCreate,setShowCreate]= useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/master/academic-years', authHeaders()).then(r => r.json()),
      fetch('/api/master/grades',         authHeaders()).then(r => r.json()),
      examsApi.getTypes(),
    ]).then(([y, g, t]) => {
      const ys = Array.isArray(y) ? y : []
      setYears(ys)
      setGrades(Array.isArray(g) ? g : [])
      setExamTypes(Array.isArray(t) ? t : [])
      const cur = ys.find(x => x.is_current)
      if (cur) setYearId(cur.id)
    })
  }, [])

  useEffect(() => {
    if (!yearId) return
    loadExams()
  }, [yearId, gradeId])

  const loadExams = async () => {
    setLoading(true); setError('')
    try {
      const params = { academic_year_id: yearId }
      if (gradeId) params.grade_id = gradeId
      const data = await examsApi.getExams(params)
      setExams(Array.isArray(data) ? data : [])
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to load exams')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {/* Filters + Create */}
      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body py-2">
          <div className="row g-2 align-items-end">
            <div className="col-md-3">
              <label className="form-label fw-medium small">Academic Year</label>
              <select className="form-select form-select-sm" value={yearId}
                onChange={e => setYearId(e.target.value)}>
                {years.map(y => (
                  <option key={y.id} value={y.id}>{y.label}{y.is_current ? ' ★' : ''}</option>
                ))}
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label fw-medium small">Class Filter</label>
              <select className="form-select form-select-sm" value={gradeId}
                onChange={e => setGradeId(e.target.value)}>
                <option value="">All Classes</option>
                {grades.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            <div className="col-md-2">
              <button className="btn btn-outline-secondary btn-sm w-100" onClick={loadExams}>
                <i className="bi bi-arrow-clockwise me-1"></i>Refresh
              </button>
            </div>
            <div className="col-auto ms-auto">
              <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>
                <i className="bi bi-plus-lg me-1"></i>Create Exam
              </button>
            </div>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-danger small">{error}</div>}

      {loading ? (
        <div className="text-center py-5"><div className="spinner-border text-primary"></div></div>
      ) : exams.length === 0 ? (
        <div className="card border-0 shadow-sm">
          <div className="card-body text-center py-5 text-muted">
            <i className="bi bi-journal-text fs-1 d-block mb-3 opacity-25"></i>
            <h6>No exams found</h6>
            <small>Create an exam to get started</small>
          </div>
        </div>
      ) : (
        <div className="d-flex flex-column gap-3">
          {exams.map(exam => (
            <ExamCard
              key={exam.id}
              exam={exam}
              grades={grades}
              onEnterMarks={(schedule) => onEnterMarks(exam, schedule)}
              onViewCards={() => onViewCards(exam)}
              onRefresh={loadExams}
            />
          ))}
        </div>
      )}

      {showCreate && (
        <CreateExamModal
          years={years}
          grades={grades}
          examTypes={examTypes}
          onSuccess={() => { setShowCreate(false); loadExams() }}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  EXAM CARD
// ─────────────────────────────────────────────────────────────
function ExamCard({ exam, grades, onEnterMarks, onViewCards, onRefresh }) {
  const [expanded, setExpanded] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [msg, setMsg] = useState('')

  const gradeName = grades.find(g => g.id === exam.grade_id)?.name || '—'

  const handleGenerate = async () => {
    if (!window.confirm('Generate report cards for all students? This will mark the exam as completed.')) return
    setGenerating(true)
    try {
      const result = await examsApi.generateReportCards(exam.id)
      setMsg(`✓ ${result.message} · Pass: ${result.pass_count} · Fail: ${result.fail_count}`)
      onRefresh()
    } catch (e) {
      setMsg('✗ ' + (e.response?.data?.detail || 'Failed'))
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="card border-0 shadow-sm">
      <div className="card-body">
        <div className="d-flex align-items-start justify-content-between gap-3 flex-wrap">
          <div className="d-flex gap-3 align-items-start">
            {/* Status icon */}
            <div style={{
              width: 44, height: 44, borderRadius: 10, flexShrink: 0,
              background: exam.status === 'completed' ? '#dcfce7' :
                         exam.status === 'ongoing'   ? '#dbeafe' : '#f1f5f9',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <i className={`bi ${
                exam.status === 'completed' ? 'bi-check-circle-fill text-success' :
                exam.status === 'ongoing'   ? 'bi-pencil-fill text-primary' :
                'bi-calendar-event text-secondary'
              } fs-5`}></i>
            </div>
            <div>
              <div className="fw-bold">{exam.name}</div>
              <div className="d-flex align-items-center gap-2 mt-1 flex-wrap">
                <span className={`badge ${STATUS_BADGE[exam.status] || 'bg-secondary'}`}>
                  {exam.status}
                </span>
                <span className="badge bg-light text-dark border small">
                  {gradeName}
                </span>
                <span className="badge bg-light text-dark border small">
                  {exam.exam_type_name || exam.exam_type_code}
                </span>
                <span className="text-muted small">
                  <i className="bi bi-calendar3 me-1"></i>
                  {exam.start_date} → {exam.end_date}
                </span>
              </div>
            </div>
          </div>

          <div className="d-flex gap-2 align-items-center flex-wrap">
            <span className="badge bg-light text-dark border">
              {exam.schedules?.length || 0} subjects
            </span>
            <button className="btn btn-outline-secondary btn-sm"
              onClick={() => setExpanded(e => !e)}>
              <i className={`bi ${expanded ? 'bi-chevron-up' : 'bi-chevron-down'}`}></i>
            </button>
            {exam.status === 'completed' ? (
              <button className="btn btn-success btn-sm" onClick={onViewCards}>
                <i className="bi bi-card-list me-1"></i>Report Cards
              </button>
            ) : (
              <>
                {(exam.status === 'scheduled' || exam.status === 'ongoing') && (
                  <button
                    className="btn btn-warning btn-sm"
                    onClick={handleGenerate}
                    disabled={generating}>
                    {generating
                      ? <><span className="spinner-border spinner-border-sm me-1"></span>Generating...</>
                      : <><i className="bi bi-lightning me-1"></i>Generate Cards</>}
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {msg && (
          <div className={`alert ${msg.startsWith('✓') ? 'alert-success' : 'alert-danger'} py-2 mt-2 mb-0 small`}>
            {msg}
          </div>
        )}

        {/* Expanded: subject schedule */}
        {expanded && exam.schedules?.length > 0 && (
          <div className="mt-3 pt-3 border-top">
            <div className="fw-medium small text-muted mb-2">
              <i className="bi bi-table me-1"></i>Subject Schedule
            </div>
            <div className="table-responsive">
              <table className="table table-sm align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Subject</th>
                    <th>Date</th>
                    <th>Time</th>
                    <th className="text-center">Max Marks</th>
                    <th className="text-center">Pass Marks</th>
                    <th>Room</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {exam.schedules.map(sch => (
                    <tr key={sch.id}>
                      <td className="fw-medium small">
                        {sch.subject_name}
                        {sch.subject_code && (
                          <code className="text-muted ms-1" style={{ fontSize: 10 }}>
                            ({sch.subject_code})
                          </code>
                        )}
                      </td>
                      <td className="text-muted small">{sch.exam_date}</td>
                      <td className="text-muted small">
                        {sch.start_time && sch.end_time
                          ? `${sch.start_time} – ${sch.end_time}`
                          : '—'}
                      </td>
                      <td className="text-center">{sch.max_marks}</td>
                      <td className="text-center">{sch.pass_marks}</td>
                      <td className="text-muted small">{sch.room_no || '—'}</td>
                      <td>
                        {exam.status !== 'cancelled' && exam.status !== 'completed' && (
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => onEnterMarks(sch)}>
                            <i className="bi bi-pencil me-1"></i>Enter Marks
                          </button>
                        )}
                        {exam.status === 'completed' && (
                          <span className="text-success small">
                            <i className="bi bi-check-circle me-1"></i>Done
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  TAB 2 — MARKS ENTRY GRID
// ─────────────────────────────────────────────────────────────
function MarksEntryTab({ exam, schedule, onSelectExam }) {
  const [exams,     setExams]     = useState([])
  const [years,     setYears]     = useState([])
  const [selExam,   setSelExam]   = useState(exam)
  const [selSched,  setSelSched]  = useState(schedule)
  const [students,  setStudents]  = useState([])
  const [marks,     setMarks]     = useState({}) // { enrollment_id: { marks, is_absent, is_exempted, remarks } }
  const [loading,   setLoading]   = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState('')
  const [success,   setSuccess]   = useState('')
  const [yearId,    setYearId]    = useState('')

  // Load years + exams on mount
  useEffect(() => {
    fetch('/api/master/academic-years', authHeaders()).then(r => r.json()).then(y => {
      const ys = Array.isArray(y) ? y : []
      setYears(ys)
      const cur = ys.find(x => x.is_current)
      if (cur) setYearId(cur.id)
    })
  }, [])

  useEffect(() => {
    if (!yearId) return
    examsApi.getExams({ academic_year_id: yearId })
      .then(d => setExams(Array.isArray(d) ? d.filter(e => e.status !== 'cancelled') : []))
  }, [yearId])

  // Load students when schedule selected
  const loadStudents = useCallback(async () => {
    if (!selExam || !selSched) return
    setLoading(true); setError('')
    try {
      const data = await examsApi.getScheduleStudents(selExam.id, selSched.id)
      setStudents(data)
      // Pre-fill marks from already-entered data
      const m = {}
      data.forEach(s => {
        m[s.enrollment_id] = {
          marks:      s.marks_obtained !== null ? String(s.marks_obtained) : '',
          is_absent:  s.is_absent  || false,
          is_exempted:s.is_exempted || false,
          remarks:    s.remarks    || '',
        }
      })
      setMarks(m)
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to load students')
    } finally {
      setLoading(false)
    }
  }, [selExam, selSched])

  useEffect(() => { loadStudents() }, [loadStudents])

  // When exam + schedule passed from list tab
  useEffect(() => {
    if (exam)     setSelExam(exam)
    if (schedule) setSelSched(schedule)
  }, [exam, schedule])

  const setMark = (enrollId, field, value) => {
    setMarks(p => ({
      ...p,
      [enrollId]: { ...p[enrollId], [field]: value }
    }))
  }

  // Mark all present with empty marks field
  const clearAll = () => {
    const m = {}
    students.forEach(s => {
      m[s.enrollment_id] = { marks: '', is_absent: false, is_exempted: false, remarks: '' }
    })
    setMarks(m)
  }

  const handleSave = async () => {
    if (!selExam || !selSched) return
    setSaving(true); setError(''); setSuccess('')

    const maxMarks = selSched.max_marks || 100

    // Build records
    const records = students.map(s => {
      const m = marks[s.enrollment_id] || {}
      const absent   = m.is_absent   || false
      const exempted = m.is_exempted || false
      const raw      = m.marks

      let marksVal = null
      if (!absent && !exempted && raw !== '' && raw !== undefined && raw !== null) {
        marksVal = parseFloat(raw)
        if (isNaN(marksVal)) marksVal = null
      }

      return {
        enrollment_id:  s.enrollment_id,
        marks_obtained: marksVal,
        is_absent:      absent,
        is_exempted:    exempted,
        remarks:        m.remarks || null,
      }
    })

    try {
      const result = await examsApi.bulkEnterResults(selExam.id, {
        schedule_id: selSched.id,
        records,
      })
      setSuccess(`✓ ${result.message} — Saved: ${result.saved}, Absent: ${result.absent}`)
      setTimeout(() => setSuccess(''), 4000)
      loadStudents()
    } catch (e) {
      const msg = e.response?.data?.detail
      setError(typeof msg === 'string' ? msg : 'Save failed. Check marks values.')
    } finally {
      setSaving(false)
    }
  }

  // Count summary
  const entered  = students.filter(s => {
    const m = marks[s.enrollment_id]
    return m?.marks !== '' && m?.marks !== undefined && !m?.is_absent && !m?.is_exempted
  }).length
  const absent   = students.filter(s => marks[s.enrollment_id]?.is_absent).length
  const exempted = students.filter(s => marks[s.enrollment_id]?.is_exempted).length

  return (
    <div>
      {/* Selector */}
      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body py-3">
          <div className="row g-2 align-items-end">
            <div className="col-md-3">
              <label className="form-label fw-medium small">Academic Year</label>
              <select className="form-select form-select-sm" value={yearId}
                onChange={e => { setYearId(e.target.value); setSelExam(null); setSelSched(null) }}>
                {years.map(y => (
                  <option key={y.id} value={y.id}>{y.label}{y.is_current ? ' ★' : ''}</option>
                ))}
              </select>
            </div>
            <div className="col-md-4">
              <label className="form-label fw-medium small">Exam</label>
              <select className="form-select form-select-sm" value={selExam?.id || ''}
                onChange={e => {
                  const ex = exams.find(x => x.id === e.target.value)
                  setSelExam(ex || null); setSelSched(null)
                }}>
                <option value="">Select exam</option>
                {exams.map(e => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label fw-medium small">Subject</label>
              <select className="form-select form-select-sm" value={selSched?.id || ''}
                disabled={!selExam}
                onChange={e => {
                  const sch = selExam?.schedules?.find(s => s.id === e.target.value)
                  setSelSched(sch || null)
                }}>
                <option value="">Select subject</option>
                {selExam?.schedules?.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.subject_name} (Max: {s.max_marks})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {!selExam || !selSched ? (
        <div className="card border-0 shadow-sm">
          <div className="card-body text-center py-5 text-muted">
            <i className="bi bi-pencil-square fs-1 d-block mb-3 opacity-25"></i>
            <h6>Select an exam and subject to enter marks</h6>
          </div>
        </div>
      ) : loading ? (
        <div className="text-center py-5"><div className="spinner-border text-primary"></div></div>
      ) : (
        <div className="card border-0 shadow-sm">
          {/* Header */}
          <div className="card-header bg-white d-flex justify-content-between align-items-center flex-wrap gap-2">
            <div>
              <span className="fw-semibold">
                {selExam.name} — {selSched.subject_name}
              </span>
              <div className="d-flex gap-2 mt-1 flex-wrap">
                <span className="badge bg-light text-dark border small">
                  Max: {selSched.max_marks}
                </span>
                <span className="badge bg-light text-dark border small">
                  Pass: {selSched.pass_marks}
                </span>
                <span className="badge bg-info text-dark small">
                  {students.length} students
                </span>
                {entered > 0 && (
                  <span className="badge bg-success small">
                    {entered} marks entered
                  </span>
                )}
                {absent > 0 && (
                  <span className="badge bg-danger small">
                    {absent} absent
                  </span>
                )}
              </div>
            </div>
            <div className="d-flex gap-2">
              <button className="btn btn-outline-secondary btn-sm" onClick={clearAll}>
                <i className="bi bi-eraser me-1"></i>Clear All
              </button>
              <button className="btn btn-primary btn-sm"
                onClick={handleSave} disabled={saving}>
                {saving
                  ? <><span className="spinner-border spinner-border-sm me-1"></span>Saving...</>
                  : <><i className="bi bi-save me-1"></i>Save All Marks</>}
              </button>
            </div>
          </div>

          {/* Alerts */}
          {error   && <div className="alert alert-danger  py-2 px-3 mb-0 rounded-0 small"><i className="bi bi-exclamation-triangle-fill me-2"></i>{error}</div>}
          {success && <div className="alert alert-success py-2 px-3 mb-0 rounded-0 small"><i className="bi bi-check-circle-fill me-2"></i>{success}</div>}

          {students.length === 0 ? (
            <div className="card-body text-center py-5 text-muted">
              <i className="bi bi-people fs-1 d-block mb-3 opacity-25"></i>
              <h6>No students found for this exam</h6>
              <small>Students must be enrolled in the grade assigned to this exam</small>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-sm align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th style={{ width: 40 }}>Roll</th>
                    <th>Student</th>
                    <th style={{ width: 150 }}>
                      Marks <span className="text-muted small fw-normal">/ {selSched.max_marks}</span>
                    </th>
                    <th style={{ width: 80 }} className="text-center">Absent</th>
                    <th style={{ width: 90 }} className="text-center">Exempt</th>
                    <th>Remarks</th>
                    <th style={{ width: 70 }} className="text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map(s => {
                    const m         = marks[s.enrollment_id] || {}
                    const absent    = m.is_absent   || false
                    const exempted  = m.is_exempted || false
                    const markVal   = m.marks !== '' && m.marks !== undefined
                      ? parseFloat(m.marks) : null
                    const passed    = markVal !== null && markVal >= selSched.pass_marks
                    const failed    = markVal !== null && markVal < selSched.pass_marks
                    const maxMarks  = selSched.max_marks

                    return (
                      <tr key={s.enrollment_id}
                        className={
                          absent   ? 'table-warning opacity-75' :
                          exempted ? 'table-secondary opacity-75' :
                          failed   ? 'table-danger' : ''
                        }>
                        <td className="text-muted small text-center">
                          {s.roll_no || '—'}
                        </td>
                        <td>
                          <div className="fw-medium small">
                            {s.first_name} {s.last_name || ''}
                          </div>
                          <code className="text-muted" style={{ fontSize: 10 }}>
                            {s.admission_no}
                          </code>
                        </td>
                        <td>
                          <input
                            type="number"
                            className={`form-control form-control-sm ${
                              failed  ? 'is-invalid' :
                              passed  ? 'is-valid'   : ''
                            }`}
                            placeholder="—"
                            min="0"
                            max={maxMarks}
                            step="0.5"
                            value={m.marks || ''}
                            disabled={absent || exempted}
                            onChange={e => {
                              const v = e.target.value
                              setMark(s.enrollment_id, 'marks', v)
                            }}
                            style={{ maxWidth: 130 }}
                          />
                          {failed && (
                            <div className="invalid-feedback d-block" style={{ fontSize: 10 }}>
                              Below pass marks ({selSched.pass_marks})
                            </div>
                          )}
                        </td>
                        <td className="text-center">
                          <input type="checkbox"
                            className="form-check-input"
                            checked={absent}
                            onChange={e => {
                              setMark(s.enrollment_id, 'is_absent', e.target.checked)
                              if (e.target.checked) {
                                setMark(s.enrollment_id, 'marks', '')
                                setMark(s.enrollment_id, 'is_exempted', false)
                              }
                            }}
                          />
                        </td>
                        <td className="text-center">
                          <input type="checkbox"
                            className="form-check-input"
                            checked={exempted}
                            onChange={e => {
                              setMark(s.enrollment_id, 'is_exempted', e.target.checked)
                              if (e.target.checked) {
                                setMark(s.enrollment_id, 'marks', '')
                                setMark(s.enrollment_id, 'is_absent', false)
                              }
                            }}
                          />
                        </td>
                        <td>
                          <input type="text"
                            className="form-control form-control-sm"
                            placeholder="Optional"
                            value={m.remarks || ''}
                            onChange={e => setMark(s.enrollment_id, 'remarks', e.target.value)}
                            style={{ maxWidth: 180 }}
                          />
                        </td>
                        <td className="text-center">
                          {absent   && <span className="badge bg-warning text-dark small">AB</span>}
                          {exempted && <span className="badge bg-secondary small">EX</span>}
                          {!absent && !exempted && markVal !== null && (
                            passed
                              ? <span className="badge bg-success small">PASS</span>
                              : <span className="badge bg-danger small">FAIL</span>
                          )}
                          {!absent && !exempted && markVal === null && (
                            <span className="badge bg-light text-muted border small">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Footer save */}
          {students.length > 0 && (
            <div className="card-footer bg-white d-flex justify-content-between align-items-center">
              <small className="text-muted">
                <i className="bi bi-info-circle me-1"></i>
                Marks are saved only when you click "Save All Marks"
              </small>
              <button className="btn btn-primary"
                onClick={handleSave} disabled={saving}>
                {saving
                  ? <><span className="spinner-border spinner-border-sm me-2"></span>Saving...</>
                  : <><i className="bi bi-save me-2"></i>Save All Marks</>}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  TAB 3 — REPORT CARDS
// ─────────────────────────────────────────────────────────────
function ReportCardsTab({ exam, onSelectExam }) {
  const [exams,     setExams]     = useState([])
  const [years,     setYears]     = useState([])
  const [yearId,    setYearId]    = useState('')
  const [selExam,   setSelExam]   = useState(exam)
  const [cards,     setCards]     = useState([])
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')
  const [printCard, setPrintCard] = useState(null)

  useEffect(() => {
    fetch('/api/master/academic-years', authHeaders()).then(r => r.json()).then(y => {
      const ys = Array.isArray(y) ? y : []
      setYears(ys)
      const cur = ys.find(x => x.is_current)
      if (cur) setYearId(cur.id)
    })
  }, [])

  useEffect(() => {
    if (!yearId) return
    examsApi.getExams({ academic_year_id: yearId, status: 'completed' })
      .then(d => setExams(Array.isArray(d) ? d : []))
  }, [yearId])

  useEffect(() => {
    if (exam) setSelExam(exam)
  }, [exam])

  useEffect(() => {
    if (!selExam) return
    loadCards()
  }, [selExam])

  const loadCards = async () => {
    if (!selExam) return
    setLoading(true); setError('')
    try {
      const data = await examsApi.getReportCards(selExam.id)
      setCards(Array.isArray(data) ? data : [])
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to load report cards')
    } finally {
      setLoading(false)
    }
  }

  const passCount = cards.filter(c => c.result === 'pass').length
  const failCount = cards.filter(c => c.result === 'fail').length
  const avgPct    = cards.length
    ? (cards.reduce((s, c) => s + c.percentage, 0) / cards.length).toFixed(1)
    : 0

  return (
    <div>
      {/* Selector */}
      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body py-2">
          <div className="row g-2 align-items-end">
            <div className="col-md-3">
              <label className="form-label fw-medium small">Academic Year</label>
              <select className="form-select form-select-sm" value={yearId}
                onChange={e => { setYearId(e.target.value); setSelExam(null); setCards([]) }}>
                {years.map(y => (
                  <option key={y.id} value={y.id}>{y.label}{y.is_current ? ' ★' : ''}</option>
                ))}
              </select>
            </div>
            <div className="col-md-4">
              <label className="form-label fw-medium small">Completed Exam</label>
              <select className="form-select form-select-sm" value={selExam?.id || ''}
                onChange={e => {
                  const ex = exams.find(x => x.id === e.target.value)
                  setSelExam(ex || null)
                }}>
                <option value="">Select exam</option>
                {exams.map(e => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            </div>
            <div className="col-md-2">
              <button className="btn btn-outline-secondary btn-sm w-100"
                onClick={loadCards} disabled={!selExam}>
                <i className="bi bi-arrow-clockwise me-1"></i>Refresh
              </button>
            </div>
           
          </div>
        </div>
      </div>

      {error && <div className="alert alert-danger small">{error}</div>}

      {loading ? (
        <div className="text-center py-5"><div className="spinner-border text-primary"></div></div>
      ) : !selExam ? (
        <div className="card border-0 shadow-sm">
          <div className="card-body text-center py-5 text-muted">
            <i className="bi bi-card-list fs-1 d-block mb-3 opacity-25"></i>
            <h6>Select a completed exam to view report cards</h6>
          </div>
        </div>
      ) : cards.length === 0 ? (
        <div className="card border-0 shadow-sm">
          <div className="card-body text-center py-5 text-muted">
            <i className="bi bi-inbox fs-1 d-block mb-3 opacity-25"></i>
            <h6>No report cards generated yet</h6>
            <small>Go to Exams tab and click "Generate Cards" on the exam</small>
          </div>
        </div>
      ) : (
        <>
          {/* Summary */}
          <div className="row g-3 mb-3">
            {[
              { label: 'Total Students', value: cards.length,  color: '#1e3a5f', icon: 'bi-people-fill'          },
              { label: 'Passed',         value: passCount,     color: '#15803d', icon: 'bi-check-circle-fill'    },
              { label: 'Failed',         value: failCount,     color: '#dc2626', icon: 'bi-x-circle-fill'        },
              { label: 'Class Average',  value: `${avgPct}%`,  color: '#0369a1', icon: 'bi-bar-chart-fill'       },
            ].map((s, i) => (
              <div key={i} className="col-6 col-md-3">
                <div className="card border-0 h-100"
                  style={{ background: s.color + '15' }}>
                  <div className="card-body d-flex align-items-center gap-3 py-3">
                    <div style={{
                      width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                      background: s.color,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <i className={`bi ${s.icon} text-white`}></i>
                    </div>
                    <div>
                      <div className="text-muted small">{s.label}</div>
                      <div className="fw-bold fs-5" style={{ color: s.color }}>{s.value}</div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Cards table */}
          <div className="card border-0 shadow-sm">
            <div className="card-header bg-white fw-semibold">
              <i className="bi bi-trophy me-2 text-warning"></i>
              {selExam?.name} — Results
            </div>
            <div className="table-responsive">
              <table className="table table-sm table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th style={{ width: 50 }}>Rank</th>
                    <th>Student</th>
                    <th>Class</th>
                    <th className="text-center">Total</th>
                    <th className="text-center">Obtained</th>
                    <th style={{ width: 130 }}>Percentage</th>
                    <th className="text-center">Grade</th>
                    <th className="text-center">Result</th>
                    <th style={{ width: 90 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {cards.map((c, i) => (
                    <tr key={i}>
                      <td className="text-center">
                        {c.rank === 1 && <span>🥇</span>}
                        {c.rank === 2 && <span>🥈</span>}
                        {c.rank === 3 && <span>🥉</span>}
                        {c.rank > 3  && <span className="text-muted small fw-bold">#{c.rank}</span>}
                      </td>
                      <td>
                        <div className="fw-medium small">
                          {c.student_name}
                        </div>
                        <code style={{ fontSize: 10 }} className="text-muted">
                          {c.admission_no}
                        </code>
                      </td>
                      <td className="text-muted small">
                        {c.grade_name} — {c.section_name}
                      </td>
                      <td className="text-center small">{c.total_marks}</td>
                      <td className="text-center small fw-medium">{c.obtained_marks}</td>
                      <td>
                        <div className="d-flex align-items-center gap-2">
                          <div className="progress flex-grow-1" style={{ height: 6 }}>
                            <div
                              className={`progress-bar ${
                                c.percentage >= 75 ? 'bg-success' :
                                c.percentage >= 33 ? 'bg-warning' : 'bg-danger'
                              }`}
                              style={{ width: `${c.percentage}%` }}>
                            </div>
                          </div>
                          <span className="small fw-bold" style={{ minWidth: 40 }}>
                            {c.percentage}%
                          </span>
                        </div>
                      </td>
                      <td className="text-center">
                        <span className="badge fw-bold"
                          style={{
                            background: (GRADE_COLOR[c.grade] || '#64748b') + '20',
                            color:      GRADE_COLOR[c.grade] || '#64748b',
                            border:     `1px solid ${GRADE_COLOR[c.grade] || '#64748b'}`,
                            fontSize:   12,
                          }}>
                          {c.grade}
                        </span>
                        <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>
                          {c.grade_points} pts
                        </div>
                      </td>
                      <td className="text-center">
                        <span className={`badge ${
                          c.result === 'pass'   ? 'bg-success' :
                          c.result === 'absent' ? 'bg-warning text-dark' : 'bg-danger'
                        }`}>
                          {c.result?.toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <button className="btn btn-outline-primary btn-sm"
                          onClick={() => setPrintCard(c)}>
                          <i className="bi bi-printer me-1"></i>Print
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Print single report card */}
      {printCard && (
        <PrintReportCard
          card={printCard}
          exam={selExam}
          onClose={() => setPrintCard(null)}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  PRINTABLE REPORT CARD MODAL
// ─────────────────────────────────────────────────────────────
function PrintReportCard({ card, exam, onClose }) {
  const printRef  = useRef()
  const schoolName = localStorage.getItem('school_name') || 'School Management System'

  const handlePrint = () => {
    const content = printRef.current.innerHTML
    const win     = window.open('', '_blank', 'width=750,height=980')
    if (!win) { alert('Pop-up blocked. Please allow pop-ups.'); return }
    win.document.write(`<!DOCTYPE html><html><head>
      <title>Report Card — ${card.student_name}</title>
      <meta charset="utf-8">
      <style>
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:Arial,sans-serif;font-size:13px;color:#1a1a1a;background:#fff}
        @media print{
          body{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
          @page{margin:10mm;size:A4 portrait}
        }
      </style>
    </head><body>${content}
    <script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script>
    </body></html>`)
    win.document.close()
  }

  const gradeColor = GRADE_COLOR[card.grade] || '#64748b'

  return (
    <div className="modal show d-block" style={{ background: 'rgba(0,0,0,0.6)', zIndex: 1055 }}>
      <div className="modal-dialog modal-dialog-centered modal-lg" style={{ maxWidth: 720 }}>
        <div className="modal-content border-0 shadow-lg">

          <div className="modal-header border-0 py-3" style={{ background: '#1e3a5f' }}>
            <h5 className="modal-title fw-bold text-white">
              <i className="bi bi-card-list me-2"></i>
              Report Card — {card.student_name}
            </h5>
            <button className="btn-close btn-close-white" onClick={onClose}></button>
          </div>

          <div className="modal-body p-0" style={{ maxHeight: '78vh', overflowY: 'auto', background: '#f1f5f9' }}>
            <div style={{ padding: 16 }}>
              <div ref={printRef}
                style={{ fontFamily: 'Arial,sans-serif', fontSize: 13, color: '#1a1a1a',
                  background: '#fff', border: '0.5px solid #e2e8f0',
                  borderRadius: 6, overflow: 'hidden' }}>

                {/* School Header */}
                <div style={{ background: '#1e3a5f', color: '#fff', padding: '18px 24px',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 19, fontWeight: 700, marginBottom: 4 }}>{schoolName}</div>
                    <div style={{ fontSize: 11, opacity: 0.75 }}>Academic Report Card</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, opacity: 0.75, marginBottom: 2 }}>
                      {exam?.exam_type_name || 'Examination'}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{exam?.name}</div>
                    <div style={{ fontSize: 11, opacity: 0.75, marginTop: 2 }}>
                      {exam?.start_date} — {exam?.end_date}
                    </div>
                  </div>
                </div>

                {/* Accent */}
                <div style={{ height: 4, background: 'linear-gradient(90deg,#1e3a5f,#2e7d8c,#22c55e)' }} />

                {/* Student Info Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: '#e5e7eb' }}>
                  <div style={{ background: '#f8fafc', padding: '12px 18px' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b',
                      textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
                      Student Information
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>
                      {card.student_name}
                    </div>
                    <RCRow label="Admission No"  value={card.admission_no} />
                    <RCRow label="Class"         value={`${card.grade_name} — ${card.section_name}`} />
                    {card.roll_no && <RCRow label="Roll No" value={card.roll_no} />}
                  </div>
                  <div style={{ background: '#f8fafc', padding: '12px 18px' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b',
                      textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
                      Result Summary
                    </div>
                    <RCRow label="Total Marks"    value={card.total_marks} />
                    <RCRow label="Marks Obtained" value={`${card.obtained_marks} / ${card.total_marks}`} />
                    <RCRow label="Percentage"     value={`${card.percentage}%`} />
                    <RCRow label="Class Rank"     value={`#${card.rank}`} />
                  </div>
                </div>

                {/* Grade Highlight */}
                <div style={{ display: 'flex', justifyContent: 'space-between',
                  alignItems: 'center', padding: '14px 20px',
                  background: gradeColor + '10', borderBottom: `1px solid ${gradeColor}30` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    {/* Grade circle */}
                    <div style={{ width: 64, height: 64, borderRadius: '50%',
                      background: gradeColor, color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 22, fontWeight: 700, flexShrink: 0 }}>
                      {card.grade}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, color: '#64748b' }}>Grade</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: gradeColor }}>
                        {card.remarks}
                      </div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>
                        Grade Points: {card.grade_points} / 10.0
                      </div>
                    </div>
                  </div>

                  {/* Result badge */}
                  <div style={{
                    padding: '10px 20px', borderRadius: 8, textAlign: 'center',
                    background: card.result === 'pass' ? '#dcfce7' : '#fee2e2',
                    border: `1.5px solid ${card.result === 'pass' ? '#86efac' : '#fca5a5'}`,
                  }}>
                    <div style={{ fontSize: 11, color: card.result === 'pass' ? '#15803d' : '#dc2626',
                      fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                      {card.result === 'pass' ? '✓ PASS' : '✗ FAIL'}
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 700,
                      color: card.result === 'pass' ? '#15803d' : '#dc2626' }}>
                      {card.percentage}%
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div style={{ padding: '14px 20px', borderTop: '1px solid #e5e7eb',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                  <div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>
                      This is a computer generated report card.
                    </div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                      Generated on {new Date().toLocaleString('en-IN')}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ width: 130, borderTop: '1px solid #94a3b8',
                      paddingTop: 4, fontSize: 11, color: '#64748b' }}>
                      Class Teacher
                    </div>
                  </div>
                </div>

                {/* Bottom bar */}
                <div style={{ height: 6, background: 'linear-gradient(90deg,#1e3a5f,#2e7d8c)' }} />
              </div>
            </div>
          </div>

          <div className="modal-footer border-0 py-3" style={{ background: '#f8fafc' }}>
            <button className="btn btn-light border" onClick={onClose}>Close</button>
            <button className="btn btn-primary px-4" onClick={handlePrint}>
              <i className="bi bi-printer me-2"></i>Print Report Card
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  CREATE EXAM MODAL
// ─────────────────────────────────────────────────────────────
function CreateExamModal({ years, grades, examTypes, onSuccess, onClose }) {
  const [subjects, setSubjects] = useState([])
  const [form, setForm] = useState({
    name: '', exam_type_id: '', academic_year_id: '', grade_id: '',
    start_date: today(), end_date: today(),
  })
  const [schedules, setSchedules] = useState([])
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  useEffect(() => {
    fetch('/api/master/subjects', authHeaders())
      .then(r => r.json()).then(d => setSubjects(Array.isArray(d) ? d : []))
  }, [])

  useEffect(() => {
    const cur = years.find(y => y.is_current)
    if (cur) setForm(f => ({ ...f, academic_year_id: cur.id }))
    if (examTypes[0]) setForm(f => ({ ...f, exam_type_id: examTypes[0].id }))
    if (grades[0]) setForm(f => ({ ...f, grade_id: grades[0].id }))
  }, [years, examTypes, grades])

  const addSchedule = () => {
    setSchedules(p => [...p, {
      subject_id: subjects[0]?.id || '',
      exam_date:  form.start_date,
      max_marks:  100,
      pass_marks: 33,
    }])
  }

  const removeSchedule = (i) => setSchedules(p => p.filter((_, idx) => idx !== i))

  const setScheduleField = (i, field, value) => {
    setSchedules(p => p.map((s, idx) => idx === i ? { ...s, [field]: value } : s))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.exam_type_id || !form.grade_id || !form.name) {
      setError('Please fill all required fields'); return
    }
    setSaving(true); setError('')
    try {
      await examsApi.createExam({ ...form, schedules })
      onSuccess()
    } catch (e) {
      const msg = e.response?.data?.detail
      setError(typeof msg === 'string' ? msg : 'Failed to create exam')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal show d-block" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content border-0 shadow">
          <div className="modal-header border-0 pb-0">
            <h5 className="modal-title fw-bold">
              <i className="bi bi-plus-circle me-2 text-primary"></i>Create Exam
            </h5>
            <button className="btn-close" onClick={onClose}></button>
          </div>
          <div className="modal-body" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
            {error && <div className="alert alert-danger py-2 small mb-3">{error}</div>}
            <form onSubmit={handleSubmit}>
              <div className="row g-3">
                <div className="col-12">
                  <label className="form-label fw-medium small">Exam Name <span className="text-danger">*</span></label>
                  <input className="form-control" placeholder="e.g. Mid-Term Exam 2025"
                    value={form.name} required
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="col-md-4">
                  <label className="form-label fw-medium small">Exam Type <span className="text-danger">*</span></label>
                  <select className="form-select" value={form.exam_type_id} required
                    onChange={e => setForm(f => ({ ...f, exam_type_id: e.target.value }))}>
                    <option value="">Select type</option>
                    {examTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div className="col-md-4">
                  <label className="form-label fw-medium small">Class <span className="text-danger">*</span></label>
                  <select className="form-select" value={form.grade_id} required
                    onChange={e => setForm(f => ({ ...f, grade_id: e.target.value }))}>
                    <option value="">Select class</option>
                    {grades.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
                <div className="col-md-4">
                  <label className="form-label fw-medium small">Academic Year</label>
                  <select className="form-select" value={form.academic_year_id}
                    onChange={e => setForm(f => ({ ...f, academic_year_id: e.target.value }))}>
                    {years.map(y => <option key={y.id} value={y.id}>{y.label}</option>)}
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label fw-medium small">Start Date <span className="text-danger">*</span></label>
                  <input type="date" className="form-control" value={form.start_date} required
                    onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
                </div>
                <div className="col-md-6">
                  <label className="form-label fw-medium small">End Date <span className="text-danger">*</span></label>
                  <input type="date" className="form-control" value={form.end_date} required
                    onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
                </div>

                {/* Subject Schedules */}
                <div className="col-12">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <label className="form-label fw-medium small mb-0">
                      Subject Schedule
                    </label>
                    <button type="button" className="btn btn-outline-primary btn-sm"
                      onClick={addSchedule}>
                      <i className="bi bi-plus-lg me-1"></i>Add Subject
                    </button>
                  </div>

                  {schedules.length === 0 ? (
                    <div className="text-muted small text-center py-3 bg-light rounded-3">
                      No subjects added yet. Click "Add Subject" to add exam schedule.
                    </div>
                  ) : (
                    <div className="d-flex flex-column gap-2">
                      {schedules.map((s, i) => (
                        <div key={i} className="row g-2 align-items-end bg-light rounded-3 p-2 mx-0">
                          <div className="col-md-3">
                            <label className="form-label small mb-1">Subject</label>
                            <select className="form-select form-select-sm" value={s.subject_id}
                              onChange={e => setScheduleField(i, 'subject_id', e.target.value)}>
                              {subjects.map(sub => (
                                <option key={sub.id} value={sub.id}>{sub.name}</option>
                              ))}
                            </select>
                          </div>
                          <div className="col-md-2">
                            <label className="form-label small mb-1">Date</label>
                            <input type="date" className="form-control form-control-sm"
                              value={s.exam_date}
                              onChange={e => setScheduleField(i, 'exam_date', e.target.value)} />
                          </div>
                          <div className="col-md-2">
                            <label className="form-label small mb-1">Max Marks</label>
                            <input type="number" className="form-control form-control-sm"
                              value={s.max_marks} min="1"
                              onChange={e => setScheduleField(i, 'max_marks', parseFloat(e.target.value))} />
                          </div>
                          <div className="col-md-2">
                            <label className="form-label small mb-1">Pass Marks</label>
                            <input type="number" className="form-control form-control-sm"
                              value={s.pass_marks} min="0"
                              onChange={e => setScheduleField(i, 'pass_marks', parseFloat(e.target.value))} />
                          </div>
                          <div className="col-auto">
                            <button type="button" className="btn btn-outline-danger btn-sm"
                              onClick={() => removeSchedule(i)}>
                              <i className="bi bi-trash"></i>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </form>
          </div>
          <div className="modal-footer border-0">
            <button className="btn btn-light" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
              {saving
                ? <><span className="spinner-border spinner-border-sm me-2"></span>Creating...</>
                : <><i className="bi bi-plus-circle me-2"></i>Create Exam</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────────────────────
function authHeaders() {
  return { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
}

function RCRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between',
      alignItems: 'center', marginBottom: 4 }}>
      <span style={{ fontSize: 11, color: '#64748b' }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: '#1a1a1a' }}>{value || '—'}</span>
    </div>
  )
}
