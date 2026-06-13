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

const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']

const NOTICES = [
  { icon: 'bi-megaphone', text: 'Annual Sports Day — Friday, all classes' },
  { icon: 'bi-calendar-event', text: 'PTM scheduled for Grade 6–8' },
  { icon: 'bi-trophy', text: 'Inter-school quiz results out' },
]

export default function LoginPage() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const loading = useSelector(selectAuthLoading)
  const error = useSelector(selectAuthError)
  const isAuthenticated = useSelector(selectIsAuthenticated)

  const now = new Date()

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
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&family=Caveat:wght@500;600;700&display=swap');

        * { box-sizing: border-box; }

        .login-page {
          min-height: 100vh;
          display: flex;
          background: #F7F5F0;
          font-family: 'Inter', sans-serif;
          color: #1E2A38;
        }

        /* ═══════════════ LEFT — SCHOOL CORRIDOR SCENE ═══════════════ */
        .scene {
          flex: 1.15;
          position: relative;
          overflow: hidden;
          background: linear-gradient(180deg, #FBE8C8 0%, #F6D9A8 28%, #E8C190 55%, #C9A876 100%);
        }

        /* Floor */
        .scene-floor {
          position: absolute;
          left: 0; right: 0; bottom: 0;
          height: 34%;
          background: linear-gradient(180deg, #B89A78 0%, #9C8164 100%);
        }
        .scene-floor::before {
          content: '';
          position: absolute;
          inset: 0;
          background: repeating-linear-gradient(
            100deg,
            rgba(255,255,255,0.05) 0px,
            rgba(255,255,255,0.05) 2px,
            transparent 2px,
            transparent 64px
          );
        }

        /* Perspective corridor walls converging to a doorway of light */
        .corridor {
          position: absolute;
          inset: 0;
        }
        .wall-left, .wall-right {
          position: absolute;
          top: 0; bottom: 34%;
          width: 38%;
          background: linear-gradient(180deg, #E7C99C 0%, #D4AE7D 100%);
        }
        .wall-left {
          left: 0;
          clip-path: polygon(0 0, 100% 0, 56% 100%, 0 100%);
        }
        .wall-right {
          right: 0;
          clip-path: polygon(0 0, 100% 0, 100% 100%, 44% 100%);
        }

        /* Doorway glow at the end of the corridor */
        .doorway {
          position: absolute;
          top: 6%;
          left: 50%;
          transform: translateX(-50%);
          width: 30%;
          height: 64%;
          background: radial-gradient(ellipse 100% 90% at 50% 35%, #FFF6E0 0%, #FCE6BC 45%, rgba(252,230,188,0) 100%);
          border-radius: 6px 6px 0 0;
          filter: blur(0.5px);
        }
        .doorway::after {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse 70% 60% at 50% 28%, rgba(255,255,255,0.55), transparent 70%);
          animation: glow 6s ease-in-out infinite;
        }
        @keyframes glow {
          0%, 100% { opacity: 0.55; }
          50% { opacity: 0.85; }
        }

        /* Sunbeams crossing the corridor */
        .sunbeam {
          position: absolute;
          top: -10%;
          width: 14%;
          height: 120%;
          background: linear-gradient(180deg, rgba(255,250,230,0.35), rgba(255,250,230,0));
          transform: skewX(-18deg);
          mix-blend-mode: screen;
          animation: drift 14s ease-in-out infinite;
        }
        .sunbeam.b1 { left: 18%; animation-delay: 0s; }
        .sunbeam.b2 { left: 46%; width: 10%; opacity: 0.7; animation-delay: -5s; }
        .sunbeam.b3 { left: 68%; width: 16%; opacity: 0.5; animation-delay: -9s; }
        @keyframes drift {
          0%, 100% { transform: skewX(-18deg) translateX(0); opacity: 0.7; }
          50% { transform: skewX(-18deg) translateX(18px); opacity: 1; }
        }

        /* Window light squares on walls */
        .window {
          position: absolute;
          background: linear-gradient(180deg, #FFF8E6, #FCE7BE);
          border: 3px solid rgba(120,90,50,0.25);
          border-radius: 2px;
        }
        .window::before {
          content: '';
          position: absolute;
          left: 50%; top: 0; bottom: 0;
          width: 3px;
          background: rgba(120,90,50,0.2);
        }
        .w1 { top: 12%; left: 4%; width: 13%; height: 22%; }
        .w2 { top: 16%; right: 5%; width: 11%; height: 19%; }

        /* Backpack + open door silhouette motif near bottom */
        .motif {
          position: absolute;
          bottom: 12%;
          left: 9%;
          color: rgba(94,68,38,0.5);
          font-size: 46px;
          animation: bob 5s ease-in-out infinite;
        }
        @keyframes bob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }

        /* Content overlay */
        .scene-content {
          position: relative;
          z-index: 2;
          height: 100%;
          display: flex;
          flex-direction: column;
          padding: 48px 52px;
        }
        .scene-brand {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .scene-brand-mark {
          width: 42px; height: 42px;
          border-radius: 10px;
          background: #1E3A5F;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          box-shadow: 0 2px 10px rgba(30,58,95,0.25);
        }
        .scene-brand-mark i { color: #FBE8C8; font-size: 20px; }
        .scene-brand-name {
          font-family: 'Fraunces', serif;
          font-size: 19px;
          font-weight: 600;
          color: #4A3621;
        }

        .scene-headline {
          font-family: 'Fraunces', serif;
          font-weight: 600;
          font-size: clamp(32px, 4vw, 48px);
          line-height: 1.15;
          color: #3E2E18;
          margin: 40px 0 12px;
          max-width: 440px;
          letter-spacing: -0.01em;
        }
        .scene-sub {
          font-size: 15px;
          color: #6B5638;
          max-width: 360px;
          line-height: 1.6;
        }

        /* Noticeboard pinned to the wall */
        .noticeboard {
          margin-top: auto;
          background: #FFFCF5;
          border: 1px solid rgba(94,68,38,0.12);
          border-radius: 12px;
          padding: 18px 20px;
          max-width: 340px;
          box-shadow: 0 8px 24px rgba(94,68,38,0.10);
          position: relative;
        }
        .noticeboard::before {
          content: '';
          position: absolute;
          top: -7px; left: 24px;
          width: 14px; height: 14px;
          border-radius: 50%;
          background: #D85A30;
          box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        }
        .noticeboard-date {
          font-family: 'Caveat', cursive;
          font-size: 22px;
          font-weight: 600;
          color: #1E3A5F;
          margin-bottom: 10px;
          display: flex;
          align-items: baseline;
          gap: 8px;
        }
        .noticeboard-date .big {
          font-size: 32px;
          line-height: 1;
        }
        .notice-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .notice-row {
          display: flex;
          align-items: flex-start;
          gap: 9px;
          font-size: 13px;
          color: #4A3621;
          line-height: 1.45;
        }
        .notice-row i {
          color: #D85A30;
          font-size: 14px;
          margin-top: 2px;
          flex-shrink: 0;
        }

        /* ═══════════════ RIGHT — LOGIN FORM ═══════════════ */
        .login-main {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 32px;
          background: #F7F5F0;
        }
        .login-card { width: 100%; max-width: 392px; }
        .login-card-header { margin-bottom: 32px; }
        .login-card-eyebrow {
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.16em;
          color: #2D5F4C;
          font-weight: 600;
          margin-bottom: 10px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .login-card-eyebrow::before {
          content: '';
          width: 18px; height: 1px;
          background: #2D5F4C;
        }
        .login-card-title {
          font-family: 'Fraunces', serif;
          font-size: 30px;
          font-weight: 600;
          color: #1E2A38;
          letter-spacing: -0.01em;
          margin-bottom: 6px;
        }
        .login-card-desc { font-size: 14px; color: #64748B; }

        .field-group { margin-bottom: 18px; }
        .field-label {
          display: block;
          font-size: 12.5px;
          font-weight: 600;
          color: #1E2A38;
          margin-bottom: 7px;
        }
        .field-wrap {
          position: relative;
          display: flex;
          align-items: center;
          background: #FFFFFF;
          border: 1.5px solid #E2E0D8;
          border-radius: 10px;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }
        .field-wrap:focus-within {
          border-color: #2D5F4C;
          box-shadow: 0 0 0 3px rgba(45,95,76,0.10);
        }
        .field-icon {
          display: flex; align-items: center; justify-content: center;
          width: 42px; height: 46px;
          color: #94A0AC;
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
          color: #1E2A38;
          padding-right: 14px;
          outline: none;
        }
        .field-input::placeholder { color: #B6BCC4; }
        .field-toggle {
          width: 42px; height: 46px;
          display: flex; align-items: center; justify-content: center;
          background: transparent;
          border: none;
          color: #94A0AC;
          cursor: pointer;
          flex-shrink: 0;
        }
        .field-toggle:hover { color: #64748B; }

        .field-row-top { display: flex; justify-content: space-between; align-items: baseline; }
        .forgot-link { font-size: 12.5px; color: #2D5F4C; text-decoration: none; font-weight: 500; }
        .forgot-link:hover { text-decoration: underline; }

        .alert-box {
          display: flex; align-items: flex-start; gap: 10px;
          background: #FBEAEA; border: 1px solid #F0C9C9; border-radius: 10px;
          padding: 12px 14px; margin-bottom: 18px; font-size: 13px; color: #9B3232;
        }
        .alert-box i { font-size: 15px; margin-top: 1px; flex-shrink: 0; }
        .alert-dismiss { margin-left: auto; background: none; border: none; color: #C98F8F; cursor: pointer; font-size: 16px; line-height: 1; flex-shrink: 0; }

        .submit-btn {
          width: 100%; height: 48px; border: none; border-radius: 10px;
          background: #1E3A5F; color: #F7F5F0; font-size: 15px; font-weight: 600;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          cursor: pointer; transition: background 0.15s ease, transform 0.1s ease;
        }
        .submit-btn:hover:not(:disabled) { background: #16304D; }
        .submit-btn:active:not(:disabled) { transform: translateY(1px); }
        .submit-btn:disabled { opacity: 0.55; cursor: not-allowed; }
        .submit-btn:focus-visible { outline: 2px solid #E8A33D; outline-offset: 2px; }

        .demo-box {
          margin-top: 28px; padding: 14px 16px; background: #FFFFFF;
          border: 1px dashed #D8D4C8; border-radius: 10px;
          display: flex; align-items: center; gap: 12px;
        }
        .demo-box-icon {
          width: 32px; height: 32px; border-radius: 8px; background: #EFF3F0;
          color: #2D5F4C; display: flex; align-items: center; justify-content: center;
          flex-shrink: 0; font-size: 14px;
        }
        .demo-box-text { font-size: 12px; color: #64748B; line-height: 1.5; }
        .demo-box-text code { background: #F1EFE7; padding: 1px 6px; border-radius: 4px; color: #1E2A38; font-size: 12px; }

        .login-footer { margin-top: 32px; font-size: 12px; color: #ADB5BD; text-align: center; }

        input:-webkit-autofill {
          -webkit-text-fill-color: #1E2A38;
          -webkit-box-shadow: 0 0 0px 1000px #FFFFFF inset;
        }

        @media (max-width: 880px) {
          .scene { display: none; }
          .login-main { padding: 24px; }
        }

        @media (prefers-reduced-motion: reduce) {
          .doorway::after, .sunbeam, .motif { animation: none; }
        }
      `}</style>

      {/* LEFT — School corridor scene */}
      <div className="scene" aria-hidden="true">
        <div className="corridor">
          <div className="wall-left"></div>
          <div className="wall-right"></div>
          <div className="window w1"></div>
          <div className="window w2"></div>
          <div className="sunbeam b1"></div>
          <div className="sunbeam b2"></div>
          <div className="sunbeam b3"></div>
          <div className="doorway"></div>
        </div>
        <div className="scene-floor"></div>
        <i className="bi bi-backpack2-fill motif"></i>

        <div className="scene-content">
          <div className="scene-brand">
            <div className="scene-brand-mark"><i className="bi bi-mortarboard-fill"></i></div>
            <span className="scene-brand-name">SMS Admin</span>
          </div>

          <h1 className="scene-headline">Good morning. The school day starts here.</h1>
          <p className="scene-sub">
            Sign in to take attendance, manage fees, plan timetables,
            and keep every classroom running smoothly.
          </p>

          <div className="noticeboard">
            <div className="noticeboard-date">
              <span className="big">{now.getDate()}</span>
              <span>{MONTH_NAMES[now.getMonth()]} {now.getFullYear()} &middot; {DAY_NAMES[now.getDay()]}</span>
            </div>
            <div className="notice-list">
              {NOTICES.map((n, i) => (
                <div key={i} className="notice-row">
                  <i className={`bi ${n.icon}`}></i>
                  <span>{n.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT — Login form */}
      <main className="login-main">
        <div className="login-card">
          <div className="login-card-header">
            <div className="login-card-eyebrow">School Management System</div>
            <h2 className="login-card-title">Welcome back</h2>
            <p className="login-card-desc">Sign in to your school portal to continue.</p>
          </div>

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
      </main>
    </div>
  )
}
