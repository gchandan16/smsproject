// frontend/src/store/slices/authSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'

const API_BASE = '/api'

// ── Persist helpers ───────────────────────────────────────────
const loadPersistedAuth = () => {
  try {
    return {
      token: localStorage.getItem('token') || null,
      user:  JSON.parse(localStorage.getItem('user') || 'null'),
    }
  } catch {
    return { token: null, user: null }
  }
}

// ── Async Thunks ──────────────────────────────────────────────
export const loginThunk = createAsyncThunk(
  'auth/login',
  async ({ email, password }, { rejectWithValue }) => {
    try {
      const form = new FormData()
      form.append('username', email)
      form.append('password', password)

      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        body: form,
      })

      if (!res.ok) {
        const err = await res.json()
        return rejectWithValue(err.detail || 'Login failed')
      }

      return await res.json()
    } catch (err) {
      return rejectWithValue('Cannot connect to server. Is the backend running?')
    }
  }
)

export const logoutThunk = createAsyncThunk(
  'auth/logout',
  async () => {
    try {
      const token = localStorage.getItem('token')
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
    } catch { /* always clear client */ }
  }
)

export const fetchMeThunk = createAsyncThunk(
  'auth/fetchMe',
  async (_, { rejectWithValue }) => {
    try {
      const token = localStorage.getItem('token')
      if (!token) return rejectWithValue('No token')

      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!res.ok) return rejectWithValue('Session expired')
      return await res.json()
    } catch {
      return rejectWithValue('Network error')
    }
  }
)

// ── Slice ─────────────────────────────────────────────────────
const authSlice = createSlice({
  name: 'auth',
  initialState: {
    ...loadPersistedAuth(),
    loading: false,
    error:   null,
  },

  reducers: {
    clearError: (state) => { state.error = null },
    clearAuth:  (state) => {
      state.token   = null
      state.user    = null
      state.error   = null
      state.loading = false
      localStorage.removeItem('token')
      localStorage.removeItem('user')
    },
  },

  extraReducers: (builder) => {
    // LOGIN
    builder
      .addCase(loginThunk.pending, (state) => {
        state.loading = true
        state.error   = null
      })
      .addCase(loginThunk.fulfilled, (state, action) => {
        const { access_token, user } = action.payload
        state.loading = false
        state.token   = access_token
        state.user    = user
        state.error   = null
        localStorage.setItem('token', access_token)
        localStorage.setItem('user',  JSON.stringify(user))
      })
      .addCase(loginThunk.rejected, (state, action) => {
        state.loading = false
        state.error   = action.payload
        state.token   = null
        state.user    = null
      })

    // LOGOUT
    builder.addCase(logoutThunk.fulfilled, (state) => {
      state.token = null
      state.user  = null
      localStorage.removeItem('token')
      localStorage.removeItem('user')
    })

    // FETCH ME
    builder
      .addCase(fetchMeThunk.fulfilled, (state, action) => {
        state.user = action.payload
        localStorage.setItem('user', JSON.stringify(action.payload))
      })
      .addCase(fetchMeThunk.rejected, (state) => {
        state.token = null
        state.user  = null
        localStorage.removeItem('token')
        localStorage.removeItem('user')
      })
  },
})

export const { clearError, clearAuth } = authSlice.actions
export default authSlice.reducer

// ── Selectors ─────────────────────────────────────────────────
export const selectToken           = (state) => state.auth.token
export const selectUser            = (state) => state.auth.user
export const selectAuthLoading     = (state) => state.auth.loading
export const selectAuthError       = (state) => state.auth.error
export const selectIsAuthenticated = (state) => !!state.auth.token
export const selectUserRole        = (state) => state.auth.user?.role
export const selectTenantId        = (state) => state.auth.user?.tenant_id
export const selectTenantName      = (state) => state.auth.user?.tenant_name
export const selectSchoolName      = (state) => state.auth.user?.school_name || state.auth.user?.tenant_name
export const selectSchoolLogoUrl   = (state) => state.auth.user?.school_logo_url
