// frontend/src/store/slices/authSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import authApi from '../../api/authApi'   // ← uses authApi now

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

const persistAuth = (token, user) => {
  localStorage.setItem('token', token)
  localStorage.setItem('user', JSON.stringify(user))
}

const clearPersistedAuth = () => {
  localStorage.removeItem('token')
  localStorage.removeItem('user')
}

// ── Initial state ─────────────────────────────────────────────
const initialState = {
  ...loadPersistedAuth(),
  loading: false,
  error:   null,
}

// ── Async Thunks ──────────────────────────────────────────────

// LOGIN — calls authApi.login()
export const loginThunk = createAsyncThunk(
  'auth/login',
  async ({ email, password }, { rejectWithValue }) => {
    try {
   
      return await authApi.login(email, password)
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.detail || 'Incorrect email or password'
      )
    }
  }
)

// LOGOUT — calls authApi.logout()
export const logoutThunk = createAsyncThunk(
  'auth/logout',
  async () => {
    try {
      await authApi.logout()
    } catch {
      // Always clear client state even if server call fails
    }
  }
)

// FETCH ME — calls authApi.getMe()
// Used on app load to verify the stored token is still valid
export const fetchMeThunk = createAsyncThunk(
  'auth/fetchMe',
  async (_, { rejectWithValue }) => {
    try {
      return await authApi.getMe()
    } catch (err) {
      return rejectWithValue('Session expired. Please login again.')
    }
  }
)

// CHANGE PASSWORD — calls authApi.changePassword()
export const changePasswordThunk = createAsyncThunk(
  'auth/changePassword',
  async ({ currentPassword, newPassword }, { rejectWithValue }) => {
    try {
      return await authApi.changePassword(currentPassword, newPassword)
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.detail || 'Failed to change password'
      )
    }
  }
)

// ── Slice ─────────────────────────────────────────────────────
const authSlice = createSlice({
  name: 'auth',
  initialState,

  reducers: {
    clearError: (state) => { state.error = null },
    clearAuth:  (state) => {
      state.token   = null
      state.user    = null
      state.error   = null
      state.loading = false
      clearPersistedAuth()
    },
  },

  extraReducers: (builder) => {

    // ── LOGIN ──────────────────────────────────────────────
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
        persistAuth(access_token, user)
      })
      .addCase(loginThunk.rejected, (state, action) => {
        state.loading = false
        state.error   = action.payload
        state.token   = null
        state.user    = null
        clearPersistedAuth()
      })

    // ── LOGOUT ─────────────────────────────────────────────
    builder
      .addCase(logoutThunk.fulfilled, (state) => {
        state.token   = null
        state.user    = null
        state.error   = null
        clearPersistedAuth()
      })

    // ── FETCH ME ───────────────────────────────────────────
    builder
      .addCase(fetchMeThunk.fulfilled, (state, action) => {
        state.user = action.payload
        localStorage.setItem('user', JSON.stringify(action.payload))
      })
      .addCase(fetchMeThunk.rejected, (state) => {
        // Token is invalid — force full logout
        state.token = null
        state.user  = null
        clearPersistedAuth()
      })

    // ── CHANGE PASSWORD ────────────────────────────────────
    builder
      .addCase(changePasswordThunk.pending, (state) => {
        state.loading = true
        state.error   = null
      })
      .addCase(changePasswordThunk.fulfilled, (state) => {
        state.loading = false
      })
      .addCase(changePasswordThunk.rejected, (state, action) => {
        state.loading = false
        state.error   = action.payload
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
