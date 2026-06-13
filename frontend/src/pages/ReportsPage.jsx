// frontend/src/pages/ReportsPage.jsx
// ─────────────────────────────────────────────────────────────
// Reports module — 4 tabs:
// Dashboard | Attendance | Fee Collection | Outstanding Fees
// ─────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from 'react'
import reportsApi from '../api/reportsApi.js'
import api from '../api/client.js'

const today      = () => new Date().toISOString().slice(0, 10)
const monthStart = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

const STATUS_BADGE = {
  paid:      'bg-success',
  partial:   'bg-warning text-dark',
  sent:      'bg-info text-dark',
  overdue:   'bg-danger',
  draft:     'bg-secondary',
  cancelled: 'bg-light text-muted border',
}

// ─────────────────────────────────────────────────────────────
export default function ReportsPage() {
  const [tab,    setTab]    = useState('dashboard')
  const [years,  setYears]  = useState([])
  const [yearId, setYearId] = useState('')

  useEffect(() => {
    fetch('/api/master/academic-years', {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    }).then(r => r.json()).then(d => {
      const ys = Array.isArray(d) ? d : []
      setYears(ys)
      const cur = ys.find(y => y.is_current)
      if (cur) setYearId(cur.id)
    })
  }, [])

  return (
    <div>
      <div className="mb-4">
        <h4 className="fw-bold mb-0">Reports</h4>
        <small className="text-muted">Analytics and reports for your school</small>
      </div>

      {/* Year selector — shared across all tabs */}
      {yearId && (
        <div className="d-flex align-items-center gap-2 mb-3">
          <span className="text-muted small fw-medium">Academic Year:</span>
          <select className="form-select form-select-sm" style={{ width: 160 }}
            value={yearId} onChange={e => setYearId(e.target.value)}>
            {years.map(y => (
              <option key={y.id} value={y.id}>{y.label}{y.is_current ? ' ★' : ''}</option>
            ))}
          </select>
        </div>
      )}

      <ul className="nav nav-tabs mb-4 flex-wrap">
        {[
          { key: 'dashboard',    icon: 'bi-speedometer2',   label: 'Dashboard'         },
          { key: 'attendance',   icon: 'bi-calendar-check', label: 'Attendance'        },
          { key: 'fees',         icon: 'bi-receipt',        label: 'Fee Collection'    },
          { key: 'outstanding',  icon: 'bi-exclamation-circle', label: 'Outstanding'   },
          { key: 'admissions',   icon: 'bi-graph-up-arrow', label: 'Admission Trend'   },
          { key: 'vehicles',     icon: 'bi-bus-front',      label: 'Vehicle Utilization' },
          { key: 'certificates', icon: 'bi-card-text',      label: 'ID Cards & Certificates' },
        ].map(t => (
          <li key={t.key} className="nav-item">
            <button className={`nav-link ${tab === t.key ? 'active' : ''}`}
              onClick={() => setTab(t.key)}>
              <i className={`bi ${t.icon} me-2`}></i>{t.label}
            </button>
          </li>
        ))}
      </ul>

      {tab === 'dashboard'   && <DashboardTab yearId={yearId} />}
      {tab === 'attendance'  && <AttendanceTab yearId={yearId} years={years} />}
      {tab === 'fees'        && <FeeCollectionTab yearId={yearId} />}
      {tab === 'outstanding' && <OutstandingTab yearId={yearId} />}
      {tab === 'admissions'  && <AdmissionTrendTab />}
      {tab === 'vehicles'    && <VehicleUtilizationTab />}
      {tab === 'certificates'&& <CertificatesTab years={years} />}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  STAT CARD
// ─────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, sub, color = 'primary', small }) {
  const bg = {
    primary: '#e8f0fe', success: '#e8f5e9',
    danger:  '#fce8e8', warning: '#fff8e1',
    info:    '#e3f2fd', purple:  '#f3e5f5',
  }
  const fg = {
    primary: '#1967d2', success: '#2e7d32',
    danger:  '#c62828', warning: '#f57f17',
    info:    '#0277bd', purple:  '#7b1fa2',
  }
  return (
    <div className="card border-0 h-100" style={{ background: bg[color] || bg.primary }}>
      <div className="card-body">
        <div className="d-flex align-items-start justify-content-between">
          <div>
            <div className="text-muted small fw-medium mb-1">{label}</div>
            <div style={{ fontSize: small ? 20 : 28, fontWeight: 700, color: fg[color] || fg.primary }}>
              {value}
            </div>
            {sub && <div className="text-muted small mt-1">{sub}</div>}
          </div>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: fg[color] || fg.primary,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <i className={`bi ${icon} text-white`} style={{ fontSize: 18 }}></i>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  DASHBOARD TAB
// ─────────────────────────────────────────────────────────────
function DashboardTab({ yearId }) {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  useEffect(() => {
    if (!yearId) return
    setLoading(true); setError('')
    reportsApi.getDashboard(yearId)
      .then(setData)
      .catch(e => setError(e.response?.data?.detail || 'Failed to load'))
      .finally(() => setLoading(false))
  }, [yearId])

  if (loading) return <Spinner />
  if (error)   return <ErrorBox msg={error} />
  if (!data)   return null

  const { students, attendance, fees } = data

  return (
    <div className="d-flex flex-column gap-4">

      {/* Students */}
      <div>
        <SectionTitle icon="bi-people" label="Students" />
        <div className="row g-3">
          <div className="col-6 col-md-3">
            <StatCard icon="bi-people-fill" label="Total Students"
              value={students.total} color="primary" />
          </div>
          <div className="col-6 col-md-3">
            <StatCard icon="bi-person-fill" label="Male"
              value={students.male} color="info" />
          </div>
          <div className="col-6 col-md-3">
            <StatCard icon="bi-person-fill" label="Female"
              value={students.female} color="purple" />
          </div>
          <div className="col-6 col-md-3">
            <StatCard icon="bi-person-plus-fill" label="New This Month"
              value={students.new_this_month} color="success" />
          </div>
        </div>
      </div>

      {/* Attendance */}
      <div>
        <SectionTitle icon="bi-calendar-check" label="Attendance — Today" />
        <div className="row g-3">
          <div className="col-6 col-md-3">
            <StatCard icon="bi-check-circle-fill" label="Today Present"
              value={attendance.today_present}
              sub={`${attendance.today_pct}% attendance`} color="success" />
          </div>
          <div className="col-6 col-md-3">
            <StatCard icon="bi-x-circle-fill" label="Today Absent"
              value={attendance.today_absent} color="danger" />
          </div>
          <div className="col-6 col-md-3">
            <StatCard icon="bi-clock-fill" label="Late"
              value={attendance.today_late} color="warning" />
          </div>
          <div className="col-6 col-md-3">
            <StatCard icon="bi-bar-chart-fill" label="Month Average"
              value={`${attendance.month_avg_pct}%`} color="info" />
          </div>
        </div>
      </div>

      {/* Fee */}
      <div>
        <SectionTitle icon="bi-cash-coin" label="Fee Collection" />
        <div className="row g-3">
          <div className="col-6 col-md-3">
            <StatCard icon="bi-file-earmark-text-fill" label="Total Billed"
              value={`₹${(fees.total_billed / 1000).toFixed(1)}K`}
              sub={`${fees.total_invoices} invoices`} color="primary" small />
          </div>
          <div className="col-6 col-md-3">
            <StatCard icon="bi-check-circle-fill" label="Collected"
              value={`₹${(fees.total_collected / 1000).toFixed(1)}K`}
              sub={`${fees.collection_pct}% of billed`} color="success" small />
          </div>
          <div className="col-6 col-md-3">
            <StatCard icon="bi-hourglass-split" label="Pending"
              value={`₹${(fees.total_pending / 1000).toFixed(1)}K`}
              sub={`${fees.partial_count} partial`} color="warning" small />
          </div>
          <div className="col-6 col-md-3">
            <StatCard icon="bi-exclamation-triangle-fill" label="Overdue"
              value={fees.overdue_count}
              sub="invoices overdue" color="danger" small />
          </div>
        </div>

        {/* Collection progress bar */}
        <div className="card border-0 shadow-sm mt-3">
          <div className="card-body py-3">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <span className="small fw-medium">Fee collection progress</span>
              <span className="small fw-bold">{fees.collection_pct}%</span>
            </div>
            <div className="progress" style={{ height: 10, borderRadius: 5 }}>
              <div
                className={`progress-bar ${
                  fees.collection_pct >= 80 ? 'bg-success' :
                  fees.collection_pct >= 50 ? 'bg-warning' : 'bg-danger'
                }`}
                style={{ width: `${Math.min(fees.collection_pct, 100)}%`, borderRadius: 5 }}>
              </div>
            </div>
            <div className="d-flex justify-content-between mt-1">
              <small className="text-muted">
                Collected: ₹{fees.total_collected.toLocaleString('en-IN')}
              </small>
              <small className="text-muted">
                Total: ₹{fees.total_billed.toLocaleString('en-IN')}
              </small>
            </div>
          </div>
        </div>

        {/* Today's collection */}
        {fees.today_collected > 0 && (
          <div className="alert alert-success py-2 mt-2 mb-0 small">
            <i className="bi bi-arrow-up-circle-fill me-2"></i>
            Today's collection: <strong>₹{fees.today_collected.toLocaleString('en-IN')}</strong>
            {' '}across <strong>{fees.today_transactions}</strong> transactions
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  ATTENDANCE REPORT TAB
// ─────────────────────────────────────────────────────────────
function AttendanceTab({ yearId, years }) {
  const [fromDate, setFromDate] = useState(monthStart())
  const [toDate,   setToDate]   = useState(today())
  const [data,     setData]     = useState(null)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  const load = async () => {
    if (!fromDate || !toDate) return
    setLoading(true); setError('')
    try {
      const params = { from_date: fromDate, to_date: toDate }
      if (yearId) params.academic_year_id = yearId
      const d = await reportsApi.getAttendanceSummary(params)
      setData(d)
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (yearId) load() }, [yearId])

  const getPctColor = (pct) =>
    pct >= 90 ? 'text-success' : pct >= 75 ? 'text-warning' : 'text-danger'
  const getBarColor = (pct) =>
    pct >= 90 ? 'bg-success'  : pct >= 75 ? 'bg-warning'   : 'bg-danger'

  return (
    <div>
      {/* Filters */}
      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body py-2">
          <div className="row g-2 align-items-end">
            <div className="col-md-3">
              <label className="form-label fw-medium small">From Date</label>
              <input type="date" className="form-control form-control-sm"
                value={fromDate} onChange={e => setFromDate(e.target.value)} />
            </div>
            <div className="col-md-3">
              <label className="form-label fw-medium small">To Date</label>
              <input type="date" className="form-control form-control-sm"
                value={toDate} max={today()} onChange={e => setToDate(e.target.value)} />
            </div>
            <div className="col-md-2">
              <button className="btn btn-primary btn-sm w-100" onClick={load} disabled={loading}>
                {loading
                  ? <span className="spinner-border spinner-border-sm"></span>
                  : <><i className="bi bi-search me-1"></i>Generate</>}
              </button>
            </div>
          </div>
        </div>
      </div>

      {error   && <ErrorBox msg={error} />}
      {loading && <Spinner />}

      {data && !loading && (
        <>
          {/* Section summary table */}
          {data.sections?.length > 0 ? (
            <div className="card border-0 shadow-sm mb-3">
              <div className="card-header bg-white fw-semibold d-flex justify-content-between">
                <span><i className="bi bi-table me-2 text-primary"></i>Section-wise Summary</span>
                <span className="badge bg-secondary">{data.sections.length} sections</span>
              </div>
              <div className="table-responsive">
                <table className="table table-sm table-hover align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Grade</th>
                      <th>Section</th>
                      <th className="text-center">Enrolled</th>
                      <th className="text-center text-success">Present</th>
                      <th className="text-center text-danger">Absent</th>
                      <th className="text-center text-warning">Late</th>
                      <th style={{ width: 160 }}>Avg %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.sections.map((s, i) => (
                      <tr key={i}>
                        <td className="fw-medium small">{s.grade_name}</td>
                        <td><span className="badge bg-primary">{s.section_name}</span></td>
                        <td className="text-center small">{s.enrolled}</td>
                        <td className="text-center">
                          <span className="badge bg-success">{s.present_days}</span>
                        </td>
                        <td className="text-center">
                          <span className="badge bg-danger">{s.absent_days}</span>
                        </td>
                        <td className="text-center">
                          <span className="badge bg-warning text-dark">{s.late_days}</span>
                        </td>
                        <td>
                          <div className="d-flex align-items-center gap-2">
                            <div className="progress flex-grow-1" style={{ height: 6 }}>
                              <div className={`progress-bar ${getBarColor(s.avg_pct)}`}
                                style={{ width: `${s.avg_pct}%` }}>
                              </div>
                            </div>
                            <span className={`small fw-bold ${getPctColor(s.avg_pct)}`}
                              style={{ minWidth: 40 }}>
                              {s.avg_pct}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <EmptyState icon="bi-calendar-x" msg="No attendance data for this period" />
          )}

          {/* Daily trend */}
          {data.daily_trend?.length > 0 && (
            <div className="card border-0 shadow-sm">
              <div className="card-header bg-white fw-semibold">
                <i className="bi bi-graph-up me-2 text-primary"></i>Daily Trend
              </div>
              <div className="table-responsive">
                <table className="table table-sm table-hover align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Date</th>
                      <th className="text-center">Total</th>
                      <th className="text-center text-success">Present</th>
                      <th className="text-center text-danger">Absent</th>
                      <th className="text-center text-warning">Late</th>
                      <th style={{ width: 140 }}>%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.daily_trend.map((d, i) => (
                      <tr key={i}>
                        <td className="small fw-medium">{d.date}</td>
                        <td className="text-center small">{d.total}</td>
                        <td className="text-center"><span className="badge bg-success">{d.present}</span></td>
                        <td className="text-center"><span className="badge bg-danger">{d.absent}</span></td>
                        <td className="text-center"><span className="badge bg-warning text-dark">{d.late}</span></td>
                        <td>
                          <div className="d-flex align-items-center gap-2">
                            <div className="progress flex-grow-1" style={{ height: 5 }}>
                              <div className={`progress-bar ${getBarColor(d.pct)}`}
                                style={{ width: `${d.pct}%` }}>
                              </div>
                            </div>
                            <span className={`small fw-bold ${getPctColor(d.pct)}`}
                              style={{ minWidth: 36 }}>
                              {d.pct}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  FEE COLLECTION TAB
// ─────────────────────────────────────────────────────────────
function FeeCollectionTab({ yearId }) {
  const [fromDate, setFromDate] = useState(monthStart())
  const [toDate,   setToDate]   = useState(today())
  const [status,   setStatus]   = useState('')
  const [data,     setData]     = useState(null)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  const load = async () => {
    if (!yearId) return
    setLoading(true); setError('')
    try {
      const params = { academic_year_id: yearId }
      if (fromDate) params.from_date = fromDate
      if (toDate)   params.to_date   = toDate
      if (status)   params.status    = status
      const d = await reportsApi.getFeeCollection(params)
      setData(d)
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (yearId) load() }, [yearId])

  return (
    <div>
      {/* Filters */}
      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body py-2">
          <div className="row g-2 align-items-end">
            <div className="col-md-2">
              <label className="form-label fw-medium small">From</label>
              <input type="date" className="form-control form-control-sm"
                value={fromDate} onChange={e => setFromDate(e.target.value)} />
            </div>
            <div className="col-md-2">
              <label className="form-label fw-medium small">To</label>
              <input type="date" className="form-control form-control-sm"
                value={toDate} max={today()} onChange={e => setToDate(e.target.value)} />
            </div>
            <div className="col-md-2">
              <label className="form-label fw-medium small">Status</label>
              <select className="form-select form-select-sm" value={status}
                onChange={e => setStatus(e.target.value)}>
                <option value="">All</option>
                {['sent','partial','paid','overdue'].map(s => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
            </div>
            <div className="col-md-2">
              <button className="btn btn-primary btn-sm w-100" onClick={load} disabled={loading}>
                {loading
                  ? <span className="spinner-border spinner-border-sm"></span>
                  : <><i className="bi bi-search me-1"></i>Generate</>}
              </button>
            </div>
          </div>
        </div>
      </div>

      {error   && <ErrorBox msg={error} />}
      {loading && <Spinner />}

      {data && !loading && (
        <>
          {/* Summary cards */}
          <div className="row g-3 mb-3">
            <div className="col-6 col-md-3">
              <StatCard icon="bi-file-earmark-text-fill" label="Total Invoices"
                value={data.summary.invoice_count} color="primary" />
            </div>
            <div className="col-6 col-md-3">
              <StatCard icon="bi-cash-stack" label="Total Billed"
                value={`₹${data.summary.total_billed.toLocaleString('en-IN')}`}
                color="info" small />
            </div>
            <div className="col-6 col-md-3">
              <StatCard icon="bi-check-circle-fill" label="Collected"
                value={`₹${data.summary.total_collected.toLocaleString('en-IN')}`}
                sub={`${data.summary.collection_pct}%`} color="success" small />
            </div>
            <div className="col-6 col-md-3">
              <StatCard icon="bi-hourglass-split" label="Pending"
                value={`₹${data.summary.total_pending.toLocaleString('en-IN')}`}
                color="warning" small />
            </div>
          </div>

          {/* Invoice table */}
          {data.invoices?.length > 0 ? (
            <div className="card border-0 shadow-sm">
              <div className="card-header bg-white d-flex justify-content-between">
                <span className="fw-semibold">
                  <i className="bi bi-table me-2 text-primary"></i>Invoice Details
                </span>
                <span className="badge bg-secondary">{data.invoices.length} invoices</span>
              </div>
              <div className="table-responsive">
                <table className="table table-sm table-hover align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Invoice No</th>
                      <th>Student</th>
                      <th>Class</th>
                      <th>Issue Date</th>
                      <th className="text-end">Billed</th>
                      <th className="text-end">Paid</th>
                      <th className="text-end">Balance</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.invoices.map((inv, i) => (
                      <tr key={i}>
                        <td><code className="small">{inv.invoice_no}</code></td>
                        <td>
                          <div className="fw-medium small">{inv.student_name}</div>
                          <code style={{ fontSize: 10 }} className="text-muted">
                            {inv.admission_no}
                          </code>
                        </td>
                        <td className="small text-muted">
                          {inv.grade_name} {inv.section_name !== '—' ? `— ${inv.section_name}` : ''}
                        </td>
                        <td className="small text-muted">{inv.issue_date}</td>
                        <td className="text-end small">₹{inv.total_amount.toFixed(2)}</td>
                        <td className="text-end small text-success fw-medium">
                          ₹{inv.paid_amount.toFixed(2)}
                        </td>
                        <td className="text-end small text-danger fw-medium">
                          ₹{inv.balance.toFixed(2)}
                        </td>
                        <td>
                          <span className={`badge ${STATUS_BADGE[inv.status] || 'bg-secondary'}`}>
                            {inv.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <EmptyState icon="bi-receipt" msg="No invoices found for this period" />
          )}
        </>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  OUTSTANDING FEES TAB
// ─────────────────────────────────────────────────────────────
function OutstandingTab({ yearId }) {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  const load = async () => {
    if (!yearId) return
    setLoading(true); setError('')
    try {
      const d = await reportsApi.getOutstandingFees({ academic_year_id: yearId })
      setData(d)
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (yearId) load() }, [yearId])

  if (loading) return <Spinner />
  if (error)   return <ErrorBox msg={error} />

  return (
    <div>
      {data && (
        <>
          {/* Summary */}
          <div className="row g-3 mb-3">
            <div className="col-md-4">
              <StatCard icon="bi-exclamation-circle-fill" label="Students with Balance"
                value={data.student_count} color="danger" />
            </div>
            <div className="col-md-4">
              <StatCard icon="bi-cash-stack" label="Total Outstanding"
                value={`₹${data.total_outstanding.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`}
                color="warning" small />
            </div>
            <div className="col-md-4">
              <StatCard icon="bi-alarm-fill" label="Overdue Students"
                value={data.students?.filter(s => s.has_overdue).length || 0}
                color="danger" />
            </div>
          </div>

          {data.students?.length > 0 ? (
            <div className="card border-0 shadow-sm">
              <div className="card-header bg-white d-flex justify-content-between">
                <span className="fw-semibold text-danger">
                  <i className="bi bi-exclamation-circle me-2"></i>Outstanding Fee Details
                </span>
                <button className="btn btn-outline-secondary btn-sm"
                  onClick={() => window.print()}>
                  <i className="bi bi-printer me-1"></i>Print
                </button>
              </div>
              <div className="table-responsive">
                <table className="table table-sm table-hover align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>#</th>
                      <th>Student</th>
                      <th>Class</th>
                      <th className="text-center">Invoices</th>
                      <th className="text-end">Billed</th>
                      <th className="text-end">Paid</th>
                      <th className="text-end text-danger">Outstanding</th>
                      <th>Due By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.students.map((s, i) => (
                      <tr key={i}
                        className={s.has_overdue ? 'table-danger' : ''}>
                        <td className="text-muted small">{i + 1}</td>
                        <td>
                          <div className="fw-medium small">{s.first_name} {s.last_name || ''}</div>
                          <code style={{ fontSize: 10 }} className="text-muted">{s.admission_no}</code>
                        </td>
                        <td className="small text-muted">
                          {s.grade_name} — {s.section_name}
                        </td>
                        <td className="text-center">
                          <span className="badge bg-secondary">{s.invoice_count}</span>
                        </td>
                        <td className="text-end small">₹{s.total_billed.toFixed(2)}</td>
                        <td className="text-end small text-success">₹{s.total_paid.toFixed(2)}</td>
                        <td className="text-end fw-bold text-danger">
                          ₹{s.outstanding.toFixed(2)}
                        </td>
                        <td>
                          <span className={`small ${s.has_overdue ? 'text-danger fw-medium' : 'text-muted'}`}>
                            {s.latest_due}
                            {s.has_overdue && (
                              <span className="badge bg-danger ms-1">Overdue</span>
                            )}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="table-light fw-bold">
                    <tr>
                      <td colSpan="6" className="text-end">Total Outstanding</td>
                      <td className="text-end text-danger fw-bold">
                        ₹{data.total_outstanding.toFixed(2)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ) : (
            <div className="card border-0 shadow-sm">
              <div className="card-body text-center py-5 text-muted">
                <i className="bi bi-emoji-smile fs-1 d-block mb-3 text-success opacity-50"></i>
                <h6 className="text-success">No outstanding fees!</h6>
                <small>All students are up to date with their fee payments.</small>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  SHARED HELPERS
// ─────────────────────────────────────────────────────────────
function Spinner() {
  return (
    <div className="text-center py-5">
      <div className="spinner-border text-primary"></div>
      <div className="text-muted small mt-2">Loading report...</div>
    </div>
  )
}

function ErrorBox({ msg }) {
  return (
    <div className="alert alert-danger small">
      <i className="bi bi-exclamation-triangle-fill me-2"></i>{msg}
    </div>
  )
}

function EmptyState({ icon, msg }) {
  return (
    <div className="card border-0 shadow-sm">
      <div className="card-body text-center py-5 text-muted">
        <i className={`bi ${icon} fs-1 d-block mb-3 opacity-25`}></i>
        <h6>{msg}</h6>
      </div>
    </div>
  )
}

function SectionTitle({ icon, label }) {
  return (
    <div className="d-flex align-items-center gap-2 mb-3">
      <i className={`bi ${icon} text-primary`}></i>
      <span className="fw-semibold">{label}</span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  ADMISSION TREND TAB
// ─────────────────────────────────────────────────────────────
function AdmissionTrendTab() {
  const yearAgo = () => {
    const d = new Date(); d.setFullYear(d.getFullYear()-1)
    return d.toISOString().slice(0,10)
  }
  const [fromDate, setFromDate] = useState(yearAgo())
  const [toDate,   setToDate]   = useState(today())
  const [grades,   setGrades]   = useState([])
  const [gradeId,  setGradeId]  = useState('')
  const [data,     setData]     = useState(null)
  const [loading,  setLoading]  = useState(false)
  const [err,setErr] = useState('')

  useEffect(() => {
    api.get('/master/grades').then(r=>setGrades(Array.isArray(r.data)?r.data:[])).catch(()=>{})
  },[])

  const load = useCallback(async () => {
    setLoading(true); setErr('')
    try {
      const params = { from_date: fromDate, to_date: toDate }
      if (gradeId) params.grade_id = gradeId
      const r = await api.get('/reports/admissions/trend', { params })
      setData(r.data)
    } catch(e) { setErr(e.response?.data?.detail || 'Failed to load') }
    setLoading(false)
  }, [fromDate, toDate, gradeId])

  useEffect(()=>{load()},[load])

  const maxCount = data ? Math.max(...data.months.map(m=>m.total), 1) : 1

  return (
    <div>
      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body py-2">
          <div className="row g-2 align-items-end">
            <div className="col-md-3">
              <label className="form-label fw-medium small mb-1">From Date</label>
              <input type="date" className="form-control form-control-sm" value={fromDate} onChange={e=>setFromDate(e.target.value)} />
            </div>
            <div className="col-md-3">
              <label className="form-label fw-medium small mb-1">To Date</label>
              <input type="date" className="form-control form-control-sm" value={toDate} onChange={e=>setToDate(e.target.value)} />
            </div>
            <div className="col-md-3">
              <label className="form-label fw-medium small mb-1">Class (optional)</label>
              <select className="form-select form-select-sm" value={gradeId} onChange={e=>setGradeId(e.target.value)}>
                <option value="">All Classes</option>
                {grades.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      {err && <div className="alert alert-danger small">{err}</div>}
      {loading ? (
        <div className="text-center py-5"><div className="spinner-border text-primary"></div></div>
      ) : !data ? null : (
        <>
          <div className="row g-3 mb-3">
            <div className="col-md-4">
              <div className="card border-0 shadow-sm bg-primary-subtle">
                <div className="card-body py-3">
                  <div className="text-muted small">New Admissions (selected period)</div>
                  <div className="fw-bold fs-4 text-primary">{data.current_total}</div>
                </div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="card border-0 shadow-sm">
                <div className="card-body py-3">
                  <div className="text-muted small">Same Period, Previous Year</div>
                  <div className="fw-bold fs-4">{data.previous_period_total}</div>
                  <div className="text-muted" style={{fontSize:11}}>{data.previous_period.from} to {data.previous_period.to}</div>
                </div>
              </div>
            </div>
            <div className="col-md-4">
              <div className={`card border-0 shadow-sm ${data.yoy_change_pct>=0?'bg-success-subtle':'bg-danger-subtle'}`}>
                <div className="card-body py-3">
                  <div className="text-muted small">Year-over-Year Change</div>
                  <div className={`fw-bold fs-4 ${data.yoy_change_pct>=0?'text-success':'text-danger'}`}>
                    {data.yoy_change_pct === null ? '—' : (
                      <><i className={`bi bi-arrow-${data.yoy_change_pct>=0?'up':'down'}-short`}></i>{Math.abs(data.yoy_change_pct)}%</>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="row g-3">
            <div className="col-md-8">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-header bg-white fw-semibold">
                  <i className="bi bi-bar-chart-line me-2 text-primary"></i>Monthly Admissions
                </div>
                <div className="card-body">
                  {data.months.length===0 ? (
                    <div className="text-center text-muted py-4">No admissions in this period</div>
                  ) : data.months.map(m=>(
                    <div key={m.month} className="mb-2">
                      <div className="d-flex justify-content-between small mb-1">
                        <span className="fw-medium">{m.month}</span>
                        <span>{m.total} <span className="text-muted">({m.male}M / {m.female}F)</span></span>
                      </div>
                      <div className="progress" style={{height:8}}>
                        <div className="progress-bar bg-primary" style={{width:`${(m.total/maxCount)*100}%`}}></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-header bg-white fw-semibold">
                  <i className="bi bi-layers me-2 text-success"></i>By Class
                </div>
                <div className="card-body">
                  {data.by_grade.length===0 ? (
                    <div className="text-center text-muted py-4 small">No data</div>
                  ) : data.by_grade.map(g=>(
                    <div key={g.grade} className="d-flex justify-content-between small mb-2">
                      <span>{g.grade}</span>
                      <span className="badge bg-light text-dark border">{g.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  VEHICLE UTILIZATION TAB
// ─────────────────────────────────────────────────────────────
function VehicleUtilizationTab() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  useEffect(() => {
    api.get('/reports/transport/utilization')
      .then(r=>setData(r.data))
      .catch(e=>setErr(e.response?.data?.detail||'Failed to load'))
      .finally(()=>setLoading(false))
  },[])

  const statusBadge = {
    over:   { label: 'Over Capacity', cls: 'bg-danger' },
    full:   { label: 'Near Full',     cls: 'bg-warning text-dark' },
    normal: { label: 'Normal',        cls: 'bg-success' },
    low:    { label: 'Low Usage',     cls: 'bg-info text-dark' },
  }

  if (loading) return <div className="text-center py-5"><div className="spinner-border text-primary"></div></div>
  if (err) return <div className="alert alert-danger small">{err}</div>
  if (!data) return null

  return (
    <div>
      <div className="row g-3 mb-3">
        <div className="col-md-4">
          <div className="card border-0 shadow-sm bg-primary-subtle">
            <div className="card-body py-3">
              <div className="text-muted small">Total Capacity</div>
              <div className="fw-bold fs-4 text-primary">{data.total_capacity} seats</div>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card border-0 shadow-sm bg-success-subtle">
            <div className="card-body py-3">
              <div className="text-muted small">Students Assigned</div>
              <div className="fw-bold fs-4 text-success">{data.total_assigned}</div>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card border-0 shadow-sm">
            <div className="card-body py-3">
              <div className="text-muted small">Overall Utilization</div>
              <div className="fw-bold fs-4">{data.overall_utilization_pct}%</div>
            </div>
          </div>
        </div>
      </div>

      {data.unassigned_routes.length > 0 && (
        <div className="alert alert-warning small mb-3">
          <i className="bi bi-exclamation-triangle-fill me-2"></i>
          <strong>{data.unassigned_routes.length} route(s)</strong> have students assigned but no vehicle:
          {' '}{data.unassigned_routes.map(r=>`${r.route_no} (${r.assigned_students} students)`).join(', ')}
        </div>
      )}

      <div className="card border-0 shadow-sm">
        <div className="card-header bg-white fw-semibold">
          <i className="bi bi-bus-front me-2 text-primary"></i>Vehicle Utilization
        </div>
        <div className="table-responsive">
          <table className="table table-sm table-hover align-middle mb-0">
            <thead className="table-light">
              <tr><th>Vehicle</th><th>Type</th><th>Route</th><th>Driver</th>
                <th className="text-center">Capacity</th><th className="text-center">Assigned</th>
                <th style={{width:150}}>Utilization</th><th>Status</th></tr>
            </thead>
            <tbody>
              {data.vehicles.length===0 ? (
                <tr><td colSpan={8} className="text-center text-muted py-4">No vehicles found</td></tr>
              ) : data.vehicles.map(v=>{
                const badge = statusBadge[v.status]
                const barColor = v.status==='over' ? 'bg-danger' : v.status==='full' ? 'bg-warning' : v.status==='low' ? 'bg-info' : 'bg-success'
                return (
                  <tr key={v.vehicle_id} className={!v.is_active?'opacity-50':''}>
                    <td><code className="fw-bold">{v.vehicle_no}</code></td>
                    <td><span className="badge bg-light text-dark border small text-capitalize">{v.vehicle_type}</span></td>
                    <td className="small">{v.route_name?<><code>{v.route_no}</code> {v.route_name}</>:<span className="text-muted">Unassigned</span>}</td>
                    <td className="small">{v.driver_name||'—'}</td>
                    <td className="text-center small">{v.capacity}</td>
                    <td className="text-center small fw-medium">{v.assigned_students}</td>
                    <td>
                      <div className="progress" style={{height:10}}>
                        <div className={`progress-bar ${barColor}`} style={{width:`${Math.min(v.utilization_pct,100)}%`}}></div>
                      </div>
                      <div className="text-muted small mt-1">{v.utilization_pct}%</div>
                    </td>
                    <td><span className={`badge small ${badge.cls}`}>{badge.label}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  ID CARDS & BONAFIDE CERTIFICATES TAB
// ─────────────────────────────────────────────────────────────
function CertificatesTab({ years }) {
  const [mode, setMode] = useState('idcards')  // idcards | bonafide
  const [grades, setGrades] = useState([])
  const [gradeId, setGradeId] = useState('')
  const [sections, setSections] = useState([])
  const [sectionId, setSectionId] = useState('')
  const [search, setSearch] = useState('')
  const [results, setResults] = useState([])
  const [selected, setSelected] = useState([])  // array of {id, name, admission_no, class}
  const [side, setSide] = useState('front')
  const [purpose, setPurpose] = useState('')
  const [generating, setGenerating] = useState(false)
  const [err, setErr] = useState('')

  const yearId = years.find(y=>y.is_current)?.id || years[0]?.id || ''

  useEffect(() => {
    api.get('/master/grades').then(r=>setGrades(Array.isArray(r.data)?r.data:[])).catch(()=>{})
  },[])

  useEffect(() => {
    if (!gradeId || !yearId) { setSections([]); return }
    api.get('/master/sections', { params: { grade_id: gradeId, academic_year_id: yearId }})
      .then(r=>setSections(Array.isArray(r.data)?r.data:[]))
      .catch(()=>setSections([]))
  },[gradeId, yearId])

  const searchStudents = async (q) => {
    setSearch(q)
    if (q.length < 2) { setResults([]); return }
    try {
      const r = await api.get('/certificates/students-lookup', { params: { search: q } })
      setResults(Array.isArray(r.data) ? r.data : [])
    } catch { setResults([]) }
  }

  const toggleSelect = (s) => {
    setSelected(prev =>
      prev.find(x=>x.id===s.id)
        ? prev.filter(x=>x.id!==s.id)
        : [...prev, s]
    )
  }

  const selectAllInSection = async () => {
    if (!sectionId) { setErr('Select a class and section first'); return }
    try {
      const r = await api.get('/certificates/students-lookup', { params: { section_id: sectionId, academic_year_id: yearId }})
      const list = Array.isArray(r.data) ? r.data : []
      setSelected(list)
      setErr('')
    } catch(e) { setErr('Failed to load students for this section') }
  }

  const clearSelection = () => setSelected([])

  const downloadPdf = async (url, body, filename) => {
    setGenerating(true); setErr('')
    try {
      const res = await api.post(url, body, { responseType: 'blob' })
      const blob = new Blob([res.data], { type: 'application/pdf' })
      const link = document.createElement('a')
      link.href = window.URL.createObjectURL(blob)
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(link.href)
    } catch(e) {
      setErr(e.response?.data?.detail || 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  const generateIdCards = () => {
    if (selected.length===0) { setErr('Select at least one student'); return }
    downloadPdf('/certificates/id-cards',
      { student_ids: selected.map(s=>s.id), side },
      `id_cards_${side}_${today()}.pdf`)
  }

  const generateBonafide = () => {
    if (selected.length===0) { setErr('Select at least one student'); return }
    downloadPdf('/certificates/bonafide',
      { student_ids: selected.map(s=>s.id), purpose },
      `bonafide_certificates_${today()}.pdf`)
  }

  return (
    <div>
      <ul className="nav nav-pills mb-3">
        <li className="nav-item">
          <button className={`nav-link ${mode==='idcards'?'active':''}`} onClick={()=>setMode('idcards')}>
            <i className="bi bi-card-image me-2"></i>ID Cards
          </button>
        </li>
        <li className="nav-item ms-2">
          <button className={`nav-link ${mode==='bonafide'?'active':''}`} onClick={()=>setMode('bonafide')}>
            <i className="bi bi-file-earmark-text me-2"></i>Bonafide Certificate
          </button>
        </li>
      </ul>

      <div className="row g-3">
        {/* Selection panel */}
        <div className="col-md-7">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white fw-semibold">
              <i className="bi bi-people-fill me-2 text-primary"></i>Select Students
            </div>
            <div className="card-body">
              <div className="row g-2 mb-3">
                <div className="col-md-4">
                  <label className="form-label fw-medium small mb-1">Class</label>
                  <select className="form-select form-select-sm" value={gradeId} onChange={e=>{setGradeId(e.target.value);setSectionId('')}}>
                    <option value="">Select class</option>
                    {grades.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
                <div className="col-md-4">
                  <label className="form-label fw-medium small mb-1">Section</label>
                  <select className="form-select form-select-sm" value={sectionId} onChange={e=>setSectionId(e.target.value)} disabled={!sections.length}>
                    <option value="">Select section</option>
                    {sections.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="col-md-4 d-flex align-items-end">
                  <button className="btn btn-outline-primary btn-sm w-100" onClick={selectAllInSection}>
                    <i className="bi bi-check2-all me-1"></i>Select All in Section
                  </button>
                </div>
              </div>

              <div className="position-relative mb-2">
                <input className="form-control form-control-sm" placeholder="Or search by name / admission no..."
                  value={search} onChange={e=>searchStudents(e.target.value)} />
                {results.length>0 && (
                  <div className="border rounded mt-1 bg-white shadow-sm position-absolute w-100" style={{zIndex:10,maxHeight:200,overflowY:'auto'}}>
                    {results.map(s=>(
                      <button key={s.id} type="button" className="w-100 text-start border-0 px-3 py-2 small bg-white d-flex justify-content-between"
                        onClick={()=>{toggleSelect(s);setResults([]);setSearch('')}}>
                        <span>{s.name} <code style={{fontSize:10}}>{s.admission_no}</code></span>
                        <span className="text-muted">{s.class}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="d-flex justify-content-between align-items-center mb-2">
                <span className="fw-medium small">Selected: {selected.length} student(s)</span>
                {selected.length>0 && (
                  <button className="btn btn-outline-danger btn-sm" onClick={clearSelection}>
                    <i className="bi bi-x-circle me-1"></i>Clear
                  </button>
                )}
              </div>

              <div className="border rounded" style={{maxHeight:240,overflowY:'auto'}}>
                {selected.length===0 ? (
                  <div className="text-center text-muted py-4 small">
                    No students selected. Search above or select a class+section.
                  </div>
                ) : selected.map(s=>(
                  <div key={s.id} className="d-flex justify-content-between align-items-center px-3 py-2 border-bottom small">
                    <div>
                      <span className="fw-medium">{s.name}</span>
                      <code className="text-muted ms-2" style={{fontSize:10}}>{s.admission_no}</code>
                      <span className="text-muted ms-2">{s.class}</span>
                    </div>
                    <button className="btn btn-sm btn-link text-danger p-0" onClick={()=>toggleSelect(s)}>
                      <i className="bi bi-x-lg"></i>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Generate panel */}
        <div className="col-md-5">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white fw-semibold">
              <i className="bi bi-printer me-2 text-success"></i>
              {mode==='idcards' ? 'Generate ID Cards' : 'Generate Bonafide Certificate'}
            </div>
            <div className="card-body">
              {mode==='idcards' ? (
                <>
                  <p className="text-muted small">
                    Generates a printable A4 PDF — 8 cards per page (2 columns × 4 rows),
                    sized for standard ID card cutting (95mm × 58mm).
                  </p>
                  <label className="form-label fw-medium small">Side to Print</label>
                  <select className="form-select form-select-sm mb-3" value={side} onChange={e=>setSide(e.target.value)}>
                    <option value="front">Front Side (Photo + Details)</option>
                    <option value="back">Back Side (Parent Info + Rules)</option>
                    <option value="both">Both (Front pages, then Back pages)</option>
                  </select>
                  <button className="btn btn-primary w-100" onClick={generateIdCards} disabled={generating}>
                    {generating ? (
                      <><span className="spinner-border spinner-border-sm me-2"></span>Generating...</>
                    ) : (
                      <><i className="bi bi-file-earmark-pdf me-2"></i>Download ID Cards PDF</>
                    )}
                  </button>
                </>
              ) : (
                <>
                  <p className="text-muted small">
                    Generates one certificate per page on school letterhead format,
                    with student name, class, admission no, parent name and DOB.
                  </p>
                  <label className="form-label fw-medium small">Purpose (optional)</label>
                  <input className="form-control form-control-sm mb-3" placeholder="e.g. Passport application, Bank account opening..."
                    value={purpose} onChange={e=>setPurpose(e.target.value)} />
                  <button className="btn btn-primary w-100" onClick={generateBonafide} disabled={generating}>
                    {generating ? (
                      <><span className="spinner-border spinner-border-sm me-2"></span>Generating...</>
                    ) : (
                      <><i className="bi bi-file-earmark-pdf me-2"></i>Download Certificate(s) PDF</>
                    )}
                  </button>
                </>
              )}

              {err && <div className="alert alert-danger py-2 mt-3 small mb-0">{err}</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
