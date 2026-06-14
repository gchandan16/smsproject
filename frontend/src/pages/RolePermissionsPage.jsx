// frontend/src/pages/RolePermissionsPage.jsx
// Pure dynamic — all modules, actions, and defaults come from the database.
// No hardcoded MODULES or ROLE_DEFAULTS arrays.

import { useState, useEffect, useCallback, useRef } from 'react'
import api from '../api/client'

const ROLE_COLORS = {
  superadmin: 'danger',
  admin:      'primary',
  accountant: 'success',
  teacher:    'warning',
  parent:     'info',
  student:    'secondary',
}

export default function RolePermissionsTab() {
  const [schema,   setSchema]   = useState([])   // [{key,label,icon,order,actions:[{key,label}]}]
  const [roles,    setRoles]    = useState([])   // [{id,name,is_system,permissions:[]}]
  const [selected, setSelected] = useState(null) // current role object
  const [perms,    setPerms]    = useState(new Set())
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [dirty,    setDirty]    = useState(false)
  const [toast,    setToast]    = useState(null)
  const [expanded, setExpanded] = useState({})
  const [defaultsLoading, setDefaultsLoading] = useState(false)
  const pendingRole = useRef(null)

  const showToast = (type, msg) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 3500)
  }

  // Load schema + roles together on mount
  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [schemaRes, rolesRes] = await Promise.all([
        api.get('/users/permission-schema'),
        api.get('/users/roles-with-permissions'),
      ])
      setSchema(schemaRes.data)
      setRoles(rolesRes.data)

      // Auto-select first non-superadmin role
      if (!selected && rolesRes.data.length) {
        const first = rolesRes.data.find(r => r.name !== 'superadmin') || rolesRes.data[0]
        applyRoleData(first)
      } else if (selected) {
        const fresh = rolesRes.data.find(r => r.id === selected.id)
        if (fresh) applyRoleData(fresh)
      }

      // Expand all modules by default
      const exp = {}
      schemaRes.data.forEach(m => { exp[m.key] = true })
      setExpanded(exp)
    } catch (e) {
      const msg = e.response?.data?.detail
      if (e.response?.status === 404) {
        showToast('warning', 'Permission schema not found in database. Run seed_permissions.py first.')
      } else {
        showToast('danger', typeof msg === 'string' ? msg : 'Failed to load permission data.')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  const applyRoleData = (role) => {
    setSelected(role)
    // Only load permissions that match our "module.action" dot format.
    // Old-format strings like "fees:*" or "**" are ignored in the UI toggles
    // (they won't match any key) — superadmin must re-save to migrate to new format.
    const dotFormatPerms = (role.permissions || []).filter(
      p => typeof p === 'string' && p.includes('.') && !p.includes(':') && p !== '**'
    )
    setPerms(new Set(dotFormatPerms))
    setDirty(false)
    pendingRole.current = null
  }

  // Returns true when the role has old-format permissions that need re-saving
  const hasLegacyPerms = (role) => {
    return (role?.permissions || []).some(
      p => typeof p === 'string' && (p.includes(':') || p === '**' || p === '*')
    )
  }

  const selectRole = (role) => {
    if (dirty && !confirm('You have unsaved changes. Discard them?')) return
    const fresh = roles.find(r => r.id === role.id) || role
    applyRoleData(fresh)
  }

  const toggle = (key) => {
    if (selected?.name === 'superadmin') return
    setPerms(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
    setDirty(true)
  }

  const toggleModule = (mod) => {
    if (selected?.name === 'superadmin') return
    const allKeys = mod.actions.map(a => `${mod.key}.${a.key}`)
    const allOn = allKeys.every(k => perms.has(k))
    setPerms(prev => {
      const next = new Set(prev)
      allOn ? allKeys.forEach(k => next.delete(k)) : allKeys.forEach(k => next.add(k))
      return next
    })
    setDirty(true)
  }

  // Load defaults from DB then apply
  const applyDefaults = async () => {
    if (!selected || selected.name === 'superadmin') return
    setDefaultsLoading(true)
    try {
      const { data } = await api.get(`/users/role-defaults/${selected.name}`)
      setPerms(new Set(data.permissions || []))
      setDirty(true)
      showToast('info', `Default permissions for "${selected.name}" loaded from database. Save to confirm.`)
    } catch {
      showToast('danger', 'Failed to load defaults from database.')
    } finally {
      setDefaultsLoading(false)
    }
  }

  const clearAll = () => {
    if (!selected || selected.name === 'superadmin') return
    if (!confirm('Remove ALL permissions from this role?')) return
    setPerms(new Set())
    setDirty(true)
  }

  const selectAll = () => {
    if (!selected || selected.name === 'superadmin') return
    const all = new Set()
    schema.forEach(m => m.actions.forEach(a => all.add(`${m.key}.${a.key}`)))
    setPerms(all)
    setDirty(true)
  }

  const save = async () => {
    if (!selected || !dirty) return
    setSaving(true)
    try {
      const payload = [...perms]
      const res = await api.put(`/users/roles/${selected.id}/permissions`, {
        permissions: payload,
      })
      const savedCount = res.data?.saved_count ?? payload.length
      setDirty(false)
      if (savedCount === 0 && payload.length > 0) {
        showToast('warning',
          `Saved but 0 permissions recorded. Check that permission strings are in "module.action" format.`)
      } else {
        showToast('success',
          `Saved ${savedCount} permission${savedCount !== 1 ? 's' : ''} for "${selected.name}".`)
      }
      await loadAll()
    } catch (e) {
      const msg = e.response?.data?.detail
      showToast('danger', typeof msg === 'string' ? msg : 'Failed to save permissions.')
    } finally {
      setSaving(false)
    }
  }

  const totalPerms = schema.reduce((n, m) => n + m.actions.length, 0)
  const isSuperadmin = selected?.name?.toLowerCase() === 'superadmin'

  return (
    <div style={{ fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        .rp-pill { cursor:pointer; border:2px solid transparent; border-radius:12px; padding:10px 14px; transition:all .15s; background:#fff; }
        .rp-pill:hover { border-color:#1E3A5F22; background:#f8f9fb; }
        .rp-pill.active { border-color:#1E3A5F; background:#EEF2F8; }
        .rp-mod-head { display:flex; align-items:center; gap:10px; padding:12px 16px; cursor:pointer; user-select:none; background:#F8FAFC; border-bottom:1px solid #E2E8F0; border-radius:10px 10px 0 0; }
        .rp-mod-head:hover { background:#F1F5F9; }
        .rp-row { display:flex; align-items:center; justify-content:space-between; padding:9px 16px; border-bottom:1px solid #F1F5F9; transition:background .1s; }
        .rp-row:last-child { border-bottom:none; }
        .rp-row:hover { background:#FAFAFA; }
        .rp-toggle { position:relative; display:inline-block; width:40px; height:22px; flex-shrink:0; }
        .rp-toggle input { opacity:0; width:0; height:0; }
        .rp-slider { position:absolute; cursor:pointer; inset:0; border-radius:22px; background:#CBD5E1; transition:.2s; }
        .rp-slider:before { content:''; position:absolute; width:16px; height:16px; left:3px; bottom:3px; border-radius:50%; background:white; transition:.2s; }
        input:checked + .rp-slider { background:#2D5F4C; }
        input:checked + .rp-slider:before { transform:translateX(18px); }
        .rp-slider.off { cursor:not-allowed; opacity:.5; }
        .rp-badge { font-size:11px; padding:2px 8px; border-radius:10px; background:#E6F0EA; color:#2D5F4C; font-weight:600; }
        .rp-badge.zero { background:#F1F5F9; color:#94A3B8; }
        .rp-save { position:sticky; bottom:0; z-index:10; background:#1E3A5F; color:white; padding:12px 20px; border-radius:12px; display:flex; align-items:center; justify-content:space-between; box-shadow:0 -4px 20px rgba(30,58,95,.18); margin-top:20px; }
        .rp-toast { position:fixed; bottom:28px; right:28px; z-index:9999; min-width:280px; padding:12px 18px; border-radius:12px; font-size:14px; font-weight:500; animation:rpSlide .25s ease; box-shadow:0 8px 24px rgba(0,0,0,.12); }
        @keyframes rpSlide { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        .rp-empty { text-align:center; padding:60px 0; color:#94A3B8; }
        .rp-empty i { font-size:48px; display:block; margin-bottom:16px; opacity:.25; }
      `}</style>

      {toast && (
        <div className={`rp-toast alert alert-${toast.type} mb-0`}>
          <i className={`bi ${toast.type === 'success' ? 'bi-check-circle-fill' : toast.type === 'warning' ? 'bi-exclamation-triangle-fill' : toast.type === 'danger' ? 'bi-exclamation-triangle-fill' : 'bi-info-circle-fill'} me-2`}></i>
          {toast.msg}
        </div>
      )}

      <div className="d-flex align-items-center justify-content-between mb-3">
        <div>
          <h5 className="fw-bold mb-1" style={{ color: '#1E2A38' }}>
            <i className="bi bi-shield-lock me-2 text-primary"></i>
            Role Permissions
          </h5>
          <p className="text-muted small mb-0">
            Control what each role can see and do across the system. Changes apply the next time the user logs in.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary"></div>
          <div className="text-muted small mt-2">Loading permissions…</div>
        </div>
      ) : (
        <div className="row g-4">

          {/* Left — role list */}
          <div className="col-lg-3">
            <div className="card border-0 shadow-sm mb-3">
              <div className="card-header bg-white border-0 pb-0">
                <span className="fw-semibold small text-muted text-uppercase" style={{ letterSpacing: '.08em' }}>Roles</span>
              </div>
              <div className="card-body p-2">
                {roles.map(role => {
                  const col = ROLE_COLORS[role.name.toLowerCase()] || 'secondary'
                  const isActive = selected?.id === role.id
                  const pct = role.name === 'superadmin' ? 100
                    : totalPerms > 0 ? Math.round((role.permissions?.length || 0) / totalPerms * 100) : 0
                  return (
                    <div key={role.id} className={`rp-pill mb-1 ${isActive ? 'active' : ''}`}
                      onClick={() => selectRole(role)}>
                      <div className="d-flex align-items-center justify-content-between">
                        <div className="d-flex align-items-center gap-2">
                          <span className={`badge bg-${col}`} style={{ fontSize: 11, textTransform: 'capitalize' }}>
                            {role.name}
                          </span>
                          {role.name === 'superadmin' &&
                            <i className="bi bi-shield-fill-check text-danger" style={{ fontSize: 13 }}></i>}
                        </div>
                        <span className="text-muted" style={{ fontSize: 11 }}>{pct}%</span>
                      </div>
                      {role.name !== 'superadmin' && (
                        <div className="progress mt-2" style={{ height: 4, borderRadius: 4 }}>
                          <div className={`progress-bar bg-${col}`} style={{ width: `${pct}%` }}></div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="card border-0 shadow-sm">
              <div className="card-body p-3">
                <div className="small fw-semibold mb-2" style={{ color: '#1E2A38' }}>
                  <i className="bi bi-info-circle me-2 text-primary"></i>How it works
                </div>
                <div className="d-flex flex-column gap-2" style={{ fontSize: 12, color: '#64748B', lineHeight: 1.5 }}>
                  <div className="d-flex gap-2">
                    <i className="bi bi-1-circle-fill text-primary flex-shrink-0 mt-1"></i>
                    <span>Select a role from the list on the left</span>
                  </div>
                  <div className="d-flex gap-2">
                    <i className="bi bi-2-circle-fill text-primary flex-shrink-0 mt-1"></i>
                    <span>Toggle the modules and actions you want that role to access</span>
                  </div>
                  <div className="d-flex gap-2">
                    <i className="bi bi-3-circle-fill text-primary flex-shrink-0 mt-1"></i>
                    <span>Click <strong>Save Permissions</strong> — changes take effect the next time that user logs in</span>
                  </div>
                  <div className="border-top mt-1 pt-2 d-flex flex-column gap-1">
                    <div><i className="bi bi-shield-fill-check text-danger me-1"></i><strong>Superadmin</strong> always has full access</div>
                    <div><i className="bi bi-person-fill text-warning me-1"></i><strong>Student / Parent</strong> always see only their own data</div>
                    <div className="text-muted" style={{ fontSize: 11 }}>{schema.length} modules · {totalPerms} permissions available</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right — permissions matrix */}
          <div className="col-lg-9">
            {!selected ? (
              <div className="rp-empty card border-0 shadow-sm">
                <i className="bi bi-shield-lock"></i>
                <h6>Select a role to manage permissions</h6>
              </div>
            ) : (
              <>
                {/* Role header */}
                <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
                  <div className="d-flex align-items-center gap-3">
                    <h6 className="fw-bold mb-0 text-capitalize" style={{ color: '#1E2A38', fontSize: 17 }}>
                      {selected.name}
                    </h6>
                    {isSuperadmin ? (
                      <span className="badge bg-danger">Full access — cannot be restricted</span>
                    ) : (
                      <span className={`rp-badge ${perms.size === 0 ? 'zero' : ''}`}>
                        {perms.size} / {totalPerms} active
                      </span>
                    )}
                    {dirty && <span className="badge bg-warning text-dark"><i className="bi bi-pencil me-1"></i>Unsaved</span>}
                  </div>
                  {!isSuperadmin && (
                    <div className="d-flex gap-2 flex-wrap">
                      <button className="btn btn-sm btn-outline-secondary" onClick={clearAll}>
                        <i className="bi bi-x-circle me-1"></i>Clear all
                      </button>
                      <button className="btn btn-sm btn-outline-secondary" onClick={selectAll}>
                        <i className="bi bi-check2-all me-1"></i>Select all
                      </button>
                      <button className="btn btn-sm btn-outline-primary" onClick={applyDefaults}
                        disabled={defaultsLoading}>
                        {defaultsLoading
                          ? <><span className="spinner-border spinner-border-sm me-1"></span>Loading…</>
                          : <><i className="bi bi-database-check me-1"></i>Apply defaults</>}
                      </button>
                    </div>
                  )}
                </div>

                {isSuperadmin && (
                  <div className="alert alert-danger d-flex gap-2 mb-3">
                    <i className="bi bi-shield-fill-check fs-5"></i>
                    <div><strong>Superadmin has unrestricted access</strong> to all modules. This cannot be changed.</div>
                  </div>
                )}

                {/* Legacy format migration warning */}
                {!isSuperadmin && hasLegacyPerms(selected) && (
                  <div className="alert alert-warning d-flex gap-2 align-items-start mb-3">
                    <i className="bi bi-exclamation-triangle-fill fs-5 flex-shrink-0"></i>
                    <div>
                      <strong>Legacy permissions detected</strong> for <code>{selected.name}</code>.
                      The existing permissions in the database use an old format (<code>fees:*</code> / <code>**</code>)
                      that is incompatible with the new module-based system.
                      <br/>
                      <span className="small mt-1 d-block">
                        Toggle the permissions you want below and click <strong>Save Permissions</strong>
                        to migrate to the new format. All old entries will be replaced.
                      </span>
                    </div>
                  </div>
                )}

                {schema.length === 0 ? (
                  <div className="text-center py-5 text-muted">
                    <div className="spinner-border spinner-border-sm mb-2"></div>
                    <p className="small mb-0">Loading permission schema…</p>
                  </div>
                ) : (
                  <div className="d-flex flex-column gap-3">
                    {schema.map(mod => {
                      const modKeys = mod.actions.map(a => `${mod.key}.${a.key}`)
                      const activeCount = isSuperadmin ? mod.actions.length : modKeys.filter(k => perms.has(k)).length
                      const allOn = isSuperadmin || modKeys.every(k => perms.has(k))
                      const someOn = !allOn && modKeys.some(k => perms.has(k))
                      const isExpanded = expandedMod => expanded[expandedMod] !== false
                      const exp = expanded[mod.key] !== false

                      return (
                        <div key={mod.key} className="card border-0 shadow-sm" style={{ borderRadius: 12, overflow: 'hidden' }}>
                          <div className="rp-mod-head"
                            onClick={() => setExpanded(prev => ({ ...prev, [mod.key]: !exp }))}>
                            <div className="form-check mb-0" style={{ marginRight: 4 }}>
                              <input type="checkbox" className="form-check-input"
                                style={{ width: 16, height: 16, cursor: isSuperadmin ? 'not-allowed' : 'pointer' }}
                                checked={allOn}
                                ref={el => { if (el) el.indeterminate = someOn }}
                                onChange={e => { e.stopPropagation(); toggleModule(mod) }}
                                disabled={isSuperadmin}
                                onClick={e => e.stopPropagation()}
                              />
                            </div>
                            <i className={`bi ${mod.icon}`} style={{ color: '#1E3A5F', fontSize: 17 }}></i>
                            <span className="fw-semibold flex-fill" style={{ color: '#1E2A38', fontSize: 14 }}>
                              {mod.label}
                            </span>
                            <span className={`rp-badge ${activeCount === 0 && !isSuperadmin ? 'zero' : ''}`}>
                              {isSuperadmin ? 'All' : `${activeCount}/${mod.actions.length}`}
                            </span>
                            <i className={`bi ${exp ? 'bi-chevron-up' : 'bi-chevron-down'} ms-2 text-muted`}
                              style={{ fontSize: 13 }}></i>
                          </div>

                          {exp && (
                            <div>
                              {mod.actions.map(action => {
                                const key = `${mod.key}.${action.key}`
                                const on = isSuperadmin || perms.has(key)
                                return (
                                  <div key={key} className="rp-row">
                                    <div style={{ fontSize: 13.5, color: '#334155' }}>
                                      <i className={`bi ${on ? 'bi-check-circle-fill text-success' : 'bi-circle text-muted'} me-2`}
                                        style={{ fontSize: 14 }}></i>
                                      {action.label}
                                    </div>
                                    <label className="rp-toggle">
                                      <input type="checkbox" checked={on}
                                        onChange={() => toggle(key)} disabled={isSuperadmin} />
                                      <span className={`rp-slider ${isSuperadmin ? 'off' : ''}`}></span>
                                    </label>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {!isSuperadmin && dirty && (
                  <div className="rp-save">
                    <div>
                      <i className="bi bi-exclamation-circle me-2"></i>
                      Unsaved changes to <strong>{selected.name}</strong> permissions
                    </div>
                    <div className="d-flex gap-2">
                      <button className="btn btn-sm btn-outline-light"
                        onClick={() => { const fresh = roles.find(r => r.id === selected.id); if (fresh) applyRoleData(fresh) }}>
                        Discard
                      </button>
                      <button className="btn btn-sm btn-warning fw-bold" onClick={save} disabled={saving}>
                        {saving
                          ? <><span className="spinner-border spinner-border-sm me-2"></span>Saving…</>
                          : <><i className="bi bi-check-lg me-1"></i>Save permissions</>}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
