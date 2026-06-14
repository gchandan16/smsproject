# backend/schemas/auth.py
from pydantic import BaseModel, EmailStr
from uuid import UUID
from typing import Optional, List

# ── What the token response returns to frontend ───────────────
class UserInfo(BaseModel):
    id:              UUID
    email:           str
    role:            str
    tenant_id:       UUID
    tenant_name:     str
    school_name:     Optional[str]       = None
    school_logo_url: Optional[str]       = None
    permissions:     Optional[List[str]] = []   # ← dynamic permissions from DB

    class Config:
        from_attributes = True

class TokenResponse(BaseModel):
    access_token: str
    token_type:   str = "bearer"
    expires_in:   int       # seconds
    user:         UserInfo

# ── Change password request ───────────────────────────────────
class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password:     str
