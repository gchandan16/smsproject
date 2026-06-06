// frontend/src/components/layout/Topbar.jsx
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import {useState ,useEffect,useRef } from 'react'
import {
  logoutThunk,
  selectUser,
  selectTenantName,
} from '../../store/slices/authSlice'

export default function Topbar() {
  const dispatch    = useDispatch()
  const navigate    = useNavigate()
  const user        = useSelector(selectUser)
  const tenantName  = useSelector(selectTenantName)

  const profileRef=useRef(null)
  const notificationRef=useRef(null)
  const [profileOpen, setProfileOpen] = useState(false)
  const [notificationOpen, setNotificationOpen] = useState(false)

  const handleLogout = async () => {
    await dispatch(logoutThunk())
    navigate('/login', { replace: true })
  }
  useEffect(()=>{
    const handleClickOutside=(event)=>{
      // profile dropdown
      if( profileRef.current &&  !profileRef.current.contains(event.target)){
        setProfileOpen(false)
      }

       // Notification dropdown
    if (notificationRef.current && !notificationRef.current.contains(event.target)) {
      setNotificationOpen(false)
    }
      
    }
      document.addEventListener('mousedown', handleClickOutside)
       return () => {
         document.removeEventListener('mousedown', handleClickOutside )
     }

  } ,[])
  return (
    <nav className="app-header navbar navbar-expand bg-body">
      <div className="container-fluid">

        {/* Sidebar toggle */}
        <ul className="navbar-nav">
          <li className="nav-item">
            <a className="nav-link" data-lte-toggle="sidebar" href="#" role="button">
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

          {/* Notifications */}
          <li className="nav-item dropdown"   ref={notificationRef}>
            <a href="#" className="nav-link" data-bs-toggle="dropdown" onClick={(e)=>{
               e.preventDefault()
                setNotificationOpen(!notificationOpen)
                setProfileOpen(false)
            }}>
              <i className="bi bi-bell-fill"></i>
              <span className="navbar-badge badge text-bg-danger">3</span>
            </a>

            
            <div className={`dropdown-menu dropdown-menu-left ${notificationOpen ? 'show' : ''}`}     style={{ minWidth: 200,left:'-90px' }}>
              <span className="dropdown-item-text fw-bold border-bottom pb-2">
                Notifications
              </span>
              <a href="#" className="dropdown-item py-2">
                <i className="bi bi-person-plus-fill text-primary me-2"></i>
                New student enrolled
                <small className="d-block text-muted">2 mins ago</small>
              </a>
              <a href="#" className="dropdown-item py-2">
                <i className="bi bi-cash-coin text-success me-2"></i>
                Fee payment received
                <small className="d-block text-muted">1 hour ago</small>
              </a>
              <div className="dropdown-divider"></div>
              <a href="#" className="dropdown-item text-center small">
                View all notifications
              </a>
            </div>
          </li>

          {/* User menu */}
          <li className="nav-item position-relative"  ref={profileRef}>
            <a href="#" className="nav-link dropdown-toggle d-flex align-items-center gap-2"
              data-bs-toggle="dropdown" 
              onClick={(e) => {
                e.preventDefault()
                setProfileOpen(!profileOpen)
                setNotificationOpen(false)
              }}>

                
              <div
                className="bg-primary rounded-circle d-flex align-items-center
                           justify-content-center text-white"
                style={{ width: 30, height: 30, fontSize: 14 }}
              >
                {user?.email?.[0]?.toUpperCase() || 'A'}
              </div>
              <span className="d-none d-md-inline">
                {user?.email?.split('@')[0] || 'Admin'}
              </span>
            </a>
            <ul  className={`dropdown-menu dropdown-menu-left ${profileOpen ? 'show' : ''}`}  style={{left:'-50px'}}>
              <li className="px-3 py-2 border-bottom">
                <div className="fw-semibold small">{user?.email}</div>
                <div className="text-muted" style={{ fontSize: 11 }}>
                  {user?.role} — {tenantName}
                </div>
              </li>
              <li>
                <a className="dropdown-item" href="#">
                  <i className="bi bi-person me-2"></i>My Profile
                </a>
              </li>
              <li>
                <a className="dropdown-item" href="#">
                  <i className="bi bi-gear me-2"></i>Settings
                </a>
              </li>
              <li><hr className="dropdown-divider" /></li>
              <li>
                <button className="dropdown-item text-danger" onClick={handleLogout}>
                  <i className="bi bi-box-arrow-right me-2"></i>Sign Out
                </button>
              </li>
            </ul>
          </li>

        </ul>
      </div>
    </nav>
  )
}
