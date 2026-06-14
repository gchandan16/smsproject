// frontend/src/pages/RolePermissionsPage.jsx
// Superadmin-only UI to view and edit role permissions
// Drop into SettingsPage as a new tab: <RolePermissionsTab />

import { useState, useEffect, useCallback } from 'react'
import { useSelector } from 'react-redux'
import api from '../api/client'

// ─── Module definitions ────────────────────────────────────────────────────
// Each module has a set of granular actions that can be toggled per role
const MODULES = [
  {
    key: 'dashboard', label: 'Dashboard', icon: 'bi-speedometer2',
    actions: [
      { key: 'view', label: 'View dashboard' },
    ],
  },
  {
    key: 'students', label: 'Students & Admissions', icon: 'bi-mortarboard',
    actions: [
      { key: 'view',   label: 'View student profiles' },
      { key: 'create', label: 'Add new students' },
      { key: 'edit',   label: 'Edit student profiles' },
      { key: 'delete', label: 'Delete / deactivate students' },
    ],
  },
  {
    key: 'attendance', label: 'Attendance', icon: 'bi-clipboard-check',
    actions: [
      { key: 'view', label: 'View attendance records' },
      { key: 'mark', label: 'Mark / edit attendance' },
    ],
  },
  {
    key: 'timetable', label: 'Timetable', icon: 'bi-calendar3',
    actions: [
      { key: 'view', label: 'View timetables' },
      { key: 'edit', label: 'Build / edit timetables' },
    ],
  },
  {
    key: 'fees', label: 'Fee Management', icon: 'bi-cash-coin',
    actions: [
      { key: 'view',     label: 'View invoices & payments' },
      { key: 'generate', label: 'Generate invoices' },
      { key: 'collect',  label: 'Collect / record payments' },
      { key: 'cancel',   label: 'Cancel invoices' },
    ],
  },
  {
    key: 'finance_reports', label: 'Finance Reports', icon: 'bi-bar-chart-line',
    actions: [
      { key: 'view',   label: 'View finance reports' },
      { key: 'export', label: 'Export to Excel / PDF' },
    ],
  },
  {
    key: 'exams', label: 'Exams & Results', icon: 'bi-journal-text',
    actions: [
      { key: 'view',        label: 'View exams & results' },
      { key: 'create',      label: 'Create / schedule exams' },
      { key: 'enter_marks', label: 'Enter marks' },
      { key: 'publish',     label: 'Publish results / report cards' },
    ],
  },
  {
    key: 'transport', label: 'Transport', icon: 'bi-bus-front',
    actions: [
      { key: 'view',   label: 'View routes, vehicles, students' },
      { key: 'manage', label: 'Add / edit routes, stops, vehicles' },
      { key: 'assign', label: 'Assign students to routes' },
    ],
  },
  {
    key: 'library', label: 'Library', icon: 'bi-book',
    actions: [
      { key: 'view',   label: 'View books & members' },
      { key: 'issue',  label: 'Issue & return books' },
      { key: 'manage', label: 'Add / edit books & categories' },
    ],
  },
  {
    key: 'reports', label: 'Reports & Certificates', icon: 'bi-file-earmark-bar-graph',
    actions: [
      { key: 'view',        label: 'View all reports' },
      { key: 'id_cards',    label: 'Generate ID cards' },
      { key: 'certificates',label: 'Generate bonafide certificates' },
    ],
  },
  {
    key: 'settings', label: 'Settings', icon: 'bi-gear',
    actions: [
      { key: 'view',         label: 'View settings' },
      { key: 'school',       label: 'Edit school profile' },
      { key: 'academic',     label: 'Manage academic years, grades, sections' },
      { key: 'fee_setup',    label: 'Manage fee categories & structures' },
      { key: 'users',        label: 'Manage users & logins' },
      { key: 'permissions',  label: 'Manage role permissions (Superadmin only)' },
    ],
  },
]

