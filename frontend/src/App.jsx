// frontend/src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import {
  selectIsAuthenticated, selectUserRole,
  selectHasPermission
} from './store/slices/authSlice.js'

import DashboardLayout    from './components/layout/DashboardLayout.jsx'
import LoginPage          from './pages/LoginPage.jsx'
import Dashboard          from './pages/Dashboard.jsx'
import StudentsPage       from './pages/StudentsPage.jsx'
import StudentDetailPage  from './pages/StudentDetailPage.jsx'
import AttendancePage     from './pages/AttendancePage.jsx'
import FeesPage           from './pages/FeesPage.jsx'
import ExamsPage          from './pages/ExamsPage.jsx'
import TimetablePage      from './pages/TimetablePage.jsx'
import LibraryPage        from './pages/LibraryPage.jsx'
import TransportPage      from './pages/TransportPage.jsx'
import ReportsPage        from './pages/ReportsPage.jsx'
import FinanceReportsPage from './pages/FinanceReportsPage.jsx'
import SettingsPage       from './pages/SettingsPage.jsx'
import MyTimetablePage    from './pages/MyTimetablePage.jsx'
import MyAttendancePage   from './pages/MyAttendancePage.jsx'
import MyFeesPage         from './pages/MyFeesPage.jsx'
import MyClassTimetablePage from './pages/MyClassTimetablePage.jsx'

// Roles that are always portal-only — NEVER access staff pages
const PERSONAL_ROLES = ['student', 'parent']

/**
 * PrivateRoute — three modes:
 *
 * 1. personalOnly: true  → only student/parent can access (My Timetable, My Fees)
 * 2. roles: [...]        → only the listed roles can access (e.g. teacher-only pages)
 * 3. permission: "x.y"   → check dynamic DB permission; also blocks student/parent
 *                           even if they somehow have that permission string
 */
function PrivateRoute({ children, permission = null, personalOnly = false, roles = null }) {
  const isAuthenticated = useSelector(selectIsAuthenticated)
  const userRole        = (useSelector(selectUserRole) || '').toLowerCase()
  const can             = useSelector(selectHasPermission)

  if (!isAuthenticated) return <Navigate to="/login" replace />

  // Personal pages — only student/parent
  if (personalOnly) {
    return PERSONAL_ROLES.includes(userRole)
      ? children
      : <Navigate to="/" replace />
  }

  // Explicit role allowlist (e.g. teacher-only pages)
  if (roles) {
    return roles.includes(userRole)
      ? children
      : <Navigate to="/" replace />
  }

  // Permission-gated staff pages — block student/parent regardless of permissions
  if (permission) {
    if (PERSONAL_ROLES.includes(userRole)) return <Navigate to="/" replace />
    if (!can(permission)) return <Navigate to="/" replace />
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
          {/* Dashboard — all authenticated users
              Dashboard.jsx itself renders StudentParentDashboard for student/parent */}
          <Route index element={<Dashboard />} />

          {/* Student / Parent personal pages */}
          <Route path="my-timetable" element={
            <PrivateRoute personalOnly><MyTimetablePage /></PrivateRoute>
          } />
          <Route path="my-attendance" element={
            <PrivateRoute personalOnly><MyAttendancePage /></PrivateRoute>
          } />
          <Route path="my-fees" element={
            <PrivateRoute personalOnly><MyFeesPage /></PrivateRoute>
          } />

          {/* Teacher's personal weekly timetable (read-only, all their classes) */}
          <Route path="my-class-timetable" element={
            <PrivateRoute roles={['teacher']}><MyClassTimetablePage /></PrivateRoute>
          } />

          {/* Academic — permission-gated, student/parent hard-blocked */}
          <Route path="students" element={
            <PrivateRoute permission="students.view"><StudentsPage /></PrivateRoute>
          } />
          <Route path="students/:id" element={
            <PrivateRoute permission="students.view"><StudentDetailPage /></PrivateRoute>
          } />
          <Route path="attendance" element={
            <PrivateRoute permission="attendance.view"><AttendancePage /></PrivateRoute>
          } />
          <Route path="timetable" element={
            <PrivateRoute permission="timetable.view"><TimetablePage /></PrivateRoute>
          } />
          <Route path="exams" element={
            <PrivateRoute permission="exams.view"><ExamsPage /></PrivateRoute>
          } />

          {/* Finance */}
          <Route path="fees" element={
            <PrivateRoute permission="fees.view"><FeesPage /></PrivateRoute>
          } />
          <Route path="finance-reports" element={
            <PrivateRoute permission="finance_reports.view"><FinanceReportsPage /></PrivateRoute>
          } />

          {/* Management */}
          <Route path="library" element={
            <PrivateRoute permission="library.view"><LibraryPage /></PrivateRoute>
          } />
          <Route path="transport" element={
            <PrivateRoute permission="transport.view"><TransportPage /></PrivateRoute>
          } />
          <Route path="reports" element={
            <PrivateRoute permission="reports.view"><ReportsPage /></PrivateRoute>
          } />
          <Route path="settings" element={
            <PrivateRoute permission="settings.view"><SettingsPage /></PrivateRoute>
          } />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
