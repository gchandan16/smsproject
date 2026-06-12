// frontend/src/pages/TransportPage.jsx
import { useState, useEffect, useCallback } from 'react'
import api from '../api/client.js'

const VEHICLE_TYPES  = ['bus','van','auto','car']
const PICKUP_TYPES   = [
  { value:'both',        label:'Both (Pickup & Drop)' },
  { value:'pickup_only', label:'Pickup Only'           },
  { value:'drop_only',   label:'Drop Only'             },
]

// ── tiny helpers ─────────────────────────────────────────────
const toast = (setter, msg, ms=3000) => {
  setter(msg)
  setTimeout(() => setter(''), ms)
}
const fmt = (n) => parseFloat(n||0).toFixed(2)
const soonExpiry = (dateStr) => {
  if (!dateStr) return false
  const exp  = new Date(dateStr)
  const warn = new Date(Date.now() + 30*24*3600*1000)
  return exp < warn
}

function Spinner() {
  return <div className="text-center py-5"><div className="spinner-border text-primary"></div></div>
}
function ErrBox({ msg }) {
  if (!msg) return null
  return <div className="alert alert-danger py-2 small"><i className="bi bi-exclamation-triangle-fill me-2"></i>{msg}</div>
}
function OkBox({ msg }) {
  if (!msg) return null
  return <div className="alert alert-success py-2 small"><i className="bi bi-check-circle-fill me-2"></i>{msg}</div>
}

