// frontend/src/components/layout/DashboardLayout.jsx
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar  from './Topbar'

export default function DashboardLayout() {
  return (
    <div className="app-wrapper">
      <Topbar />
      <Sidebar />
      <main className="app-main">
        <div className="app-content-header">
          <div className="container-fluid"></div>
        </div>
        <div className="app-content">
          <div className="container-fluid">
            <Outlet />
          </div>
        </div>
      </main>
      <footer className="app-footer">
        <div className="float-end d-none d-sm-inline">v1.0.0</div>
        <strong>School Management System</strong> &copy; {new Date().getFullYear()}
      </footer>
    </div>
  )
}
