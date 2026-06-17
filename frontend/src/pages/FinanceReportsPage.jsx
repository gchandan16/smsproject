// frontend/src/pages/FinanceReportsPage.jsx
import { useState, useEffect, useCallback } from 'react'
import api from '../api/client.js'

const today      = () => new Date().toISOString().slice(0,10)
const monthStart = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01` }
const fmt = (n) => `₹${(parseFloat(n)||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}`

function Spinner(){ return <div className="text-center py-5"><div className="spinner-border text-primary"></div></div> }
function ErrBox({msg}){ return msg ? <div className="alert alert-danger py-2 small"><i className="bi bi-exclamation-triangle-fill me-2"></i>{msg}</div> : null }

// Download a file from a blob response
async function downloadExport(url, params, filename) {
  const res = await api.get(url, { params, responseType: 'blob' })
  const blob = new Blob([res.data])
  const link = document.createElement('a')
  link.href = window.URL.createObjectURL(blob)
  const ext = params.fmt === 'pdf' ? 'pdf' : 'xlsx'
  link.download = `${filename}.${ext}`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(link.href)
}

function ExportButtons({ onExport, loading }) {
  return (
    <div className="btn-group btn-group-sm">
      <button className="btn btn-outline-success" disabled={loading} onClick={()=>onExport('excel')}>
        <i className="bi bi-file-earmark-excel me-1"></i>Excel
      </button>
      <button className="btn btn-outline-danger" disabled={loading} onClick={()=>onExport('pdf')}>
        <i className="bi bi-file-earmark-pdf me-1"></i>PDF
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
export default function FinanceReportsPage() {
  const [tab, setTab] = useState('collection')
  const [years, setYears] = useState([])
  const [yearId, setYearId] = useState('')

  useEffect(() => {
    api.get('/master/academic-years').then(r=>{
      const ys = Array.isArray(r.data)?r.data:[]
      setYears(ys)
      const cur = ys.find(y=>y.is_current)
      if(cur) setYearId(cur.id)
    }).catch(()=>{})
  },[])

  const TABS = [
    { key:'collection', icon:'bi-cash-stack',       label:'Fee Collection'   },
    { key:'transport',  icon:'bi-bus-front',        label:'Transport Fees'   },
    { key:'outstanding',icon:'bi-exclamation-circle',label:'Outstanding'     },
    { key:'cashbook',   icon:'bi-journal-text',     label:'Daily Cash Book'  },
    { key:'ledger',     icon:'bi-person-lines-fill', label:'Student Ledger'  },
    { key:'income',     icon:'bi-graph-up',         label:'Income Summary'   },
  ]

  return (
    <div>
      <div className="mb-4">
        <h4 className="fw-bold mb-0">Finance Reports</h4>
        <small className="text-muted">Generate and export financial reports</small>
      </div>
      <ul className="nav nav-tabs mb-4 flex-wrap">
        {TABS.map(t=>(
          <li key={t.key} className="nav-item">
            <button className={`nav-link ${tab===t.key?'active':''}`} onClick={()=>setTab(t.key)}>
              <i className={`bi ${t.icon} me-2`}></i>{t.label}
            </button>
          </li>
        ))}
      </ul>
      {tab==='collection'  && <CollectionTab yearId={yearId} />}
      {tab==='transport'   && <TransportTab  yearId={yearId} />}
      {tab==='outstanding' && <OutstandingTab years={years} yearId={yearId} setYearId={setYearId} />}
      {tab==='cashbook'    && <CashbookTab />}
      {tab==='ledger'      && <LedgerTab years={years} yearId={yearId} setYearId={setYearId} />}
      {tab==='income'      && <IncomeTab years={years} yearId={yearId} setYearId={setYearId} />}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  1. FEE COLLECTION REPORT
// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
//  SHARED PAGINATION COMPONENT
// ─────────────────────────────────────────────────────────────
function Pagination({ pagination, onPageChange }) {
  if (!pagination || pagination.total_pages <= 1) return null
  const { page, total_pages, total_count, page_size } = pagination
  const start = (page - 1) * page_size + 1
  const end   = Math.min(page * page_size, total_count)

  // Build page number list with ellipsis
  const pages = []
  for (let i = 1; i <= total_pages; i++) {
    if (i === 1 || i === total_pages || Math.abs(i - page) <= 2) pages.push(i)
    else if (pages[pages.length - 1] !== '…') pages.push('…')
  }

  return (
    <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 px-3 py-2 border-top bg-white">
      <div className="text-muted small">
        Showing <strong>{start}–{end}</strong> of <strong>{total_count}</strong> records
      </div>
      <nav>
        <ul className="pagination pagination-sm mb-0 gap-1">
          <li className={`page-item ${page <= 1 ? 'disabled' : ''}`}>
            <button className="page-link rounded" onClick={() => onPageChange(page - 1)}>
              <i className="bi bi-chevron-left"></i>
            </button>
          </li>
          {pages.map((p, i) =>
            p === '…' ? (
              <li key={`e${i}`} className="page-item disabled">
                <span className="page-link">…</span>
              </li>
            ) : (
              <li key={p} className={`page-item ${p === page ? 'active' : ''}`}>
                <button className="page-link rounded" onClick={() => onPageChange(p)}>{p}</button>
              </li>
            )
          )}
          <li className={`page-item ${page >= total_pages ? 'disabled' : ''}`}>
            <button className="page-link rounded" onClick={() => onPageChange(page + 1)}>
              <i className="bi bi-chevron-right"></i>
            </button>
          </li>
        </ul>
      </nav>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  1. FEE COLLECTION REPORT
// ─────────────────────────────────────────────────────────────
function CollectionTab() {
  const [fromDate,setFromDate]=useState(monthStart())
  const [toDate,setToDate]=useState(today())
  const [grades,setGrades]=useState([])
  const [gradeId,setGradeId]=useState('')
  const [page,setPage]=useState(1)
  const [pageSize]=useState(10)
  const [data,setData]=useState(null)
  const [loading,setLoading]=useState(false)
  const [exporting,setExporting]=useState(false)
  const [err,setErr]=useState('')

  useEffect(()=>{ api.get('/master/grades').then(r=>setGrades(Array.isArray(r.data)?r.data:[])).catch(()=>{}) },[])

  const load=useCallback(async(p=1)=>{
    setLoading(true); setErr('')
    try{
      const params={from_date:fromDate,to_date:toDate,page:p,page_size:pageSize}
      if(gradeId)params.grade_id=gradeId
      const r=await api.get('/finance-reports/fees/collection',{params})
      setData(r.data); setPage(p)
    }catch(e){setErr(e.response?.data?.detail||'Failed to load')}
    setLoading(false)
  },[fromDate,toDate,gradeId,pageSize])

  useEffect(()=>{load(1)},[load])

  const exportFile=async(fmt)=>{
    setExporting(true)
    try{
      const params={fmt,from_date:fromDate,to_date:toDate}
      if(gradeId)params.grade_id=gradeId
      await downloadExport('/finance-reports/fees/collection/export',params,`fee_collection_${fromDate}_to_${toDate}`)
    }catch(e){setErr('Export failed')}
    setExporting(false)
  }

  return (
    <div>
      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body py-2">
          <div className="row g-2 align-items-end">
            <div className="col-md-2">
              <label className="form-label fw-medium small mb-1">From Date</label>
              <input type="date" className="form-control form-control-sm" value={fromDate} onChange={e=>{setFromDate(e.target.value)}} />
            </div>
            <div className="col-md-2">
              <label className="form-label fw-medium small mb-1">To Date</label>
              <input type="date" className="form-control form-control-sm" value={toDate} onChange={e=>{setToDate(e.target.value)}} />
            </div>
            <div className="col-md-2">
              <label className="form-label fw-medium small mb-1">Class</label>
              <select className="form-select form-select-sm" value={gradeId} onChange={e=>setGradeId(e.target.value)}>
                <option value="">All Classes</option>
                {grades.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            <div className="col-auto ms-auto">
              <ExportButtons onExport={exportFile} loading={exporting||loading} />
            </div>
          </div>
        </div>
      </div>

      <ErrBox msg={err} />
      {loading?<Spinner/>:!data?null:(
        <>
          <div className="row g-3 mb-3">
            <div className="col-md-4">
              <div className="card border-0 shadow-sm bg-success-subtle">
                <div className="card-body py-3">
                  <div className="text-muted small">Total Collected</div>
                  <div className="fw-bold fs-4 text-success">{fmt(data.total_collected)}</div>
                  <div className="text-muted small">{data.transaction_count} transactions</div>
                </div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="card border-0 shadow-sm">
                <div className="card-body py-3">
                  <div className="text-muted small mb-2">By Payment Method</div>
                  {Object.entries(data.by_method).map(([m,v])=>(
                    <div key={m} className="d-flex justify-content-between small">
                      <span className="text-capitalize">{m||'—'}</span><span className="fw-medium">{fmt(v)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="card border-0 shadow-sm">
                <div className="card-body py-3">
                  <div className="text-muted small mb-2">By Fee Category</div>
                  {Object.entries(data.by_category).map(([c,v])=>(
                    <div key={c} className="d-flex justify-content-between small">
                      <span>{c}</span><span className="fw-medium">{fmt(v)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="card border-0 shadow-sm">
            <div className="table-responsive">
              <table className="table table-sm table-hover align-middle mb-0">
                <thead className="table-light sticky-top">
                  <tr><th>Date</th><th>Receipt</th><th>Student</th><th>Admission No</th><th>Class</th><th>Category</th><th>Method</th><th className="text-end">Amount</th></tr>
                </thead>
                <tbody>
                  {data.transactions.length===0?(
                    <tr><td colSpan={8} className="text-center text-muted py-4">No transactions in this period</td></tr>
                  ):data.transactions.map((t,i)=>(
                    <tr key={i}>
                      <td className="small">{t.date}</td>
                      <td><code className="small">{t.receipt_no}</code></td>
                      <td className="small">{t.student_name}</td>
                      <td className="small text-muted">{t.admission_no}</td>
                      <td className="small">{t.class}</td>
                      <td><span className="badge bg-light text-dark border small">{t.category}</span></td>
                      <td className="small text-capitalize">{t.method}</td>
                      <td className="text-end small fw-medium">{fmt(t.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination pagination={data.pagination} onPageChange={p=>load(p)} />
          </div>
        </>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  2. TRANSPORT FEE REPORT
// ─────────────────────────────────────────────────────────────
function TransportTab() {
  const [fromDate,setFromDate]=useState(monthStart())
  const [toDate,setToDate]=useState(today())
  const [routes,setRoutes]=useState([])
  const [routeId,setRouteId]=useState('')
  const [page,setPage]=useState(1)
  const [pageSize]=useState(10)
  const [data,setData]=useState(null)
  const [loading,setLoading]=useState(false)
  const [exporting,setExporting]=useState(false)
  const [err,setErr]=useState('')

  useEffect(()=>{ api.get('/transport/routes').then(r=>setRoutes(Array.isArray(r.data)?r.data:[])).catch(()=>{}) },[])

  const load=useCallback(async(p=1)=>{
    setLoading(true); setErr('')
    try{
      const params={from_date:fromDate,to_date:toDate,page:p,page_size:pageSize}
      if(routeId)params.route_id=routeId
      const r=await api.get('/finance-reports/fees/transport',{params})
      setData(r.data); setPage(p)
    }catch(e){setErr(e.response?.data?.detail||'Failed to load')}
    setLoading(false)
  },[fromDate,toDate,routeId,pageSize])

  useEffect(()=>{load(1)},[load])

  const exportFile=async(fmt)=>{
    setExporting(true)
    try{
      const params={fmt,from_date:fromDate,to_date:toDate}
      if(routeId)params.route_id=routeId
      await downloadExport('/finance-reports/fees/transport/export',params,`transport_fees_${fromDate}_to_${toDate}`)
    }catch(e){setErr('Export failed')}
    setExporting(false)
  }

  return (
    <div>
      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body py-2">
          <div className="row g-2 align-items-end">
            <div className="col-md-2">
              <label className="form-label fw-medium small mb-1">From Date</label>
              <input type="date" className="form-control form-control-sm" value={fromDate} onChange={e=>setFromDate(e.target.value)} />
            </div>
            <div className="col-md-2">
              <label className="form-label fw-medium small mb-1">To Date</label>
              <input type="date" className="form-control form-control-sm" value={toDate} onChange={e=>setToDate(e.target.value)} />
            </div>
            <div className="col-md-3">
              <label className="form-label fw-medium small mb-1">Route</label>
              <select className="form-select form-select-sm" value={routeId} onChange={e=>setRouteId(e.target.value)}>
                <option value="">All Routes</option>
                {routes.map(r=><option key={r.id} value={r.id}>{r.route_no} — {r.name}</option>)}
              </select>
            </div>
            <div className="col-auto ms-auto">
              <ExportButtons onExport={exportFile} loading={exporting||loading} />
            </div>
          </div>
        </div>
      </div>

      <ErrBox msg={err} />
      {loading?<Spinner/>:!data?null:(
        <>
          <div className="row g-3 mb-3">
            <div className="col-md-4">
              <div className="card border-0 shadow-sm bg-info-subtle">
                <div className="card-body py-3">
                  <div className="text-muted small">Total Transport Collection</div>
                  <div className="fw-bold fs-4 text-primary">{fmt(data.total_collected)}</div>
                  <div className="text-muted small">{data.transaction_count} transactions</div>
                </div>
              </div>
            </div>
            <div className="col-md-8">
              <div className="card border-0 shadow-sm">
                <div className="card-body py-3">
                  <div className="text-muted small mb-2">By Route</div>
                  <div className="row">
                    {Object.entries(data.by_route||{}).map(([r,v])=>(
                      <div key={r} className="col-md-4 d-flex justify-content-between small mb-1">
                        <span>{r}</span><span className="fw-medium">{fmt(v)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="card border-0 shadow-sm">
            <div className="table-responsive">
              <table className="table table-sm table-hover align-middle mb-0">
                <thead className="table-light sticky-top">
                  <tr><th>Date</th><th>Receipt</th><th>Student</th><th>Class</th><th>Route</th><th>Stop</th><th>Method</th><th className="text-end">Amount</th></tr>
                </thead>
                <tbody>
                  {(data.transactions||[]).length===0?(
                    <tr><td colSpan={8} className="text-center text-muted py-4">No transport fee transactions in this period</td></tr>
                  ):(data.transactions||[]).map((t,i)=>(
                    <tr key={i}>
                      <td className="small">{t.date}</td>
                      <td><code className="small">{t.receipt_no}</code></td>
                      <td className="small">{t.student_name}</td>
                      <td className="small">{t.class}</td>
                      <td className="small">{t.route}</td>
                      <td className="small text-muted">{t.stop}</td>
                      <td className="small text-capitalize">{t.method}</td>
                      <td className="text-end small fw-medium">{fmt(t.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination pagination={data.pagination} onPageChange={p=>load(p)} />
          </div>
        </>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  3. OUTSTANDING FEES REPORT
// ─────────────────────────────────────────────────────────────
function OutstandingTab({ years, yearId, setYearId }) {
  const [grades,setGrades]=useState([])
  const [gradeId,setGradeId]=useState('')
  const [minAmount,setMinAmount]=useState(0)
  const [page,setPage]=useState(1)
  const [pageSize]=useState(10)
  const [data,setData]=useState(null)
  const [loading,setLoading]=useState(false)
  const [exporting,setExporting]=useState(false)
  const [err,setErr]=useState('')

  useEffect(()=>{ api.get('/master/grades').then(r=>setGrades(Array.isArray(r.data)?r.data:[])).catch(()=>{}) },[])

  const load=useCallback(async(p=1)=>{
    if(!yearId)return
    setLoading(true); setErr('')
    try{
      const params={academic_year_id:yearId,min_amount:minAmount,page:p,page_size:pageSize}
      if(gradeId)params.grade_id=gradeId
      const r=await api.get('/finance-reports/fees/outstanding',{params})
      setData(r.data); setPage(p)
    }catch(e){setErr(e.response?.data?.detail||'Failed to load')}
    setLoading(false)
  },[yearId,gradeId,minAmount,pageSize])

  useEffect(()=>{load(1)},[load])

  const exportFile=async(fmt)=>{
    setExporting(true)
    try{
      const params={fmt,academic_year_id:yearId,min_amount:minAmount}
      if(gradeId)params.grade_id=gradeId
      await downloadExport('/finance-reports/fees/outstanding/export',params,'outstanding_fees')
    }catch(e){setErr('Export failed')}
    setExporting(false)
  }

  return (
    <div>
      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body py-2">
          <div className="row g-2 align-items-end">
            <div className="col-md-3">
              <label className="form-label fw-medium small mb-1">Academic Year</label>
              <select className="form-select form-select-sm" value={yearId} onChange={e=>setYearId(e.target.value)}>
                {years.map(y=><option key={y.id} value={y.id}>{y.label}{y.is_current?' ★':''}</option>)}
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label fw-medium small mb-1">Class</label>
              <select className="form-select form-select-sm" value={gradeId} onChange={e=>setGradeId(e.target.value)}>
                <option value="">All Classes</option>
                {grades.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label fw-medium small mb-1">Min. Outstanding ₹</label>
              <input type="number" className="form-control form-control-sm" min="0" value={minAmount}
                onChange={e=>setMinAmount(parseFloat(e.target.value)||0)} />
            </div>
            <div className="col-auto ms-auto">
              <ExportButtons onExport={exportFile} loading={exporting||loading} />
            </div>
          </div>
        </div>
      </div>

      <ErrBox msg={err} />
      {loading?<Spinner/>:!data?null:(
        <>
          <div className="card border-0 shadow-sm bg-danger-subtle mb-3">
            <div className="card-body py-3 d-flex justify-content-between align-items-center">
              <div>
                <div className="text-muted small">Total Outstanding</div>
                <div className="fw-bold fs-4 text-danger">{fmt(data.total_outstanding)}</div>
              </div>
              <div className="text-end">
                <div className="text-muted small">Students with dues</div>
                <div className="fw-bold fs-4">{data.student_count}</div>
              </div>
            </div>
          </div>

          <div className="card border-0 shadow-sm">
            <div className="table-responsive">
              <table className="table table-sm table-hover align-middle mb-0">
                <thead className="table-light sticky-top">
                  <tr><th>Student</th><th>Admission No</th><th>Class</th><th>Invoices</th>
                    <th className="text-end">Billed</th><th className="text-end">Paid</th>
                    <th className="text-end">Outstanding</th><th>Due Date</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {data.students.length===0?(
                    <tr><td colSpan={9} className="text-center text-muted py-4">No outstanding dues 🎉</td></tr>
                  ):data.students.map((s,i)=>(
                    <tr key={i} className={s.status==='OVERDUE'?'table-danger':''}>
                      <td className="fw-medium small">{s.student_name}</td>
                      <td className="small text-muted">{s.admission_no}</td>
                      <td className="small">{s.class}</td>
                      <td><code className="small">{s.invoices}</code></td>
                      <td className="text-end small">{fmt(s.total_billed)}</td>
                      <td className="text-end small text-success">{fmt(s.total_paid)}</td>
                      <td className="text-end small fw-bold text-danger">{fmt(s.outstanding)}</td>
                      <td className="small">{s.due_date}</td>
                      <td>{s.status==='OVERDUE'?<span className="badge bg-danger small">Overdue</span>:<span className="badge bg-warning text-dark small">Pending</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination pagination={data.pagination} onPageChange={p=>load(p)} />
          </div>
        </>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  4. DAILY CASH BOOK
// ─────────────────────────────────────────────────────────────
function CashbookTab() {
  const [fromDate,setFromDate]=useState(monthStart())
  const [toDate,setToDate]=useState(today())
  const [page,setPage]=useState(1)
  const [pageSize]=useState(10)
  const [data,setData]=useState(null)
  const [loading,setLoading]=useState(false)
  const [exporting,setExporting]=useState(false)
  const [err,setErr]=useState('')

  const load=useCallback(async(p=1)=>{
    setLoading(true); setErr('')
    try{
      const r=await api.get('/finance-reports/fees/daily-cashbook',{params:{from_date:fromDate,to_date:toDate,page:p,page_size:pageSize}})
      setData(r.data); setPage(p)
    }catch(e){setErr(e.response?.data?.detail||'Failed to load')}
    setLoading(false)
  },[fromDate,toDate,pageSize])

  useEffect(()=>{load(1)},[load])

  const exportFile=async(fmt)=>{
    setExporting(true)
    try{
      await downloadExport('/finance-reports/fees/daily-cashbook/export',{fmt,from_date:fromDate,to_date:toDate},`daily_cashbook_${fromDate}_to_${toDate}`)
    }catch(e){setErr('Export failed')}
    setExporting(false)
  }

  return (
    <div>
      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body py-2">
          <div className="row g-2 align-items-end">
            <div className="col-md-2">
              <label className="form-label fw-medium small mb-1">From Date</label>
              <input type="date" className="form-control form-control-sm" value={fromDate} onChange={e=>setFromDate(e.target.value)} />
            </div>
            <div className="col-md-2">
              <label className="form-label fw-medium small mb-1">To Date</label>
              <input type="date" className="form-control form-control-sm" value={toDate} onChange={e=>setToDate(e.target.value)} />
            </div>
            <div className="col-auto ms-auto">
              <ExportButtons onExport={exportFile} loading={exporting||loading} />
            </div>
          </div>
        </div>
      </div>

      <ErrBox msg={err} />
      {loading?<Spinner/>:!data?null:(
        <>
          <div className="card border-0 shadow-sm bg-success-subtle mb-3">
            <div className="card-body py-3">
              <div className="text-muted small">Grand Total Collection</div>
              <div className="fw-bold fs-4 text-success">{fmt(data.grand_total)}</div>
            </div>
          </div>

          <div className="card border-0 shadow-sm">
            <div className="table-responsive">
              <table className="table table-sm table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr><th>Date</th><th className="text-end">Cash</th><th className="text-end">Card</th>
                    <th className="text-end">Online</th><th className="text-end">UPI</th><th className="text-end">Cheque</th>
                    <th className="text-center">Txns</th><th className="text-end">Total</th></tr>
                </thead>
                <tbody>
                  {data.days.length===0?(
                    <tr><td colSpan={8} className="text-center text-muted py-4">No transactions in this period</td></tr>
                  ):data.days.map((d,i)=>(
                    <tr key={i}>
                      <td className="small fw-medium">{d.date}</td>
                      <td className="text-end small">{d.cash>0?fmt(d.cash):'—'}</td>
                      <td className="text-end small">{d.card>0?fmt(d.card):'—'}</td>
                      <td className="text-end small">{d.online>0?fmt(d.online):'—'}</td>
                      <td className="text-end small">{d.upi>0?fmt(d.upi):'—'}</td>
                      <td className="text-end small">{d.cheque>0?fmt(d.cheque):'—'}</td>
                      <td className="text-center small">{d.txn_count}</td>
                      <td className="text-end fw-bold small">{fmt(d.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination pagination={data.pagination} onPageChange={p=>load(p)} />
          </div>
        </>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  5. STUDENT LEDGER
// ─────────────────────────────────────────────────────────────
function LedgerTab({ years, yearId, setYearId }) {
  const [search,setSearch]=useState('')
  const [results,setResults]=useState([])
  const [student,setStudent]=useState(null)
  const [page,setPage]=useState(1)
  const [pageSize]=useState(10)
  const [data,setData]=useState(null)
  const [loading,setLoading]=useState(false)
  const [exporting,setExporting]=useState(false)
  const [err,setErr]=useState('')

  const searchStudents=async(q)=>{
    setSearch(q)
    if(q.length<2){setResults([]);return}
    const r=await api.get('/students/',{params:{search:q,limit:10}}).then(r=>r.data).catch(()=>null)
    setResults(Array.isArray(r?.students)?r.students:[])
  }

  const selectStudent=async(s)=>{
    setStudent(s); setResults([]); setSearch(`${s.first_name} ${s.last_name||''}`)
    loadLedger(s.id, 1)
  }

  const loadLedger=async(sid, p=1)=>{
    setLoading(true); setErr('')
    try{
      const params={page:p,page_size:pageSize}
      if(yearId)params.academic_year_id=yearId
      const r=await api.get(`/finance-reports/fees/ledger/${sid}`,{params})
      setData(r.data); setPage(p)
    }catch(e){setErr(e.response?.data?.detail||'Failed to load')}
    setLoading(false)
  }

  const exportFile=async(fmt)=>{
    if(!student)return
    setExporting(true)
    try{
      const params={fmt}
      if(yearId)params.academic_year_id=yearId
      await downloadExport(`/finance-reports/fees/ledger/${student.id}/export`,params,`ledger_${student.admission_no}`)
    }catch(e){setErr('Export failed')}
    setExporting(false)
  }

  return (
    <div>
      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body py-2">
          <div className="row g-2 align-items-end">
            <div className="col-md-4 position-relative">
              <label className="form-label fw-medium small mb-1">Search Student</label>
              <input className="form-control form-control-sm" placeholder="Type name or admission no..."
                value={search} onChange={e=>searchStudents(e.target.value)} />
              {results.length>0&&(
                <div className="border rounded mt-1 bg-white shadow-sm position-absolute w-100" style={{zIndex:10,maxHeight:180,overflowY:'auto'}}>
                  {results.map(s=>(
                    <button key={s.id} type="button" className="w-100 text-start border-0 px-3 py-2 small bg-white"
                      onClick={()=>selectStudent(s)}>
                      {s.first_name} {s.last_name||''} <code style={{fontSize:10}}>{s.admission_no}</code>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="col-md-3">
              <label className="form-label fw-medium small mb-1">Academic Year</label>
              <select className="form-select form-select-sm" value={yearId} onChange={e=>setYearId(e.target.value)}>
                <option value="">All Years</option>
                {years.map(y=><option key={y.id} value={y.id}>{y.label}{y.is_current?' ★':''}</option>)}
              </select>
            </div>
            <div className="col-auto ms-auto">
              <ExportButtons onExport={exportFile} loading={exporting||loading||!student} />
            </div>
          </div>
        </div>
      </div>

      <ErrBox msg={err} />
      {loading?<Spinner/>:!data?(
        <div className="card border-0 shadow-sm">
          <div className="card-body text-center py-5 text-muted">
            <i className="bi bi-person-lines-fill fs-1 d-block mb-2 opacity-25"></i>
            <h6>Search and select a student to view their fee ledger</h6>
          </div>
        </div>
      ):(
        <>
          <div className="card border-0 shadow-sm mb-3">
            <div className="card-body py-3">
              <div className="row">
                <div className="col-md-4">
                  <div className="text-muted small">Student</div>
                  <div className="fw-bold">{data.student.name}</div>
                  <code className="small">{data.student.admission_no}</code> · {data.student.class}
                </div>
                <div className="col-md-2">
                  <div className="text-muted small">Total Billed</div>
                  <div className="fw-bold">{fmt(data.total_billed)}</div>
                </div>
                <div className="col-md-2">
                  <div className="text-muted small">Total Paid</div>
                  <div className="fw-bold text-success">{fmt(data.total_paid)}</div>
                </div>
                <div className="col-md-2">
                  <div className="text-muted small">Balance</div>
                  <div className={`fw-bold ${data.balance>0?'text-danger':'text-success'}`}>{fmt(data.balance)}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="card border-0 shadow-sm">
            <div className="table-responsive">
              <table className="table table-sm table-hover align-middle mb-0">
                <thead className="table-light sticky-top">
                  <tr><th>Date</th><th>Type</th><th>Reference</th><th>Description</th><th className="text-end">Debit</th><th className="text-end">Credit</th></tr>
                </thead>
                <tbody>
                  {data.entries.map((e,i)=>(
                    <tr key={i}>
                      <td className="small">{e.date}</td>
                      <td><span className={`badge small ${e.type==='Invoice'?'bg-warning text-dark':'bg-success'}`}>{e.type}</span></td>
                      <td><code className="small">{e.ref}</code></td>
                      <td className="small text-muted">{e.description}</td>
                      <td className="text-end small">{e.debit>0?fmt(e.debit):''}</td>
                      <td className="text-end small text-success">{e.credit>0?fmt(e.credit):''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination pagination={data.pagination} onPageChange={p=>loadLedger(student.id,p)} />
          </div>
        </>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  6. INCOME SUMMARY (pivot)
// ─────────────────────────────────────────────────────────────
function IncomeTab({ years, yearId, setYearId }) {
  const [data,setData]=useState(null)
  const [loading,setLoading]=useState(false)
  const [exporting,setExporting]=useState(false)
  const [err,setErr]=useState('')

  const load=useCallback(async()=>{
    if(!yearId)return
    setLoading(true); setErr('')
    try{
      const r=await api.get('/finance-reports/fees/income-summary',{params:{academic_year_id:yearId}})
      setData(r.data)
    }catch(e){setErr(e.response?.data?.detail||'Failed to load')}
    setLoading(false)
  },[yearId])

  useEffect(()=>{load()},[load])

  const exportFile=async(fmt)=>{
    setExporting(true)
    try{
      await downloadExport('/finance-reports/fees/income-summary/export',{fmt,academic_year_id:yearId},'income_summary')
    }catch(e){setErr('Export failed')}
    setExporting(false)
  }

  return (
    <div>
      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body py-2">
          <div className="row g-2 align-items-end">
            <div className="col-md-3">
              <label className="form-label fw-medium small mb-1">Academic Year</label>
              <select className="form-select form-select-sm" value={yearId} onChange={e=>setYearId(e.target.value)}>
                {years.map(y=><option key={y.id} value={y.id}>{y.label}{y.is_current?' ★':''}</option>)}
              </select>
            </div>
            <div className="col-auto ms-auto">
              <ExportButtons onExport={exportFile} loading={exporting||loading} />
            </div>
          </div>
        </div>
      </div>

      <ErrBox msg={err} />
      {loading?<Spinner/>:!data?null:(
        <>
          <div className="card border-0 shadow-sm bg-primary-subtle mb-3">
            <div className="card-body py-3">
              <div className="text-muted small">Grand Total Income</div>
              <div className="fw-bold fs-4 text-primary">{fmt(data.grand_total)}</div>
            </div>
          </div>

          <div className="card border-0 shadow-sm">
            <div className="table-responsive">
              <table className="table table-sm table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Month</th>
                    {data.categories.map(c=><th key={c} className="text-end">{c}</th>)}
                    <th className="text-end">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.months.length===0?(
                    <tr><td colSpan={data.categories.length+2} className="text-center text-muted py-4">No income data for this year</td></tr>
                  ):data.months.map((m,i)=>(
                    <tr key={i}>
                      <td className="fw-medium small">{m.month}</td>
                      {data.categories.map(c=><td key={c} className="text-end small">{m[c]>0?fmt(m[c]):'—'}</td>)}
                      <td className="text-end fw-bold small">{fmt(m.total)}</td>
                    </tr>
                  ))}
                </tbody>
                {data.months.length>0&&(
                  <tfoot className="table-light">
                    <tr>
                      <td className="fw-bold small">Grand Total</td>
                      {data.categories.map(c=>(
                        <td key={c} className="text-end fw-bold small">
                          {fmt(data.months.reduce((s,m)=>s+(m[c]||0),0))}
                        </td>
                      ))}
                      <td className="text-end fw-bold small">{fmt(data.grand_total)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
