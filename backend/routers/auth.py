# backend/routers/auth.py
from fastapi import APIRouter, Depends, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

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
def get_me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    role = getattr(current_user, "role_name", None) or "staff"

    from sqlalchemy import text
    profile = db.execute(text("""
        SELECT school_name, logo_url FROM school_profile WHERE tenant_id=:tid
    """), {"tid": str(current_user.tenant_id)}).fetchone()

    school_name = (profile.school_name if profile and profile.school_name else None) or current_user.tenant.name
    school_logo = profile.logo_url if profile else None

    # Load permissions from role
    permissions = []
    if role == "superadmin":
        permissions = ["**"]
    elif hasattr(current_user, 'role_obj') and current_user.role_obj is not None:
        raw = current_user.role_obj.permissions or []
        permissions = [
            p for p in raw
            if isinstance(p, str) and "." in p and ":" not in p and p != "**"
        ]

    return UserInfo(
        id=current_user.id,
        email=current_user.email,
        role=role,
        tenant_id=current_user.tenant_id,
        tenant_name=current_user.tenant.name,
        school_name=school_name,
        school_logo_url=school_logo,
        permissions=permissions,
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
