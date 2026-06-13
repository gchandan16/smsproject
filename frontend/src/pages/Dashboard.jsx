// frontend/src/pages/Dashboard.jsx
// Chart.js loaded from CDN via useEffect — no npm install needed
import { useState, useEffect, useRef } from 'react'
import { useSelector } from 'react-redux'
import reportsApi from '../api/reportsApi.js'
import { selectUserRole } from '../store/slices/authSlice.js'
import StudentParentDashboard from './StudentParentDashboard.jsx'

// ─────────────────────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────────────────────
const fmt  = (n) => Number(n || 0).toLocaleString('en-IN')
const fmtK = (n) => {
  const v = Number(n || 0)
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`
  if (v >= 1000)   return `₹${(v / 1000).toFixed(1)}K`
  return `₹${v.toFixed(0)}`
}
const pct = (n) => `${Number(n || 0).toFixed(1)}%`

const today      = () => new Date().toISOString().slice(0, 10)
const monthStart = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}
// auth handled by axios client interceptor

// Load Chart.js from CDN once
let chartJsReady = false
let chartJsCallbacks = []

function loadChartJs(cb) {
  if (chartJsReady) { cb(); return }
  chartJsCallbacks.push(cb)
  if (chartJsCallbacks.length > 1) return // already loading
  const script = document.createElement('script')
  script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.2/dist/chart.umd.min.js'
  script.onload = () => {
    chartJsReady = true
    chartJsCallbacks.forEach(fn => fn())
    chartJsCallbacks = []
  }
  document.head.appendChild(script)
}

// ─────────────────────────────────────────────────────────────
//  MAIN PAGE
// ─────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const userRole = useSelector(selectUserRole)
  const role = (userRole || '').toLowerCase()

  // Students and parents get a completely different, personalized dashboard
  if (role === 'student' || role === 'parent') {
    return <StudentParentDashboard />
  }

  return <AdminDashboard />
}

// ─────────────────────────────────────────────────────────────
//  ADMIN / STAFF DASHBOARD (original)
// ─────────────────────────────────────────────────────────────
function AdminDashboard() {
  const [stats,    setStats]    = useState(null)
  const [attTrend, setAttTrend] = useState([])
  const [feeTrend, setFeeTrend] = useState([])
  const [yearId,   setYearId]   = useState('')
  const [years,    setYears]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')

  useEffect(() => {
    import('../api/client.js').then(({ default: api }) => {
      api.get('/master/academic-years')
        .then(r => {
          const ys = Array.isArray(r.data) ? r.data : []
          setYears(ys)
          const cur = ys.find(y => y.is_current)
          if (cur) setYearId(cur.id)
          else if (ys[0]) setYearId(ys[0].id)
        })
        .catch(() => setError('Failed to load academic years'))
    })
  }, [])

  useEffect(() => {
    if (!yearId) return
    loadAll()
  }, [yearId])

  const loadAll = async () => {
    setLoading(true); setError('')
    try {
      const [dashData, attData, feeData] = await Promise.all([
        reportsApi.getDashboard(yearId),
        reportsApi.getAttendanceSummary({
          from_date: monthStart(), to_date: today(),
          academic_year_id: yearId,
        }).catch(() => ({ daily_trend: [] })),
        reportsApi.getMonthlyTrend(yearId).catch(() => ({ months: [] })),
      ])
      setStats(dashData)
      setAttTrend(attData?.daily_trend || [])
      setFeeTrend(feeData?.months || [])
    } catch (e) {
      const status = e.response?.status
      if (status === 401) {
        // Token expired — redirect to login
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        window.location.href = '/login'
        return
      }
      setError(e.response?.data?.detail || 'Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }

  if (loading) return (
    <div className="d-flex align-items-center justify-content-center" style={{ minHeight: 400 }}>
      <div className="text-center">
        <div className="spinner-border text-primary mb-3"></div>
        <div className="text-muted small">Loading dashboard...</div>
      </div>
    </div>
  )

  if (error) return (
    <div className="alert alert-danger m-3">
      <i className="bi bi-exclamation-triangle-fill me-2"></i>{error}
      <button className="btn btn-sm btn-link ms-2" onClick={loadAll}>Retry</button>
    </div>
  )

  if (!stats) return null

  const { students, attendance, fees } = stats

  return (
    <div>
      {/* Header */}
      <div className="d-flex align-items-center justify-content-between mb-4 flex-wrap gap-2">
        <div>
          <h4 className="fw-bold mb-0">Dashboard</h4>
          <small className="text-muted">
            {new Date().toLocaleDateString('en-IN', {
              weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
            })}
          </small>
        </div>
        <div className="d-flex gap-2">
          <select className="form-select form-select-sm" style={{ width: 160 }}
            value={yearId} onChange={e => setYearId(e.target.value)}>
            {years.map(y => (
              <option key={y.id} value={y.id}>{y.label}{y.is_current ? ' ★' : ''}</option>
            ))}
          </select>
          <button className="btn btn-outline-secondary btn-sm" onClick={loadAll}>
            <i className="bi bi-arrow-clockwise me-1"></i>Refresh
          </button>
        </div>
      </div>

      {/* Row 1 — Students */}
      <div className="row g-3 mb-4">
        <div className="col-6 col-md-3">
          <StatCard icon="bi-people-fill" label="Total Students"
            value={fmt(students.total)} sub={`${students.total_sections} sections`}
            color="#1e3a5f" bg="#e8f0fe" />
        </div>
        <div className="col-6 col-md-3">
          <StatCard icon="bi-person-fill" label="Male"
            value={fmt(students.male)}
            sub={pct(students.total ? students.male / students.total * 100 : 0)}
            color="#0369a1" bg="#e0f2fe" />
        </div>
        <div className="col-6 col-md-3">
          <StatCard icon="bi-person-fill" label="Female"
            value={fmt(students.female)}
            sub={pct(students.total ? students.female / students.total * 100 : 0)}
            color="#7c3aed" bg="#ede9fe" />
        </div>
        <div className="col-6 col-md-3">
          <StatCard icon="bi-person-plus-fill" label="New This Month"
            value={fmt(students.new_this_month)} sub="admissions"
            color="#059669" bg="#d1fae5" />
        </div>
      </div>

      {/* Row 2 — Attendance */}
      <div className="row g-3 mb-4">
        <div className="col-6 col-md-3">
          <StatCard icon="bi-check-circle-fill" label="Present Today"
            value={fmt(attendance.today_present)}
            sub={`${pct(attendance.today_pct)} rate`}
            color="#16a34a" bg="#dcfce7" />
        </div>
        <div className="col-6 col-md-3">
          <StatCard icon="bi-x-circle-fill" label="Absent Today"
            value={fmt(attendance.today_absent)} sub="students"
            color="#dc2626" bg="#fee2e2" />
        </div>
        <div className="col-6 col-md-3">
          <StatCard icon="bi-clock-fill" label="Late Today"
            value={fmt(attendance.today_late)} sub="arrivals"
            color="#d97706" bg="#fef3c7" />
        </div>
        <div className="col-6 col-md-3">
          <StatCard icon="bi-bar-chart-fill" label="Month Average"
            value={pct(attendance.month_avg_pct)} sub="attendance"
            color="#0891b2" bg="#cffafe" />
        </div>
      </div>

      {/* Row 3 — Fees */}
      <div className="row g-3 mb-4">
        <div className="col-6 col-md-3">
          <StatCard icon="bi-file-earmark-text-fill" label="Total Billed"
            value={fmtK(fees.total_billed)} sub={`${fees.total_invoices} invoices`}
            color="#1e3a5f" bg="#e8f0fe" />
        </div>
        <div className="col-6 col-md-3">
          <StatCard icon="bi-check-circle-fill" label="Collected"
            value={fmtK(fees.total_collected)} sub={`${pct(fees.collection_pct)} of billed`}
            color="#16a34a" bg="#dcfce7" />
        </div>
        <div className="col-6 col-md-3">
          <StatCard icon="bi-hourglass-split" label="Pending"
            value={fmtK(fees.total_pending)} sub={`${fees.partial_count} partial`}
            color="#d97706" bg="#fef3c7" />
        </div>
        <div className="col-6 col-md-3">
          <StatCard icon="bi-exclamation-triangle-fill" label="Overdue"
            value={fmt(fees.overdue_count)} sub="invoices"
            color="#dc2626" bg="#fee2e2" />
        </div>
      </div>

      {/* Row 4 — Charts */}
      <div className="row g-3 mb-4">
        {/* Attendance bar */}
        <div className="col-12 col-lg-8">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white d-flex align-items-center
              justify-content-between py-3">
              <div>
                <span className="fw-semibold">
                  <i className="bi bi-bar-chart me-2 text-primary"></i>
                  Attendance Trend — This Month
                </span>
              </div>
              <div className="d-flex gap-3">
                <span className="d-flex align-items-center gap-1 small">
                  <span style={{ width:12, height:12, borderRadius:3,
                    background:'#16a34a', display:'inline-block' }}></span>Present
                </span>
                <span className="d-flex align-items-center gap-1 small">
                  <span style={{ width:12, height:12, borderRadius:3,
                    background:'#dc2626', display:'inline-block' }}></span>Absent
                </span>
              </div>
            </div>
            <div className="card-body" style={{ height: 280 }}>
              {attTrend.length === 0 ? (
                <EmptyChart icon="bi-bar-chart" msg="No attendance data this month" />
              ) : (
                <AttendanceBarChart data={attTrend} />
              )}
            </div>
          </div>
        </div>

        {/* Fee doughnut */}
        <div className="col-12 col-lg-4">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white py-3">
              <span className="fw-semibold">
                <i className="bi bi-pie-chart me-2 text-primary"></i>
                Fee Collection
              </span>
              <div className="text-muted small mt-1">Paid vs pending vs overdue</div>
            </div>
            <div className="card-body d-flex flex-column align-items-center
              justify-content-center">
              {fees.total_billed > 0 ? (
                <FeeDonutChart fees={fees} />
              ) : (
                <EmptyChart icon="bi-pie-chart" msg="No invoices yet" />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Row 5 — Monthly fee + Quick links */}
      <div className="row g-3 mb-4">
        <div className="col-12 col-lg-8">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white py-3">
              <span className="fw-semibold">
                <i className="bi bi-cash-coin me-2 text-success"></i>
                Monthly Fee Collection
              </span>
            </div>
            <div className="card-body" style={{ height: 220 }}>
              {feeTrend.length === 0 ? (
                <EmptyChart icon="bi-cash-coin" msg="No collection data yet" />
              ) : (
                <MonthlyFeeChart data={feeTrend} />
              )}
            </div>
          </div>
        </div>

        <div className="col-12 col-lg-4">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white py-3">
              <span className="fw-semibold">
                <i className="bi bi-lightning-charge me-2 text-warning"></i>
                Quick Actions
              </span>
            </div>
            <div className="card-body p-0">
              {[
                { href:'/students',   icon:'bi-person-plus-fill', label:'Add Student',      color:'#1e3a5f' },
                { href:'/attendance', icon:'bi-calendar-check',   label:'Mark Attendance',  color:'#16a34a' },
                { href:'/fees',       icon:'bi-cash-coin',        label:'Collect Fees',     color:'#0369a1' },
                { href:'/exams',      icon:'bi-pencil-square',    label:'Enter Exam Marks', color:'#7c3aed' },
                { href:'/reports',    icon:'bi-bar-chart-line',   label:'View Reports',     color:'#d97706' },
                { href:'/settings',   icon:'bi-gear-fill',        label:'Settings',         color:'#6b7280' },
              ].map((q, i) => (
                <a key={i} href={q.href}
                  className="d-flex align-items-center gap-3 px-4 py-2
                    text-decoration-none border-bottom"
                  style={{ color:'inherit' }}
                  onMouseEnter={e => e.currentTarget.style.background='#f8fafc'}
                  onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                  <div style={{
                    width:32, height:32, borderRadius:8, flexShrink:0,
                    background: q.color + '18',
                    display:'flex', alignItems:'center', justifyContent:'center',
                  }}>
                    <i className={`bi ${q.icon}`}
                      style={{ color:q.color, fontSize:14 }}></i>
                  </div>
                  <span className="small fw-medium">{q.label}</span>
                  <i className="bi bi-chevron-right text-muted ms-auto small"></i>
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Row 6 — Progress panels */}
      <div className="row g-3">
        <div className="col-12 col-md-6">
          <div className="card border-0 shadow-sm">
            <div className="card-header bg-white py-3">
              <span className="fw-semibold">
                <i className="bi bi-activity me-2 text-primary"></i>
                Today's Attendance
              </span>
            </div>
            <div className="card-body">
              <AttendanceProgress attendance={attendance} />
            </div>
          </div>
        </div>
        <div className="col-12 col-md-6">
          <div className="card border-0 shadow-sm">
            <div className="card-header bg-white py-3">
              <span className="fw-semibold">
                <i className="bi bi-wallet2 me-2 text-success"></i>
                Fee Collection Progress
              </span>
            </div>
            <div className="card-body">
              <FeeProgress fees={fees} />
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  STAT CARD
// ─────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, sub, color, bg }) {
  return (
    <div className="card border-0 shadow-sm h-100" style={{ background: bg }}>
      <div className="card-body py-3 px-3">
        <div className="d-flex align-items-start justify-content-between">
          <div className="flex-grow-1">
            <div className="text-muted fw-medium mb-1"
              style={{ fontSize:11, textTransform:'uppercase', letterSpacing:0.5 }}>
              {label}
            </div>
            <div className="fw-bold" style={{ fontSize:24, color, lineHeight:1.2 }}>
              {value}
            </div>
            {sub && (
              <div className="mt-1" style={{ fontSize:11, color: color + 'aa' }}>{sub}</div>
            )}
          </div>
          <div style={{
            width:38, height:38, borderRadius:10, flexShrink:0,
            background: color,
            display:'flex', alignItems:'center', justifyContent:'center',
          }}>
            <i className={`bi ${icon} text-white`} style={{ fontSize:16 }}></i>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  EMPTY CHART PLACEHOLDER
// ─────────────────────────────────────────────────────────────
function EmptyChart({ icon, msg }) {
  return (
    <div className="d-flex align-items-center justify-content-center h-100 text-muted">
      <div className="text-center">
        <i className={`bi ${icon} fs-1 d-block mb-2 opacity-25`}></i>
        <small>{msg}</small>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  CHART HOOK — loads Chart.js from CDN on first use
// ─────────────────────────────────────────────────────────────
function useChart(canvasRef, buildFn, deps) {
  const chartRef = useRef(null)
  const [ready, setReady] = useState(chartJsReady)

  useEffect(() => {
    if (!ready) {
      loadChartJs(() => setReady(true))
    }
  }, [])

  useEffect(() => {
    if (!ready || !canvasRef.current) return

    // Destroy previous instance
    if (chartRef.current) {
      chartRef.current.destroy()
      chartRef.current = null
    }

    // Build new chart
    const Chart = window.Chart
    if (!Chart) return

    chartRef.current = buildFn(Chart, canvasRef.current)

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy()
        chartRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, ...deps])
}

// ─────────────────────────────────────────────────────────────
//  ATTENDANCE BAR CHART
// ─────────────────────────────────────────────────────────────
function AttendanceBarChart({ data }) {
  const canvasRef = useRef(null)

  useChart(canvasRef, (Chart, canvas) => {
    return new Chart(canvas, {
      type: 'bar',
      data: {
        labels: data.map(d => {
          const dt = new Date(d.date)
          return dt.toLocaleDateString('en-IN', { day:'2-digit', month:'short' })
        }),
        datasets: [
          {
            label:           'Present',
            data:            data.map(d => d.present || 0),
            backgroundColor: '#16a34a',
            borderRadius:    4,
            borderSkipped:   false,
          },
          {
            label:           'Absent',
            data:            data.map(d => d.absent || 0),
            backgroundColor: '#dc2626cc',
            borderRadius:    4,
            borderSkipped:   false,
          },
        ],
      },
      options: {
        responsive:          true,
        maintainAspectRatio: false,
        interaction:         { mode:'index', intersect:false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1e293b',
            padding:         10,
            cornerRadius:    8,
            callbacks: {
              label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y}`,
            },
          },
        },
        scales: {
          x: {
            stacked: false,
            grid:    { display:false },
            ticks:   { font:{ size:10 }, maxRotation:45 },
          },
          y: {
            beginAtZero: true,
            grid:        { color:'#f1f5f9' },
            ticks:       { font:{ size:10 }, stepSize:5 },
          },
        },
      },
    })
  }, [data])

  return <canvas ref={canvasRef} style={{ width:'100%', height:'100%' }} />
}

