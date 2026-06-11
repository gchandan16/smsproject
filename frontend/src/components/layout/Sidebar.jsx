// frontend/src/components/layout/Sidebar.jsx
import { NavLink } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { selectUserRole } from '../../store/slices/authSlice.js'

// Menu definition — roles array = who can see this item
const MENU = [
  {
    heading: 'MAIN',
    items: [
      { to: '/', icon: 'bi-speedometer2', label: 'Dashboard', roles: [] }, // all
    ],
  },
  {
    heading: 'ACADEMICS',
    items: [
      { to: '/students',   icon: 'bi-people-fill',          label: 'Students',      roles: ['superadmin','admin','teacher','accountant'] },
      { to: '/attendance', icon: 'bi-calendar-check-fill',  label: 'Attendance',    roles: ['superadmin','admin','teacher'] },
      { to: '/timetable',  icon: 'bi-clock-fill',           label: 'Timetable',     roles: ['superadmin','admin','teacher'] },
      { to: '/exams',      icon: 'bi-clipboard2-check-fill',label: 'Exams & Results',roles: ['superadmin','admin','teacher'] },
    ],
  },
  {
    heading: 'FINANCE',
    items: [
      { to: '/fees', icon: 'bi-cash-coin', label: 'Fee Management', roles: ['superadmin','admin','accountant'] },
    ],
  },
  {
    heading: 'MANAGEMENT',
    items: [
      { to: '/library',   icon: 'bi-book-fill',          label: 'Library',   roles: ['superadmin','admin'] },
      { to: '/transport', icon: 'bi-bus-front-fill',     label: 'Transport', roles: ['superadmin','admin'] },
      { to: '/reports',   icon: 'bi-bar-chart-line-fill',label: 'Reports',   roles: ['superadmin','admin'] },
      { to: '/settings',  icon: 'bi-gear-fill',          label: 'Settings',  roles: ['superadmin','admin'] },
    ],
  },
]

export default function Sidebar() {
  const userRole = (useSelector(selectUserRole) || '').toLowerCase()

  const canSee = (roles) => {
    if (!roles || roles.length === 0) return true          // no restriction
    return roles.map(r => r.toLowerCase()).includes(userRole)
  }

  return (
    <aside className="app-sidebar bg-dark shadow" data-bs-theme="dark">

      {/* Brand */}
      <div className="sidebar-brand">
        <a href="/" className="brand-link">
          <i className="bi bi-mortarboard-fill text-primary fs-4 me-2"></i>
          <span className="brand-text fw-bold">SMS Admin</span>
        </a>
      </div>

      <div className="sidebar-wrapper">
        <nav className="mt-2">
          <ul className="nav sidebar-menu flex-column" role="navigation">
            {MENU.map(group => {
              const visibleItems = group.items.filter(item => canSee(item.roles))
              if (visibleItems.length === 0) return null
              return (
                <MenuGroup
                  key={group.heading}
                  heading={group.heading}
                  items={visibleItems}
                />
              )
            })}
          </ul>
        </nav>
      </div>

    </aside>
  )
}

function MenuGroup({ heading, items }) {
  return (
    <>
      <li className="nav-header">{heading}</li>
      {items.map(item => (
        <li className="nav-item" key={item.to}>
          <NavLink
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            <i className={`nav-icon bi ${item.icon}`}></i>
            <p>{item.label}</p>
          </NavLink>
        </li>
      ))}
    </>
  )
}
