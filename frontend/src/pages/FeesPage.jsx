// frontend/src/pages/FeesPage.jsx
import { useState, useEffect, useRef } from 'react'
import feesApi    from '../api/feesApi.js'
import studentsApi from '../api/studentsApi.js'

const today = () => new Date().toISOString().slice(0, 10)

// 30 days from today
const defaultDueDate = () => {
  const d = new Date()
  d.setDate(d.getDate() + 30)
  return d.toISOString().slice(0, 10)
}

const STATUS_BADGE = {
  draft:     'bg-secondary',
  sent:      'bg-info text-dark',
  partial:   'bg-warning text-dark',
  paid:      'bg-success',
  overdue:   'bg-danger',
  cancelled: 'bg-light text-muted border',
}

const METHOD_ICONS = {
  cash:          'bi-cash-coin',
  upi:           'bi-phone',
  bank_transfer: 'bi-bank',
  cheque:        'bi-file-earmark-text',
  dd:            'bi-file-earmark-ruled',
  online:        'bi-globe',
}

// ─────────────────────────────────────────────────────────────
export default function FeesPage() {
  const [tab, setTab] = useState('collect')

  return (
    <div>
      <div className="mb-4">
        <h4 className="fw-bold mb-0">Fee Management</h4>
        <small className="text-muted">Collect fees, manage invoices and track payments</small>
      </div>
      <ul className="nav nav-tabs mb-4">
        {[
          { key: 'collect',  icon: 'bi-cash-coin',      label: 'Collect Fees'     },
          { key: 'invoices', icon: 'bi-receipt',        label: 'All Invoices'     },
          { key: 'daily',    icon: 'bi-calendar-check', label: 'Daily Collection' },
        ].map(t => (
          <li key={t.key} className="nav-item">
            <button className={`nav-link ${tab === t.key ? 'active' : ''}`}
              onClick={() => setTab(t.key)}>
              <i className={`bi ${t.icon} me-2`}></i>{t.label}
            </button>
          </li>
        ))}
      </ul>
      {tab === 'collect'  && <CollectFeesTab />}
      {tab === 'invoices' && <AllInvoicesTab />}
      {tab === 'daily'    && <DailyCollectionTab />}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  TAB 1 — COLLECT FEES
// ─────────────────────────────────────────────────────────────
function CollectFeesTab() {
  const [search,      setSearch]      = useState('')
  const [students,    setStudents]    = useState([])
  const [searching,   setSearching]   = useState(false)
  const [selected,    setSelected]    = useState(null)
  const [studentData, setStudentData] = useState(null)
  const [loading,     setLoading]     = useState(false)
  const [payInvoice,  setPayInvoice]  = useState(null)
  const [receipt,     setReceipt]     = useState(null)
  const [showGenerate,setShowGenerate]= useState(false)
  const [error,       setError]       = useState('')
  const [schoolProfile,setSchoolProfile]= useState(null)

  useEffect(() => {
    fetch('/api/master/school-profile', {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    }).then(r => r.json()).then(d => { if (d.school_name) setSchoolProfile(d) }).catch(() => {})
  }, [])

  const handleSearch = async (e) => {
    e.preventDefault()
    if (!search.trim()) return
    setSearching(true); setError('')
    try {
      const result = await studentsApi.getStudents({ search: search.trim(), limit: 10 })
      setStudents(result.students || [])
      if (!result.students?.length) setError(`No students found for "${search}"`)
    } catch {
      setError('Search failed.')
    } finally {
      setSearching(false)
    }
  }

  const loadStudent = async (student) => {
    setSelected(student)
    setStudents([])
    setSearch('')
    setLoading(true); setError('')
    try {
      const data = await feesApi.getStudentInvoices(student.id)
      setStudentData(data)
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to load student fees')
    } finally {
      setLoading(false)
    }
  }

  const refreshStudent = async () => {
    if (!selected) return
    const data = await feesApi.getStudentInvoices(selected.id)
    setStudentData(data)
  }

  const handlePaymentDone = async (paymentResult) => {
    // Snapshot the invoice BEFORE refreshing so receipt always has data
    const invoiceSnapshot = studentData?.invoices?.find(i => i.id === paymentResult.invoice_id) || payInvoice
    setPayInvoice(null)
    setReceipt({ ...paymentResult, _invoiceSnapshot: invoiceSnapshot })
    // Refresh in background - don't await, don't block receipt modal
    refreshStudent().catch(() => {})
  }

  const handleInvoiceGenerated = async () => {
    setShowGenerate(false)
    await refreshStudent()
  }

  return (
    <div className="row g-3">
      {/* Search */}
      <div className="col-12">
        <div className="card border-0 shadow-sm">
          <div className="card-body">
            <form onSubmit={handleSearch}>
              <div className="row g-2 align-items-end">
                <div className="col-12 col-md-8">
                  <label className="form-label fw-medium small">Search Student</label>
                  <div className="input-group">
                    <span className="input-group-text bg-light">
                      <i className="bi bi-search text-muted"></i>
                    </span>
                    <input className="form-control"
                      placeholder="Search by name or admission number..."
                      value={search}
                      onChange={e => { setSearch(e.target.value); setError('') }} />
                    {search && (
                      <button type="button" className="btn btn-outline-secondary"
                        onClick={() => { setSearch(''); setStudents([]) }}>
                        <i className="bi bi-x"></i>
                      </button>
                    )}
                  </div>
                </div>
                <div className="col-md-2">
                  <button type="submit" className="btn btn-primary w-100" disabled={searching}>
                    {searching
                      ? <span className="spinner-border spinner-border-sm"></span>
                      : <><i className="bi bi-search me-1"></i>Search</>}
                  </button>
                </div>
                {selected && (
                  <div className="col-md-2">
                    <button type="button" className="btn btn-outline-secondary w-100"
                      onClick={() => { setSelected(null); setStudentData(null); setReceipt(null) }}>
                      <i className="bi bi-x-circle me-1"></i>Clear
                    </button>
                  </div>
                )}
              </div>
            </form>

            {students.length > 0 && (
              <div className="border rounded-3 mt-2 shadow-sm"
                style={{ maxHeight: 280, overflowY: 'auto' }}>
                {students.map(s => (
                  <button key={s.id}
                    className="w-100 text-start border-0 bg-white px-3 py-2 d-flex align-items-center gap-3"
                    style={{ borderBottom: '1px solid #f0f0f0' }}
                    onClick={() => loadStudent(s)}>
                    <StudentAvatar student={s} size={36} />
                    <div>
                      <div className="fw-medium">{s.first_name} {s.last_name || ''}</div>
                      <div className="text-muted small">
                        <code>{s.admission_no}</code>
                        {s.current_section && (
                          <span className="badge bg-light text-dark border ms-2">
                            {s.current_section}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {error && (
              <div className="alert alert-warning py-2 mt-2 mb-0 small">
                <i className="bi bi-exclamation-circle me-2"></i>{error}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Student fee profile */}
      {selected && (
        <div className="col-12">
          {loading ? (
            <div className="card border-0 shadow-sm">
              <div className="card-body text-center py-5">
                <div className="spinner-border text-primary"></div>
              </div>
            </div>
          ) : studentData ? (
            <>
              {/* Student header */}
              <div className="card border-0 shadow-sm mb-3">
                <div className="card-body">
                  <div className="row align-items-center g-3">
                    <div className="col-auto">
                      <StudentAvatar student={selected} size={56} />
                    </div>
                    <div className="col">
                      <h5 className="fw-bold mb-0">
                        {selected.first_name} {selected.last_name || ''}
                      </h5>
                      <div className="text-muted small">
                        <code>{selected.admission_no}</code>
                        {selected.current_section && (
                          <span className="badge bg-light text-dark border ms-2">
                            {selected.current_section}
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Balance cards */}
                    <div className="col-auto">
                      <div className="d-flex gap-3">
                        <div className="text-center px-3 py-2 bg-light rounded-3">
                          <div className="small text-muted">Total Billed</div>
                          <div className="fw-bold">₹{(studentData.total_billed || 0).toFixed(2)}</div>
                        </div>
                        <div className="text-center px-3 py-2 bg-success bg-opacity-10 rounded-3">
                          <div className="small text-success">Paid</div>
                          <div className="fw-bold text-success">₹{(studentData.total_paid || 0).toFixed(2)}</div>
                        </div>
                        <div className={`text-center px-3 py-2 rounded-3 ${
                          (studentData.total_balance || 0) > 0
                            ? 'bg-danger bg-opacity-10'
                            : 'bg-success bg-opacity-10'
                        }`}>
                          <div className={`small ${
                            (studentData.total_balance || 0) > 0 ? 'text-danger' : 'text-success'
                          }`}>
                            {(studentData.total_balance || 0) > 0 ? 'Balance Due' : 'Clear'}
                          </div>
                          <div className={`fw-bold ${
                            (studentData.total_balance || 0) > 0 ? 'text-danger' : 'text-success'
                          }`}>
                            ₹{Math.abs(studentData.total_balance || 0).toFixed(2)}
                          </div>
                        </div>
                        {/* Generate Invoice button — blocked if any unpaid invoice exists */}
                        <div className="d-flex align-items-center">
                          {(() => {
                            const hasOutstanding = studentData.invoices?.some(
                              inv => !['paid','cancelled'].includes(inv.status)
                            )
                            return hasOutstanding ? (
                              <div className="d-flex align-items-center gap-2">
                                <span className="badge bg-warning text-dark small">
                                  <i className="bi bi-exclamation-triangle-fill me-1"></i>
                                  Outstanding invoice exists
                                </span>
                                <button
                                  className="btn btn-outline-secondary btn-sm"
                                  disabled
                                  title="Collect payment or cancel the existing invoice before generating a new one">
                                  <i className="bi bi-lock me-1"></i>
                                  Generate Invoice
                                </button>
                              </div>
                            ) : (
                              <button className="btn btn-outline-primary btn-sm"
                                onClick={() => setShowGenerate(true)}>
                                <i className="bi bi-plus-circle me-1"></i>
                                Generate Invoice
                              </button>
                            )
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Invoices */}
              {studentData.invoices?.length === 0 ? (
                <div className="card border-0 shadow-sm">
                  <div className="card-body text-center py-5 text-muted">
                    <i className="bi bi-receipt fs-1 d-block mb-3 opacity-25"></i>
                    <h6>No invoices found</h6>
                    <p className="small text-muted mb-3">
                      No fee invoices have been generated for this student.
                    </p>
                    {/* Prominent generate button when no invoices */}
                    <button className="btn btn-primary"
                      onClick={() => setShowGenerate(true)}>
                      <i className="bi bi-plus-circle me-2"></i>
                      Generate Fee Invoice
                    </button>
                    <div className="mt-3 small text-muted">
                      Make sure fee structures are set in
                      <strong> Settings → Fee Structures</strong> first.
                    </div>
                  </div>
                </div>
              ) : (
                <div className="d-flex flex-column gap-3">
                  {studentData.invoices.map(inv => (
                    <InvoiceCard
                      key={inv.id}
                      invoice={inv}
                      onPay={() => setPayInvoice(inv)}
                    />
                  ))}
                </div>
              )}
            </>
          ) : null}
        </div>
      )}

      {/* Empty state */}
      {!selected && !loading && (
        <div className="col-12">
          <div className="card border-0 shadow-sm">
            <div className="card-body text-center py-5 text-muted">
              <i className="bi bi-person-circle fs-1 d-block mb-3 opacity-25"></i>
              <h6>Search for a student to collect fees</h6>
              <small>Enter the student's name or admission number above</small>
            </div>
          </div>
        </div>
      )}

      {/* Generate Invoice Modal */}
      {showGenerate && selected && (
        <GenerateInvoiceModal
          student={selected}
          onSuccess={handleInvoiceGenerated}
          onClose={() => setShowGenerate(false)}
        />
      )}

      {/* Payment Modal */}
      {payInvoice && (
        <PaymentModal
          invoice={payInvoice}
          onSuccess={handlePaymentDone}
          onClose={() => setPayInvoice(null)}
        />
      )}

      {/* Receipt Modal */}
      {receipt && (
        <ReceiptModal
          receipt={receipt}
          student={selected}
          invoice={receipt._invoiceSnapshot || studentData?.invoices?.find(i => i.id === receipt.invoice_id)}
          schoolProfile={schoolProfile}
          onClose={() => setReceipt(null)}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  GENERATE INVOICE MODAL
// ─────────────────────────────────────────────────────────────
function GenerateInvoiceModal({ student, onSuccess, onClose }) {
  const [years,       setYears]       = useState([])
  const [grades,      setGrades]      = useState([])
  const [form,        setForm]        = useState({
    academic_year_id: '',
    grade_id:         '',
    due_date:         defaultDueDate(),
  })
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')
  const [preview,  setPreview]  = useState(null)  // structure preview
  const [transportPreview, setTransportPreview] = useState(null) // auto transport fee line

  useEffect(() => {
    Promise.all([
      fetch('/api/master/academic-years', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      }).then(r => r.json()),
      fetch('/api/students/grades/all', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      }).then(r => r.json()),
    ]).then(([y, g]) => {
      const ys = Array.isArray(y) ? y : []
      const gs = Array.isArray(g) ? g : []
      setYears(ys)
      setGrades(gs)

      // Auto-fill from student's current enrollment
      const cur = ys.find(x => x.is_current)
      if (cur) setForm(f => ({ ...f, academic_year_id: cur.id }))

      // Try to detect student's grade from current_section
      if (student.current_section) {
        const gradePart = student.current_section.split(' - ')[0]
        const match = gs.find(g => g.name === gradePart)
        if (match) setForm(f => ({ ...f, grade_id: match.id }))
      }
      setLoading(false)
    })
  }, [])

  // Preview fee structure when grade + year selected
  useEffect(() => {
    if (!form.grade_id || !form.academic_year_id) { setPreview(null); return }
    fetch(`/api/fees/structures?academic_year_id=${form.academic_year_id}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    }).then(r => r.json()).then(data => {
      if (Array.isArray(data)) {
        const applicable = data.filter(s =>
          s.grade_id === form.grade_id || s.grade_id === null
        )
        setPreview(applicable)
      }
    }).catch(() => setPreview([]))
  }, [form.grade_id, form.academic_year_id])

  // Preview auto-added Transport Fee (from student's route/stop assignment)
  useEffect(() => {
    if (!form.academic_year_id || !student?.id) { setTransportPreview(null); return }
    fetch(`/api/fees/transport-preview/${student.id}?academic_year_id=${form.academic_year_id}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    }).then(r => r.json()).then(data => {
      setTransportPreview(data && data.amount ? data : null)
    }).catch(() => setTransportPreview(null))
  }, [form.academic_year_id, student?.id])

  // Skip transport preview if a manual "Transport" structure already covers it
  const structureHasTransport = preview?.some(s =>
    (s.category_name || '').toLowerCase().includes('transport')
  )
  const showTransportPreview = transportPreview && !structureHasTransport

  const structureTotal = preview?.reduce((sum, s) => sum + parseFloat(s.amount || 0), 0) || 0
  const total = structureTotal + (showTransportPreview ? parseFloat(transportPreview.amount || 0) : 0)

  const handleGenerate = async (e) => {
    e.preventDefault()
    if (!form.grade_id)         { setError('Select a grade'); return }
    if (!form.academic_year_id) { setError('Select an academic year'); return }
    if (!preview?.length && !showTransportPreview) {
      setError('No fee structures found for this grade and year. Go to Settings → Fee Structures first.')
      return
    }

    setSaving(true); setError('')
    try {
      await feesApi.generateInvoice({
        student_id:       student.id,
        grade_id:         form.grade_id,
        academic_year_id: form.academic_year_id,
        due_date:         form.due_date,
      })
      onSuccess()
    } catch (e) {
      const msg = e.response?.data?.detail
      const status = e.response?.status
      if (status === 409) {
        // Duplicate invoice — surface a clear, actionable message
        setError(`⚠️ ${typeof msg === 'string' ? msg : 'An outstanding invoice already exists for this student. Collect payment or cancel it first.'}`)
      } else {
        setError(typeof msg === 'string' ? msg : 'Failed to generate invoice. Check fee structures in Settings.')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal show d-block" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: 520 }}>
        <div className="modal-content border-0 shadow">

          <div className="modal-header border-0 pb-0">
            <h5 className="modal-title fw-bold">
              <i className="bi bi-plus-circle me-2 text-primary"></i>
              Generate Fee Invoice
            </h5>
            <button className="btn-close" onClick={onClose} disabled={saving}></button>
          </div>

          <div className="modal-body">
            {/* Student strip */}
            <div className="d-flex align-items-center gap-3 p-3 bg-light rounded-3 mb-4">
              <StudentAvatar student={student} size={44} />
              <div>
                <div className="fw-semibold">
                  {student.first_name} {student.last_name || ''}
                </div>
                <code className="small text-muted">{student.admission_no}</code>
                {student.current_section && (
                  <span className="badge bg-light text-dark border ms-2 small">
                    {student.current_section}
                  </span>
                )}
              </div>
            </div>

            {loading ? (
              <div className="text-center py-3">
                <div className="spinner-border spinner-border-sm text-primary"></div>
                <div className="text-muted small mt-2">Loading...</div>
              </div>
            ) : (
              <form onSubmit={handleGenerate}>
                <div className="row g-3">
                  {/* Academic Year */}
                  <div className="col-md-6">
                    <label className="form-label fw-medium small">
                      Academic Year <span className="text-danger">*</span>
                    </label>
                    <select className="form-select"
                      value={form.academic_year_id} required
                      onChange={e => setForm(f => ({ ...f, academic_year_id: e.target.value }))}>
                      <option value="">Select year</option>
                      {years.map(y => (
                        <option key={y.id} value={y.id}>
                          {y.label}{y.is_current ? ' ★ Current' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Grade */}
                  <div className="col-md-6">
                    <label className="form-label fw-medium small">
                      Grade / Class <span className="text-danger">*</span>
                    </label>
                    <select className="form-select"
                      value={form.grade_id} required
                      onChange={e => setForm(f => ({ ...f, grade_id: e.target.value }))}>
                      <option value="">Select grade</option>
                      {grades.map(g => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                    {student.current_section && (
                      <div className="form-text">
                        Auto-detected from enrollment: {student.current_section}
                      </div>
                    )}
                  </div>

                  {/* Due Date */}
                  <div className="col-12">
                    <label className="form-label fw-medium small">Due Date</label>
                    <input type="date" className="form-control"
                      value={form.due_date}
                      min={today()}
                      onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
                  </div>

                  {/* Fee structure preview */}
                  {preview !== null && (
                    <div className="col-12">
                      <div className="fw-medium small text-muted mb-2">
                        <i className="bi bi-eye me-1"></i>
                        Invoice preview — fee structure for this grade
                      </div>

                      {preview.length === 0 && !showTransportPreview ? (
                        <div className="alert alert-warning py-2 mb-0 small">
                          <i className="bi bi-exclamation-triangle-fill me-2"></i>
                          No fee structures found for this grade and year.
                          Go to <strong>Settings → Fee Structures</strong> to add them.
                        </div>
                      ) : preview.length === 0 && showTransportPreview ? (
                        <div className="border rounded-3 overflow-hidden">
                          <table className="table table-sm mb-0">
                            <thead className="table-light">
                              <tr>
                                <th>Fee Type</th>
                                <th>Applies to</th>
                                <th className="text-end">Amount</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr className="table-info">
                                <td><i className="bi bi-bus-front me-1 text-primary"></i>Transport Fee</td>
                                <td>
                                  <span className="badge bg-primary-subtle text-primary border border-primary-subtle small">
                                    Auto — Route Assignment
                                  </span>
                                  <div className="text-muted small mt-1" style={{fontSize:11}}>
                                    {transportPreview.description}
                                  </div>
                                </td>
                                <td className="text-end fw-medium text-success">
                                  ₹{parseFloat(transportPreview.amount || 0).toLocaleString('en-IN')}
                                </td>
                              </tr>
                            </tbody>
                            <tfoot className="table-light">
                              <tr>
                                <td colSpan="2" className="fw-bold">Total Invoice Amount</td>
                                <td className="text-end fw-bold text-primary">
                                  ₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      ) : (
                        <div className="border rounded-3 overflow-hidden">
                          <table className="table table-sm mb-0">
                            <thead className="table-light">
                              <tr>
                                <th>Fee Type</th>
                                <th>Applies to</th>
                                <th className="text-end">Amount</th>
                              </tr>
                            </thead>
                            <tbody>
                              {preview.map((s, i) => (
                                <tr key={i}>
                                  <td>{s.category_name || s.fee_category_id}</td>
                                  <td>
                                    <span className="badge bg-light text-dark border small">
                                      {s.grade_id ? grades.find(g => g.id === s.grade_id)?.name || 'Class' : 'All Classes'}
                                    </span>
                                  </td>
                                  <td className="text-end fw-medium text-success">
                                    ₹{parseFloat(s.amount || 0).toLocaleString('en-IN')}
                                  </td>
                                </tr>
                              ))}
                              {showTransportPreview && (
                                <tr className="table-info">
                                  <td>
                                    <i className="bi bi-bus-front me-1 text-primary"></i>
                                    Transport Fee
                                  </td>
                                  <td>
                                    <span className="badge bg-primary-subtle text-primary border border-primary-subtle small">
                                      Auto — Route Assignment
                                    </span>
                                    <div className="text-muted small mt-1" style={{fontSize:11}}>
                                      {transportPreview.description}
                                    </div>
                                  </td>
                                  <td className="text-end fw-medium text-success">
                                    ₹{parseFloat(transportPreview.amount || 0).toLocaleString('en-IN')}
                                  </td>
                                </tr>
                              )}
                            </tbody>
                            <tfoot className="table-light">
                              <tr>
                                <td colSpan="2" className="fw-bold">Total Invoice Amount</td>
                                <td className="text-end fw-bold text-primary">
                                  ₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      )}

                      {!showTransportPreview && !structureHasTransport && (
                        <div className="text-muted small mt-2">
                          <i className="bi bi-info-circle me-1"></i>
                          No transport assigned for this student —
                          assign a route in <strong>Transport → Student Assignments</strong> if applicable.
                        </div>
                      )}
                    </div>
                  )}

                  {error && (
                    <div className="col-12">
                      <div className="alert alert-danger py-2 mb-0 small">
                        <i className="bi bi-exclamation-triangle-fill me-2"></i>{error}
                      </div>
                    </div>
                  )}
                </div>
              </form>
            )}
          </div>

          <div className="modal-footer border-0 pt-0">
            <button className="btn btn-light" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={handleGenerate}
              disabled={saving || loading || !form.grade_id || !form.academic_year_id || preview?.length === 0}>
              {saving
                ? <><span className="spinner-border spinner-border-sm me-2"></span>Generating...</>
                : <><i className="bi bi-receipt me-2"></i>Generate Invoice — ₹{total.toLocaleString('en-IN')}</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  INVOICE CARD
// ─────────────────────────────────────────────────────────────
function InvoiceCard({ invoice, onPay }) {
  const [expanded, setExpanded] = useState(false)
  const isPayable = ['sent', 'partial', 'overdue'].includes(invoice.status)
  const pctPaid   = invoice.total_amount > 0
    ? (invoice.paid_amount / invoice.total_amount) * 100 : 0

  return (
    <div className="card border-0 shadow-sm">
      <div className="card-body">
        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
          <div>
            <div className="d-flex align-items-center gap-2 mb-1">
              <code className="fw-bold">{invoice.invoice_no}</code>
              <span className={`badge ${STATUS_BADGE[invoice.status] || 'bg-secondary'}`}>
                {invoice.status}
              </span>
            </div>
            <div className="small text-muted">
              <i className="bi bi-calendar3 me-1"></i>Issued: {invoice.issue_date}
              <span className="mx-2">·</span>
              <i className="bi bi-clock me-1"></i>Due:
              <span className={invoice.status === 'overdue' ? 'text-danger fw-medium ms-1' : 'ms-1'}>
                {invoice.due_date}
              </span>
            </div>
          </div>

          <div className="d-flex align-items-center gap-3 flex-wrap">
            <div className="text-end">
              <div className="small text-muted">Total</div>
              <div className="fw-bold">₹{(invoice.total_amount || 0).toFixed(2)}</div>
            </div>
            <div className="text-end">
              <div className="small text-success">Paid</div>
              <div className="fw-bold text-success">₹{(invoice.paid_amount || 0).toFixed(2)}</div>
            </div>
            <div className="text-end">
              <div className="small text-danger">Balance</div>
              <div className="fw-bold text-danger">₹{(invoice.balance || 0).toFixed(2)}</div>
            </div>
            <div className="d-flex gap-2">
              <button className="btn btn-outline-secondary btn-sm"
                onClick={() => setExpanded(e => !e)}>
                <i className={`bi ${expanded ? 'bi-chevron-up' : 'bi-chevron-down'}`}></i>
              </button>
              {isPayable && (
                <button className="btn btn-success btn-sm" onClick={onPay}>
                  <i className="bi bi-cash-coin me-1"></i>Collect Payment
                </button>
              )}
              {invoice.status === 'paid' && (
                <span className="btn btn-success btn-sm disabled">
                  <i className="bi bi-check-circle me-1"></i>Paid
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Progress bar */}
        {invoice.total_amount > 0 && (
          <div className="mt-3">
            <div className="progress" style={{ height: 6 }}>
              <div
                className={`progress-bar ${invoice.status === 'paid' ? 'bg-success' : 'bg-primary'}`}
                style={{ width: `${Math.min(pctPaid, 100)}%` }}>
              </div>
            </div>
            <div className="d-flex justify-content-between mt-1">
              <small className="text-muted">{pctPaid.toFixed(0)}% paid</small>
              <small className="text-muted">₹{(invoice.balance || 0).toFixed(2)} remaining</small>
            </div>
          </div>
        )}

        {/* Expanded details */}
        {expanded && (
          <div className="mt-3 pt-3 border-top">
            <div className="row g-3">
              <div className="col-md-6">
                <div className="fw-medium small mb-2 text-muted">
                  <i className="bi bi-list-ul me-1"></i>Line Items
                </div>
                {invoice.items?.map((item, i) => (
                  <div key={i} className="d-flex justify-content-between py-1 border-bottom small">
                    <span>{item.description}</span>
                    <span className="fw-medium">₹{(item.amount || 0).toFixed(2)}</span>
                  </div>
                ))}
                {invoice.discount_amount > 0 && (
                  <div className="d-flex justify-content-between py-1 text-success small">
                    <span>Discount</span>
                    <span>- ₹{(invoice.discount_amount || 0).toFixed(2)}</span>
                  </div>
                )}
                <div className="d-flex justify-content-between py-1 fw-bold">
                  <span>Total</span>
                  <span>₹{(invoice.total_amount || 0).toFixed(2)}</span>
                </div>
              </div>
              <div className="col-md-6">
                <div className="fw-medium small mb-2 text-muted">
                  <i className="bi bi-clock-history me-1"></i>Payment History
                </div>
                {!invoice.payments?.length ? (
                  <div className="text-muted small">No payments yet</div>
                ) : (
                  invoice.payments?.map(p => (
                    <div key={p.id}
                      className="d-flex align-items-center justify-content-between py-1 border-bottom small">
                      <div>
                        <i className={`bi ${METHOD_ICONS[p.method] || 'bi-cash'} me-1 text-muted`}></i>
                        <code className="text-success">{p.receipt_no}</code>
                        <span className="text-muted ms-2">{p.payment_date}</span>
                      </div>
                      <span className="fw-medium text-success">₹{(p.amount || 0).toFixed(2)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  PAYMENT MODAL
// ─────────────────────────────────────────────────────────────
function PaymentModal({ invoice, onSuccess, onClose }) {
  const [form, setForm] = useState({
    amount:       (invoice.balance || 0).toFixed(2),
    method:       'cash',
    payment_date: today(),
    reference_no: '',
    remarks:      '',
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  const set = (f, v) => setForm(p => ({ ...p, [f]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    const amt = parseFloat(form.amount)
    if (!amt || amt <= 0)              { setError('Enter a valid amount'); return }
    if (amt > invoice.balance + 0.01)  { setError(`Max payable: ₹${(invoice.balance || 0).toFixed(2)}`); return }
    setSaving(true); setError('')
    try {
      const result = await feesApi.recordPayment({
        invoice_id:   invoice.id,
        amount:       amt,
        method:       form.method,
        payment_date: form.payment_date,
        reference_no: form.reference_no || null,
        remarks:      form.remarks      || null,
      })
      onSuccess({ ...result, invoice_id: invoice.id })
    } catch (e) {
      const msg = e.response?.data?.detail
      setError(typeof msg === 'string' ? msg : 'Payment failed. Try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal show d-block" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: 480 }}>
        <div className="modal-content border-0 shadow">
          <div className="modal-header border-0 pb-0">
            <h5 className="modal-title fw-bold">
              <i className="bi bi-cash-coin me-2 text-success"></i>Collect Payment
            </h5>
            <button className="btn-close" onClick={onClose} disabled={saving}></button>
          </div>
          <div className="modal-body">
            {/* Invoice summary */}
            <div className="p-3 bg-light rounded-3 mb-4">
              <div className="d-flex justify-content-between mb-1">
                <span className="text-muted small">Invoice</span>
                <code className="fw-bold">{invoice.invoice_no}</code>
              </div>
              <div className="d-flex justify-content-between mb-1">
                <span className="text-muted small">Total Amount</span>
                <span className="fw-medium">₹{(invoice.total_amount || 0).toFixed(2)}</span>
              </div>
              {invoice.paid_amount > 0 && (
                <div className="d-flex justify-content-between mb-1">
                  <span className="text-muted small">Already Paid</span>
                  <span className="text-success fw-medium">₹{(invoice.paid_amount || 0).toFixed(2)}</span>
                </div>
              )}
              <div className="d-flex justify-content-between border-top pt-2 mt-1">
                <span className="fw-semibold text-danger">Balance Due</span>
                <span className="fw-bold text-danger fs-5">₹{(invoice.balance || 0).toFixed(2)}</span>
              </div>
            </div>

            <div className="row g-3">
              {/* Amount */}
              <div className="col-12">
                <label className="form-label fw-medium small">
                  Payment Amount <span className="text-danger">*</span>
                </label>
                <div className="input-group input-group-lg">
                  <span className="input-group-text fw-bold">₹</span>
                  <input type="number" className="form-control form-control-lg fw-bold"
                    value={form.amount} min="1" max={invoice.balance} step="0.01" required
                    onChange={e => set('amount', e.target.value)} />
                </div>
                <div className="d-flex gap-2 mt-1">
                  <button type="button" className="btn btn-outline-secondary btn-sm"
                    onClick={() => set('amount', (invoice.balance || 0).toFixed(2))}>
                    Full Amount
                  </button>
                  {invoice.balance > 500 && (
                    <button type="button" className="btn btn-outline-secondary btn-sm"
                      onClick={() => set('amount', Math.round((invoice.balance || 0) / 2).toString())}>
                      Half
                    </button>
                  )}
                </div>
              </div>

              {/* Payment Method */}
              <div className="col-12">
                <label className="form-label fw-medium small">Payment Method</label>
                <div className="d-flex gap-2 flex-wrap">
                  {[
                    { key: 'cash',          label: 'Cash',   icon: 'bi-cash-coin'         },
                    { key: 'upi',           label: 'UPI',    icon: 'bi-phone'             },
                    { key: 'bank_transfer', label: 'Bank',   icon: 'bi-bank'              },
                    { key: 'cheque',        label: 'Cheque', icon: 'bi-file-earmark-text' },
                    { key: 'online',        label: 'Online', icon: 'bi-globe'             },
                  ].map(m => (
                    <button key={m.key} type="button"
                      className={`btn btn-sm ${form.method === m.key ? 'btn-primary' : 'btn-outline-secondary'}`}
                      onClick={() => set('method', m.key)}>
                      <i className={`bi ${m.icon} me-1`}></i>{m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date + Reference */}
              <div className="col-md-6">
                <label className="form-label fw-medium small">Payment Date</label>
                <input type="date" className="form-control"
                  value={form.payment_date} max={today()}
                  onChange={e => set('payment_date', e.target.value)} />
              </div>
              <div className="col-md-6">
                <label className="form-label fw-medium small">
                  {form.method === 'upi'    ? 'UPI Transaction ID' :
                   form.method === 'cheque' ? 'Cheque Number' :
                   form.method === 'bank_transfer' ? 'UTR Number' : 'Reference No'}
                </label>
                <input className="form-control"
                  placeholder={form.method === 'cash' ? 'Optional' : 'Enter reference'}
                  value={form.reference_no}
                  onChange={e => set('reference_no', e.target.value)} />
              </div>

              {/* Remarks */}
              <div className="col-12">
                <label className="form-label fw-medium small">Remarks (optional)</label>
                <input className="form-control" placeholder="Any notes..."
                  value={form.remarks}
                  onChange={e => set('remarks', e.target.value)} />
              </div>

              {error && (
                <div className="col-12">
                  <div className="alert alert-danger py-2 mb-0 small">
                    <i className="bi bi-exclamation-triangle-fill me-2"></i>{error}
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="modal-footer border-0 pt-0">
            <button className="btn btn-light" onClick={onClose} disabled={saving}>Cancel</button>
            <button className="btn btn-success px-4" onClick={handleSubmit} disabled={saving}>
              {saving
                ? <><span className="spinner-border spinner-border-sm me-2"></span>Processing...</>
                : <><i className="bi bi-check-circle me-2"></i>Confirm Payment</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  RECEIPT MODAL
// ─────────────────────────────────────────────────────────────
function ReceiptModal({ receipt, student, invoice, schoolProfile, onClose }) {
  const school     = schoolProfile || {}
  const schoolName = school.school_name || 'School Management System'
  const phone      = school.phone       || ''
  const email      = school.email       || ''
  const board      = school.board       || ''
  const address    = school.address     || {}

  const paidAmt    = parseFloat(receipt?.amount       || 0)
  const totalAmt   = parseFloat(invoice?.total_amount  || paidAmt)
  const prevPaid   = parseFloat(invoice?.paid_amount   || 0)
  const newBalance = Math.max(0, totalAmt - prevPaid - paidAmt)

  const METHOD_LABEL = {
    cash: 'Cash', upi: 'UPI / QR', bank_transfer: 'Bank Transfer',
    cheque: 'Cheque', dd: 'Demand Draft', online: 'Online',
  }

  const fmt = (n) => parseFloat(n || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2, maximumFractionDigits: 2
  })

  const fmtDate = (d) => {
    if (!d) return '—'
    try {
      return new Date(d).toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric'
      })
    } catch { return d }
  }

  const addrLine = [address.street, address.city, address.state, address.pin]
    .filter(Boolean).join(', ')

  const handlePrint = () => {
    const el  = document.getElementById('sms-receipt-content')
    if (!el) return
    const html = el.innerHTML
    const win  = window.open('', '_blank', 'width=740,height=960')
    if (!win) {
      alert('Pop-up blocked. Please allow pop-ups for this site and try again.')
      return
    }
    win.document.write(`<!DOCTYPE html><html><head>
      <title>Receipt ${receipt?.receipt_no || ''}</title>
      <meta charset="utf-8">
      <style>
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#1a1a1a;background:#fff}
        @media print{
          body{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
          @page{margin:8mm;size:A4 portrait}
        }
      </style>
    </head><body>${html}<script>
      window.onload = function(){ setTimeout(function(){ window.print() }, 300) }
    <\/script></body></html>`)
    win.document.close()
  }

  return (
    <div className="modal show d-block" style={{ background: 'rgba(0,0,0,0.65)', zIndex: 1055 }}>
      <div className="modal-dialog modal-dialog-centered modal-lg" style={{ maxWidth: 700 }}>
        <div className="modal-content border-0 shadow-lg">

          {/* Modal header */}
          <div className="modal-header border-0 py-3" style={{ background: '#1e3a5f' }}>
            <h5 className="modal-title fw-bold text-white">
              <i className="bi bi-check-circle-fill me-2"></i>
              Payment Confirmed — {receipt?.receipt_no}
            </h5>
            <button className="btn-close btn-close-white" onClick={onClose}></button>
          </div>

          {/* Scrollable receipt preview */}
          <div className="modal-body p-0" style={{ maxHeight: '72vh', overflowY: 'auto', background: '#f1f5f9' }}>
            <div style={{ padding: 16 }}>
              <div id="sms-receipt-content"
                style={{ fontFamily: 'Arial,sans-serif', fontSize: 13, color: '#1a1a1a', background: '#fff', border: '0.5px solid #e2e8f0', borderRadius: 6, overflow: 'hidden' }}>

                {/* ── HEADER ─────────────────────────────────── */}
                <div style={{ background: '#1e3a5f', color: '#fff', padding: '18px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{schoolName}</div>
                    {board    && <div style={{ fontSize: 11, opacity: 0.75, marginBottom: 2 }}>{board}</div>}
                    {addrLine && <div style={{ fontSize: 11, opacity: 0.75, marginBottom: 2 }}>{addrLine}</div>}
                    {phone    && <div style={{ fontSize: 11, opacity: 0.75, marginBottom: 2 }}>Tel: {phone}</div>}
                    {email    && <div style={{ fontSize: 11, opacity: 0.75 }}>{email}</div>}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 16 }}>
                    <div style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 6, padding: '6px 14px', marginBottom: 6 }}>
                      <div style={{ fontSize: 10, opacity: 0.8, textTransform: 'uppercase', letterSpacing: 1 }}>Fee Receipt</div>
                      <div style={{ fontSize: 16, fontWeight: 700 }}>{receipt?.receipt_no}</div>
                    </div>
                    <div style={{ fontSize: 11, opacity: 0.75 }}>{fmtDate(receipt?.payment_date)}</div>
                  </div>
                </div>

                {/* Accent bar */}
                <div style={{ height: 4, background: 'linear-gradient(90deg,#1e3a5f 0%,#2e7d8c 50%,#22c55e 100%)' }} />

                {/* ── STUDENT + INVOICE INFO ───────────────── */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: '#e5e7eb' }}>
                  <div style={{ background: '#f8fafc', padding: '13px 18px' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>Student Details</div>
                    <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>
                      {student?.first_name} {student?.last_name || ''}
                    </div>
                    <RRow label="Admission No" value={student?.admission_no} />
                    {student?.current_section && <RRow label="Class" value={student.current_section} />}
                  </div>
                  <div style={{ background: '#f8fafc', padding: '13px 18px' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>Invoice Details</div>
                    <RRow label="Invoice No"  value={invoice?.invoice_no || '—'} />
                    <RRow label="Issue Date"  value={fmtDate(invoice?.issue_date)} />
                    <RRow label="Due Date"    value={fmtDate(invoice?.due_date)} />
                    <RRow label="Status" value={
                      <span style={{ background: newBalance <= 0 ? '#dcfce7' : '#fef9c3', color: newBalance <= 0 ? '#15803d' : '#854d0e', padding: '1px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
                        {newBalance <= 0 ? 'PAID' : 'PARTIAL'}
                      </span>
                    } />
                  </div>
                </div>

                {/* ── LINE ITEMS ───────────────────────────── */}
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#1e3a5f', color: '#fff' }}>
                      <th style={{ padding: '8px 18px', textAlign: 'left', fontSize: 11, fontWeight: 600, letterSpacing: 0.5, width: 36 }}>#</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 11, fontWeight: 600, letterSpacing: 0.5 }}>Fee Description</th>
                      <th style={{ padding: '8px 18px', textAlign: 'right', fontSize: 11, fontWeight: 600, letterSpacing: 0.5 }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice?.items?.length > 0 ? (
                      invoice.items.map((item, i) => (
                        <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                          <td style={{ padding: '8px 18px', color: '#94a3b8', fontSize: 12 }}>{i + 1}</td>
                          <td style={{ padding: '8px 10px', fontSize: 13 }}>{item.description}</td>
                          <td style={{ padding: '8px 18px', textAlign: 'right', fontSize: 13, fontWeight: 500 }}>₹{fmt(item.amount)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr style={{ background: '#fff' }}>
                        <td style={{ padding: '8px 18px', color: '#94a3b8', fontSize: 12 }}></td>
                        <td style={{ padding: '8px 10px', fontSize: 13 }}>Fee Payment</td>
                        <td style={{ padding: '8px 18px', textAlign: 'right', fontSize: 13, fontWeight: 500 }}>₹{fmt(paidAmt)}</td>
                      </tr>
                    )}
                  </tbody>
                </table>

                {/* ── TOTALS ──────────────────────────────── */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #e5e7eb' }}>
                  <div style={{ width: 240, padding: '12px 18px' }}>
                    <TRow label="Total Amount"  value={`₹${fmt(totalAmt)}`} />
                    {prevPaid > 0.01 && <TRow label="Previously Paid" value={`₹${fmt(prevPaid)}`} color="#16a34a" />}
                  </div>
                </div>

                {/* ── PAYMENT BOX ──────────────────────────── */}
                <div style={{ margin: '0 16px 14px', background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: 8, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 10, color: '#16a34a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>Amount Received</div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: '#15803d' }}>₹{fmt(paidAmt)}</div>
                    <div style={{ fontSize: 12, color: '#166534', marginTop: 3 }}>
                      via {METHOD_LABEL[receipt?.method] || receipt?.method || 'Cash'}
                      {receipt?.reference_no && <span style={{ color: '#64748b', marginLeft: 6 }}>· Ref: {receipt.reference_no}</span>}
                    </div>
                  </div>
                  {newBalance <= 0.01 ? (
                    <div style={{ background: '#dcfce7', color: '#15803d', border: '1.5px solid #86efac', borderRadius: 6, padding: '10px 16px', fontWeight: 700, fontSize: 14, textAlign: 'center', flexShrink: 0 }}>
                      ✓ FULLY PAID<br />
                      <span style={{ fontSize: 11, fontWeight: 400 }}>No balance due</span>
                    </div>
                  ) : (
                    <div style={{ background: '#fef2f2', color: '#dc2626', border: '1.5px solid #fca5a5', borderRadius: 6, padding: '10px 16px', fontWeight: 700, fontSize: 14, textAlign: 'center', flexShrink: 0 }}>
                      Balance Due<br />
                      <span style={{ fontSize: 17 }}>₹{fmt(newBalance)}</span>
                    </div>
                  )}
                </div>

                {/* Remarks */}
                {receipt?.remarks && (
                  <div style={{ margin: '0 16px 14px', padding: '8px 12px', background: '#f8fafc', borderRadius: 6, fontSize: 12, color: '#64748b' }}>
                    <strong style={{ color: '#475569' }}>Remarks:</strong> {receipt.remarks}
                  </div>
                )}

                {/* ── FOOTER ───────────────────────────────── */}
                <div style={{ borderTop: '1px solid #e5e7eb', padding: '12px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                  <div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>This is a computer generated receipt. No signature required.</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                      Generated on {new Date().toLocaleString('en-IN')}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ width: 130, borderTop: '1px solid #94a3b8', paddingTop: 4, fontSize: 11, color: '#64748b' }}>
                      Authorised Signatory
                    </div>
                  </div>
                </div>

                {/* Bottom bar */}
                <div style={{ height: 6, background: 'linear-gradient(90deg,#1e3a5f,#2e7d8c)' }} />

              </div>
            </div>
          </div>

          {/* Modal footer */}
          <div className="modal-footer border-0 py-3" style={{ background: '#f8fafc' }}>
            <button className="btn btn-light border" onClick={onClose}>
              <i className="bi bi-x me-1"></i>Close
            </button>
            <button className="btn btn-primary px-4" onClick={handlePrint}>
              <i className="bi bi-printer me-2"></i>Print Receipt
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}

function RRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
      <span style={{ fontSize: 11, color: '#64748b' }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: '#1a1a1a' }}>{value || '—'}</span>
    </div>
  )
}

function TRow({ label, value, bold, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
      <span style={{ fontSize: 12, color: '#64748b' }}>{label}</span>
      <span style={{ fontSize: bold ? 14 : 12, fontWeight: bold ? 700 : 500, color: color || (bold ? '#1a1a1a' : '#475569') }}>
        {value}
      </span>
    </div>
  )
}



// ─────────────────────────────────────────────────────────────
//  TAB 2 — ALL INVOICES
// ─────────────────────────────────────────────────────────────
function AllInvoicesTab() {
  const [invoices, setInvoices] = useState([])
  const [total,    setTotal]    = useState(0)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [years,    setYears]    = useState([])
  const [filters,  setFilters]  = useState({
    academic_year_id: '',
    status:           '',
    search:           '',
    page:             1,
  })

  useEffect(() => {
    fetch('/api/master/academic-years', {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    }).then(r => r.json()).then(y => {
      const ys = Array.isArray(y) ? y : []
      setYears(ys)
      const cur = ys.find(x => x.is_current)
      if (cur) setFilters(f => ({ ...f, academic_year_id: cur.id }))
    })
  }, [])

  useEffect(() => { loadInvoices() }, [filters])

  const loadInvoices = async () => {
    setLoading(true); setError('')
    try {
      const params = { page: filters.page, limit: 50 }
      if (filters.academic_year_id) params.academic_year_id = filters.academic_year_id
      if (filters.status)           params.status           = filters.status
      if (filters.search)           params.search           = filters.search
      const data = await feesApi.getInvoices(params)
      setInvoices(data.invoices || [])
      setTotal(data.total || 0)
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to load invoices')
    } finally {
      setLoading(false)
    }
  }

  const setFilter = (key, val) => setFilters(f => ({ ...f, [key]: val, page: 1 }))

  return (
    <div>
      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body py-2">
          <div className="row g-2 align-items-center">
            <div className="col-12 col-md-4">
              <div className="input-group input-group-sm">
                <span className="input-group-text bg-light">
                  <i className="bi bi-search text-muted"></i>
                </span>
                <input type="text" className="form-control"
                  placeholder="Search student or invoice no..."
                  value={filters.search}
                  onChange={e => setFilter('search', e.target.value)} />
              </div>
            </div>
            <div className="col-6 col-md-3">
              <select className="form-select form-select-sm"
                value={filters.academic_year_id}
                onChange={e => setFilter('academic_year_id', e.target.value)}>
                <option value="">All Years</option>
                {years.map(y => (
                  <option key={y.id} value={y.id}>{y.label}{y.is_current ? ' ★' : ''}</option>
                ))}
              </select>
            </div>
            <div className="col-6 col-md-2">
              <select className="form-select form-select-sm"
                value={filters.status}
                onChange={e => setFilter('status', e.target.value)}>
                <option value="">All Status</option>
                {['draft','sent','partial','paid','overdue','cancelled'].map(s => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
            </div>
            <div className="col-auto">
              <span className="badge bg-secondary">{total} invoices</span>
            </div>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-danger small">{error}</div>}

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary"></div>
        </div>
      ) : invoices.length === 0 ? (
        <div className="card border-0 shadow-sm">
          <div className="card-body text-center py-5 text-muted">
            <i className="bi bi-receipt fs-1 d-block mb-3 opacity-25"></i>
            <h6>No invoices found</h6>
          </div>
        </div>
      ) : (
        <div className="card border-0 shadow-sm">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>Invoice No</th>
                  <th>Student</th>
                  <th>Issue Date</th>
                  <th>Due Date</th>
                  <th className="text-end">Total</th>
                  <th className="text-end">Paid</th>
                  <th className="text-end">Balance</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map(inv => (
                  <tr key={inv.id}>
                    <td><code className="small fw-bold">{inv.invoice_no}</code></td>
                    <td>
                      <div className="fw-medium small">{inv.student_name}</div>
                      <code style={{ fontSize: 10 }} className="text-muted">{inv.admission_no}</code>
                    </td>
                    <td className="text-muted small">{inv.issue_date}</td>
                    <td className={`small ${inv.status === 'overdue' ? 'text-danger fw-medium' : 'text-muted'}`}>
                      {inv.due_date}
                    </td>
                    <td className="text-end fw-medium">₹{(inv.total_amount || 0).toFixed(2)}</td>
                    <td className="text-end text-success">₹{(inv.paid_amount || 0).toFixed(2)}</td>
                    <td className="text-end text-danger fw-bold">₹{(inv.balance || 0).toFixed(2)}</td>
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
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  TAB 3 — DAILY COLLECTION
// ─────────────────────────────────────────────────────────────
function DailyCollectionTab() {
  const [date,    setDate]    = useState(today())
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  const load = async () => {
    setLoading(true); setError('')
    try {
      const result = await feesApi.getDailyCollection(date)
      setData(result)
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [date])

  return (
    <div>
      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body py-2">
          <div className="row g-2 align-items-center">
            <div className="col-auto">
              <label className="form-label fw-medium small mb-0">Date</label>
            </div>
            <div className="col-auto">
              <input type="date" className="form-control form-control-sm"
                value={date} max={today()}
                onChange={e => setDate(e.target.value)} />
            </div>
            <div className="col-auto">
              <button className="btn btn-outline-secondary btn-sm" onClick={load}>
                <i className="bi bi-arrow-clockwise"></i>
              </button>
            </div>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-danger small">{error}</div>}

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary"></div>
        </div>
      ) : data ? (
        <>
          <div className="card border-0 shadow-sm mb-3">
            <div className="card-body">
              <div className="row g-3 text-center">
                <div className="col-md-4">
                  <div className="p-3 bg-primary bg-opacity-10 rounded-3">
                    <div className="text-muted small">Total Collected</div>
                    <div className="fw-bold fs-3 text-primary">
                      ₹{parseFloat(data.total_amount || 0).toFixed(2)}
                    </div>
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="p-3 bg-success bg-opacity-10 rounded-3">
                    <div className="text-muted small">Transactions</div>
                    <div className="fw-bold fs-3 text-success">{data.total_count || 0}</div>
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="p-3 bg-info bg-opacity-10 rounded-3">
                    <div className="text-muted small">Date</div>
                    <div className="fw-bold text-info">
                      {new Date(date).toLocaleDateString('en-IN', {
                        day: 'numeric', month: 'long', year: 'numeric',
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {data.breakdown && Object.keys(data.breakdown).length > 0 ? (
            <div className="card border-0 shadow-sm">
              <div className="card-header bg-white fw-semibold">
                <i className="bi bi-pie-chart me-2 text-primary"></i>
                Collection by Method
              </div>
              <div className="card-body p-0">
                <table className="table table-sm align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Method</th>
                      <th className="text-center">Count</th>
                      <th className="text-end">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(data.breakdown).map(([method, info]) => (
                      <tr key={method}>
                        <td>
                          <i className={`bi ${METHOD_ICONS[method] || 'bi-cash'} me-2 text-muted`}></i>
                          <span className="text-capitalize">{method.replace('_', ' ')}</span>
                        </td>
                        <td className="text-center">
                          <span className="badge bg-secondary">{info.count}</span>
                        </td>
                        <td className="text-end fw-bold">
                          ₹{parseFloat(info.amount || 0).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="table-light">
                    <tr>
                      <td className="fw-bold">Total</td>
                      <td className="text-center fw-bold">{data.total_count}</td>
                      <td className="text-end fw-bold text-primary">
                        ₹{parseFloat(data.total_amount || 0).toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ) : (
            <div className="card border-0 shadow-sm">
              <div className="card-body text-center py-5 text-muted">
                <i className="bi bi-calendar-x fs-1 d-block mb-3 opacity-25"></i>
                <h6>No collections on this date</h6>
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  STUDENT AVATAR
// ─────────────────────────────────────────────────────────────
function StudentAvatar({ student, size = 36 }) {
  if (student?.photo_url) {
    return (
      <img src={student.photo_url} alt={student.first_name}
        className="rounded-circle flex-shrink-0"
        style={{ width: size, height: size, objectFit: 'cover' }}
        onError={e => { e.target.style.display = 'none' }} />
    )
  }
  const colors = { male: ['#dbeafe','#1d4ed8'], female: ['#fce7f3','#be185d'] }
  const [bg, color] = colors[student?.gender] || ['#f1f5f9','#475569']
  return (
    <div className="rounded-circle d-flex align-items-center justify-content-center fw-bold flex-shrink-0"
      style={{ width: size, height: size, background: bg, color, fontSize: size * 0.4 }}>
      {student?.first_name?.[0]?.toUpperCase() || '?'}
    </div>
  )
}
