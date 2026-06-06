// frontend/src/api/authApi.js
// ─────────────────────────────────────────────────────────────
// All API calls related to authentication.
// Called by Redux thunks in authSlice.js — never called
// directly from components.
// ─────────────────────────────────────────────────────────────
import api from './client'

const authApi = {

  // ── POST /api/auth/login ─────────────────────────────────
  // FastAPI OAuth2 expects FormData (not JSON)
  // Returns: { access_token, token_type, expires_in, user }
  login: async (email, password) => {
    const form = new FormData()
    form.append('username', email)   // OAuth2 field name is 'username'
    form.append('password', password)

    const { data } = await api.post('/auth/login', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return data
  },

  // ── POST /api/auth/logout ────────────────────────────────
  // JWT is stateless — server just acknowledges.
  // Client deletes token regardless of response.
  logout: async () => {
    const { data } = await api.post('/auth/logout')
    return data
  },

  // ── GET /api/auth/me ─────────────────────────────────────
  // Fetch current logged-in user profile.
  // Called on app load to verify token is still valid.
  // Returns: { id, email, role, tenant_id, tenant_name }
  getMe: async () => {
    const { data } = await api.get('/auth/me')
    return data
  },

  // ── POST /api/auth/change-password ───────────────────────
  changePassword: async (currentPassword, newPassword) => {
    const { data } = await api.post('/auth/change-password', {
      current_password: currentPassword,
      new_password:     newPassword,
    })
    return data
  },

}

export default authApi