// ─────────────────────────────────────────────────────────────
//  FEE DOUGHNUT CHART
// ─────────────────────────────────────────────────────────────
function FeeDonutChart({ fees }) {
  const canvasRef = useRef(null)

  const collected = fees.total_collected || 0
  const pending   = fees.total_pending   || 0
  const billed    = fees.total_billed    || 1
  const collPct   = fees.collection_pct  || 0

  // Split pending into partial vs overdue proportionally
  const overdueAmt  = pending * (fees.overdue_count / Math.max(fees.total_invoices || 1, 1))
  const pendingAmt  = Math.max(pending - overdueAmt, 0)

  useChart(canvasRef, (Chart, canvas) => {
    const centerTextPlugin = {
      id: 'centerText',
      beforeDraw(chart) {
        const { ctx, chartArea: { top, right, bottom, left, width, height } } = chart
        ctx.save()
        const cx = left + width  / 2
        const cy = top  + height / 2 - 12
        ctx.textAlign    = 'center'
        ctx.textBaseline = 'middle'
        ctx.font         = 'bold 15px Arial'
        ctx.fillStyle    = '#1e3a5f'
        ctx.fillText(`${collPct}%`, cx, cy)
        ctx.font      = '10px Arial'
        ctx.fillStyle = '#64748b'
        ctx.fillText('collected', cx, cy + 18)
        ctx.restore()
      },
    }

    return new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels:   ['Collected', 'Pending', 'Overdue'],
        datasets: [{
          data:            [collected, pendingAmt, overdueAmt],
          backgroundColor: ['#16a34a', '#d97706', '#dc2626'],
          borderColor:     ['#fff', '#fff', '#fff'],
          borderWidth:     3,
          hoverOffset:     6,
        }],
      },
      options: {
        responsive:          true,
        maintainAspectRatio: true,
        cutout:              '65%',
        plugins: {
          legend: {
            position: 'bottom',
            labels:   { padding:14, font:{ size:11 }, boxWidth:12, boxHeight:12 },
          },
          tooltip: {
            backgroundColor: '#1e293b',
            padding:         10,
            cornerRadius:    8,
            callbacks: {
              label: ctx => {
                const total = collected + pendingAmt + overdueAmt
                const p = total > 0 ? (ctx.parsed / total * 100).toFixed(1) : '0'
                return ` ${ctx.label}: ₹${Number(ctx.parsed).toLocaleString('en-IN')} (${p}%)`
              },
            },
          },
        },
      },
      plugins: [centerTextPlugin],
    })
  }, [collected, pendingAmt, overdueAmt, collPct])

  return (
    <div style={{ maxWidth:220, maxHeight:240, width:'100%' }}>
      <canvas ref={canvasRef} />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  MONTHLY FEE BAR CHART
// ─────────────────────────────────────────────────────────────
function MonthlyFeeChart({ data }) {
  const canvasRef = useRef(null)

  useChart(canvasRef, (Chart, canvas) => {
    return new Chart(canvas, {
      type: 'bar',
      data: {
        labels: data.map(d => d.month_label),
        datasets: [{
          label:           'Collected (₹)',
          data:            data.map(d => d.collected),
          backgroundColor: '#1e3a5f',
          borderRadius:    5,
          borderSkipped:   false,
        }],
      },
      options: {
        responsive:          true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1e293b',
            padding:         10,
            cornerRadius:    8,
            callbacks: {
              label: (ctx) => {
                const txns = data[ctx.dataIndex]?.transactions || 0
                return ` ₹${Number(ctx.parsed.y).toLocaleString('en-IN')} · ${txns} txns`
              },
            },
          },
        },
        scales: {
          x: {
            grid:  { display:false },
            ticks: { font:{ size:10 } },
          },
          y: {
            beginAtZero: true,
            grid:        { color:'#f1f5f9' },
            ticks: {
              font: { size:10 },
              callback: v => `₹${(v/1000).toFixed(0)}K`,
            },
          },
        },
      },
    })
  }, [data])

  return <canvas ref={canvasRef} style={{ width:'100%', height:'100%' }} />
}

