// frontend/src/pages/MyAttendancePage.jsx
// Student / Parent personal attendance view
// Shows: monthly calendar, daily status, year overview chart

import { useState, useEffect } from 'react'
import api from '../api/client.js'

const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December']
const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

const STATUS_STYLE = {
  present: { bg: '#DCFCE7', color: '#166534', label: 'Present', icon: 'bi-check-circle-fill' },
  late:    { bg: '#FEF9C3', color: '#854D0E', label: 'Late',    icon: 'bi-clock-fill'        },
  absent:  { bg: '#FEE2E2', color: '#991B1B', label: 'Absent',  icon: 'bi-x-circle-fill'     },
}

function Spinner() {
  return (
    <div className="text-center py-5">
      <div className="spinner-border text-primary"></div>
      <div className="text-muted small mt-2">Loading attendance…</div>
    </div>
  )
}

export default function MyAttendancePage() {
  const today     = new Date()
  const [month,   setMonth]   = useState(today.getMonth() + 1)
  const [year,    setYear]    = useState(today.getFullYear())
  const [yearId,  setYearId]  = useState('')
  const [childId, setChildId] = useState('')
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [err,     setErr]     = useState('')

  const load = (m = month, y = year, yrId = yearId, cId = childId) => {
    setLoading(true)
    setErr('')
    const params = { month: m, year: y }
    if (yrId)  params.academic_year_id = yrId
    if (cId)   params.student_id       = cId
    api.get('/my/attendance', { params })
      .then(r => {
        setData(r.data)
        // Set year id from response if not already set
        if (!yrId && r.data.academic_year?.id) setYearId(r.data.academic_year.id)
      })
      .catch(e => setErr(e.response?.data?.detail || 'Failed to load attendance'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const goMonth = (dir) => {
    let m = month + dir, y = year
    if (m < 1)  { m = 12; y-- }
    if (m > 12) { m = 1;  y++ }
    setMonth(m); setYear(y)
    load(m, y, yearId, childId)
  }

  const changeYear = (id) => {
    setYearId(id)
    load(month, year, id, childId)
  }

  const changeChild = (id) => {
    setChildId(id)
    load(month, year, yearId, id)
  }

  if (loading) return <Spinner />
  if (err) return (
    <div className="container-fluid py-4">
      <div className="alert alert-warning">
        <i className="bi bi-info-circle me-2"></i>{err}
      </div>
    </div>
  )
  if (!data) return null

  const { student, month: mdata, monthly_summary, all_years, is_parent, linked_students } = data
  const { summary, days, days_in_month } = mdata

  // Build calendar grid
  const firstDay = new Date(year, month - 1, 1).getDay() // 0=Sun
  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= days_in_month; d++) cells.push(d)

  return (
    <div className="container-fluid py-4" style={{ maxWidth: 960 }}>

      {/* Page header */}
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-4">
        <div>
          <h4 className="fw-bold mb-1">
            <i className="bi bi-calendar-check me-2 text-primary"></i>
            My Attendance
          </h4>
          <p className="text-muted small mb-0">
            {student.name} &middot; {student.admission_no}
            {student.class && <> &middot; <span className="fw-medium">{student.class}</span></>}
          </p>
        </div>

        {/* Controls */}
        <div className="d-flex gap-2 flex-wrap">
          {/* Child switcher for parents */}
          {is_parent && linked_students?.length > 1 && (
            <select className="form-select form-select-sm" style={{ minWidth: 180 }}
              value={childId} onChange={e => changeChild(e.target.value)}>
              {linked_students.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          )}
          {/* Academic year */}
          {all_years?.length > 0 && (
            <select className="form-select form-select-sm" style={{ minWidth: 130 }}
              value={yearId} onChange={e => changeYear(e.target.value)}>
              {all_years.map(y => (
                <option key={y.id} value={y.id}>
                  {y.label}{y.is_current ? ' ★' : ''}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="row g-3 mb-4">
        {[
          { label: 'Present', value: summary.present, color: '#166534', bg: '#DCFCE7', icon: 'bi-check-circle-fill' },
          { label: 'Absent',  value: summary.absent,  color: '#991B1B', bg: '#FEE2E2', icon: 'bi-x-circle-fill'    },
          { label: 'Late',    value: summary.late,    color: '#854D0E', bg: '#FEF9C3', icon: 'bi-clock-fill'       },
          {
            label: 'Attendance',
            value: summary.pct != null ? `${summary.pct}%` : '—',
            color: summary.pct >= 75 ? '#166534' : summary.pct >= 60 ? '#854D0E' : '#991B1B',
            bg: summary.pct >= 75 ? '#DCFCE7' : summary.pct >= 60 ? '#FEF9C3' : '#FEE2E2',
            icon: 'bi-percent',
          },
        ].map((c, i) => (
          <div className="col-6 col-md-3" key={i}>
            <div className="card border-0 shadow-sm h-100" style={{ background: c.bg }}>
              <div className="card-body py-3">
                <div className="small text-muted fw-semibold text-uppercase" style={{ fontSize: 11 }}>{c.label}</div>
                <div className="fw-bold mt-1" style={{ fontSize: 28, color: c.color }}>
                  {c.value}
                </div>
                {c.label === 'Attendance' && summary.total > 0 && (
                  <div style={{ fontSize: 12, color: c.color }}>
                    {summary.present} of {summary.total} days
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="row g-4">
        {/* Calendar */}
        <div className="col-md-7">
          <div className="card border-0 shadow-sm">
            <div className="card-header bg-white d-flex align-items-center justify-content-between">
              <button className="btn btn-sm btn-outline-secondary" onClick={() => goMonth(-1)}>
                <i className="bi bi-chevron-left"></i>
              </button>
              <span className="fw-semibold">{MONTHS[month - 1]} {year}</span>
              <button className="btn btn-sm btn-outline-secondary" onClick={() => goMonth(1)}
                disabled={year >= today.getFullYear() && month >= today.getMonth() + 1}>
                <i className="bi bi-chevron-right"></i>
              </button>
            </div>
            <div className="card-body p-3">
              {/* Day headers */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 6 }}>
                {DAYS.map(d => (
                  <div key={d} style={{ textAlign: 'center', fontSize: 12, fontWeight: 600, color: '#94A3B8', padding: '4px 0' }}>
                    {d}
                  </div>
                ))}
              </div>
              {/* Date cells */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
                {cells.map((d, i) => {
                  if (!d) return <div key={`e${i}`} />
                  const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`
                  const rec     = days[dateStr]
                  const st      = rec ? STATUS_STYLE[rec.status] : null
                  const isToday = dateStr === today.toISOString().slice(0,10)
                  const isFuture = new Date(dateStr) > today

                  return (
                    <div key={d} title={rec ? `${STATUS_STYLE[rec.status]?.label}${rec.remark ? ` — ${rec.remark}` : ''}` : ''}
                      style={{
                        aspectRatio: '1',
                        borderRadius: 8,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 13,
                        fontWeight: isToday ? 700 : 400,
                        cursor: rec ? 'default' : 'default',
                        background: st ? st.bg : isFuture ? 'transparent' : '#F8FAFC',
                        color: st ? st.color : isToday ? '#1E3A5F' : '#475569',
                        border: isToday ? '2px solid #1E3A5F' : '1px solid transparent',
                        position: 'relative',
                      }}>
                      {d}
                      {rec?.remark && (
                        <span style={{
                          position: 'absolute', bottom: 3, right: 3,
                          width: 5, height: 5, borderRadius: '50%',
                          background: st?.color,
                        }} />
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Legend */}
              <div className="d-flex gap-3 mt-3 justify-content-center flex-wrap" style={{ fontSize: 12 }}>
                {Object.entries(STATUS_STYLE).map(([k, v]) => (
                  <span key={k} className="d-flex align-items-center gap-1">
                    <span style={{ width: 14, height: 14, borderRadius: 3, background: v.bg, border: `1px solid ${v.color}`, display: 'inline-block' }}></span>
                    <span style={{ color: '#64748B' }}>{v.label}</span>
                  </span>
                ))}
                <span className="d-flex align-items-center gap-1">
                  <span style={{ width: 14, height: 14, borderRadius: 3, background: '#F8FAFC', border: '1px solid #E2E8F0', display: 'inline-block' }}></span>
                  <span style={{ color: '#94A3B8' }}>No record</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Year overview */}
        <div className="col-md-5">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white">
              <span className="fw-semibold small">Year Overview</span>
            </div>
            <div className="card-body p-3">
              {monthly_summary.length === 0 ? (
                <div className="text-center text-muted py-4">
                  <i className="bi bi-calendar-x d-block mb-2 fs-2 opacity-25"></i>
                  No attendance data yet
                </div>
              ) : (
                <div className="d-flex flex-column gap-2">
                  {monthly_summary.map(m => {
                    const bar = m.pct || 0
                    const color = bar >= 75 ? '#166534' : bar >= 60 ? '#854D0E' : '#991B1B'
                    const barBg = bar >= 75 ? '#2D5F4C' : bar >= 60 ? '#CA8A04' : '#DC2626'
                    const isCurrentMonth = m.month === month && m.year === year
                    return (
                      <div key={`${m.year}-${m.month}`}
                        className={`rounded px-2 py-1 ${isCurrentMonth ? 'border border-primary' : ''}`}
                        style={{ background: '#F8FAFC', cursor: 'pointer' }}
                        onClick={() => { setMonth(m.month); setYear(m.year); load(m.month, m.year, yearId, childId) }}>
                        <div className="d-flex align-items-center justify-content-between mb-1">
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#1E2A38' }}>
                            {MONTHS[m.month - 1].slice(0,3)} {m.year}
                          </span>
                          <span style={{ fontSize: 12, color }}>
                            {m.present}/{m.total} · {bar}%
                          </span>
                        </div>
                        <div style={{ height: 5, background: '#E2E8F0', borderRadius: 3 }}>
                          <div style={{ width: `${bar}%`, height: '100%', background: barBg, borderRadius: 3, transition: 'width .3s' }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
