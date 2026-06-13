// frontend/src/pages/MyFeesPage.jsx
import { useState, useEffect } from 'react'
import api from '../api/client.js'

const fmt = (n) => `₹${Number(n||0).toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}`

const STATUS_BADGE = {
  paid:      'bg-success',
  partial:   'bg-warning text-dark',
  sent:      'bg-info text-dark',
  overdue:   'bg-danger',
  draft:     'bg-secondary',
  cancelled: 'bg-light text-muted border',
}

export default function MyFeesPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    api.get('/my/fees')
      .then(r => setData(r.data))
      .catch(e => setErr(e.response?.data?.detail || 'Failed to load fee history'))
      .finally(() => setLoading(false))
  },[])

  if (loading) return <div className="text-center py-5"><div className="spinner-border text-primary"></div></div>
  if (err) return <div className="alert alert-warning">{err}</div>
  if (!data) return null

  const totalOutstanding = data.invoices.reduce((s,i)=>s+i.balance, 0)

  return (
    <div>
      <div className="mb-4">
        <h4 className="fw-bold mb-0">My Fees</h4>
        <small className="text-muted">View invoices and payment history</small>
      </div>

      {totalOutstanding > 0 && (
        <div className="alert alert-warning d-flex justify-content-between align-items-center mb-3">
          <span><i className="bi bi-exclamation-triangle-fill me-2"></i>Total Outstanding</span>
          <span className="fw-bold fs-5">{fmt(totalOutstanding)}</span>
        </div>
      )}

      {data.invoices.length === 0 ? (
        <div className="card border-0 shadow-sm">
          <div className="card-body text-center py-5 text-muted">
            <i className="bi bi-receipt fs-1 d-block mb-2 opacity-25"></i>
            No invoices found
          </div>
        </div>
      ) : (
        <div className="card border-0 shadow-sm">
          <div className="table-responsive">
            <table className="table table-sm table-hover align-middle mb-0">
              <thead className="table-light">
                <tr><th>Invoice No</th><th>Issue Date</th><th>Due Date</th>
                  <th className="text-end">Total</th><th className="text-end">Paid</th>
                  <th className="text-end">Balance</th><th>Status</th><th style={{width:40}}></th></tr>
              </thead>
              <tbody>
                {data.invoices.map(inv=>(
                  <>
                    <tr key={inv.id} style={{cursor:'pointer'}} onClick={()=>setExpanded(expanded===inv.id?null:inv.id)}>
                      <td><code className="fw-bold small">{inv.invoice_no}</code></td>
                      <td className="small text-muted">{inv.issue_date}</td>
                      <td className="small text-muted">{inv.due_date}</td>
                      <td className="text-end small">{fmt(inv.total)}</td>
                      <td className="text-end small text-success">{fmt(inv.paid)}</td>
                      <td className="text-end small fw-bold">{inv.balance>0?fmt(inv.balance):'—'}</td>
                      <td><span className={`badge small text-capitalize ${STATUS_BADGE[inv.status]||'bg-secondary'}`}>{inv.status}</span></td>
                      <td className="text-center">
                        <i className={`bi bi-chevron-${expanded===inv.id?'up':'down'} text-muted`}></i>
                      </td>
                    </tr>
                    {expanded===inv.id && (
                      <tr key={`${inv.id}-detail`}>
                        <td colSpan={8} className="bg-light p-0">
                          <table className="table table-sm mb-0">
                            <thead>
                              <tr><th className="ps-4">Description</th><th>Category</th><th className="text-end pe-4">Amount</th></tr>
                            </thead>
                            <tbody>
                              {inv.items.map((it,i)=>(
                                <tr key={i}>
                                  <td className="ps-4 small">{it.description}</td>
                                  <td><span className="badge bg-white border small">{it.category}</span></td>
                                  <td className="text-end pe-4 small">{fmt(it.amount)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
