import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import Footer from './Footer'

export default function DashboardLayout() {
  return (
    // app-wrapper is the required AdminLTE 4 root div
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
      <Footer/>
    </div>
  )
}
