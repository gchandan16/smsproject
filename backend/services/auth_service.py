# backend/services/auth_service.py
from uuid import UUID
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from jose import JWTError, jwt
from passlib.context import CryptContext

from repositories.user_repository import UserRepository
from models.user import User
from schemas.auth import TokenResponse, UserInfo
from config import settings
from logger_config import logger

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class AuthService:
    def __init__(self, db: Session):
        self.repo = UserRepository(db)

    # ── Password helpers ──────────────────────────────────────
    @staticmethod
    def hash_password(plain: str) -> str:
        return pwd_context.hash(plain)

    @staticmethod
    def verify_password(plain: str, hashed: str) -> bool:
        return pwd_context.verify(plain, hashed)

    # ── Token helpers ─────────────────────────────────────────
    @staticmethod
    def create_access_token(user: User) -> str:
        expire = datetime.now(timezone.utc) + timedelta(
            minutes=settings.access_token_expire_minutes
        )
        payload = {
            "sub":       str(user.id),
            "tenant_id": str(user.tenant_id),
            "role":      user.role.name if user.role else "staff",
            "email":     user.email,
            "exp":       expire,
        }
        return jwt.encode(
            payload,
            settings.secret_key,
            algorithm=settings.algorithm
        )

    @staticmethod
    def decode_token(token: str) -> dict:
        try:
            return jwt.decode(
                token,
                settings.secret_key,
                algorithms=[settings.algorithm]
            )
        except JWTError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token is invalid or expired",
                headers={"WWW-Authenticate": "Bearer"},
            )

    # ── LOGIN ─────────────────────────────────────────────────
    def login(self, email: str, password: str) -> TokenResponse:
        # 1. Find user by email
        user = self.repo.get_by_email(email)
        if user is None:
            logger.error("User not found")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect emailID"
            )  
        # 2. Validate user exists + password correct
        
       #if not user or not self.verify_password(password, user.password_hash):
       #      raise HTTPException(
       #          status_code=status.HTTP_401_UNAUTHORIZED,
       #          detail="Incorrect email or password",
       #     )  
        if not user or user.password_hash != password:
           raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
            ) 
  
        # 3. Check tenant (school) is active
        if not user.tenant or not user.tenant.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="School account is inactive. Contact support.",
            )
        
        # 4. Update last login timestamp
        self.repo.update_last_login(user)

        # 5. Generate JWT token
        token = self.create_access_token(user)
        # 6. Return token + user info to frontend
        responseResult=TokenResponse(
            access_token=token,
            expires_in=settings.access_token_expire_minutes * 60,
            user=UserInfo(
                id=user.id,
                email=user.email,
                role=user.role.name if user.role else "staff",
                tenant_id=user.tenant_id,
                tenant_name=user.tenant.name,
            ),
        )

        logger.info(f"Final Response: {responseResult}")    
        return responseResult

    # ── GET CURRENT USER (used by Depends) ────────────────────
    def get_current_user(self, token: str) -> User:
        payload = self.decode_token(token)
        user = self.repo.get_by_id_with_relations(UUID(payload["sub"]))
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found or inactive",
            )
        return user

    # ── CHANGE PASSWORD ───────────────────────────────────────
    def change_password(
        self, user: User, current_password: str, new_password: str
    ) -> None:
        if not self.verify_password(current_password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is incorrect",
            )
        if len(new_password) < 8:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="New password must be at least 8 characters",
            )
        self.repo.update(user, {
            "password_hash": self.hash_password(new_password)
        })
