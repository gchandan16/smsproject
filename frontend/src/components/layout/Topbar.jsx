// frontend/src/components/layout/Topbar.jsx
import { useState, useRef, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import {
  logoutThunk,
  selectUser,
  selectTenantName,
} from '../../store/slices/authSlice'

// Toggle sidebar using CSS class — no AdminLTE JS needed
function toggleSidebar(e) {
  e.preventDefault()
  const wrapper = document.querySelector('.app-wrapper')
  if (wrapper) wrapper.classList.toggle('sidebar-collapse')
}

// ── React dropdown hook (no Bootstrap JS dependency) ─────────
function useDropdown() {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return { open, setOpen, ref }
}

export default function Topbar() {
  const dispatch   = useDispatch()
  const navigate   = useNavigate()
  const user       = useSelector(selectUser)
  const tenantName = useSelector(selectTenantName)

  const notif  = useDropdown()
  const profile = useDropdown()

  const handleLogout = async () => {
    profile.setOpen(false)
    await dispatch(logoutThunk())
    navigate('/login', { replace: true })
  }

  return (
    <nav className="app-header navbar navbar-expand bg-body">
      <div className="container-fluid">

        {/* Sidebar toggle */}
        <ul className="navbar-nav">
          <li className="nav-item">
            <a className="nav-link" href="#" onClick={toggleSidebar}>
              <i className="bi bi-list fs-5"></i>
            </a>
          </li>
          <li className="nav-item d-none d-md-block">
            <span className="nav-link fw-semibold text-primary">
              <i className="bi bi-mortarboard-fill me-1"></i>
              {tenantName || 'School Management System'}
            </span>
          </li>
        </ul>

        {/* Right side */}
        <ul className="navbar-nav ms-auto">

          {/* ── Notifications ─────────────────────────────── */}
          <li className="nav-item" ref={notif.ref} style={{ position: 'relative' }}>
            <a className="nav-link" href="#"
              onClick={e => { e.preventDefault(); notif.setOpen(o => !o) }}>
              <i className="bi bi-bell-fill"></i>
              <span className="navbar-badge badge text-bg-danger">3</span>
            </a>
            {notif.open && (
              <div className="dropdown-menu dropdown-menu-end show"
                style={{
                  position: 'absolute', right: 0, top: '100%',
                  minWidth: 280, zIndex: 1060,
                  display: 'block',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                }}>
                <span className="dropdown-item-text fw-bold border-bottom pb-2">
                  Notifications
                </span>
                <a href="#" className="dropdown-item py-2"
                  onClick={e => e.preventDefault()}>
                  <i className="bi bi-person-plus-fill text-primary me-2"></i>
                  New student enrolled
                  <small className="d-block text-muted">2 mins ago</small>
                </a>
                <a href="#" className="dropdown-item py-2"
                  onClick={e => e.preventDefault()}>
                  <i className="bi bi-cash-coin text-success me-2"></i>
                  Fee payment received
                  <small className="d-block text-muted">1 hour ago</small>
                </a>
                <div className="dropdown-divider"></div>
                <a href="#" className="dropdown-item text-center small"
                  onClick={e => e.preventDefault()}>
                  View all notifications
                </a>
              </div>
            )}
          </li>

          {/* ── User profile ───────────────────────────────── */}
          <li className="nav-item" ref={profile.ref} style={{ position: 'relative' }}>
            <a href="#"
              className="nav-link d-flex align-items-center gap-2"
              onClick={e => { e.preventDefault(); profile.setOpen(o => !o) }}>
              <div className="bg-primary rounded-circle d-flex align-items-center
                             justify-content-center text-white fw-bold"
                style={{ width: 32, height: 32, fontSize: 13, flexShrink: 0 }}>
                {user?.email?.[0]?.toUpperCase() || 'A'}
              </div>
              <span className="d-none d-md-inline small">
                {user?.email?.split('@')[0] || 'Admin'}
              </span>
              <i className="bi bi-chevron-down small text-muted"></i>
            </a>
            {profile.open && (
              <div className="dropdown-menu dropdown-menu-end show"
                style={{
                  position: 'absolute', right: 0, top: '100%',
                  minWidth: 220, zIndex: 1060,
                  display: 'block',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                }}>
                <li className="px-3 py-2 border-bottom">
                  <div className="fw-semibold small">{user?.email}</div>
                  <div className="text-muted" style={{ fontSize: 11 }}>
                    {user?.role} — {tenantName}
                  </div>
                </li>
                <li>
                  <a className="dropdown-item" href="/settings"
                    onClick={() => profile.setOpen(false)}>
                    <i className="bi bi-gear me-2"></i>Settings
                  </a>
                </li>
                <li><hr className="dropdown-divider" /></li>
                <li>
                  <button className="dropdown-item text-danger w-100 text-start"
                    onClick={handleLogout}>
                    <i className="bi bi-box-arrow-right me-2"></i>Sign Out
                  </button>
                </li>
              </div>
            )}
          </li>

        </ul>
      </div>
    </nav>
  )
}
