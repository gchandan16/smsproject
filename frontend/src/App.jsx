// frontend/src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { selectIsAuthenticated, selectUserRole } from './store/slices/authSlice.js'

import DashboardLayout   from './components/layout/DashboardLayout.jsx'
import LoginPage         from './pages/LoginPage.jsx'
import Dashboard         from './pages/Dashboard.jsx'
import StudentsPage      from './pages/StudentsPage.jsx'
import StudentDetailPage from './pages/StudentDetailPage.jsx'
import AttendancePage    from './pages/AttendancePage.jsx'
import FeesPage          from './pages/FeesPage.jsx'
import ExamsPage         from './pages/ExamsPage.jsx'
import TimetablePage     from './pages/TimetablePage.jsx'
import LibraryPage       from './pages/LibraryPage.jsx'
import TransportPage     from './pages/TransportPage.jsx'
import ReportsPage       from './pages/ReportsPage.jsx'
import FinanceReportsPage from './pages/FinanceReportsPage.jsx'
import SettingsPage      from './pages/SettingsPage.jsx'
import MyTimetablePage   from './pages/MyTimetablePage.jsx'
import MyFeesPage        from './pages/MyFeesPage.jsx'

// Role sets
const ADMIN_ROLES       = ['superadmin', 'admin']
const ACADEMIC_ROLES    = ['superadmin', 'admin', 'teacher']
const FINANCE_ROLES     = ['superadmin', 'admin', 'accountant']
const ALL_STAFF_ROLES   = ['superadmin', 'admin', 'teacher', 'accountant']
const STUDENT_ROLES     = ['student', 'parent']

function PrivateRoute({ children, roles = [] }) {
  const isAuthenticated = useSelector(selectIsAuthenticated)
  const userRole        = useSelector(selectUserRole)

  if (!isAuthenticated) return <Navigate to="/login" replace />

  if (roles.length > 0) {
    // Normalize role for comparison
    const role = (userRole || '').toLowerCase()
    const allowed = roles.map(r => r.toLowerCase())
    if (!allowed.includes(role)) {
      return <Navigate to="/" replace />
    }
  }
  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route path="/" element={
          <PrivateRoute>
            <DashboardLayout />
          </PrivateRoute>
        }>
          {/* Dashboard — all authenticated users */}
          <Route index element={<Dashboard />} />

          {/* Student / Parent personal pages */}
          <Route path="my-timetable" element={
            <PrivateRoute roles={STUDENT_ROLES}><MyTimetablePage /></PrivateRoute>
          } />
          <Route path="my-fees" element={
            <PrivateRoute roles={STUDENT_ROLES}><MyFeesPage /></PrivateRoute>
          } />

          {/* Academic — admin + teacher */}
          <Route path="students" element={
            <PrivateRoute roles={ALL_STAFF_ROLES}><StudentsPage /></PrivateRoute>
          } />
          <Route path="students/:id" element={
            <PrivateRoute roles={ALL_STAFF_ROLES}><StudentDetailPage /></PrivateRoute>
          } />
          <Route path="attendance" element={
            <PrivateRoute roles={ACADEMIC_ROLES}><AttendancePage /></PrivateRoute>
          } />
          <Route path="exams" element={
            <PrivateRoute roles={ACADEMIC_ROLES}><ExamsPage /></PrivateRoute>
          } />
          <Route path="timetable" element={
            <PrivateRoute roles={ALL_STAFF_ROLES}><TimetablePage /></PrivateRoute>
          } />

          {/* Finance — admin + accountant */}
          <Route path="fees" element={
            <PrivateRoute roles={FINANCE_ROLES}><FeesPage /></PrivateRoute>
          } />

          {/* Management — admin only */}
          <Route path="library"   element={<PrivateRoute roles={ADMIN_ROLES}><LibraryPage /></PrivateRoute>} />
          <Route path="transport" element={<PrivateRoute roles={ADMIN_ROLES}><TransportPage /></PrivateRoute>} />
          <Route path="reports"   element={<PrivateRoute roles={ADMIN_ROLES}><ReportsPage /></PrivateRoute>} />
          <Route path="finance-reports" element={<PrivateRoute roles={FINANCE_ROLES}><FinanceReportsPage /></PrivateRoute>} />
          <Route path="settings"  element={<PrivateRoute roles={ADMIN_ROLES}><SettingsPage /></PrivateRoute>} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
