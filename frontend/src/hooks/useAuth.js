// frontend/src/hooks/useAuth.js
// ─────────────────────────────────────────────────────────────
// Custom hook — clean API for components.
// Components import this instead of calling useSelector directly.
// ─────────────────────────────────────────────────────────────
import { useDispatch, useSelector } from 'react-redux'
import {
  loginThunk,
  logoutThunk,
  fetchMeThunk,
  clearError,
  clearAuth,
  selectToken,
  selectUser,
  selectAuthLoading,
  selectAuthError,
  selectIsAuthenticated,
  selectUserRole,
  selectTenantId,
  selectTenantName,
} from '../store/slices/authSlice'

export function useAuth() {
  const dispatch = useDispatch()

  return {
    // State
    token:           useSelector(selectToken),
    user:            useSelector(selectUser),
    loading:         useSelector(selectAuthLoading),
    error:           useSelector(selectAuthError),
    isAuthenticated: useSelector(selectIsAuthenticated),
    role:            useSelector(selectUserRole),
    tenantId:        useSelector(selectTenantId),
    tenantName:      useSelector(selectTenantName),

    // Actions
    login:      (email, password) => dispatch(loginThunk({ email, password })),
    logout:     ()                => dispatch(logoutThunk()),
    fetchMe:    ()                => dispatch(fetchMeThunk()),
    clearError: ()                => dispatch(clearError()),
    clearAuth:  ()                => dispatch(clearAuth()),

    // Role helpers
    isAdmin:       () => useSelector(selectUserRole) === 'superadmin' ||
                         useSelector(selectUserRole) === 'admin',
    hasRole:       (role) => useSelector(selectUserRole) === role,
    hasAnyRole:    (roles) => roles.includes(useSelector(selectUserRole)),
  }
}
