// frontend/src/components/layout/Sidebar.jsx
import { NavLink } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { selectHasPermission, selectUserRole } from '../../store/slices/authSlice.js'

// Roles that get a personal portal view — NEVER see admin/staff modules
const PERSONAL_ROLES = ['student', 'parent']

// staffOnly: true = hidden from student/parent even if that permission
//            was accidentally granted in Role Permissions
const MENU = [
  {
    heading: 'MAIN',
    items: [
      { to: '/', icon: 'bi-speedometer2', label: 'Dashboard',
        permission: 'dashboard.view', staffOnly: false },
    ],
  },
  {
    heading: 'ACADEMICS',
    items: [
      { to: '/students',   icon: 'bi-people-fill',    label: 'Students',        permission: 'students.view',   staffOnly: true },
      { to: '/attendance', icon: 'bi-calendar-check', label: 'Attendance',      permission: 'attendance.view', staffOnly: true },
      { to: '/timetable',  icon: 'bi-clock',          label: 'Timetable',       permission: 'timetable.view',  staffOnly: true },
      { to: '/exams',      icon: 'bi-journal-check',  label: 'Exams & Results', permission: 'exams.view',      staffOnly: true },
    ],
  },
  {
    heading: 'MY SCHOOL',
    items: [
      // Only student / parent roles ever see these
      { to: '/my-timetable',  icon: 'bi-clock',          label: 'My Timetable',  roles: ['student','parent'] },
      { to: '/my-attendance', icon: 'bi-calendar-check', label: 'My Attendance', roles: ['student','parent'] },
      { to: '/my-fees',       icon: 'bi-cash-coin',      label: 'My Fees',       roles: ['student','parent'] },
    ],
  },
  {
    heading: 'FINANCE',
    items: [
      { to: '/fees',            icon: 'bi-cash-coin',                label: 'Fee Management',  permission: 'fees.view',            staffOnly: true },
      { to: '/finance-reports', icon: 'bi-file-earmark-spreadsheet', label: 'Finance Reports', permission: 'finance_reports.view', staffOnly: true },
    ],
  },
  {
    heading: 'MANAGEMENT',
    items: [
      { to: '/library',   icon: 'bi-book',          label: 'Library',   permission: 'library.view',   staffOnly: true },
      { to: '/transport', icon: 'bi-truck',          label: 'Transport', permission: 'transport.view', staffOnly: true },
      { to: '/reports',   icon: 'bi-bar-chart-line', label: 'Reports',   permission: 'reports.view',   staffOnly: true },
      { to: '/settings',  icon: 'bi-gear-fill',      label: 'Settings',  permission: 'settings.view',  staffOnly: true },
    ],
  },
]

export default function Sidebar() {
  const userRole   = (useSelector(selectUserRole) || '').toLowerCase()
  const can        = useSelector(selectHasPermission)
  const isPersonal = PERSONAL_ROLES.includes(userRole)

  const canSeeItem = (item) => {
    // MY SCHOOL items — role-gated, only student/parent
    if (item.roles) {
      return item.roles.includes(userRole)
    }
    // Admin-only items — hard block for student/parent regardless of permissions
    if (item.staffOnly && isPersonal) {
      return false
    }
    // Permission-based — check dynamic DB permissions
    if (item.permission) {
      return can(item.permission)
    }
    return true
  }

  return (
    <aside className="app-sidebar bg-dark shadow" data-bs-theme="dark">
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
              const visibleItems = group.items.filter(canSeeItem)
              if (visibleItems.length === 0) return null
              return <MenuGroup key={group.heading} heading={group.heading} items={visibleItems} />
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
