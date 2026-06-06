import { NavLink } from 'react-router-dom'

const menu = [
  {
    heading: 'MAIN',
    items: [
      { to: '/',          icon: 'bi-speedometer2',     label: 'Dashboard' },
    ]
  },
  {
    heading: 'ACADEMICS',
    items: [
      { to: '/students',   icon: 'bi-people-fill',      label: 'Students' },
      { to: '/staff',      icon: 'bi-person-badge-fill',label: 'Staff' },
      { to: '/attendance', icon: 'bi-calendar-check-fill', label: 'Attendance' },
      { to: '/timetable',  icon: 'bi-clock-fill',       label: 'Timetable' },
      { to: '/exams',      icon: 'bi-clipboard2-check-fill', label: 'Exams & Results' },
    ]
  },
  {
    heading: 'FINANCE',
    items: [
      { to: '/fees',       icon: 'bi-cash-coin',        label: 'Fee Management' },
    ]
  },
  {
    heading: 'MANAGEMENT',
    items: [
      { to: '/library',    icon: 'bi-book-fill',        label: 'Library' },
      { to: '/transport',  icon: 'bi-bus-front-fill',   label: 'Transport' },
      { to: '/reports',    icon: 'bi-bar-chart-line-fill', label: 'Reports' },
      { to: '/settings',   icon: 'bi-gear-fill',        label: 'Settings' },
    ]
  },
]

export default function Sidebar() {
  return (
    <aside className="app-sidebar bg-dark shadow" data-bs-theme="dark">

      {/* Brand */}
      <div className="sidebar-brand">
        <a href="/" className="brand-link">
          <i className="bi bi-mortarboard-fill text-primary fs-4 me-2"></i>
          <span className="brand-text fw-bold">SMS Admin</span>
        </a>
      </div>

      {/* Sidebar menu — sidebar-wrapper class is required for OverlayScrollbars */}
      <div className="sidebar-wrapper">
        <nav className="mt-2" aria-label="Main navigation">
          <ul
            className="nav sidebar-menu flex-column"
            data-lte-toggle="treeview"
            role="navigation"
            data-accordion="false"
          >
            {menu.map(group => (
              <MenuGroup key={group.heading} group={group} />
            ))}
          </ul>
        </nav>
      </div>

    </aside>
  )
}

function MenuGroup({ group }) {
  return (
    <>
      <li className="nav-header">{group.heading}</li>
      {group.items.map(item => (
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
