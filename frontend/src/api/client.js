// frontend/src/api/client.js
// ─────────────────────────────────────────────────────────────
// Base Axios instance used by ALL api files.
// Handles token injection and auto-logout on 401.
// ─────────────────────────────────────────────────────────────
import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 15000,  // 15 second timeout
  headers: {
    'Content-Type': 'application/json',
    'Accept':       'application/json',
  },
})

// ── Request interceptor — attach JWT token ────────────────────
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// ── Response interceptor — handle errors globally ────────────
api.interceptors.response.use(
  (response) => response,

  (error) => {
    const status  = error.response?.status
    const message = error.response?.data?.detail

    // 401 — token expired or invalid → force logout
    if (status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      // Dispatch Redux clearAuth then redirect
      window.dispatchEvent(new CustomEvent('auth:logout'))
      window.location.href = '/login'
    }

    // 403 — forbidden
    if (status === 403) {
      console.warn('Access denied:', message)
    }

    // 500 — server error
    if (status >= 500) {
      console.error('Server error:', message)
    }

    return Promise.reject(error)
  }
)

export default api