// ─────────────────────────────────────────────────────────────
export default function TransportPage() {
  const [tab, setTab] = useState('dashboard')
  return (
    <div>
      <div className="mb-4">
        <h4 className="fw-bold mb-0">Transport</h4>
        <small className="text-muted">Manage routes, vehicles and student assignments</small>
      </div>
      <ul className="nav nav-tabs mb-4">
        {[
          { key:'dashboard', icon:'bi-speedometer2', label:'Overview'          },
          { key:'routes',    icon:'bi-map',          label:'Routes & Stops'    },
          { key:'vehicles',  icon:'bi-bus-front',    label:'Vehicles'          },
          { key:'students',  icon:'bi-people-fill',  label:'Student Assignments'},
        ].map(t => (
          <li key={t.key} className="nav-item">
            <button className={`nav-link ${tab===t.key?'active':''}`}
              onClick={() => setTab(t.key)}>
              <i className={`bi ${t.icon} me-2`}></i>{t.label}
            </button>
          </li>
        ))}
      </ul>
      {tab==='dashboard' && <DashboardTab />}
      {tab==='routes'    && <RoutesTab />}
      {tab==='vehicles'  && <VehiclesTab />}
      {tab==='students'  && <StudentsTab />}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  TAB 1 — DASHBOARD
// ─────────────────────────────────────────────────────────────
function DashboardTab() {
  const [summary,  setSummary]  = useState(null)
  const [vehicles, setVehicles] = useState([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    Promise.all([
      api.get('/transport/summary').then(r=>r.data).catch(()=>{}),
      api.get('/transport/vehicles').then(r=>r.data).catch(()=>[]),
    ]).then(([s,v]) => {
      setSummary(s||{})
      setVehicles(Array.isArray(v)?v:[])
      setLoading(false)
    })
  },[])

  if (loading) return <Spinner />

  return (
    <div>
      {/* Summary cards */}
      <div className="row g-3 mb-4">
        {[
          { label:'Total Routes',   val:summary?.total_routes||0,   icon:'bi-map',         c1:'#1e3a5f', c2:'#e8f0fe' },
          { label:'Total Vehicles', val:summary?.total_vehicles||0, icon:'bi-bus-front',    c1:'#0369a1', c2:'#e0f2fe' },
          { label:'Students',       val:summary?.total_students||0, icon:'bi-people-fill',  c1:'#059669', c2:'#d1fae5' },
          { label:'Expiring Soon',  val:summary?.expiring_soon||0,  icon:'bi-exclamation-triangle', c1:'#dc2626', c2:'#fee2e2' },
        ].map(c=>(
          <div key={c.label} className="col-6 col-md-3">
            <div className="card border-0 shadow-sm" style={{background:c.c2}}>
              <div className="card-body py-3">
                <div className="d-flex align-items-start justify-content-between">
                  <div>
                    <div style={{fontSize:11,textTransform:'uppercase',letterSpacing:.5}} className="text-muted fw-medium mb-1">{c.label}</div>
                    <div className="fw-bold" style={{fontSize:28,color:c.c1}}>{c.val}</div>
                  </div>
                  <div style={{width:38,height:38,borderRadius:10,background:c.c1,display:'flex',alignItems:'center',justifyContent:'center'}}>
                    <i className={`bi ${c.icon} text-white`} style={{fontSize:16}}></i>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {vehicles.length > 0 && (
        <div className="card border-0 shadow-sm">
          <div className="card-header bg-white fw-semibold">
            <i className="bi bi-bus-front me-2 text-primary"></i>Vehicle Status
          </div>
          <div className="table-responsive">
            <table className="table table-sm table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>Vehicle No</th><th>Type</th><th>Route</th>
                  <th>Driver</th><th className="text-center">Cap.</th>
                  <th>Fitness Expiry</th><th>Insurance Expiry</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {vehicles.map(v=>(
                  <tr key={v.id}>
                    <td><code className="fw-bold">{v.vehicle_no}</code><br/><small className="text-muted">{v.make_model}</small></td>
                    <td><span className="badge bg-light text-dark border small text-capitalize">{v.vehicle_type}</span></td>
                    <td className="small">{v.route_name?<><code>{v.route_no}</code> {v.route_name}</>:<span className="text-muted">—</span>}</td>
                    <td className="small">{v.driver_name||'—'}</td>
                    <td className="text-center small">{v.capacity}</td>
                    <td><span className={`small ${soonExpiry(v.fitness_expiry)?'text-danger fw-bold':''}`}>{v.fitness_expiry||'—'}</span></td>
                    <td><span className={`small ${soonExpiry(v.insurance_expiry)?'text-danger fw-bold':''}`}>{v.insurance_expiry||'—'}</span></td>
                    <td>{v.is_active?<span className="badge bg-success small">Active</span>:<span className="badge bg-secondary small">Inactive</span>}</td>
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
//  TAB 2 — ROUTES & STOPS
// ─────────────────────────────────────────────────────────────
function RoutesTab() {
  const [routes,     setRoutes]     = useState([])
  const [stops,      setStops]      = useState([])
  const [selRoute,   setSelRoute]   = useState(null)
  const [loading,    setLoading]    = useState(true)
  // separate error/success for routes and stops
  const [rErr,  setRErr]  = useState(''); const [rOk,  setROk]  = useState('')
  const [stErr, setStErr] = useState(''); const [stOk, setStOk] = useState('')
  // route form
  const [showRF,   setShowRF]   = useState(false)
  const [editR,    setEditR]    = useState(null)
  const [savingR,  setSavingR]  = useState(false)
  const [rForm,    setRForm]    = useState({ name:'', route_no:'', start_point:'', end_point:'', distance_km:'', fare:0, is_active:true })
  // stop form
  const [showSF,   setShowSF]   = useState(false)
  const [editSt,   setEditSt]   = useState(null)
  const [savingSt, setSavingSt] = useState(false)
  const [stForm,   setStForm]   = useState({ name:'', stop_no:1, pickup_time:'', drop_time:'', fare:0 })

  const loadRoutes = useCallback(async () => {
    try {
      const r = await api.get('/transport/routes').then(r=>r.data)
      setRoutes(Array.isArray(r)?r:[])
    } catch(e) { setRErr(e.response?.data?.detail||'Failed to load routes') }
    setLoading(false)
  },[])

  const loadStops = useCallback(async (routeId) => {
    try {
      const s = await api.get(`/transport/routes/${routeId}/stops`).then(r=>r.data)
      setStops(Array.isArray(s)?s:[])
    } catch { setStops([]) }
  },[])

  useEffect(() => { loadRoutes() },[loadRoutes])
  useEffect(() => { if(selRoute) loadStops(selRoute.id) },[selRoute,loadStops])

  // ── Route CRUD ────────────────────────────────────────────
  const openAddRoute = () => {
    setEditR(null)
    setRForm({ name:'', route_no:'', start_point:'', end_point:'', distance_km:'', fare:0, is_active:true })
    setRErr(''); setShowRF(true)
  }
  const openEditRoute = (r) => {
    setEditR(r)
    setRForm({ name:r.name, route_no:r.route_no, start_point:r.start_point||'',
               end_point:r.end_point||'', distance_km:r.distance_km||'', fare:r.fare, is_active:r.is_active })
    setRErr(''); setShowRF(true)
  }
  const saveRoute = async () => {
    if (!rForm.name.trim() || !rForm.route_no.trim()) { setRErr('Name and Route No are required'); return }
    setSavingR(true); setRErr('')
    try {
      const payload = {
        ...rForm,
        distance_km: rForm.distance_km === '' ? null : parseFloat(rForm.distance_km) || null,
        start_point: rForm.start_point || null,
        end_point:   rForm.end_point   || null,
        fare:        parseFloat(rForm.fare) || 0,
      }
      if (editR) await api.put(`/transport/routes/${editR.id}`, payload)
      else       await api.post('/transport/routes', payload)
      setShowRF(false)
      toast(setROk, editR ? '✓ Route updated' : '✓ Route created')
      await loadRoutes()
    } catch(e) { setRErr(e.response?.data?.detail || 'Save failed') }
    finally { setSavingR(false) }
  }
  const deleteRoute = async (r) => {
    if (!window.confirm(`Delete route "${r.name}"?`)) return
    try {
      await api.delete(`/transport/routes/${r.id}`)
      if (selRoute?.id===r.id) { setSelRoute(null); setStops([]) }
      await loadRoutes()
      toast(setROk, '✓ Route deleted')
    } catch(e) { setRErr(e.response?.data?.detail||'Delete failed') }
  }

  // ── Stop CRUD ─────────────────────────────────────────────
  const openAddStop = () => {
    setEditSt(null)
    setStForm({ name:'', stop_no:stops.length+1, pickup_time:'', drop_time:'', fare:0 })
    setStErr(''); setShowSF(true)
  }
  const openEditStop = (s) => {
    setEditSt(s)
    setStForm({ name:s.name, stop_no:s.stop_no,
                pickup_time:s.pickup_time?.slice(0,5)||'',
                drop_time:s.drop_time?.slice(0,5)||'', fare:s.fare })
    setStErr(''); setShowSF(true)
  }
  const saveStop = async () => {
    if (!stForm.name.trim()) { setStErr('Stop name is required'); return }
    setSavingSt(true); setStErr('')
    try {
      const payload = {
        ...stForm,
        stop_no:     parseInt(stForm.stop_no) || 1,
        fare:        parseFloat(stForm.fare)  || 0,
        pickup_time: stForm.pickup_time || null,
        drop_time:   stForm.drop_time   || null,
      }
      if (editSt) await api.put(`/transport/stops/${editSt.id}`, payload)
      else        await api.post(`/transport/routes/${selRoute.id}/stops`, payload)
      setShowSF(false)
      toast(setStOk, editSt ? '✓ Stop updated' : '✓ Stop added')
      await loadStops(selRoute.id)
    } catch(e) { setStErr(e.response?.data?.detail||'Save failed') }
    finally { setSavingSt(false) }
  }
  const deleteStop = async (s) => {
    if (!window.confirm(`Delete stop "${s.name}"?`)) return
    try {
      await api.delete(`/transport/stops/${s.id}`)
      await loadStops(selRoute.id)
      toast(setStOk, '✓ Stop deleted')
    } catch(e) { setStErr(e.response?.data?.detail||'Delete failed') }
  }

  return (
    <div className="row g-3">
      {/* ── ROUTES ── */}
      <div className="col-md-5">
        <div className="card border-0 shadow-sm">
          <div className="card-header bg-white d-flex justify-content-between align-items-center">
            <span className="fw-semibold"><i className="bi bi-map me-2 text-primary"></i>Routes <span className="badge bg-secondary ms-1">{routes.length}</span></span>
            <button className="btn btn-primary btn-sm" onClick={openAddRoute}><i className="bi bi-plus-lg me-1"></i>Add Route</button>
          </div>

          {/* Route form */}
          {showRF && (
            <div className="card-body bg-light border-bottom">
              <div className="fw-medium small text-muted mb-2">{editR?'Edit Route':'New Route'}</div>
              <div className="row g-2">
                <div className="col-12">
                  <label className="form-label fw-medium small mb-1">Route Name *</label>
                  <input className="form-control form-control-sm" placeholder="e.g. North Route"
                    value={rForm.name} onChange={e=>setRForm(f=>({...f,name:e.target.value}))} />
                </div>
                <div className="col-6">
                  <label className="form-label fw-medium small mb-1">Route No *</label>
                  <input className="form-control form-control-sm" placeholder="R-01"
                    value={rForm.route_no} onChange={e=>setRForm(f=>({...f,route_no:e.target.value}))} />
                </div>
                <div className="col-6">
                  <label className="form-label fw-medium small mb-1">Fare (₹)</label>
                  <input type="number" className="form-control form-control-sm" min="0"
                    value={rForm.fare} onChange={e=>setRForm(f=>({...f,fare:parseFloat(e.target.value)||0}))} />
                </div>
                <div className="col-6">
                  <label className="form-label fw-medium small mb-1">From</label>
                  <input className="form-control form-control-sm" placeholder="Start point"
                    value={rForm.start_point} onChange={e=>setRForm(f=>({...f,start_point:e.target.value}))} />
                </div>
                <div className="col-6">
                  <label className="form-label fw-medium small mb-1">To</label>
                  <input className="form-control form-control-sm" placeholder="End point"
                    value={rForm.end_point} onChange={e=>setRForm(f=>({...f,end_point:e.target.value}))} />
                </div>
                <div className="col-12"><ErrBox msg={rErr} /></div>
                <div className="col-12 d-flex gap-2">
                  <button className="btn btn-primary btn-sm" onClick={saveRoute} disabled={savingR}>
                    {savingR?<><span className="spinner-border spinner-border-sm me-1"></span>Saving...</>:editR?'Update Route':'Save Route'}
                  </button>
                  <button className="btn btn-light btn-sm" onClick={()=>{setShowRF(false);setRErr('')}}>Cancel</button>
                </div>
              </div>
            </div>
          )}

          <div className="card-body p-0">
            <OkBox msg={rOk} />
            {!showRF && rErr && <ErrBox msg={rErr} />}
            {loading ? <Spinner /> : routes.length===0 ? (
              <div className="text-center py-5 text-muted"><i className="bi bi-map fs-1 d-block mb-2 opacity-25"></i><small>No routes yet</small></div>
            ) : (
              <div style={{maxHeight:480,overflowY:'auto'}}>
                {routes.map(r=>(
                  <div key={r.id}
                    className={`p-3 border-bottom d-flex align-items-start justify-content-between ${selRoute?.id===r.id?'bg-primary bg-opacity-10':''}`}
                    style={{cursor:'pointer'}} onClick={()=>setSelRoute(r)}>
                    <div>
                      <div className="d-flex align-items-center gap-2 mb-1">
                        <code className="small fw-bold">{r.route_no}</code>
                        <span className="fw-medium small">{r.name}</span>
                        {!r.is_active&&<span className="badge bg-secondary" style={{fontSize:9}}>Inactive</span>}
                      </div>
                      {(r.start_point||r.end_point)&&<div className="text-muted" style={{fontSize:11}}>{r.start_point} → {r.end_point}</div>}
                      <div className="d-flex gap-1 mt-1">
                        <span className="badge bg-light text-dark border" style={{fontSize:10}}>{r.stop_count} stops</span>
                        <span className="badge bg-light text-dark border" style={{fontSize:10}}>{r.vehicle_count} vehicles</span>
                        {r.fare>0&&<span className="badge bg-success text-white" style={{fontSize:10}}>₹{r.fare}</span>}
                      </div>
                    </div>
                    <div className="btn-group btn-group-sm ms-2" onClick={e=>e.stopPropagation()}>
                      <button className="btn btn-outline-primary" title="Edit" onClick={()=>openEditRoute(r)}><i className="bi bi-pencil"></i></button>
                      <button className="btn btn-outline-danger" title="Delete" onClick={()=>deleteRoute(r)}><i className="bi bi-trash"></i></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── STOPS ── */}
      <div className="col-md-7">
        <div className="card border-0 shadow-sm">
          <div className="card-header bg-white d-flex justify-content-between align-items-center">
            <span className="fw-semibold">
              <i className="bi bi-geo-alt me-2 text-success"></i>
              {selRoute ? <>Stops — <span className="text-primary">{selRoute.name}</span></> : 'Stops'}
            </span>
            {selRoute&&<button className="btn btn-success btn-sm" onClick={openAddStop}><i className="bi bi-plus-lg me-1"></i>Add Stop</button>}
          </div>

          {showSF && selRoute && (
            <div className="card-body bg-light border-bottom">
              <div className="fw-medium small text-muted mb-2">{editSt?'Edit Stop':'New Stop'}</div>
              <div className="row g-2">
                <div className="col-md-4">
                  <label className="form-label fw-medium small mb-1">Stop Name *</label>
                  <input className="form-control form-control-sm" placeholder="Stop name"
                    value={stForm.name} onChange={e=>setStForm(f=>({...f,name:e.target.value}))} />
                </div>
                <div className="col-md-1">
                  <label className="form-label fw-medium small mb-1">No</label>
                  <input type="number" className="form-control form-control-sm" min="1"
                    value={stForm.stop_no} onChange={e=>setStForm(f=>({...f,stop_no:e.target.value}))} />
                </div>
                <div className="col-md-2">
                  <label className="form-label fw-medium small mb-1">Pickup</label>
                  <input type="time" className="form-control form-control-sm"
                    value={stForm.pickup_time} onChange={e=>setStForm(f=>({...f,pickup_time:e.target.value}))} />
                </div>
                <div className="col-md-2">
                  <label className="form-label fw-medium small mb-1">Drop</label>
                  <input type="time" className="form-control form-control-sm"
                    value={stForm.drop_time} onChange={e=>setStForm(f=>({...f,drop_time:e.target.value}))} />
                </div>
                <div className="col-md-2">
                  <label className="form-label fw-medium small mb-1">Fare ₹</label>
                  <input type="number" className="form-control form-control-sm" min="0"
                    value={stForm.fare} onChange={e=>setStForm(f=>({...f,fare:parseFloat(e.target.value)||0}))} />
                </div>
                <div className="col-12"><ErrBox msg={stErr} /></div>
                <div className="col-12 d-flex gap-2">
                  <button className="btn btn-success btn-sm" onClick={saveStop} disabled={savingSt}>
                    {savingSt?<><span className="spinner-border spinner-border-sm me-1"></span>Saving...</>:editSt?'Update Stop':'Add Stop'}
                  </button>
                  <button className="btn btn-light btn-sm" onClick={()=>{setShowSF(false);setStErr('')}}>Cancel</button>
                </div>
              </div>
            </div>
          )}

          <div className="card-body p-0">
            <OkBox msg={stOk} />
            {!showSF&&stErr&&<ErrBox msg={stErr} />}
            {!selRoute ? (
              <div className="text-center py-5 text-muted"><i className="bi bi-arrow-left fs-2 d-block mb-2 opacity-25"></i><small>← Select a route to manage stops</small></div>
            ) : stops.length===0 ? (
              <div className="text-center py-5 text-muted"><i className="bi bi-geo-alt fs-1 d-block mb-2 opacity-25"></i><small>No stops for this route</small></div>
            ) : (
              <table className="table table-sm table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr><th style={{width:40}}>#</th><th>Stop</th><th>Pickup</th><th>Drop</th><th className="text-end">Fare</th><th style={{width:80}}></th></tr>
                </thead>
                <tbody>
                  {stops.map(s=>(
                    <tr key={s.id}>
                      <td className="text-muted fw-bold small">{s.stop_no}</td>
                      <td className="fw-medium small">{s.name}</td>
                      <td className="text-muted small">{s.pickup_time?.slice(0,5)||'—'}</td>
                      <td className="text-muted small">{s.drop_time?.slice(0,5)||'—'}</td>
                      <td className="text-end small">{s.fare>0?`₹${fmt(s.fare)}`:'—'}</td>
                      <td>
                        <div className="btn-group btn-group-sm">
                          <button className="btn btn-outline-primary" onClick={()=>openEditStop(s)}><i className="bi bi-pencil"></i></button>
                          <button className="btn btn-outline-danger" onClick={()=>deleteStop(s)}><i className="bi bi-trash"></i></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  TAB 3 — VEHICLES
// ─────────────────────────────────────────────────────────────
function VehiclesTab() {
  const [vehicles, setVehicles] = useState([])
  const [routes,   setRoutes]   = useState([])
  const [loading,  setLoading]  = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing,  setEditing]  = useState(null)
  const [saving,   setSaving]   = useState(false)
  const [err,  setErr]  = useState('')
  const [ok,   setOk]   = useState('')
  const BLANK = { vehicle_no:'', vehicle_type:'bus', make_model:'', capacity:40,
    driver_name:'', driver_phone:'', conductor_name:'', conductor_phone:'',
    route_id:'', insurance_expiry:'', fitness_expiry:'', is_active:true }
  const [form, setForm] = useState(BLANK)

  const load = useCallback(async () => {
    try {
      const [v,r] = await Promise.all([
        api.get('/transport/vehicles').then(r=>r.data),
        api.get('/transport/routes').then(r=>r.data),
      ])
      setVehicles(Array.isArray(v)?v:[])
      setRoutes(Array.isArray(r)?r.filter(x=>x.is_active):[])
    } catch(e) { setErr(e.response?.data?.detail||'Failed to load') }
    setLoading(false)
  },[])

  useEffect(()=>{load()},[load])

  const openAdd = () => { setEditing(null); setForm(BLANK); setErr(''); setShowForm(true) }
  const openEdit = (v) => {
    setEditing(v)
    setForm({ vehicle_no:v.vehicle_no, vehicle_type:v.vehicle_type, make_model:v.make_model||'',
      capacity:v.capacity||40, driver_name:v.driver_name||'', driver_phone:v.driver_phone||'',
      conductor_name:v.conductor_name||'', conductor_phone:v.conductor_phone||'',
      route_id:v.route_id||'', insurance_expiry:v.insurance_expiry||'',
      fitness_expiry:v.fitness_expiry||'', is_active:v.is_active })
    setErr(''); setShowForm(true)
  }

  const save = async (e) => {
    e.preventDefault()
    if (!form.vehicle_no.trim()) { setErr('Vehicle No is required'); return }
    setSaving(true); setErr('')
    try {
      const payload = { ...form, route_id: form.route_id||null,
        insurance_expiry: form.insurance_expiry||null, fitness_expiry: form.fitness_expiry||null }
      if (editing) await api.put(`/transport/vehicles/${editing.id}`, payload)
      else         await api.post('/transport/vehicles', payload)
      setShowForm(false)
      toast(setOk, editing ? '✓ Vehicle updated' : '✓ Vehicle added')
      await load()
    } catch(e) { setErr(e.response?.data?.detail||'Save failed') }
    finally { setSaving(false) }
  }

  const del = async (v) => {
    if (!window.confirm(`Delete vehicle ${v.vehicle_no}?`)) return
    try { await api.delete(`/transport/vehicles/${v.id}`); await load(); toast(setOk,'✓ Deleted') }
    catch(e) { setErr(e.response?.data?.detail||'Delete failed') }
  }

  return (
    <div className="card border-0 shadow-sm">
      <div className="card-header bg-white d-flex justify-content-between align-items-center">
        <span className="fw-semibold"><i className="bi bi-bus-front me-2 text-primary"></i>Vehicles <span className="badge bg-secondary ms-1">{vehicles.length}</span></span>
        <button className="btn btn-primary btn-sm" onClick={openAdd}><i className="bi bi-plus-lg me-1"></i>Add Vehicle</button>
      </div>

      {showForm && (
        <div className="card-body bg-light border-bottom">
          <div className="fw-medium small text-muted mb-2">{editing?'Edit Vehicle':'New Vehicle'}</div>
          <form onSubmit={save}>
            <div className="row g-2">
              <div className="col-md-3">
                <label className="form-label fw-medium small mb-1">Vehicle No *</label>
                <input className="form-control form-control-sm" placeholder="GJ01AB1234"
                  value={form.vehicle_no} onChange={e=>setForm(f=>({...f,vehicle_no:e.target.value}))} required />
              </div>
              <div className="col-md-2">
                <label className="form-label fw-medium small mb-1">Type</label>
                <select className="form-select form-select-sm" value={form.vehicle_type} onChange={e=>setForm(f=>({...f,vehicle_type:e.target.value}))}>
                  {VEHICLE_TYPES.map(t=><option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
                </select>
              </div>
              <div className="col-md-3">
                <label className="form-label fw-medium small mb-1">Make / Model</label>
                <input className="form-control form-control-sm" placeholder="Tata Starbus"
                  value={form.make_model} onChange={e=>setForm(f=>({...f,make_model:e.target.value}))} />
              </div>
              <div className="col-md-2">
                <label className="form-label fw-medium small mb-1">Capacity</label>
                <input type="number" className="form-control form-control-sm" min="1"
                  value={form.capacity} onChange={e=>setForm(f=>({...f,capacity:parseInt(e.target.value)||40}))} />
              </div>
              <div className="col-md-2">
                <label className="form-label fw-medium small mb-1">Assign Route</label>
                <select className="form-select form-select-sm" value={form.route_id} onChange={e=>setForm(f=>({...f,route_id:e.target.value}))}>
                  <option value="">-- Route --</option>
                  {routes.map(r=><option key={r.id} value={r.id}>{r.route_no} — {r.name}</option>)}
                </select>
              </div>
              <div className="col-md-3">
                <label className="form-label fw-medium small mb-1">Driver Name</label>
                <input className="form-control form-control-sm" value={form.driver_name} onChange={e=>setForm(f=>({...f,driver_name:e.target.value}))} />
              </div>
              <div className="col-md-3">
                <label className="form-label fw-medium small mb-1">Driver Phone</label>
                <input className="form-control form-control-sm" value={form.driver_phone} onChange={e=>setForm(f=>({...f,driver_phone:e.target.value}))} />
              </div>
              <div className="col-md-3">
                <label className="form-label fw-medium small mb-1">Conductor Name</label>
                <input className="form-control form-control-sm" value={form.conductor_name} onChange={e=>setForm(f=>({...f,conductor_name:e.target.value}))} />
              </div>
              <div className="col-md-3">
                <label className="form-label fw-medium small mb-1">Conductor Phone</label>
                <input className="form-control form-control-sm" value={form.conductor_phone} onChange={e=>setForm(f=>({...f,conductor_phone:e.target.value}))} />
              </div>
              <div className="col-md-3">
                <label className="form-label fw-medium small mb-1">Fitness Expiry</label>
                <input type="date" className="form-control form-control-sm" value={form.fitness_expiry} onChange={e=>setForm(f=>({...f,fitness_expiry:e.target.value}))} />
              </div>
              <div className="col-md-3">
                <label className="form-label fw-medium small mb-1">Insurance Expiry</label>
                <input type="date" className="form-control form-control-sm" value={form.insurance_expiry} onChange={e=>setForm(f=>({...f,insurance_expiry:e.target.value}))} />
              </div>
              <div className="col-md-3">
                <label className="form-label fw-medium small mb-1">Status</label>
                <select className="form-select form-select-sm" value={form.is_active} onChange={e=>setForm(f=>({...f,is_active:e.target.value==='true'}))}>
                  <option value="true">Active</option><option value="false">Inactive</option>
                </select>
              </div>
              <div className="col-12"><ErrBox msg={err} /></div>
              <div className="col-12 d-flex gap-2">
                <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                  {saving?<><span className="spinner-border spinner-border-sm me-1"></span>Saving...</>:editing?'Update Vehicle':'Add Vehicle'}
                </button>
                <button type="button" className="btn btn-light btn-sm" onClick={()=>{setShowForm(false);setErr('')}}>Cancel</button>
              </div>
            </div>
          </form>
        </div>
      )}

      <div className="card-body p-0">
        <OkBox msg={ok} />
        {!showForm&&err&&<ErrBox msg={err} />}
        {loading?<Spinner/>:vehicles.length===0?(
          <div className="text-center py-5 text-muted"><i className="bi bi-bus-front fs-1 d-block mb-2 opacity-25"></i><h6>No vehicles added</h6></div>
        ):(
          <div className="table-responsive">
            <table className="table table-sm table-hover align-middle mb-0">
              <thead className="table-light">
                <tr><th>Vehicle No</th><th>Type</th><th>Route</th><th>Driver</th><th>Conductor</th><th className="text-center">Cap.</th><th>Fitness</th><th>Insurance</th><th style={{width:90}}></th></tr>
              </thead>
              <tbody>
                {vehicles.map(v=>(
                  <tr key={v.id} className={!v.is_active?'opacity-50':''}>
                    <td><code className="fw-bold">{v.vehicle_no}</code>{v.make_model&&<div className="text-muted" style={{fontSize:10}}>{v.make_model}</div>}</td>
                    <td><span className="badge bg-light text-dark border small text-capitalize">{v.vehicle_type}</span></td>
                    <td className="small">{v.route_name?<><code>{v.route_no}</code> {v.route_name}</>:<span className="text-muted">—</span>}</td>
                    <td className="small">{v.driver_name||'—'}{v.driver_phone&&<div className="text-muted" style={{fontSize:10}}>{v.driver_phone}</div>}</td>
                    <td className="small">{v.conductor_name||'—'}</td>
                    <td className="text-center small">{v.capacity}</td>
                    <td><span className={`small ${soonExpiry(v.fitness_expiry)?'text-danger fw-bold':''}`}>{v.fitness_expiry||'—'}</span></td>
                    <td><span className={`small ${soonExpiry(v.insurance_expiry)?'text-danger fw-bold':''}`}>{v.insurance_expiry||'—'}</span></td>
                    <td>
                      <div className="btn-group btn-group-sm">
                        <button className="btn btn-outline-primary" onClick={()=>openEdit(v)}><i className="bi bi-pencil"></i></button>
                        <button className="btn btn-outline-danger" onClick={()=>del(v)}><i className="bi bi-trash"></i></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  TAB 4 — STUDENT ASSIGNMENTS
// ─────────────────────────────────────────────────────────────
function StudentsTab() {
  const [assignments,setAssignments]=useState([])
  const [routes,  setRoutes]  = useState([])
  const [stops,   setStops]   = useState([])
  const [years,   setYears]   = useState([])
  const [results, setResults] = useState([])   // student search
  const [loading, setLoading] = useState(true)
  const [showForm,setShowForm]= useState(false)
  const [saving,  setSaving]  = useState(false)
  const [err,  setErr]  = useState('')
  const [ok,   setOk]   = useState('')
  const [filterRoute, setFilterRoute] = useState('')
  const [yearId, setYearId] = useState('')
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [form, setForm] = useState({ student_id:'', route_id:'', stop_id:'', vehicle_id:'', pickup_type:'both', academic_year_id:'' })

  const load = useCallback(async () => {
    const params={}
    if (filterRoute) params.route_id=filterRoute
    if (yearId) params.academic_year_id=yearId
    try {
      const [a,r,y]=await Promise.all([
        api.get('/transport/students',{params}).then(r=>r.data),
        api.get('/transport/routes').then(r=>r.data),
        api.get('/master/academic-years').then(r=>r.data),
      ])
      setAssignments(Array.isArray(a)?a:[])
      setRoutes(Array.isArray(r)?r:[])
      const ys=Array.isArray(y)?y:[]
      setYears(ys)
      if(!yearId){const cur=ys.find(x=>x.is_current);if(cur)setYearId(cur.id)}
    } catch(e){setErr(e.response?.data?.detail||'Failed to load')}
    setLoading(false)
  },[filterRoute,yearId])

  useEffect(()=>{load()},[load])

  const loadStops=async(rid)=>{
    if(!rid){setStops([]);return}
    const s=await api.get(`/transport/routes/${rid}/stops`).then(r=>r.data).catch(()=>[])
    setStops(Array.isArray(s)?s:[])
  }

  const searchStudents=async(q)=>{
    if(q.length<2){setResults([]);return}
    const r=await api.get('/students/',{params:{search:q,limit:10}}).then(r=>r.data).catch(()=>null)
    setResults(Array.isArray(r?.students)?r.students:[])
  }

  const openAdd=()=>{
    setSelectedStudent(null)
    setForm({student_id:'',route_id:'',stop_id:'',vehicle_id:'',pickup_type:'both',academic_year_id:yearId})
    setStops([]); setResults([]); setErr(''); setShowForm(true)
  }

  const save=async()=>{
    if(!form.student_id){setErr('Please select a student');return}
    if(!form.route_id){setErr('Please select a route');return}
    setSaving(true); setErr('')
    try{
      await api.post('/transport/students',{
        ...form,
        stop_id:form.stop_id||null,
        vehicle_id:form.vehicle_id||null,
        academic_year_id:form.academic_year_id||null
      })
      setShowForm(false)
      toast(setOk,'✓ Student assigned to transport')
      await load()
    }catch(e){setErr(e.response?.data?.detail||'Save failed')}
    finally{setSaving(false)}
  }

  const remove=async(a)=>{
    if(!window.confirm(`Remove ${a.student_name} from transport?`))return
    try{await api.delete(`/transport/students/${a.id}`);await load();toast(setOk,'✓ Removed')}
    catch(e){setErr(e.response?.data?.detail||'Remove failed')}
  }

  return (
    <div>
      {/* Filters */}
      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body py-2">
          <div className="row g-2 align-items-center">
            <div className="col-md-3">
              <select className="form-select form-select-sm" value={yearId} onChange={e=>setYearId(e.target.value)}>
                <option value="">All Years</option>
                {years.map(y=><option key={y.id} value={y.id}>{y.label}{y.is_current?' ★':''}</option>)}
              </select>
            </div>
            <div className="col-md-3">
              <select className="form-select form-select-sm" value={filterRoute} onChange={e=>setFilterRoute(e.target.value)}>
                <option value="">All Routes</option>
                {routes.map(r=><option key={r.id} value={r.id}>{r.route_no} — {r.name}</option>)}
              </select>
            </div>
            <div className="col-auto"><span className="badge bg-secondary">{assignments.length} students</span></div>
            <div className="col-auto ms-auto">
              <button className="btn btn-primary btn-sm" onClick={openAdd}><i className="bi bi-person-plus-fill me-1"></i>Assign Student</button>
            </div>
          </div>
        </div>
      </div>

      <OkBox msg={ok} />
      <ErrBox msg={err} />

      {/* Assign form */}
      {showForm && (
        <div className="card border-0 shadow-sm mb-3">
          <div className="card-header bg-light py-2 fw-semibold small"><i className="bi bi-person-plus-fill me-2 text-primary"></i>Assign Student to Transport</div>
          <div className="card-body">
            <div className="row g-3">
              {/* Student search */}
              <div className="col-md-4">
                <label className="form-label fw-medium small">Search Student *</label>
                <input className="form-control" placeholder="Type name or admission no..."
                  onChange={e=>searchStudents(e.target.value)} />
                {results.length>0&&(
                  <div className="border rounded mt-1 shadow-sm" style={{maxHeight:160,overflowY:'auto',zIndex:10,position:'relative'}}>
                    {results.map(s=>(
                      <button key={s.id} type="button"
                        className={`w-100 text-start border-0 px-3 py-2 small d-flex align-items-center gap-2 ${form.student_id===s.id?'bg-primary text-white':'bg-white'}`}
                        onClick={()=>{setSelectedStudent(s);setForm(f=>({...f,student_id:s.id}));setResults([])}}>
                        <div>
                          <div className="fw-medium">{s.first_name} {s.last_name||''}</div>
                          <code style={{fontSize:10}}>{s.admission_no}</code>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {selectedStudent&&(
                  <div className="mt-1 p-2 bg-success bg-opacity-10 rounded small">
                    <i className="bi bi-check-circle-fill text-success me-1"></i>
                    <strong>{selectedStudent.first_name} {selectedStudent.last_name||''}</strong>
                    <code className="ms-2">{selectedStudent.admission_no}</code>
                  </div>
                )}
              </div>

              <div className="col-md-3">
                <label className="form-label fw-medium small">Route *</label>
                <select className="form-select" value={form.route_id}
                  onChange={e=>{setForm(f=>({...f,route_id:e.target.value,stop_id:''}));loadStops(e.target.value)}}>
                  <option value="">Select route</option>
                  {routes.map(r=><option key={r.id} value={r.id}>{r.route_no} — {r.name}</option>)}
                </select>
              </div>

              <div className="col-md-3">
                <label className="form-label fw-medium small">Boarding Stop</label>
                <select className="form-select" value={form.stop_id} onChange={e=>setForm(f=>({...f,stop_id:e.target.value}))}>
                  <option value="">Select stop</option>
                  {stops.map(s=><option key={s.id} value={s.id}>{s.stop_no}. {s.name}</option>)}
                </select>
                {stops.length===0&&form.route_id&&<div className="form-text text-warning">No stops defined for this route</div>}
              </div>

              <div className="col-md-2">
                <label className="form-label fw-medium small">Pickup Type</label>
                <select className="form-select" value={form.pickup_type} onChange={e=>setForm(f=>({...f,pickup_type:e.target.value}))}>
                  {PICKUP_TYPES.map(p=><option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
            </div>

            <ErrBox msg={err} />

            <div className="d-flex gap-2 mt-3">
              <button className="btn btn-primary" onClick={save} disabled={saving}>
                {saving?<><span className="spinner-border spinner-border-sm me-2"></span>Assigning...</>:<><i className="bi bi-check-circle me-2"></i>Assign Transport</>}
              </button>
              <button className="btn btn-light" onClick={()=>{setShowForm(false);setErr('')}}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {loading?<Spinner/>:assignments.length===0?(
        <div className="card border-0 shadow-sm">
          <div className="card-body text-center py-5 text-muted">
            <i className="bi bi-people fs-1 d-block mb-2 opacity-25"></i>
            <h6>No students assigned to transport yet</h6>
          </div>
        </div>
      ):(
        <div className="card border-0 shadow-sm">
          <div className="card-header bg-white fw-semibold">
            <i className="bi bi-people-fill me-2 text-primary"></i>Assigned Students
          </div>
          <div className="table-responsive">
            <table className="table table-sm table-hover align-middle mb-0">
              <thead className="table-light">
                <tr><th>Student</th><th>Class</th><th>Route</th><th>Stop</th><th>Pickup</th><th>Drop</th><th>Type</th><th style={{width:60}}></th></tr>
              </thead>
              <tbody>
                {assignments.map(a=>(
                  <tr key={a.id}>
                    <td><div className="fw-medium small">{a.student_name}</div><code style={{fontSize:10}} className="text-muted">{a.admission_no}</code></td>
                    <td className="text-muted small">{a.grade_name} {a.section_name}</td>
                    <td><code className="small">{a.route_no}</code> <span className="text-muted small">{a.route_name}</span></td>
                    <td className="small">{a.stop_name||'—'}</td>
                    <td className="small text-muted">{a.pickup_time?.slice(0,5)||'—'}</td>
                    <td className="small text-muted">{a.drop_time?.slice(0,5)||'—'}</td>
                    <td><span className="badge bg-info text-dark small" style={{fontSize:10}}>{PICKUP_TYPES.find(p=>p.value===a.pickup_type)?.label||a.pickup_type}</span></td>
                    <td><button className="btn btn-outline-danger btn-sm" onClick={()=>remove(a)}><i className="bi bi-x"></i></button></td>
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
