import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import {
  loginThunk,
  clearError,
  selectAuthLoading,
  selectAuthError,
  selectIsAuthenticated,
} from '../store/slices/authSlice'

export default function LoginPage() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const loading = useSelector(selectAuthLoading)
  const error = useSelector(selectAuthError)
  const isAuthenticated = useSelector(selectIsAuthenticated)

  useEffect(() => {
    if (isAuthenticated) navigate('/', { replace: true })
  }, [isAuthenticated])

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      dispatch(clearError())
      const result = await dispatch(loginThunk({ email, password }))
      if (loginThunk.fulfilled.match(result)) {
        navigate('/', { replace: true })
      }
    } catch (err) {
      console.error('Login Error:', err)
    }
  }

  return (
    <div className="login-page">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&display=swap');

        * { box-sizing: border-box; }

        .login-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'Inter', sans-serif;
          position: relative;
          overflow: hidden;
          background:
            radial-gradient(ellipse 80% 60% at 50% 0%, #FFD9A0 0%, transparent 55%),
            linear-gradient(180deg, #FF9966 0%, #F4694F 22%, #B8456F 48%, #5B3B7E 75%, #2C2459 100%);
        }

        /* ── Ambient scene layer ── */
        .scene-bg { position: absolute; inset: 0; z-index: 0; }

        .sun {
          position: absolute;
          top: 6%; left: 50%;
          transform: translateX(-50%);
          width: 260px; height: 260px;
          border-radius: 50%;
          background: radial-gradient(circle, #FFF2D0 0%, #FFD9A0 45%, rgba(255,217,160,0) 75%);
          filter: blur(2px);
        }

        /* School building silhouette on the horizon */
        .skyline {
          position: absolute;
          left: 0; right: 0; bottom: 0;
          height: 38%;
        }
        .skyline svg { display: block; width: 100%; height: 100%; }

        /* Floating motifs — pencils, stars, books drifting like Discord's blobs */
        .float-item {
          position: absolute;
          color: rgba(255,255,255,0.55);
          animation: floaty 9s ease-in-out infinite;
        }
        .float-item.dim { color: rgba(255,255,255,0.28); }
        @keyframes floaty {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-22px) rotate(8deg); }
        }
        .f1 { top: 12%; left: 8%;  font-size: 38px; animation-delay: 0s; }
        .f2 { top: 22%; right: 12%; font-size: 28px; animation-delay: -3s; }
        .f3 { top: 52%; left: 14%; font-size: 24px; animation-delay: -6s; }
        .f4 { top: 38%; right: 22%; font-size: 44px; animation-delay: -1.5s; }
        .f5 { top: 65%; right: 8%;  font-size: 30px; animation-delay: -4.5s; }
        .f6 { top: 8%;  left: 38%; font-size: 20px; animation-delay: -7s; }

        /* Twinkling stars */
        .star {
          position: absolute;
          background: #FFFFFF;
          border-radius: 50%;
          animation: twinkle 3s ease-in-out infinite;
        }
        @keyframes twinkle {
          0%, 100% { opacity: 0.25; transform: scale(1); }
          50% { opacity: 0.9; transform: scale(1.4); }
        }

        /* ── Centered glass card ── */
        .login-card {
          position: relative;
          z-index: 2;
          width: 100%;
          max-width: 880px;
          margin: 24px;
          background: rgba(28, 22, 48, 0.78);
          backdrop-filter: blur(18px);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 20px;
          padding: 48px;
          display: grid;
          grid-template-columns: 1fr 280px;
          gap: 48px;
          align-items: center;
          box-shadow: 0 24px 60px rgba(20,12,40,0.35);
        }

        /* Left column — form */
        .card-eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: #FFC98B;
          margin-bottom: 14px;
        }
        .card-eyebrow i { font-size: 16px; }
        .card-title {
          font-family: 'Fraunces', serif;
          font-size: 30px;
          font-weight: 600;
          color: #FFF6EC;
          margin-bottom: 6px;
          letter-spacing: -0.01em;
        }
        .card-desc {
          font-size: 14px;
          color: rgba(255,246,236,0.55);
          margin-bottom: 28px;
        }

        .field-group { margin-bottom: 16px; }
        .field-label {
          display: block;
          font-size: 12.5px;
          font-weight: 600;
          color: rgba(255,246,236,0.85);
          margin-bottom: 7px;
        }
        .field-row-top { display: flex; justify-content: space-between; align-items: baseline; }
        .forgot-link { font-size: 12.5px; color: #FFC98B; text-decoration: none; font-weight: 500; }
        .forgot-link:hover { text-decoration: underline; }

        .field-wrap {
          position: relative;
          display: flex;
          align-items: center;
          background: rgba(255,255,255,0.05);
          border: 1.5px solid rgba(255,255,255,0.10);
          border-radius: 10px;
          transition: border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
        }
        .field-wrap:focus-within {
          border-color: #FF9966;
          background: rgba(255,255,255,0.08);
          box-shadow: 0 0 0 3px rgba(255,153,102,0.12);
        }
        .field-icon {
          display: flex; align-items: center; justify-content: center;
          width: 42px; height: 46px;
          color: rgba(255,246,236,0.4);
          font-size: 16px;
          flex-shrink: 0;
        }
        .field-input {
          flex: 1;
          height: 46px;
          border: none;
          background: transparent;
          font-size: 14.5px;
          font-family: 'Inter', sans-serif;
          color: #FFF6EC;
          padding-right: 14px;
          outline: none;
        }
        .field-input::placeholder { color: rgba(255,246,236,0.28); }
        .field-toggle {
          width: 42px; height: 46px;
          display: flex; align-items: center; justify-content: center;
          background: transparent; border: none;
          color: rgba(255,246,236,0.4);
          cursor: pointer; flex-shrink: 0;
        }
        .field-toggle:hover { color: rgba(255,246,236,0.7); }

        input:-webkit-autofill {
          -webkit-text-fill-color: #FFF6EC;
          -webkit-box-shadow: 0 0 0px 1000px rgba(255,255,255,0.05) inset;
        }

        .alert-box {
          display: flex; align-items: flex-start; gap: 10px;
          background: rgba(226,75,74,0.14); border: 1px solid rgba(226,75,74,0.3);
          border-radius: 10px; padding: 12px 14px; margin-bottom: 18px;
          font-size: 13px; color: #FFB4B4;
        }
        .alert-box i { font-size: 15px; margin-top: 1px; flex-shrink: 0; }
        .alert-dismiss { margin-left: auto; background: none; border: none; color: rgba(255,180,180,0.6); cursor: pointer; font-size: 16px; line-height: 1; flex-shrink: 0; }

        .submit-btn {
          width: 100%; height: 48px; border: none; border-radius: 10px;
          background: linear-gradient(135deg, #FF9966, #F4694F);
          color: #2C1A12; font-size: 15px; font-weight: 700;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          cursor: pointer; transition: transform 0.1s ease, box-shadow 0.15s ease;
          margin-top: 6px;
        }
        .submit-btn:hover:not(:disabled) { box-shadow: 0 6px 20px rgba(255,153,102,0.35); }
        .submit-btn:active:not(:disabled) { transform: translateY(1px); }
        .submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .submit-btn:focus-visible { outline: 2px solid #FFC98B; outline-offset: 2px; }

        .demo-box {
          margin-top: 22px; padding: 12px 14px;
          background: rgba(255,255,255,0.04);
          border: 1px dashed rgba(255,255,255,0.14);
          border-radius: 10px;
          display: flex; align-items: center; gap: 10px;
        }
        .demo-box-icon {
          width: 30px; height: 30px; border-radius: 8px;
          background: rgba(255,201,139,0.14); color: #FFC98B;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0; font-size: 13px;
        }
        .demo-box-text { font-size: 12px; color: rgba(255,246,236,0.55); line-height: 1.5; }
        .demo-box-text code {
          background: rgba(255,255,255,0.08); padding: 1px 6px; border-radius: 4px;
          color: #FFF6EC; font-size: 12px;
        }

        /* Right column — bell badge (Discord-QR equivalent) */
        .badge-col {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 14px;
        }
        .badge-ring {
          width: 168px; height: 168px;
          border-radius: 50%;
          background: linear-gradient(135deg, #FFD9A0, #FF9966 60%, #F4694F);
          display: flex; align-items: center; justify-content: center;
          position: relative;
          box-shadow: 0 12px 32px rgba(255,153,102,0.25);
        }
        .badge-ring::before {
          content: '';
          position: absolute;
          inset: 10px;
          border-radius: 50%;
          border: 2px dashed rgba(255,255,255,0.4);
          animation: spin 30s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .badge-ring i { font-size: 64px; color: #2C1A12; }

        .badge-title {
          font-family: 'Fraunces', serif;
          font-size: 17px;
          font-weight: 600;
          color: #FFF6EC;
        }
        .badge-desc {
          font-size: 12.5px;
          color: rgba(255,246,236,0.5);
          line-height: 1.6;
          max-width: 220px;
        }
        .badge-desc strong { color: #FFC98B; }

        .login-footer {
          margin-top: 24px;
          font-size: 11px;
          color: rgba(255,246,236,0.3);
          text-align: center;
        }

        @media (max-width: 760px) {
          .login-card {
            grid-template-columns: 1fr;
            padding: 32px 24px;
            gap: 28px;
          }
          .badge-col { order: -1; }
          .badge-ring { width: 120px; height: 120px; }
          .badge-ring i { font-size: 46px; }
          .badge-desc { display: none; }
        }

        @media (prefers-reduced-motion: reduce) {
          .float-item, .star, .badge-ring::before { animation: none; }
        }
      `}</style>

      {/* Ambient background scene */}
      <div className="scene-bg" aria-hidden="true">
        <div className="sun"></div>

        {/* Twinkling stars scattered across the upper sky */}
        {[
          {t:'5%',l:'15%',s:4},{t:'9%',l:'72%',s:3},{t:'3%',l:'45%',s:5},
          {t:'16%',l:'88%',s:3},{t:'28%',l:'5%',s:4},{t:'34%',l:'60%',s:3},
          {t:'45%',l:'92%',s:4},{t:'14%',l:'30%',s:3},{t:'22%',l:'18%',s:5},
        ].map((s, i) => (
          <span key={i} className="star" style={{
            top: s.t, left: s.l, width: s.s, height: s.s,
            animationDelay: `${i * 0.4}s`,
          }}></span>
        ))}

        {/* Floating school motifs */}
        <i className="bi bi-pencil-fill float-item f1"></i>
        <i className="bi bi-star-fill float-item dim f2"></i>
        <i className="bi bi-book-fill float-item f3"></i>
        <i className="bi bi-mortarboard-fill float-item dim f4"></i>
        <i className="bi bi-bookmark-star-fill float-item f5"></i>
        <i className="bi bi-stars float-item dim f6"></i>

        {/* School building skyline silhouette */}
        <div className="skyline">
          <svg viewBox="0 0 1200 300" preserveAspectRatio="none">
            <path
              d="M0,300 L0,180 L60,180 L60,140 L160,140 L160,180 L260,180 L260,100
                 L300,100 L300,70 L340,70 L340,100 L380,100 L380,180
                 L520,180 L520,120 L560,120 L560,90 L620,90 L620,120 L660,120 L660,180
                 L820,180 L820,150 L900,150 L900,180 L1040,180 L1040,110
                 L1080,110 L1080,80 L1120,80 L1120,110 L1160,110 L1160,180
                 L1200,180 L1200,300 Z"
              fill="#241C44"
              opacity="0.85"
            />
            {/* Windows on the main building block */}
            <g fill="#FFD9A0" opacity="0.5">
              <rect x="40" y="155" width="14" height="18" />
              <rect x="80" y="155" width="14" height="18" />
              <rect x="120" y="155" width="14" height="18" />
              <rect x="540" y="135" width="14" height="18" />
              <rect x="580" y="135" width="14" height="18" />
              <rect x="620" y="135" width="14" height="18" />
              <rect x="840" y="160" width="14" height="14" />
              <rect x="870" y="160" width="14" height="14" />
            </g>
          </svg>
        </div>
      </div>

      {/* Centered glass card */}
      <div className="login-card">
        {/* LEFT — form */}
        <div>
          <div className="card-eyebrow">
            <i className="bi bi-mortarboard-fill"></i>
            School Management System
          </div>
          <h1 className="card-title">Welcome back</h1>
          <p className="card-desc">Sign in to your school portal to continue.</p>

          {error && (
            <div className="alert-box" role="alert">
              <i className="bi bi-exclamation-triangle-fill"></i>
              <span>{error}</span>
              <button type="button" className="alert-dismiss" aria-label="Dismiss"
                onClick={() => dispatch(clearError())}>
                <i className="bi bi-x"></i>
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div className="field-group">
              <label className="field-label" htmlFor="login-email">Email address</label>
              <div className="field-wrap">
                <span className="field-icon"><i className="bi bi-envelope"></i></span>
                <input
                  id="login-email"
                  type="email"
                  className="field-input"
                  placeholder="admin@school.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoFocus
                  autoComplete="email"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="field-group">
              <div className="field-row-top">
                <label className="field-label" htmlFor="login-password">Password</label>
                <a href="#" className="forgot-link">Forgot password?</a>
              </div>
              <div className="field-wrap">
                <span className="field-icon"><i className="bi bi-lock"></i></span>
                <input
                  id="login-password"
                  type={showPass ? 'text' : 'password'}
                  className="field-input"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  disabled={loading}
                />
                <button
                  type="button"
                  className="field-toggle"
                  onClick={() => setShowPass(v => !v)}
                  tabIndex={-1}
                  aria-label={showPass ? 'Hide password' : 'Show password'}
                >
                  <i className={`bi ${showPass ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                </button>
              </div>
            </div>

            <button type="submit" className="submit-btn" disabled={loading || !email || !password}>
              {loading ? (
                <>
                  <span className="spinner-border spinner-border-sm"></span>
                  Signing in&hellip;
                </>
              ) : (
                <>
                  Sign in
                  <i className="bi bi-arrow-right"></i>
                </>
              )}
            </button>
          </form>

          <div className="demo-box">
            <div className="demo-box-icon"><i className="bi bi-key"></i></div>
            <div className="demo-box-text">
              Demo credentials — <code>rahul@demoschool.com</code> / <code>Admin@123</code>
            </div>
          </div>

          <p className="login-footer">
            &copy; {new Date().getFullYear()} School Management System
          </p>
        </div>

        {/* RIGHT — badge column (Discord-QR equivalent) */}
        <div className="badge-col">
          <div className="badge-ring">
            <i className="bi bi-mortarboard-fill"></i>
          </div>
          <div className="badge-title">Your school, all in one place</div>
          <div className="badge-desc">
            Attendance, fees, timetables, exams, transport and library —
            everything your <strong>school portal</strong> needs to run the day.
          </div>
        </div>
      </div>
    </div>
  )
}
