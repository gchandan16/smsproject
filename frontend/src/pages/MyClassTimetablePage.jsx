// frontend/src/pages/MyClassTimetablePage.jsx
// A teacher's personal weekly timetable — read-only grid of every class
// they teach, across all sections, for the current academic year.
import { useState, useEffect } from 'react'
import api from '../api/client.js'

const DAY_LABELS = { 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday', 6: 'Saturday', 7: 'Sunday' }
const DAY_ORDER  = [1, 2, 3, 4, 5, 6]   // Mon–Sat (most schools exclude Sunday from the grid)

function Spinner() {
  return (
    <div className="text-center py-5">
      <div className="spinner-border text-primary"></div>
      <div className="text-muted small mt-2">Loading your timetable…</div>
    </div>
  )
}

export default function MyClassTimetablePage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  useEffect(() => {
    api.get('/teacher/timetable')
      .then(r => setData(r.data))
      .catch(e => setErr(e.response?.data?.detail || 'Failed to load timetable'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <Spinner />

  if (err) return (
    <div className="container-fluid py-4" style={{ maxWidth: 640 }}>
      <div className="card border-0 shadow-sm">
        <div className="card-body text-center py-5">
          <i className="bi bi-calendar-x text-warning d-block mb-3" style={{ fontSize: 48 }}></i>
          <h5 className="fw-bold mb-2">No teacher profile linked</h5>
          <p className="text-muted mb-3" style={{ fontSize: 14 }}>{err}</p>
          <div className="alert alert-info text-start" style={{ fontSize: 13 }}>
            <i className="bi bi-info-circle-fill me-2"></i>
            <strong>What to do:</strong> Ask your school administrator to check
            <strong> Settings → Teachers</strong> for your record, and link your
            login account to it in <strong>Settings → User Management</strong>.
          </div>
        </div>
      </div>
    </div>
  )

  if (!data) return null

  const { teacher, academic_year, periods, entries } = data
  const teachingPeriods = periods.filter(p => !p.is_break)

  // Build a lookup: { "day_period": entry }
  const grid = {}
  entries.forEach(e => {
    grid[`${e.day_of_week}_${e.period_no}`] = e
  })

  const hasAnyClasses = entries.length > 0

  return (
    <div className="container-fluid py-4">

      {/* Header */}
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-4">
        <div>
          <h4 className="fw-bold mb-1">
            <i className="bi bi-calendar3 me-2 text-primary"></i>
            My Timetable
          </h4>
          <p className="text-muted small mb-0">
            {teacher} {academic_year && <>&middot; Academic Year {academic_year}</>}
          </p>
        </div>
      </div>

      {!hasAnyClasses ? (
        <div className="card border-0 shadow-sm">
          <div className="card-body text-center py-5 text-muted">
            <i className="bi bi-calendar-x d-block mb-2 fs-1 opacity-25"></i>
            <h6>No classes found in the timetable for you yet</h6>
            <p className="small mb-0">
              Ask your administrator to assign you to periods in the school Timetable,
              using your exact name as registered in Settings → Teachers.
            </p>
          </div>
        </div>
      ) : (
        <div className="card border-0 shadow-sm">
          <div className="table-responsive">
            <table className="table table-bordered align-middle mb-0" style={{ minWidth: 760 }}>
              <thead className="table-light">
                <tr>
                  <th style={{ width: 130 }}>Period</th>
                  {DAY_ORDER.map(d => (
                    <th key={d} className="text-center">{DAY_LABELS[d]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {teachingPeriods.map(p => (
                  <tr key={p.id}>
                    <td className="bg-light">
                      <div className="fw-semibold small">{p.name}</div>
                      <div className="text-muted" style={{ fontSize: 11 }}>
                        {p.start_time?.slice(0,5)} – {p.end_time?.slice(0,5)}
                      </div>
                    </td>
                    {DAY_ORDER.map(d => {
                      const cell = grid[`${d}_${p.period_no}`]
                      return (
                        <td key={d} className={cell ? 'bg-primary-subtle' : ''} style={{ minWidth: 120 }}>
                          {cell ? (
                            <div className="small">
                              <div className="fw-semibold" style={{ color: '#1E2A38' }}>{cell.subject}</div>
                              <div className="text-muted">{cell.class}</div>
                              {cell.room !== '—' && (
                                <div className="text-muted" style={{ fontSize: 11 }}>
                                  <i className="bi bi-door-open me-1"></i>{cell.room}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted" style={{ fontSize: 12 }}>—</span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
