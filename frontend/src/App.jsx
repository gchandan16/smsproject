// frontend/src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { selectIsAuthenticated, selectUserRole } from './store/slices/authSlice.js'

import DashboardLayout from './components/layout/DashboardLayout'
import LoginPage       from './pages/LoginPage'
import Dashboard       from './pages/Dashboard'
import StudentsPage    from './pages/StudentsPage'
import StudentDetailPage  from './pages/StudentDetailPage'
import AttendancePage  from './pages/AttendancePage'
import FeesPage        from './pages/FeesPage'
import ExamsPage       from './pages/ExamsPage'
import TimetablePage   from './pages/TimetablePage'
import LibraryPage     from './pages/LibraryPage'
import TransportPage   from './pages/TransportPage'
import ReportsPage     from './pages/ReportsPage'
import SettingsPage    from './pages/SettingsPage'

function PrivateRoute({ children, roles = [] }){
  const isAuthenticated  =useSelector(selectIsAuthenticated)
  const userRole        = useSelector(selectUserRole)
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (roles.length > 0 && !roles.includes(userRole)) return <Navigate to="/" replace />
  return children
}
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<PrivateRoute><DashboardLayout /></PrivateRoute>}>
          <Route index              element={<Dashboard />} />
          <Route path="students"      element={<StudentsPage />} />
          <Route path="students/:id"  element={<StudentDetailPage />} />
          <Route path="attendance"    element={<AttendancePage />} />
          <Route path="fees"          element={<FeesPage />} />
          <Route path="exams"         element={<ExamsPage />} />
          <Route path="timetable"     element={<TimetablePage />} />
          <Route path="library"       element={<LibraryPage />} />
          <Route path="transport"     element={<TransportPage />} />
          <Route path="reports"       element={<ReportsPage />} />
          <Route path="settings"      element={
            <PrivateRoute roles={['superadmin', 'admin']}>
              <SettingsPage />
            </PrivateRoute>
          } />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
