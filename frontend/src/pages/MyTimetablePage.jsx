// frontend/src/pages/MyTimetablePage.jsx
import { useState, useEffect } from 'react'
import api from '../api/client.js'

const DAYS = [
  {n:1, label:'Monday'}, {n:2, label:'Tuesday'}, {n:3, label:'Wednesday'},
  {n:4, label:'Thursday'}, {n:5, label:'Friday'}, {n:6, label:'Saturday'},
]

export default function MyTimetablePage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  useEffect(() => {
    api.get('/my/timetable')
      .then(r => setData(r.data))
      .catch(e => setErr(e.response?.data?.detail || 'Failed to load timetable'))
      .finally(() => setLoading(false))
  },[])

  if (loading) return <div className="text-center py-5"><div className="spinner-border text-primary"></div></div>
  if (err) return <div className="alert alert-warning">{err}</div>
  if (!data || !data.periods?.length) return (
    <div className="alert alert-info">
      <i className="bi bi-info-circle me-2"></i>Timetable has not been set up for your class yet.
    </div>
  )

  const findEntry = (day, period_no) =>
    data.entries.find(e => e.day === day && e.period_no === period_no)

  return (
    <div>
      <div className="mb-4">
        <h4 className="fw-bold mb-0">My Timetable</h4>
        <small className="text-muted">{data.class}</small>
      </div>

      <div className="card border-0 shadow-sm">
        <div className="table-responsive">
          <table className="table table-sm table-bordered align-middle mb-0 text-center">
            <thead className="table-light">
              <tr>
                <th style={{width:120}}>Period</th>
                {DAYS.map(d=><th key={d.n}>{d.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {data.periods.map(p=>(
                <tr key={p.period_no} className={p.is_break?'table-light':''}>
                  <td className="text-start">
                    <div className="fw-medium small">{p.name}</div>
                    <div className="text-muted" style={{fontSize:10}}>{p.time}</div>
                  </td>
                  {DAYS.map(d=>{
                    const entry = findEntry(d.n, p.period_no)
                    return (
                      <td key={d.n}>
                        {p.is_break ? (
                          <span className="text-muted small"><i className="bi bi-cup-hot"></i></span>
                        ) : entry ? (
                          <div>
                            <div className="fw-medium small">{entry.subject || '—'}</div>
                            <div className="text-muted" style={{fontSize:10}}>
                              {entry.teacher}{entry.room && ` · ${entry.room}`}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted">—</span>
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
    </div>
  )
}
