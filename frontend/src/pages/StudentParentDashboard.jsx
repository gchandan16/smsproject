// frontend/src/pages/StudentParentDashboard.jsx
// ─────────────────────────────────────────────────────────────
// Personalized dashboard for student & parent roles.
// Shows: profile, attendance %, next fee due, today's timetable,
// transport info, library books held.
// ─────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/client.js'

const fmt = (n) => `₹${Number(n||0).toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}`

function Spinner(){ return <div className="text-center py-5"><div className="spinner-border text-primary"></div></div> }

export default function StudentParentDashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [selectedChild, setSelectedChild] = useState('')

  const load = (studentId) => {
    setLoading(true)
    const params = studentId ? { student_id: studentId } : {}
    api.get('/my/dashboard', { params })
      .then(r => setData(r.data))
      .catch(e => setErr(e.response?.data?.detail || 'Failed to load dashboard'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const switchChild = (id) => {
    setSelectedChild(id)
    load(id)
  }

  if (loading) return <Spinner />
  if (err) return (
    <div className="alert alert-warning">
      <i className="bi bi-info-circle me-2"></i>{err}
    </div>
  )
  if (!data) return null

  const { student, is_parent, linked_students, academic_year, attendance, fees, transport, today, library_books } = data

  return (
    <div>
      {/* Header */}
      <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-4">
        <div>
          <h4 className="fw-bold mb-0">
            {is_parent ? `Welcome — Parent of ${student.name}` : `Welcome, ${student.name}`}
          </h4>
          <small className="text-muted">
            {today.day_name}, {new Date(today.date).toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'})}
            {academic_year && ` · Academic Year ${academic_year}`}
          </small>
        </div>
        {is_parent && linked_students?.length > 1 && (
          <select className="form-select form-select-sm" style={{maxWidth:220}}
            value={selectedChild} onChange={e=>switchChild(e.target.value)}>
            {linked_students.map(s=>(
              <option key={s.id} value={s.id}>{s.name} ({s.admission_no})</option>
            ))}
          </select>
        )}
      </div>

      {/* Profile card */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-body d-flex align-items-center gap-3 flex-wrap">
          <div style={{width:64,height:64,borderRadius:'50%',overflow:'hidden',background:'#F1F5F9',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center'}}>
            {student.photo_url ? (
              <img src={student.photo_url} alt={student.name} style={{width:'100%',height:'100%',objectFit:'cover'}} />
            ) : (
              <i className="bi bi-person-fill text-muted" style={{fontSize:32}}></i>
            )}
          </div>
          <div className="flex-grow-1">
            <div className="fw-bold fs-5">{student.name}</div>
            <div className="text-muted small">
              <code className="me-2">{student.admission_no}</code>
              <span className="badge bg-light text-dark border me-2">{student.class}</span>
              {student.roll_no && <span className="me-2">Roll No: {student.roll_no}</span>}
              {student.blood_group && <span>Blood Group: {student.blood_group}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="row g-3 mb-4">
        {/* Attendance */}
        <div className="col-md-3 col-6">
          <div className="card border-0 shadow-sm h-100 bg-success-subtle">
            <div className="card-body py-3">
              <div className="text-muted small text-uppercase" style={{fontSize:11,letterSpacing:.5}}>This Month Attendance</div>
              <div className="fw-bold fs-3 text-success">
                {attendance.month_pct !== null ? `${attendance.month_pct}%` : '—'}
              </div>
              <div className="text-muted small">
                {attendance.present} present / {attendance.total} days
              </div>
            </div>
          </div>
        </div>

        {/* Next fee due */}
        <div className="col-md-3 col-6">
          <div className={`card border-0 shadow-sm h-100 ${fees.next_due ? 'bg-warning-subtle' : 'bg-light'}`}>
            <div className="card-body py-3">
              <div className="text-muted small text-uppercase" style={{fontSize:11,letterSpacing:.5}}>Next Fee Due</div>
              {fees.next_due ? (
                <>
                  <div className="fw-bold fs-4 text-warning-emphasis">{fmt(fees.next_due.amount)}</div>
                  <div className="text-muted small">
                    Due {fees.next_due.due_date}
                    {fees.next_due.days_until_due < 0
                      ? <span className="text-danger fw-bold"> (Overdue)</span>
                      : <span> ({fees.next_due.days_until_due} days)</span>}
                  </div>
                </>
              ) : (
                <div className="fw-bold fs-5 text-success">No dues <i className="bi bi-check-circle"></i></div>
              )}
            </div>
          </div>
        </div>

        {/* Total outstanding */}
        <div className="col-md-3 col-6">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body py-3">
              <div className="text-muted small text-uppercase" style={{fontSize:11,letterSpacing:.5}}>Total Outstanding</div>
              <div className={`fw-bold fs-3 ${fees.total_outstanding>0?'text-danger':'text-success'}`}>
                {fmt(fees.total_outstanding)}
              </div>
              <Link to="/my-fees" className="small text-decoration-none">View fee history →</Link>
            </div>
          </div>
        </div>

        {/* Transport */}
        <div className="col-md-3 col-6">
          <div className="card border-0 shadow-sm h-100 bg-info-subtle">
            <div className="card-body py-3">
              <div className="text-muted small text-uppercase" style={{fontSize:11,letterSpacing:.5}}>Transport</div>
              {transport ? (
                <>
                  <div className="fw-bold">{transport.route}</div>
                  <div className="text-muted small">
                    {transport.stop && <>Stop: {transport.stop}<br/></>}
                    {transport.pickup_time && `Pickup: ${transport.pickup_time}`}
                    {transport.drop_time && ` · Drop: ${transport.drop_time}`}
                  </div>
                </>
              ) : (
                <div className="text-muted small">Not using school transport</div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="row g-3">
        {/* Today's timetable */}
        <div className="col-md-7">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white fw-semibold d-flex justify-content-between align-items-center">
              <span><i className="bi bi-calendar-day me-2 text-primary"></i>Today's Classes — {today.day_name}</span>
              <Link to="/my-timetable" className="small text-decoration-none">Full Timetable →</Link>
            </div>
            <div className="card-body p-0">
              {today.classes.length === 0 ? (
                <div className="text-center text-muted py-5">
                  <i className="bi bi-calendar-x fs-1 d-block mb-2 opacity-25"></i>
                  No classes scheduled today
                </div>
              ) : (
                <table className="table table-sm table-hover align-middle mb-0">
                  <thead className="table-light">
                    <tr><th>Period</th><th>Time</th><th>Subject</th><th>Teacher</th><th>Room</th></tr>
                  </thead>
                  <tbody>
                    {today.classes.map((c,i)=>(
                      <tr key={i} className={c.is_break?'table-light':''}>
                        <td className="small fw-medium">{c.period_name}</td>
                        <td className="small text-muted">{c.time}</td>
                        <td className="small">
                          {c.is_break ? <span className="text-muted"><i className="bi bi-cup-hot me-1"></i>{c.subject}</span> : c.subject}
                        </td>
                        <td className="small text-muted">{c.teacher || '—'}</td>
                        <td className="small text-muted">{c.room || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* Library books */}
        <div className="col-md-5">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white fw-semibold">
              <i className="bi bi-book me-2 text-success"></i>Library Books
            </div>
            <div className="card-body">
              {library_books.length === 0 ? (
                <div className="text-center text-muted py-4 small">
                  <i className="bi bi-book fs-1 d-block mb-2 opacity-25"></i>
                  No books currently issued
                </div>
              ) : library_books.map((b,i)=>(
                <div key={i} className="d-flex justify-content-between align-items-center py-2 border-bottom small">
                  <span>{b.title}</span>
                  <span className={`badge ${b.is_overdue?'bg-danger':'bg-light text-dark border'}`}>
                    Due {b.due_date}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Transport driver contact */}
          {transport?.driver_name && (
            <div className="card border-0 shadow-sm mt-3">
              <div className="card-header bg-white fw-semibold">
                <i className="bi bi-person-badge me-2 text-primary"></i>Driver Contact
              </div>
              <div className="card-body small">
                <div><strong>{transport.driver_name}</strong></div>
                {transport.driver_phone && <div className="text-muted">{transport.driver_phone}</div>}
                {transport.vehicle_no && <div className="text-muted mt-1">Vehicle: <code>{transport.vehicle_no}</code></div>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
