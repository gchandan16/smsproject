import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {useDispatch,useSelector} from 'react-redux'
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
  const [showPass,setShowPass]=useState(false)
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const loading= useSelector(selectAuthLoading)
  const error = useSelector(selectAuthError)
  const isAuthenticated=useSelector(selectIsAuthenticated)

  //Already loggedin -> go to dashbaord

  useEffect(()=>{
       if(isAuthenticated) navigate('/',{replace:true})
  },[isAuthenticated])

  const handleSubmit=async (e) =>{
      e.preventDefault()
      try{
            dispatch(clearError())
            const result= await dispatch(loginThunk({email,password}))
            if(loginThunk.fulfilled.match(result)){
                navigate('/', { replace: true })
            }
      }
      catch (err) {
            console.error("Login Error:", err)
      }
  }



  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center bg-body-tertiary">
      <div className="col-12 col-sm-8 col-md-5 col-lg-4 col-xl-3">

        <div className="card shadow-sm border-0">
          <div className="card-body p-4 p-md-5">

            {/* Brand */}
            <div className="text-center mb-4">
              <div
                className="d-inline-flex align-items-center justify-content-center
                           bg-primary rounded-circle mb-3"
                style={{ width: 64, height: 64 }}
              >
                <i className="bi bi-mortarboard-fill text-white fs-3"></i>
              </div>
              <h4 className="fw-bold mb-1">Welcome back</h4>
              <p className="text-muted small mb-0">School Management System</p>
            </div>

            {/* Error Alert */}
            {error && (
              <div className="alert alert-danger d-flex align-items-center py-2 mb-3">
                <i className="bi bi-exclamation-triangle-fill me-2 flex-shrink-0"></i>
                <span className="small flex-grow-1">{error}</span>
                <button
                  type="button"
                  className="btn-close btn-sm"
                  onClick={() => dispatch(clearError())}
                ></button>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate>

              {/* Email */}
              <div className="mb-3">
                <label className="form-label fw-medium small">Email address</label>
                <div className="input-group">
                  <span className="input-group-text bg-light border-end-0">
                    <i className="bi bi-envelope text-muted"></i>
                  </span>
                  <input
                    type="email"
                    className="form-control border-start-0 ps-0"
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

              {/* Password */}
              <div className="mb-4">
                <div className="d-flex justify-content-between">
                  <label className="form-label fw-medium small">Password</label>
                  <a href="#" className="small text-primary text-decoration-none">
                    Forgot password?
                  </a>
                </div>
                <div className="input-group">
                  <span className="input-group-text bg-light border-end-0">
                    <i className="bi bi-lock text-muted"></i>
                  </span>
                  <input
                    type={showPass ? 'text' : 'password'}
                    className="form-control border-start-0 border-end-0 ps-0"
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    className="input-group-text bg-light"
                    onClick={() => setShowPass(v => !v)}
                    tabIndex={-1}
                  >
                    <i className={`bi ${showPass ? 'bi-eye-slash' : 'bi-eye'} text-muted`}></i>
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                className="btn btn-primary w-100"
                disabled={loading || !email || !password}
              >
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2"></span>
                    Signing in...
                  </>
                ) : (
                  <>
                    <i className="bi bi-box-arrow-in-right me-2"></i>
                    Sign In
                  </>
                )}
              </button>

            </form>

            {/* Demo credentials */}
            <div className="mt-4 p-3 bg-light rounded-3">
              <p className="small text-muted fw-medium mb-1 text-center">
                Demo credentials
              </p>
              <div className="text-center">
                <code className="small">rahul@demoschool.com</code><br/>
                <code className="small">Admin@123</code>
              </div>
            </div>

          </div>
        </div>

        <p className="text-center text-muted small mt-3">
          &copy; {new Date().getFullYear()} School Management System
        </p>
      </div>
    </div>
  )
}