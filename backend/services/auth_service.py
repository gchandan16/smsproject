# backend/services/auth_service.py
from uuid import UUID
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from jose import JWTError, jwt
import bcrypt as _bcrypt

from repositories.user_repository import UserRepository
from models.user import User
from schemas.auth import TokenResponse, UserInfo
from config import settings


# ── Direct bcrypt (passlib's bcrypt backend is broken on bcrypt 4.1+) ──
# Must match the hashing used in routers/users.py exactly, so that
# passwords set via either path verify correctly here.
class _Bcrypt:
    def hash(self, pwd: str) -> str:
        return _bcrypt.hashpw(pwd.encode("utf-8"), _bcrypt.gensalt()).decode("utf-8")

    def verify(self, pwd: str, hashed: str) -> bool:
        try:
            return _bcrypt.checkpw(pwd.encode("utf-8"), hashed.encode("utf-8"))
        except Exception:
            return False


pwd_context = _Bcrypt()


class AuthService:
    def __init__(self, db: Session):
        self.repo = UserRepository(db)

    @staticmethod
    def hash_password(plain: str) -> str:
        return pwd_context.hash(plain)

    @staticmethod
    def verify_password(plain: str, hashed: str) -> bool:
        return pwd_context.verify(plain, hashed)

    @staticmethod
    def _get_role_name(user: User) -> str:
        """
        Safely get role name from user.
        Uses role_obj relationship (renamed from 'role').
        """
        # Try role_obj relationship first
        if hasattr(user, 'role_obj') and user.role_obj is not None:
            return user.role_obj.name or "staff"
        # Fallback: try old 'role' attribute (varchar column if it exists)
        role_attr = getattr(user, 'role', None)
        if role_attr and isinstance(role_attr, str):
            return role_attr
        return "staff"

    @staticmethod
    def create_access_token(user: User) -> str:
        expire = datetime.now(timezone.utc) + timedelta(
            minutes=settings.access_token_expire_minutes
        )
        role = AuthService._get_role_name(user)
        payload = {
            "sub":       str(user.id),
            "tenant_id": str(user.tenant_id),
            "role":      role,
            "email":     user.email,
            "exp":       expire,
        }
        return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)

    @staticmethod
    def decode_token(token: str) -> dict:
        try:
            return jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        except JWTError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token is invalid or expired",
                headers={"WWW-Authenticate": "Bearer"},
            )

    def login(self, email: str, password: str) -> TokenResponse:
        user = self.repo.get_by_email(email)
        if not user or not (password== user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
            )
        if not user.tenant or not user.tenant.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="School account is inactive.",
            )
        self.repo.update_last_login(user)
        token = self.create_access_token(user)
        role  = self._get_role_name(user)

        # School branding from school_profile (Settings → School Profile),
        # falling back to tenant name/logo if no profile configured yet.
        from sqlalchemy import text
        profile = self.repo.db.execute(text("""
            SELECT school_name, logo_url FROM school_profile WHERE tenant_id=:tid
        """), {"tid": str(user.tenant_id)}).fetchone()

        school_name = (profile.school_name if profile and profile.school_name else None) or user.tenant.name
        school_logo = profile.logo_url if profile else None

        # Load dynamic permissions from the role row in the DB.
        # Superadmin gets ["**"] sentinel → frontend treats as "all permissions".
        permissions = []
        if role == "superadmin":
            permissions = ["**"]
        elif hasattr(user, 'role_obj') and user.role_obj is not None:
            raw = user.role_obj.permissions or []
            # Only include new-format "module.action" strings (not legacy "module:*" format)
            permissions = [
                p for p in raw
                if isinstance(p, str) and "." in p and ":" not in p and p != "**"
            ]
        return TokenResponse(
            access_token=token,
            expires_in=settings.access_token_expire_minutes * 60,
            user=UserInfo(
                id=user.id,
                email=user.email,
                role=role,
                tenant_id=user.tenant_id,
                tenant_name=user.tenant.name,
                school_name=school_name,
                school_logo_url=school_logo,
                permissions=permissions,
            ),
        )

    def get_current_user(self, token: str) -> User:
        payload = self.decode_token(token)
        user = self.repo.get_by_id_with_relations(UUID(payload["sub"]))
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found or inactive",
            )
        return user

    def change_password(self, user: User, current_password: str, new_password: str) -> None:
        if not self.verify_password(current_password, user.password_hash):
            raise HTTPException(status_code=400, detail="Current password is incorrect")
        if len(new_password) < 8:
            raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
        self.repo.update(user, {"password_hash": self.hash_password(new_password)})
