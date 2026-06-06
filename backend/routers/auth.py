# backend/routers/auth.py
from fastapi import APIRouter, Depends, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from logger_config import logger

from database import get_db
from services.auth_service import AuthService
from schemas.auth import TokenResponse, UserInfo, ChangePasswordRequest
from models.user import User

router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

# ── Reusable dependency — injects current user into any route ─
def get_current_user(
    token: str    = Depends(oauth2_scheme),
    db: Session   = Depends(get_db),
) -> User:
    return AuthService(db).get_current_user(token)

# ─────────────────────────────────────────────────────────────
# POST /api/auth/login
# Called by frontend authApi.login()
# Accepts: OAuth2 form (username + password)
# Returns: { access_token, token_type, expires_in, user }
# ─────────────────────────────────────────────────────────────
@router.post("/login", response_model=TokenResponse)
def login(
    form: OAuth2PasswordRequestForm = Depends(),
    db:   Session = Depends(get_db),
):
    logger.info(f"Login attempt for email: {form.username} and password :{form.password}")

    return AuthService(db).login(
        email=form.username,
        password=form.password,
    )

# ─────────────────────────────────────────────────────────────
# GET /api/auth/me
# Called by frontend fetchMeThunk on app load
# Returns current logged-in user info
# ─────────────────────────────────────────────────────────────
@router.get("/me", response_model=UserInfo)
def get_me(current_user: User = Depends(get_current_user)):
    return UserInfo(
        id=current_user.id,
        email=current_user.email,
        role=current_user.role.name if current_user.role else "staff",
        tenant_id=current_user.tenant_id,
        tenant_name=current_user.tenant.name,
    )

# ─────────────────────────────────────────────────────────────
# POST /api/auth/change-password
# ─────────────────────────────────────────────────────────────
@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(
    data: ChangePasswordRequest,
    current_user: User  = Depends(get_current_user),
    db: Session         = Depends(get_db),
):
    AuthService(db).change_password(
        current_user,
        data.current_password,
        data.new_password,
    )

# ─────────────────────────────────────────────────────────────
# POST /api/auth/logout
# JWT is stateless — client deletes token.
# ─────────────────────────────────────────────────────────────
@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(_: User = Depends(get_current_user)):
    pass
