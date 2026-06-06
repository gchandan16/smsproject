// frontend/src/components/layout/PrivateRoute.jsx
import { Navigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import {
  selectIsAuthenticated,
  selectUserRole,
} from '../../store/slices/authSlice'

export default function PrivateRoute({ children, roles = [] }) {
  const isAuthenticated = useSelector(selectIsAuthenticated)
  const userRole        = useSelector(selectUserRole)

  if (!isAuthenticated) return <Navigate to="/login" replace />

  if (roles.length > 0 && !roles.includes(userRole)) {
    return <Navigate to="/" replace />
  }

  return children
}