// ─────────────────────────────────────────────────────────────
//  ATTENDANCE PROGRESS
// ─────────────────────────────────────────────────────────────
function AttendanceProgress({ attendance }) {
  const total = attendance.today_marked || 1

  if (attendance.today_marked === 0) {
    return (
      <div className="text-center py-3 text-muted">
        <i className="bi bi-calendar-x fs-2 d-block mb-2 opacity-25"></i>
        <small>No attendance marked today</small>
      </div>
    )
  }

  const items = [
    { label:'Present', value:attendance.today_present, color:'#16a34a', bg:'#dcfce7' },
    { label:'Absent',  value:attendance.today_absent,  color:'#dc2626', bg:'#fee2e2' },
    { label:'Late',    value:attendance.today_late,    color:'#d97706', bg:'#fef3c7' },
  ]

  return (
    <div>
      {/* Ring */}
      <div className="text-center mb-4">
        <div style={{
          display:'inline-flex', alignItems:'center', justifyContent:'center',
          width:90, height:90, borderRadius:'50%',
          background:`conic-gradient(
            #16a34a 0% ${attendance.today_pct}%,
            #f1f5f9 ${attendance.today_pct}% 100%
          )`,
        }}>
          <div style={{
            width:70, height:70, borderRadius:'50%', background:'#fff',
            display:'flex', alignItems:'center', justifyContent:'center',
            flexDirection:'column',
          }}>
            <div style={{ fontSize:16, fontWeight:700, color:'#16a34a', lineHeight:1 }}>
              {pct(attendance.today_pct)}
            </div>
            <div style={{ fontSize:9, color:'#64748b' }}>today</div>
          </div>
        </div>
      </div>

      {items.map(item => (
        <div key={item.label} className="mb-3">
          <div className="d-flex justify-content-between mb-1">
            <span className="small fw-medium">{item.label}</span>
            <span className="small fw-bold" style={{ color:item.color }}>
              {item.value} / {attendance.today_marked}
            </span>
          </div>
          <div className="progress" style={{ height:8, background:item.bg, borderRadius:4 }}>
            <div className="progress-bar" style={{
              width: `${(item.value / total * 100).toFixed(1)}%`,
              background: item.color, borderRadius:4,
            }} />
          </div>
        </div>
      ))}

      <div className="text-center mt-3">
        <small className="text-muted">
          Month avg: <strong style={{ color:'#0891b2' }}>{pct(attendance.month_avg_pct)}</strong>
        </small>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  FEE PROGRESS
// ─────────────────────────────────────────────────────────────
function FeeProgress({ fees }) {
  if (!fees.total_billed) {
    return (
      <div className="text-center py-3 text-muted">
        <i className="bi bi-receipt fs-2 d-block mb-2 opacity-25"></i>
        <small>No invoices generated yet</small>
      </div>
    )
  }

  const billed = fees.total_billed || 1
  const items  = [
    { label:'Collected', value:fees.total_collected, color:'#16a34a', bg:'#dcfce7' },
    { label:'Pending',   value:fees.total_pending,   color:'#d97706', bg:'#fef3c7' },
  ]

  return (
    <div>
      {fees.today_collected > 0 && (
        <div className="alert alert-success py-2 mb-3 small">
          <i className="bi bi-arrow-up-circle-fill me-2"></i>
          Today: <strong>₹{Number(fees.today_collected).toLocaleString('en-IN')}</strong>
          {' '}· <strong>{fees.today_transactions}</strong> transactions
        </div>
      )}

      {items.map(item => (
        <div key={item.label} className="mb-3">
          <div className="d-flex justify-content-between mb-1">
            <span className="small fw-medium">{item.label}</span>
            <span className="small fw-bold" style={{ color:item.color }}>
              ₹{Number(item.value || 0).toLocaleString('en-IN', { maximumFractionDigits:0 })}
            </span>
          </div>
          <div className="progress" style={{ height:10, background:item.bg, borderRadius:5 }}>
            <div className="progress-bar" style={{
              width: `${Math.min((item.value / billed) * 100, 100).toFixed(1)}%`,
              background: item.color, borderRadius:5, transition:'width 0.8s ease',
            }} />
          </div>
          <div style={{ fontSize:10, color:'#94a3b8', marginTop:2 }}>
            {((item.value / billed) * 100).toFixed(1)}% of billed
          </div>
        </div>
      ))}

      <div className="d-flex gap-2 mt-3 flex-wrap">
        <span className="badge bg-success">
          <i className="bi bi-check-circle me-1"></i>{fees.paid_count} Paid
        </span>
        <span className="badge bg-warning text-dark">
          <i className="bi bi-hourglass me-1"></i>{fees.partial_count} Partial
        </span>
        <span className="badge bg-danger">
          <i className="bi bi-exclamation-triangle me-1"></i>{fees.overdue_count} Overdue
        </span>
      </div>
    </div>
  )
}