// ─── Default permissions per role ─────────────────────────────────────────
const ROLE_DEFAULTS = {
  admin: [
    'dashboard.view',
    'students.view','students.create','students.edit',
    'attendance.view','attendance.mark',
    'timetable.view','timetable.edit',
    'fees.view','fees.generate','fees.collect',
    'finance_reports.view','finance_reports.export',
    'exams.view','exams.create','exams.enter_marks','exams.publish',
    'transport.view','transport.manage','transport.assign',
    'library.view','library.issue','library.manage',
    'reports.view','reports.id_cards','reports.certificates',
    'settings.view','settings.school','settings.academic','settings.fee_setup','settings.users',
  ],
  accountant: [
    'dashboard.view',
    'students.view',
    'fees.view','fees.generate','fees.collect',
    'finance_reports.view','finance_reports.export',
    'transport.view',
    'reports.view',
    'settings.view',
  ],
  teacher: [
    'dashboard.view',
    'students.view',
    'attendance.view','attendance.mark',
    'timetable.view',
    'exams.view','exams.enter_marks',
    'transport.view',
    'library.view',
    'settings.view',
  ],
  parent: ['dashboard.view'],
  student: ['dashboard.view'],
}

const ROLE_COLORS = {
  superadmin: { badge: 'danger',  hex: '#DC3545' },
  admin:      { badge: 'primary', hex: '#1E3A5F' },
  accountant: { badge: 'success', hex: '#2D5F4C' },
  teacher:    { badge: 'warning', hex: '#E8A33D' },
  parent:     { badge: 'info',    hex: '#0DCAF0' },
  student:    { badge: 'secondary',hex: '#6C757D' },
}

const LOCK_ICON = 'bi-lock-fill'
const UNLOCK_ICON = 'bi-check2-square'

