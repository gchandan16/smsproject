// frontend/src/pages/TeacherDashboard.jsx
// Personal dashboard for teachers — today's classes, attendance shortcut, timetable link.
import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api/client.js'

function Spinner() {
  return (
    <div className="text-center py-5">
      <div className="spinner-border text-primary"></div>
      <div className="text-muted small mt-2">Loading your dashboard…</div>
    </div>
  )
}

export default function TeacherDashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    api.get('/teacher/dashboard')
      .then(r => setData(r.data))
      .catch(e => setErr(e.response?.data?.detail || 'Failed to load dashboard'))
      .finally(() => setLoading(false))
  }, [])

  const goToAttendance = (sectionId, className) => {
    // Navigate to Attendance page with section pre-selected via query param
    navigate(`/attendance?section_id=${sectionId}`)
  }

  if (loading) return <Spinner />

  if (err) return (
    <div className="container-fluid py-4" style={{ maxWidth: 640 }}>
      <div className="card border-0 shadow-sm">
        <div className="card-body text-center py-5">
          <i className="bi bi-person-x-fill text-warning d-block mb-3" style={{ fontSize: 48 }}></i>
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

  const { teacher, today, summary, name_mismatch_warning } = data

  return (
    <div className="container-fluid py-4">

      {/* Header */}
      <div className="mb-4">
        <h4 className="fw-bold mb-1">Welcome, {teacher.name}</h4>
        <p className="text-muted small mb-0">
          {today.day_name}, {new Date(today.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
          {teacher.designation && <> &middot; {teacher.designation}</>}
        </p>
      </div>

      {/* Name mismatch warning for admin visibility */}
      {name_mismatch_warning && (
        <div className="alert alert-warning d-flex gap-2 align-items-start mb-4">
          <i className="bi bi-exclamation-triangle-fill fs-5 flex-shrink-0"></i>
          <div className="small">{name_mismatch_warning}</div>
        </div>
      )}

      {/* Summary cards */}
      <div className="row g-3 mb-4">
        <div className="col-md-4 col-6">
          <div className="card border-0 shadow-sm h-100 bg-primary-subtle">
            <div className="card-body py-3">
              <div className="text-muted small text-uppercase" style={{ fontSize: 11, letterSpacing: .5 }}>
                Classes Today
              </div>
              <div className="fw-bold fs-3 text-primary">{summary.total_classes_today}</div>
              <div className="text-muted small">scheduled periods</div>
            </div>
          </div>
        </div>
        <div className="col-md-4 col-6">
          <div className="card border-0 shadow-sm h-100 bg-success-subtle">
            <div className="card-body py-3">
              <div className="text-muted small text-uppercase" style={{ fontSize: 11, letterSpacing: .5 }}>
                Total Sections
              </div>
              <div className="fw-bold fs-3 text-success">{summary.total_sections}</div>
              <div className="text-muted small">classes you teach</div>
            </div>
          </div>
        </div>
        <div className="col-md-4 col-6">
          <div className="card border-0 shadow-sm h-100 bg-warning-subtle">
            <div className="card-body py-3">
              <div className="text-muted small text-uppercase" style={{ fontSize: 11, letterSpacing: .5 }}>
                Total Students
              </div>
              <div className="fw-bold fs-3 text-warning-emphasis">{summary.total_students}</div>
              <div className="text-muted small">across all sections</div>
            </div>
          </div>
        </div>
      </div>

      {/* Today's classes with attendance shortcut */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-header bg-white d-flex align-items-center justify-content-between">
          <span className="fw-semibold">
            <i className="bi bi-calendar-day me-2 text-primary"></i>
            Today's Classes — {today.day_name}
          </span>
          <Link to="/my-class-timetable" className="small fw-medium text-primary text-decoration-none">
            Full Timetable →
          </Link>
        </div>
        <div className="card-body p-0">
          {today.classes.length === 0 ? (
            <div className="text-center text-muted py-5">
              <i className="bi bi-calendar-x d-block mb-2 fs-2 opacity-25"></i>
              No classes scheduled today
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Period</th>
                    <th>Time</th>
                    <th>Subject</th>
                    <th>Class</th>
                    <th>Room</th>
                    <th>Attendance</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {today.classes.map((c, i) => (
                    <tr key={i}>
                      <td className="fw-medium">{c.period_name}</td>
                      <td className="text-muted small">{c.start_time?.slice(0,5)} – {c.end_time?.slice(0,5)}</td>
                      <td>{c.subject}</td>
                      <td><span className="badge bg-light text-dark border">{c.class}</span></td>
                      <td className="text-muted small">{c.room}</td>
                      <td>
                        {c.attendance_marked ? (
                          <span className="badge bg-success-subtle text-success border border-success-subtle">
                            <i className="bi bi-check-circle-fill me-1"></i>Marked
                          </span>
                        ) : (
                          <span className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle">
                            <i className="bi bi-clock-fill me-1"></i>Pending
                          </span>
                        )}
                      </td>
                      <td>
                        <button
                          className={`btn btn-sm ${c.attendance_marked ? 'btn-outline-secondary' : 'btn-primary'}`}
                          onClick={() => goToAttendance(c.section_id, c.class)}>
                          <i className="bi bi-clipboard-check me-1"></i>
                          {c.attendance_marked ? 'View / Edit' : 'Take Attendance'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Quick links */}
      <div className="row g-3">
        <div className="col-md-4">
          <Link to="/my-class-timetable" className="card border-0 shadow-sm text-decoration-none h-100" style={{ transition: 'transform .15s' }}>
            <div className="card-body d-flex align-items-center gap-3">
              <div className="rounded-circle bg-primary-subtle d-flex align-items-center justify-content-center flex-shrink-0"
                style={{ width: 44, height: 44 }}>
                <i className="bi bi-calendar3 text-primary fs-5"></i>
              </div>
              <div>
                <div className="fw-semibold" style={{ color: '#1E2A38' }}>My Timetable</div>
                <div className="text-muted small">View your full weekly schedule</div>
              </div>
            </div>
          </Link>
        </div>
        <div className="col-md-4">
          <Link to="/attendance" className="card border-0 shadow-sm text-decoration-none h-100">
            <div className="card-body d-flex align-items-center gap-3">
              <div className="rounded-circle bg-success-subtle d-flex align-items-center justify-content-center flex-shrink-0"
                style={{ width: 44, height: 44 }}>
                <i className="bi bi-clipboard-check text-success fs-5"></i>
              </div>
              <div>
                <div className="fw-semibold" style={{ color: '#1E2A38' }}>Attendance</div>
                <div className="text-muted small">Mark attendance for any class</div>
              </div>
            </div>
          </Link>
        </div>
        <div className="col-md-4">
          <Link to="/exams" className="card border-0 shadow-sm text-decoration-none h-100">
            <div className="card-body d-flex align-items-center gap-3">
              <div className="rounded-circle bg-warning-subtle d-flex align-items-center justify-content-center flex-shrink-0"
                style={{ width: 44, height: 44 }}>
                <i className="bi bi-journal-check text-warning-emphasis fs-5"></i>
              </div>
              <div>
                <div className="fw-semibold" style={{ color: '#1E2A38' }}>Exams & Results</div>
                <div className="text-muted small">Enter marks for your subjects</div>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  )
}
