// frontend/src/pages/UserManagementPage.jsx
// ─────────────────────────────────────────────────────────────
// Admin-only: Create users, assign roles, reset passwords
// ─────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react'
import api from '../api/client.js'

const ROLES = [
  { value:'admin',      label:'Admin',       color:'bg-danger',   icon:'bi-shield-lock-fill',    desc:'Full access to everything' },
  { value:'teacher',    label:'Teacher',     color:'bg-primary',  icon:'bi-person-video2',       desc:'Attendance, marks, students' },
  { value:'accountant', label:'Accountant',  color:'bg-success',  icon:'bi-cash-coin',           desc:'Fee collection and reports' },
  { value:'student',    label:'Student',     color:'bg-warning',  icon:'bi-mortarboard-fill',    desc:'Own records only' },
  { value:'parent',     label:'Parent',      color:'bg-secondary',icon:'bi-people-fill',         desc:'Child\'s records only' },
]

const roleBadge = (role) => {
  const r = ROLES.find(x => x.value === role)
  return r
    ? <span className={`badge ${r.color} small`}>{r.label}</span>
    : <span className="badge bg-secondary small">{role}</span>
}

export default function UserManagementPage() {
  const [users,      setUsers]      = useState([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [editUser,   setEditUser]   = useState(null)
  const [resetUser,  setResetUser]  = useState(null)
  const [filterRole, setFilterRole] = useState('')
  const [search,     setSearch]     = useState('')

  const load = async () => {
    setLoading(true); setError('')
    try {
      const params = {}
      if (filterRole) params.role   = filterRole
      if (search)     params.search = search
      const { data } = await api.get('/users/', { params })
      setUsers(Array.isArray(data) ? data : [])
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [filterRole])

  const handleDeactivate = async (user) => {
    if (!window.confirm(`Deactivate ${user.first_name}'s account? They will no longer be able to log in.`)) return
    try {
      await api.delete(`/users/${user.id}`)
      load()
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to deactivate')
    }
  }

  const handleReactivate = async (user) => {
    try {
      await api.put(`/users/${user.id}`, { is_active: true })
      load()
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to reactivate')
    }
  }

  return (
    <div>
      <div className="mb-4">
        <h4 className="fw-bold mb-0">User Management</h4>
        <small className="text-muted">Create portal access for teachers, students, parents</small>
      </div>

      {/* Role cards overview */}
      <div className="row g-2 mb-4">
        {ROLES.map(r => {
          const count = users.filter(u => u.role === r.value && u.is_active).length
          return (
            <div key={r.value} className="col-6 col-md col-lg"
              style={{ cursor:'pointer' }}
              onClick={() => setFilterRole(filterRole === r.value ? '' : r.value)}>
              <div className={`card border-0 shadow-sm h-100 ${filterRole === r.value ? 'border border-primary' : ''}`}>
                <div className="card-body py-2 px-3">
                  <div className="d-flex align-items-center gap-2">
                    <i className={`bi ${r.icon} ${filterRole === r.value ? 'text-primary' : 'text-muted'}`}></i>
                    <div>
                      <div className="small fw-medium">{r.label}</div>
                      <div className="fw-bold">{count}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Filters + Create */}
      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body py-2">
          <div className="row g-2 align-items-center">
            <div className="col-12 col-md-5">
              <div className="input-group input-group-sm">
                <span className="input-group-text bg-light">
                  <i className="bi bi-search text-muted"></i>
                </span>
                <input type="text" className="form-control"
                  placeholder="Search by name or email..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && load()} />
                {search && (
                  <button className="btn btn-outline-secondary btn-sm"
                    onClick={() => { setSearch(''); load() }}>
                    <i className="bi bi-x"></i>
                  </button>
                )}
              </div>
            </div>
            <div className="col-6 col-md-3">
              <select className="form-select form-select-sm" value={filterRole}
                onChange={e => setFilterRole(e.target.value)}>
                <option value="">All Roles</option>
                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div className="col-auto">
              <button className="btn btn-outline-secondary btn-sm" onClick={load}>
                <i className="bi bi-arrow-clockwise me-1"></i>Refresh
              </button>
            </div>
            <div className="col-auto ms-auto">
              <button className="btn btn-primary btn-sm"
                onClick={() => setShowCreate(true)}>
                <i className="bi bi-person-plus-fill me-1"></i>Add User
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
      ) : users.length === 0 ? (
        <div className="card border-0 shadow-sm">
          <div className="card-body text-center py-5 text-muted">
            <i className="bi bi-people fs-1 d-block mb-3 opacity-25"></i>
            <h6>No users found</h6>
            <small>Click "Add User" to create the first user account</small>
          </div>
        </div>
      ) : (
        <div className="card border-0 shadow-sm">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Last Login</th>
                  <th style={{ width: 130 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}
                    className={!u.is_active ? 'opacity-50' : ''}>
                    <td>
                      <div className="d-flex align-items-center gap-2">
                        <UserAvatar user={u} size={32} />
                        <div>
                          <div className="fw-medium small">
                            {u.first_name} {u.last_name || ''}
                          </div>
                          {u.phone && (
                            <div className="text-muted" style={{ fontSize: 10 }}>
                              {u.phone}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <code className="small text-muted">{u.email}</code>
                    </td>
                    <td>{roleBadge(u.role)}</td>
                    <td>
                      {u.is_active ? (
                        <span className="badge bg-success-subtle text-success border border-success-subtle small">
                          <i className="bi bi-circle-fill me-1" style={{ fontSize: 6 }}></i>Active
                        </span>
                      ) : (
                        <span className="badge bg-secondary-subtle text-secondary border small">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="text-muted small">
                      {u.last_login
                        ? new Date(u.last_login).toLocaleDateString('en-IN')
                        : '—'}
                    </td>
                    <td>
                      <div className="btn-group btn-group-sm">
                        <button className="btn btn-outline-primary"
                          title="Edit role"
                          onClick={() => setEditUser(u)}>
                          <i className="bi bi-pencil"></i>
                        </button>
                        <button className="btn btn-outline-warning"
                          title="Reset password"
                          onClick={() => setResetUser(u)}>
                          <i className="bi bi-key"></i>
                        </button>
                        {u.is_active ? (
                          <button className="btn btn-outline-danger"
                            title="Deactivate"
                            onClick={() => handleDeactivate(u)}>
                            <i className="bi bi-person-x"></i>
                          </button>
                        ) : (
                          <button className="btn btn-outline-success"
                            title="Reactivate"
                            onClick={() => handleReactivate(u)}>
                            <i className="bi bi-person-check"></i>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      {showCreate && (
        <CreateUserModal
          onSuccess={() => { setShowCreate(false); load() }}
          onClose={() => setShowCreate(false)}
        />
      )}
      {editUser && (
        <EditRoleModal
          user={editUser}
          onSuccess={() => { setEditUser(null); load() }}
          onClose={() => setEditUser(null)}
        />
      )}
      {resetUser && (
        <ResetPasswordModal
          user={resetUser}
          onSuccess={() => setResetUser(null)}
          onClose={() => setResetUser(null)}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  CREATE USER MODAL
// ─────────────────────────────────────────────────────────────
function CreateUserModal({ onSuccess, onClose }) {
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '',
    password: '', role: 'teacher', phone: '',
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')
  const [show,   setShow]   = useState(false)

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true); setError('')
    try {
      await api.post('/users/', form)
      onSuccess()
    } catch (e) {
      const msg = e.response?.data?.detail
      setError(typeof msg === 'string' ? msg : 'Failed to create user')
    } finally {
      setSaving(false)
    }
  }

  const selectedRole = ROLES.find(r => r.value === form.role)

  return (
    <div className="modal show d-block" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: 500 }}>
        <div className="modal-content border-0 shadow">
          <div className="modal-header border-0 pb-0">
            <h5 className="modal-title fw-bold">
              <i className="bi bi-person-plus-fill me-2 text-primary"></i>
              Create User Account
            </h5>
            <button className="btn-close" onClick={onClose}></button>
          </div>

          <div className="modal-body">
            {error && (
              <div className="alert alert-danger py-2 small mb-3">
                <i className="bi bi-exclamation-triangle-fill me-2"></i>{error}
              </div>
            )}
            <form onSubmit={handleSubmit}>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label fw-medium small">
                    First Name <span className="text-danger">*</span>
                  </label>
                  <input className="form-control" value={form.first_name} required
                    onChange={e => set('first_name', e.target.value)} />
                </div>
                <div className="col-md-6">
                  <label className="form-label fw-medium small">Last Name</label>
                  <input className="form-control" value={form.last_name}
                    onChange={e => set('last_name', e.target.value)} />
                </div>
                <div className="col-12">
                  <label className="form-label fw-medium small">
                    Email <span className="text-danger">*</span>
                  </label>
                  <input type="email" className="form-control" value={form.email} required
                    onChange={e => set('email', e.target.value)} />
                </div>
                <div className="col-12">
                  <label className="form-label fw-medium small">
                    Password <span className="text-danger">*</span>
                  </label>
                  <div className="input-group">
                    <input type={show ? 'text' : 'password'}
                      className="form-control" value={form.password} required
                      minLength={6}
                      onChange={e => set('password', e.target.value)} />
                    <button type="button" className="btn btn-outline-secondary"
                      onClick={() => setShow(s => !s)}>
                      <i className={`bi ${show ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                    </button>
                  </div>
                  <div className="form-text">Minimum 6 characters</div>
                </div>
                <div className="col-md-6">
                  <label className="form-label fw-medium small">Phone</label>
                  <input className="form-control" value={form.phone} placeholder="Optional"
                    onChange={e => set('phone', e.target.value)} />
                </div>
                <div className="col-md-6">
                  <label className="form-label fw-medium small">
                    Role <span className="text-danger">*</span>
                  </label>
                  <select className="form-select" value={form.role} required
                    onChange={e => set('role', e.target.value)}>
                    {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>

                {/* Role description */}
                {selectedRole && (
                  <div className="col-12">
                    <div className="alert alert-info py-2 mb-0 small">
                      <i className={`bi ${selectedRole.icon} me-2`}></i>
                      <strong>{selectedRole.label}:</strong> {selectedRole.desc}
                    </div>
                  </div>
                )}
              </div>
            </form>
          </div>

          <div className="modal-footer border-0 pt-0">
            <button className="btn btn-light" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
              {saving
                ? <><span className="spinner-border spinner-border-sm me-2"></span>Creating...</>
                : <><i className="bi bi-person-check me-2"></i>Create Account</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  EDIT ROLE MODAL
// ─────────────────────────────────────────────────────────────
function EditRoleModal({ user, onSuccess, onClose }) {
  const [form,   setForm]   = useState({ role: user.role, is_active: user.is_active })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true); setError('')
    try {
      await api.put(`/users/${user.id}`, form)
      onSuccess()
    } catch (e) {
      const msg = e.response?.data?.detail
      setError(typeof msg === 'string' ? msg : 'Failed to update')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal show d-block" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: 420 }}>
        <div className="modal-content border-0 shadow">
          <div className="modal-header border-0 pb-0">
            <h5 className="modal-title fw-bold">
              <i className="bi bi-pencil me-2 text-primary"></i>
              Edit User
            </h5>
            <button className="btn-close" onClick={onClose}></button>
          </div>
          <div className="modal-body">
            {/* User strip */}
            <div className="d-flex align-items-center gap-3 p-3 bg-light rounded-3 mb-3">
              <UserAvatar user={user} size={44} />
              <div>
                <div className="fw-semibold">{user.first_name} {user.last_name || ''}</div>
                <code className="text-muted small">{user.email}</code>
              </div>
            </div>

            {error && <div className="alert alert-danger py-2 small mb-3">{error}</div>}

            <div className="row g-3">
              <div className="col-12">
                <label className="form-label fw-medium small">Role</label>
                <select className="form-select" value={form.role}
                  onChange={e => setForm(p => ({ ...p, role: e.target.value }))}>
                  {ROLES.map(r => <option key={r.value} value={r.value}>{r.label} — {r.desc}</option>)}
                </select>
              </div>
              <div className="col-12">
                <div className="form-check form-switch">
                  <input className="form-check-input" type="checkbox"
                    checked={form.is_active}
                    onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} />
                  <label className="form-check-label small">Account Active</label>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-footer border-0 pt-0">
            <button className="btn btn-light" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  RESET PASSWORD MODAL
// ─────────────────────────────────────────────────────────────
function ResetPasswordModal({ user, onSuccess, onClose }) {
  const [pwd,    setPwd]    = useState('')
  const [show,   setShow]   = useState(false)
  const [saving, setSaving] = useState(false)
  const [done,   setDone]   = useState(false)
  const [error,  setError]  = useState('')

  const handleReset = async () => {
    if (!pwd || pwd.length < 6) { setError('Minimum 6 characters'); return }
    setSaving(true); setError('')
    try {
      await api.put(`/users/${user.id}/reset-password`, { new_password: pwd })
      setDone(true)
    } catch (e) {
      setError(e.response?.data?.detail || 'Reset failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal show d-block" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: 420 }}>
        <div className="modal-content border-0 shadow">
          <div className="modal-header border-0 pb-0">
            <h5 className="modal-title fw-bold">
              <i className="bi bi-key me-2 text-warning"></i>
              Reset Password
            </h5>
            <button className="btn-close" onClick={onClose}></button>
          </div>
          <div className="modal-body">
            <div className="d-flex align-items-center gap-3 p-3 bg-light rounded-3 mb-3">
              <UserAvatar user={user} size={44} />
              <div>
                <div className="fw-semibold">{user.first_name} {user.last_name || ''}</div>
                <code className="text-muted small">{user.email}</code>
              </div>
            </div>

            {done ? (
              <div className="alert alert-success py-2 small">
                <i className="bi bi-check-circle-fill me-2"></i>
                Password reset successfully. Share the new password with the user directly.
              </div>
            ) : (
              <>
                {error && <div className="alert alert-danger py-2 small mb-3">{error}</div>}
                <label className="form-label fw-medium small">New Password</label>
                <div className="input-group">
                  <input type={show ? 'text' : 'password'}
                    className="form-control"
                    placeholder="Enter new password"
                    value={pwd}
                    minLength={6}
                    onChange={e => setPwd(e.target.value)} />
                  <button type="button" className="btn btn-outline-secondary"
                    onClick={() => setShow(s => !s)}>
                    <i className={`bi ${show ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                  </button>
                </div>
                <div className="form-text">Minimum 6 characters</div>
              </>
            )}
          </div>
          <div className="modal-footer border-0 pt-0">
            <button className="btn btn-light" onClick={onClose}>
              {done ? 'Close' : 'Cancel'}
            </button>
            {!done && (
              <button className="btn btn-warning" onClick={handleReset} disabled={saving}>
                {saving ? 'Resetting...' : <><i className="bi bi-key me-2"></i>Reset Password</>}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  USER AVATAR
// ─────────────────────────────────────────────────────────────
function UserAvatar({ user, size = 36 }) {
  const colors = {
    admin:      ['#fee2e2', '#dc2626'],
    teacher:    ['#dbeafe', '#1d4ed8'],
    accountant: ['#dcfce7', '#16a34a'],
    student:    ['#fef9c3', '#d97706'],
    parent:     ['#f1f5f9', '#64748b'],
  }
  const [bg, color] = colors[user.role] || colors.parent
  const initials = ((user.first_name?.[0] || '') + (user.last_name?.[0] || '')).toUpperCase() || '?'
  return (
    <div className="rounded-circle d-flex align-items-center justify-content-center fw-bold flex-shrink-0"
      style={{ width: size, height: size, background: bg, color, fontSize: size * 0.38 }}>
      {initials}
    </div>
  )
}