// ─── Main component ────────────────────────────────────────────────────────
export default function RolePermissionsTab() {
  const [roles, setRoles]           = useState([])
  const [selected, setSelected]     = useState(null) // role object
  const [perms, setPerms]           = useState(new Set()) // Set of "module.action" strings
  const [loading, setLoading]       = useState(true)
  const [saving, setSaving]         = useState(false)
  const [dirty, setDirty]           = useState(false)
  const [toast, setToast]           = useState(null) // { type, msg }
  const [expandedMods, setExpanded] = useState({})

  const showToast = (type, msg) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 3500)
  }

  // Load all roles
  const loadRoles = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/users/roles-with-permissions')
      setRoles(data)
      if (data.length && !selected) {
        selectRole(data.find(r => r.name !== 'superadmin') || data[0], data)
      } else if (selected) {
        // Refresh selected role's perms from server
        const fresh = data.find(r => r.id === selected.id)
        if (fresh) applyRole(fresh)
      }
    } catch (e) {
      showToast('danger', 'Failed to load roles.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadRoles() }, [loadRoles])

  const applyRole = (role) => {
    setSelected(role)
    setPerms(new Set(role.permissions || []))
    setDirty(false)
    // Expand all modules by default
    const exp = {}
    MODULES.forEach(m => { exp[m.key] = true })
    setExpanded(exp)
  }

  const selectRole = (role, allRoles) => {
    if (dirty && !confirm('You have unsaved changes. Discard them?')) return
    const fresh = (allRoles || roles).find(r => r.id === role.id) || role
    applyRole(fresh)
  }

  // Toggle a single permission
  const toggle = (key) => {
    if (selected?.name === 'superadmin') return
    setPerms(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
    setDirty(true)
  }

  // Toggle an entire module (all its actions)
  const toggleModule = (mod) => {
    if (selected?.name === 'superadmin') return
    const allKeys = mod.actions.map(a => `${mod.key}.${a.key}`)
    const allOn = allKeys.every(k => perms.has(k))
    setPerms(prev => {
      const next = new Set(prev)
      if (allOn) allKeys.forEach(k => next.delete(k))
      else allKeys.forEach(k => next.add(k))
      return next
    })
    setDirty(true)
  }

  // Apply template defaults
  const applyDefaults = () => {
    if (!selected) return
    const defaults = ROLE_DEFAULTS[selected.name.toLowerCase()] || []
    setPerms(new Set(defaults))
    setDirty(true)
    showToast('info', `Default permissions for "${selected.name}" applied. Save to confirm.`)
  }

  // Clear all permissions
  const clearAll = () => {
    if (!selected || selected.name === 'superadmin') return
    if (!confirm('Remove ALL permissions from this role?')) return
    setPerms(new Set())
    setDirty(true)
  }

  // Select all permissions
  const selectAll = () => {
    if (!selected || selected.name === 'superadmin') return
    const all = []
    MODULES.forEach(m => m.actions.forEach(a => all.push(`${m.key}.${a.key}`)))
    setPerms(new Set(all))
    setDirty(true)
  }

  // Save
  const save = async () => {
    if (!selected || !dirty) return
    setSaving(true)
    try {
      await api.put(`/users/roles/${selected.id}/permissions`, {
        permissions: [...perms],
      })
      setDirty(false)
      showToast('success', `Permissions for "${selected.name}" saved successfully.`)
      await loadRoles()
    } catch (e) {
      const msg = e.response?.data?.detail
      showToast('danger', typeof msg === 'string' ? msg : 'Failed to save permissions.')
    } finally {
      setSaving(false)
    }
  }

  const isSuperadmin = selected?.name?.toLowerCase() === 'superadmin'
  const totalPerms = MODULES.reduce((n, m) => n + m.actions.length, 0)
  const activeCount = perms.size

  // ─── Render ────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        .rp-role-pill {
          cursor: pointer;
          border: 2px solid transparent;
          border-radius: 12px;
          padding: 10px 14px;
          transition: all .15s;
          background: #fff;
        }
        .rp-role-pill:hover { border-color: #1E3A5F22; background: #f8f9fb; }
        .rp-role-pill.active { border-color: #1E3A5F; background: #EEF2F8; }
        .rp-mod-header {
          display: flex; align-items: center; gap: 10px;
          padding: 12px 16px; cursor: pointer;
          user-select: none;
          border-radius: 10px 10px 0 0;
          background: #F8FAFC;
          border-bottom: 1px solid #E2E8F0;
        }
        .rp-mod-header:hover { background: #F1F5F9; }
        .rp-perm-row {
          display: flex; align-items: center; justify-content: space-between;
          padding: 9px 16px; border-bottom: 1px solid #F1F5F9;
          transition: background .1s;
        }
        .rp-perm-row:last-child { border-bottom: none; }
        .rp-perm-row:hover { background: #FAFAFA; }
        .rp-toggle {
          position: relative; display: inline-block;
          width: 40px; height: 22px; flex-shrink: 0;
        }
        .rp-toggle input { opacity: 0; width: 0; height: 0; }
        .rp-slider {
          position: absolute; cursor: pointer;
          inset: 0; border-radius: 22px;
          background: #CBD5E1; transition: .2s;
        }
        .rp-slider:before {
          content: ''; position: absolute;
          width: 16px; height: 16px; left: 3px; bottom: 3px;
          border-radius: 50%; background: white; transition: .2s;
        }
        input:checked + .rp-slider { background: #2D5F4C; }
        input:checked + .rp-slider:before { transform: translateX(18px); }
        .rp-slider.disabled { cursor: not-allowed; opacity: .5; }
        .rp-count-badge {
          font-size: 11px; padding: 2px 8px; border-radius: 10px;
          background: #E6F0EA; color: #2D5F4C; font-weight: 600;
        }
        .rp-count-badge.zero { background: #F1F5F9; color: #94A3B8; }
        .rp-save-bar {
          position: sticky; bottom: 0; z-index: 10;
          background: #1E3A5F; color: white;
          padding: 12px 20px; border-radius: 12px;
          display: flex; align-items: center; justify-content: space-between;
          box-shadow: 0 -4px 20px rgba(30,58,95,.18);
          margin-top: 20px;
        }
        .rp-toast {
          position: fixed; bottom: 28px; right: 28px; z-index: 9999;
          min-width: 280px; padding: 12px 18px; border-radius: 12px;
          font-size: 14px; font-weight: 500;
          animation: slideUp .25s ease;
          box-shadow: 0 8px 24px rgba(0,0,0,.12);
        }
        @keyframes slideUp {
          from { opacity:0; transform:translateY(16px); }
          to   { opacity:1; transform:translateY(0); }
        }
      `}</style>

      {/* Toast */}
      {toast && (
        <div className={`rp-toast alert alert-${toast.type} mb-0`}>
          <i className={`bi ${toast.type === 'success' ? 'bi-check-circle-fill' : toast.type === 'danger' ? 'bi-exclamation-triangle-fill' : 'bi-info-circle-fill'} me-2`}></i>
          {toast.msg}
        </div>
      )}

      <div className="d-flex align-items-center justify-content-between mb-3">
        <div>
          <h5 className="fw-bold mb-1" style={{ color: '#1E2A38' }}>
            <i className="bi bi-shield-lock me-2" style={{ color: '#1E3A5F' }}></i>
            Role Permissions
          </h5>
          <p className="text-muted small mb-0">
            Control what each role can see and do. Only Superadmin can change these.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary"></div>
          <div className="text-muted small mt-2">Loading roles…</div>
        </div>
      ) : (
        <div className="row g-4">

          {/* ── Left: Role selector ── */}
          <div className="col-lg-3">
            <div className="card border-0 shadow-sm">
              <div className="card-header bg-white border-0 pb-0">
                <span className="fw-semibold small text-muted text-uppercase" style={{ letterSpacing: '.08em' }}>Select Role</span>
              </div>
              <div className="card-body p-2">
                {roles.map(role => {
                  const col = ROLE_COLORS[role.name.toLowerCase()] || { badge: 'secondary', hex: '#6c757d' }
                  const isActive = selected?.id === role.id
                  const pct = role.name === 'superadmin' ? 100
                    : Math.round((role.permissions?.length || 0) / totalPerms * 100)
                  return (
                    <div
                      key={role.id}
                      className={`rp-role-pill mb-1 ${isActive ? 'active' : ''}`}
                      onClick={() => selectRole(role)}
                    >
                      <div className="d-flex align-items-center justify-content-between">
                        <div className="d-flex align-items-center gap-2">
                          <span className={`badge bg-${col.badge}`} style={{ fontSize: 11 }}>
                            {role.name}
                          </span>
                          {role.name === 'superadmin' && (
                            <i className="bi bi-shield-fill-check text-danger" style={{ fontSize: 13 }}></i>
                          )}
                        </div>
                        <span className="text-muted" style={{ fontSize: 11 }}>{pct}%</span>
                      </div>
                      {role.name !== 'superadmin' && (
                        <div className="progress mt-2" style={{ height: 4, borderRadius: 4 }}>
                          <div
                            className={`progress-bar bg-${col.badge}`}
                            style={{ width: `${pct}%` }}
                          ></div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Legend */}
            <div className="card border-0 shadow-sm mt-3">
              <div className="card-body p-3">
                <div className="small fw-semibold text-muted mb-2 text-uppercase" style={{ fontSize: 11, letterSpacing: '.08em' }}>How it works</div>
                <div className="d-flex flex-column gap-2" style={{ fontSize: 12, color: '#475569' }}>
                  <div><i className="bi bi-toggles text-success me-2"></i>Toggle individual actions on/off</div>
                  <div><i className="bi bi-check2-all text-primary me-2"></i>Check module header to toggle all actions in a module</div>
                  <div><i className="bi bi-arrow-counterclockwise text-warning me-2"></i>Apply Defaults to restore recommended settings</div>
                  <div><i className="bi bi-lock-fill text-danger me-2"></i>Superadmin always has full access</div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Right: Permissions matrix ── */}
          <div className="col-lg-9">
            {selected ? (
              <>
                {/* Role header */}
                <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
                  <div className="d-flex align-items-center gap-3">
                    <h6 className="fw-bold mb-0 text-capitalize" style={{ color: '#1E2A38', fontSize: 17 }}>
                      {selected.name}
                    </h6>
                    {isSuperadmin ? (
                      <span className="badge bg-danger">Full Access — Cannot be restricted</span>
                    ) : (
                      <span className={`${activeCount === 0 ? 'rp-count-badge zero' : 'rp-count-badge'}`}>
                        {activeCount} / {totalPerms} permissions active
                      </span>
                    )}
                    {dirty && <span className="badge bg-warning text-dark"><i className="bi bi-pencil me-1"></i>Unsaved changes</span>}
                  </div>
                  {!isSuperadmin && (
                    <div className="d-flex gap-2">
                      <button className="btn btn-sm btn-outline-secondary" onClick={clearAll}>
                        <i className="bi bi-x-circle me-1"></i>Clear All
                      </button>
                      <button className="btn btn-sm btn-outline-secondary" onClick={selectAll}>
                        <i className="bi bi-check2-all me-1"></i>Select All
                      </button>
                      <button className="btn btn-sm btn-outline-primary" onClick={applyDefaults}>
                        <i className="bi bi-arrow-counterclockwise me-1"></i>Apply Defaults
                      </button>
                    </div>
                  )}
                </div>

                {/* Superadmin notice */}
                {isSuperadmin && (
                  <div className="alert alert-danger d-flex align-items-center gap-2 mb-3">
                    <i className="bi bi-shield-fill-check fs-5"></i>
                    <div>
                      <strong>Superadmin has unrestricted access</strong> to all modules and actions.
                      This cannot be changed to protect system integrity.
                    </div>
                  </div>
                )}

                {/* Module cards */}
                <div className="d-flex flex-column gap-3">
                  {MODULES.map(mod => {
                    const modKeys = mod.actions.map(a => `${mod.key}.${a.key}`)
                    const activeInMod = modKeys.filter(k => isSuperadmin || perms.has(k)).length
                    const allOn = isSuperadmin || modKeys.every(k => perms.has(k))
                    const someOn = !allOn && modKeys.some(k => perms.has(k))
                    const expanded = expandedMods[mod.key] !== false

                    return (
                      <div key={mod.key} className="card border-0 shadow-sm" style={{ borderRadius: 12, overflow: 'hidden' }}>
                        {/* Module header row */}
                        <div
                          className="rp-mod-header"
                          onClick={() => setExpanded(prev => ({ ...prev, [mod.key]: !expanded }))}
                        >
                          <div className="form-check mb-0" style={{ marginRight: 4 }}>
                            <input
                              type="checkbox"
                              className="form-check-input"
                              checked={allOn}
                              ref={el => { if (el) el.indeterminate = someOn }}
                              onChange={(e) => { e.stopPropagation(); toggleModule(mod) }}
                              disabled={isSuperadmin}
                              style={{ cursor: isSuperadmin ? 'not-allowed' : 'pointer', width: 16, height: 16 }}
                              onClick={e => e.stopPropagation()}
                            />
                          </div>
                          <i className={`bi ${mod.icon}`} style={{ color: '#1E3A5F', fontSize: 17 }}></i>
                          <span className="fw-semibold flex-fill" style={{ color: '#1E2A38', fontSize: 14 }}>
                            {mod.label}
                          </span>
                          <span className={`rp-count-badge ${activeInMod === 0 && !isSuperadmin ? 'zero' : ''}`}>
                            {isSuperadmin ? 'All' : `${activeInMod}/${mod.actions.length}`}
                          </span>
                          <i className={`bi ${expanded ? 'bi-chevron-up' : 'bi-chevron-down'} ms-2 text-muted`} style={{ fontSize: 13 }}></i>
                        </div>

                        {/* Action rows */}
                        {expanded && (
                          <div>
                            {mod.actions.map(action => {
                              const key = `${mod.key}.${action.key}`
                              const on = isSuperadmin || perms.has(key)
                              return (
                                <div key={key} className="rp-perm-row">
                                  <div style={{ fontSize: 13.5, color: '#334155' }}>
                                    <i className={`bi ${on ? 'bi-check-circle-fill text-success' : 'bi-circle text-muted'} me-2`} style={{ fontSize: 14 }}></i>
                                    {action.label}
                                  </div>
                                  <label className="rp-toggle">
                                    <input
                                      type="checkbox"
                                      checked={on}
                                      onChange={() => toggle(key)}
                                      disabled={isSuperadmin}
                                    />
                                    <span className={`rp-slider ${isSuperadmin ? 'disabled' : ''}`}></span>
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

                {/* Sticky save bar */}
                {!isSuperadmin && dirty && (
                  <div className="rp-save-bar">
                    <div>
                      <i className="bi bi-exclamation-circle me-2"></i>
                      You have unsaved changes to <strong>{selected.name}</strong> permissions.
                    </div>
                    <div className="d-flex gap-2">
                      <button className="btn btn-sm btn-outline-light" onClick={() => applyRole(selected)}>
                        Discard
                      </button>
                      <button
                        className="btn btn-sm btn-warning fw-bold"
                        onClick={save}
                        disabled={saving}
                      >
                        {saving
                          ? <><span className="spinner-border spinner-border-sm me-2"></span>Saving…</>
                          : <><i className="bi bi-check-lg me-1"></i>Save Permissions</>}
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="card border-0 shadow-sm">
                <div className="card-body text-center py-5 text-muted">
                  <i className="bi bi-shield-lock fs-1 d-block mb-3 opacity-25"></i>
                  <h6>Select a role to manage permissions</h6>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
