# backend/routers/users.py
from uuid import UUID
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func as sqlfunc
from pydantic import BaseModel, field_validator
import bcrypt as _bcrypt

from database import get_db
from routers.auth import get_current_user
from models.user import User
from models.role import Role

router = APIRouter()

# ── bcrypt wrapper ────────────────────────────────────────────
class _Bcrypt:
    def hash(self, pwd: str) -> str:
        return _bcrypt.hashpw(pwd.encode("utf-8"), _bcrypt.gensalt()).decode("utf-8")
    def verify(self, pwd: str, hashed: str) -> bool:
        try:
            return _bcrypt.checkpw(pwd.encode("utf-8"), hashed.encode("utf-8"))
        except Exception:
            return False

bcrypt = _Bcrypt()
ADMIN_ROLES = {"admin", "superadmin"}


# ── Helpers ───────────────────────────────────────────────────
def get_role_name(user: User, db: Session = None) -> str:
    """Get role name — uses role_name property on User model."""
    # 1. Use the property defined on User model
    if hasattr(user, 'role_name'):
        name = user.role_name
        if name:
            return name.lower()

    # 2. Try role_obj relationship directly
    role_obj = getattr(user, 'role_obj', None)
    if role_obj and hasattr(role_obj, 'name'):
        return (role_obj.name or "").lower()

    # 3. Query by role_id
    if db and user.role_id:
        r = db.query(Role).filter(Role.id == user.role_id).first()
        if r:
            return (r.name or "").lower()
    return ""


def require_admin(cu: User, db: Session = None):
    role = get_role_name(cu, db)
    if role not in ADMIN_ROLES:
        raise HTTPException(403,
            f"Admin access required. Your role: '{role or 'unknown'}'")


def find_role(db: Session, tenant_id, name: str) -> Optional[Role]:
    """Case-insensitive role lookup. 'admin' also matches 'superadmin'."""
    r = db.query(Role).filter(
        Role.tenant_id == tenant_id,
        sqlfunc.lower(Role.name) == name.lower(),
    ).first()
    if r:
        return r
    if name.lower() == "admin":
        return db.query(Role).filter(
            Role.tenant_id == tenant_id,
            sqlfunc.lower(Role.name) == "superadmin",
        ).first()
    return None


def with_role(db: Session, user_id) -> Optional[User]:
    return (
        db.query(User)
        .options(joinedload(User.role_obj))
        .filter(User.id == user_id)
        .first()
    )


def get404(db, user_id, tenant_id) -> User:
    u = (
        db.query(User)
        .options(joinedload(User.role_obj))
        .filter(User.id == user_id, User.tenant_id == tenant_id)
        .first()
    )
    if not u:
        raise HTTPException(404, "User not found")
    return u


def serialize(u: User) -> dict:
    return {
        "id":         str(u.id),
        "email":      u.email,
        "first_name": u.first_name or "",
        "last_name":  u.last_name  or "",
        "role":       get_role_name(u),
        "role_id":    str(u.role_id) if u.role_id else None,
        "is_active":  u.is_active,
        "phone":      u.phone,
        "last_login": str(u.last_login_at) if u.last_login_at else None,
        "created_at": str(u.created_at)    if u.created_at    else None,
    }


def attach_link_status(db: Session, tenant_id: UUID, serialized_users: list[dict]) -> list[dict]:
    """
    For users with role student/parent, check whether they're linked
    to a students/guardians record (via user_id) and attach a 'linked' flag
    plus the linked record's display info.
    """
    from sqlalchemy import text, bindparam

    student_ids = [u["id"] for u in serialized_users if u["role"] == "student"]
    parent_ids  = [u["id"] for u in serialized_users if u["role"] == "parent"]

    student_links = {}
    if student_ids:
        sql = text("""
            SELECT user_id, id, first_name, last_name, admission_no
            FROM students WHERE tenant_id=:tid AND user_id IN :uids
        """).bindparams(bindparam("uids", expanding=True))
        rows = db.execute(sql, {"tid": str(tenant_id), "uids": tuple(student_ids)}).fetchall()
        for r in rows:
            student_links[str(r.user_id)] = {
                "linked_id": str(r.id),
                "linked_name": f"{r.first_name} {r.last_name or ''}".strip(),
                "linked_detail": r.admission_no,
            }

    guardian_links = {}
    if parent_ids:
        sql = text("""
            SELECT gu.user_id, gu.id, gu.first_name, gu.last_name, gu.relation,
                   s.first_name AS student_first, s.last_name AS student_last, s.admission_no
            FROM guardians gu
            JOIN students s ON s.id = gu.student_id
            WHERE gu.tenant_id=:tid AND gu.user_id IN :uids
        """).bindparams(bindparam("uids", expanding=True))
        rows = db.execute(sql, {"tid": str(tenant_id), "uids": tuple(parent_ids)}).fetchall()
        for r in rows:
            guardian_links[str(r.user_id)] = {
                "linked_id": str(r.id),
                "linked_name": f"{r.first_name} {r.last_name or ''}".strip(),
                "linked_detail": f"{r.relation} of {r.student_first} {r.student_last or ''} ({r.admission_no})".strip(),
            }

    for u in serialized_users:
        if u["role"] == "student":
            link = student_links.get(u["id"])
        elif u["role"] == "parent":
            link = guardian_links.get(u["id"])
        else:
            link = None

        u["linked"] = link is not None
        u["link_info"] = link

    return serialized_users


# ── Schemas ───────────────────────────────────────────────────
class CreateUserIn(BaseModel):
    email:      str
    password:   str
    first_name: str
    last_name:  Optional[str] = None
    role:       str           = ""
    phone:      Optional[str] = None
    model_config = {"extra": "ignore"}

    @field_validator("password")
    @classmethod
    def min_len(cls, v):
        if len(v) < 6:
            raise ValueError("Min 6 characters")
        return v


class UpdateUserIn(BaseModel):
    first_name: Optional[str]  = None
    last_name:  Optional[str]  = None
    role:       Optional[str]  = None
    is_active:  Optional[bool] = None
    phone:      Optional[str]  = None
    model_config = {"extra": "ignore"}


class ResetPasswordIn(BaseModel):
    new_password: str

    @field_validator("new_password")
    @classmethod
    def min_len(cls, v):
        if len(v) < 6:
            raise ValueError("Min 6 characters")
        return v


class ChangePasswordIn(BaseModel):
    current_password: str
    new_password:     str


# ── Self-service ──────────────────────────────────────────────
@router.get("/me")
def get_me(db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    return serialize(with_role(db, cu.id) or cu)


@router.put("/me/password")
def change_own_password(
    data: ChangePasswordIn,
    db: Session = Depends(get_db),
    cu: User    = Depends(get_current_user),
):
    #if not bcrypt.verify(data.current_password, cu.password_hash):
    if data.current_password!=cu.password_hash:
        raise HTTPException(400, "Current password is incorrect")
    #cu.password_hash = bcrypt.hash(data.new_password)
    cu.password_hash = data.new_password
    db.commit()
    return {"message": "Password updated"}


# ── Roles list ────────────────────────────────────────────────
@router.get("/roles")
def list_roles(db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    require_admin(cu, db)
    caller_role = get_role_name(cu, db)
    roles = db.query(Role).filter(Role.tenant_id == cu.tenant_id).order_by(Role.name).all()
    # Non-superadmins must never see the superadmin role in dropdowns
    if caller_role != "superadmin":
        roles = [r for r in roles if r.name.lower() != "superadmin"]
    return [{"id": str(r.id), "name": r.name, "is_system": r.is_system} for r in roles]


# ── List users ────────────────────────────────────────────────
@router.get("/")
def list_users(
    role:      Optional[str]  = None,
    is_active: Optional[bool] = None,
    search:    Optional[str]  = None,
    db: Session = Depends(get_db),
    cu: User    = Depends(get_current_user),
):
    require_admin(cu, db)
    caller_role = get_role_name(cu, db)

    q = (
        db.query(User)
        .options(joinedload(User.role_obj))
        .filter(User.tenant_id == cu.tenant_id)
    )

    # Non-superadmins must never see superadmin accounts
    if caller_role != "superadmin":
        superadmin_role = db.query(Role).filter(
            Role.tenant_id == cu.tenant_id,
            sqlfunc.lower(Role.name) == "superadmin",
        ).first()
        if superadmin_role:
            q = q.filter(User.role_id != superadmin_role.id)

    if is_active is not None:
        q = q.filter(User.is_active == is_active)
    if role:
        q = q.join(Role, User.role_id == Role.id).filter(
            sqlfunc.lower(Role.name) == role.lower()
        )
    if search:
        from sqlalchemy import or_
        q = q.filter(or_(
            User.email.ilike(f"%{search}%"),
            User.first_name.ilike(f"%{search}%"),
            User.last_name.ilike(f"%{search}%"),
        ))
    serialized = [serialize(u) for u in q.order_by(User.created_at.desc()).all()]
    return attach_link_status(db, cu.tenant_id, serialized)


# ── Role Permissions ─────────────────────────────────────────
# ALL of these must live before /{user_id} because FastAPI matches
# top-to-bottom and "roles-with-permissions" would otherwise be
# captured as user_id, failing UUID validation with a 422.

class PermissionIn(BaseModel):
    permissions: list


@router.get("/permission-schema")
def get_permission_schema(
    db: Session = Depends(get_db),
    cu: User = Depends(get_current_user),
):
    """
    Returns the full list of modules + actions from the permission_modules table.
    This is the single source of truth for what permissions exist.
    Superadmin only.
    """
    if get_role_name(cu, db) != "superadmin":
        raise HTTPException(403, "Superadmin access required")

    from sqlalchemy import text as _t
    rows = db.execute(_t("""
        SELECT module_key, module_label, module_icon, module_order,
               action_key, action_label
        FROM permission_modules
        WHERE (tenant_id = :tid OR tenant_id IS NULL)
          AND is_active = true
        ORDER BY module_order, module_key, action_key
    """), {"tid": str(cu.tenant_id)}).fetchall()

    # Group into {module_key: {label, icon, order, actions: [...]}}
    modules = {}
    for r in rows:
        if r.module_key not in modules:
            modules[r.module_key] = {
                "key":     r.module_key,
                "label":   r.module_label,
                "icon":    r.module_icon,
                "order":   r.module_order,
                "actions": [],
            }
        modules[r.module_key]["actions"].append({
            "key":   r.action_key,
            "label": r.action_label,
        })

    return sorted(modules.values(), key=lambda m: m["order"])


@router.get("/role-defaults/{role_name}")
def get_role_defaults(
    role_name: str,
    db: Session = Depends(get_db),
    cu: User = Depends(get_current_user),
):
    """
    Returns the default permissions for a named role from role_default_permissions table.
    Used by the UI's 'Apply Defaults' button — purely a convenience, not enforced.
    """
    if get_role_name(cu, db) != "superadmin":
        raise HTTPException(403, "Superadmin access required")

    from sqlalchemy import text as _t
    rows = db.execute(_t("""
        SELECT permission FROM role_default_permissions
        WHERE (tenant_id = :tid OR tenant_id IS NULL)
          AND role_name = :rname
        ORDER BY permission
    """), {"tid": str(cu.tenant_id), "rname": role_name.lower()}).fetchall()

    return {"role_name": role_name, "permissions": [r.permission for r in rows]}


@router.get("/roles-with-permissions")
def list_roles_with_permissions(
    db: Session = Depends(get_db),
    cu: User = Depends(get_current_user),
):
    role_name = get_role_name(cu, db)
    if role_name != "superadmin":
        raise HTTPException(403, "Superadmin access required")
    roles = (
        db.query(Role)
        .filter(Role.tenant_id == cu.tenant_id)
        .order_by(Role.name)
        .all()
    )
    return [
        {"id": str(r.id), "name": r.name, "is_system": r.is_system, "permissions": r.permissions or []}
        for r in roles
    ]


@router.get("/roles/{role_id}/permissions")
def get_role_permissions(
    role_id: UUID,
    db: Session = Depends(get_db),
    cu: User = Depends(get_current_user),
):
    if get_role_name(cu, db) != "superadmin":
        raise HTTPException(403, "Superadmin access required")
    role = db.query(Role).filter(Role.id == role_id, Role.tenant_id == cu.tenant_id).first()
    if not role:
        raise HTTPException(404, "Role not found")
    return {"id": str(role.id), "name": role.name, "is_system": role.is_system, "permissions": role.permissions or []}


@router.put("/roles/{role_id}/permissions")
def update_role_permissions(
    role_id: UUID,
    data: PermissionIn,
    db: Session = Depends(get_db),
    cu: User = Depends(get_current_user),
):
    if get_role_name(cu, db) != "superadmin":
        raise HTTPException(403, "Superadmin access required")
    role = db.query(Role).filter(Role.id == role_id, Role.tenant_id == cu.tenant_id).first()
    if not role:
        raise HTTPException(404, "Role not found")
    if role.name.lower() == "superadmin":
        raise HTTPException(400, "Superadmin permissions cannot be restricted")
    # Only allow permissions that actually exist in permission_modules
    from sqlalchemy import text as _t
    valid_keys = {
        r.permission for r in db.execute(_t("""
            SELECT module_key || '.' || action_key AS permission
            FROM permission_modules
            WHERE (tenant_id = :tid OR tenant_id IS NULL) AND is_active = true
        """), {"tid": str(cu.tenant_id)}).fetchall()
    }
    valid = [p.lower().strip() for p in data.permissions
             if isinstance(p, str) and p.lower().strip() in valid_keys]
    role.permissions = valid
    db.commit()
    db.refresh(role)
    return {"id": str(role.id), "name": role.name, "permissions": role.permissions}



# ── Get one user ──────────────────────────────────────────────
@router.get("/{user_id}")
def get_user(user_id: UUID, db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    require_admin(cu, db)
    return serialize(get404(db, user_id, cu.tenant_id))


# ── Create ────────────────────────────────────────────────────
@router.post("/", status_code=201)
def create_user(
    data: CreateUserIn,
    db:   Session = Depends(get_db),
    cu:   User    = Depends(get_current_user),
):
    require_admin(cu, db)

    # Block non-superadmins from creating superadmin accounts
    if (data.role or "").lower() == "superadmin" and get_role_name(cu, db) != "superadmin":
        raise HTTPException(403, "Only a superadmin can create a superadmin account.")

    if db.query(User).filter(User.email == data.email, User.tenant_id == cu.tenant_id).first():
        raise HTTPException(409, f"Email '{data.email}' already exists")

    # Find role in DB
    role_name = data.role or "teacher"
    role_obj  = find_role(db, cu.tenant_id, role_name)
    if not role_obj:
        available = [r.name for r in db.query(Role).filter(Role.tenant_id == cu.tenant_id).all()]
        raise HTTPException(400, f"Role '{role_name}' not found. Available: {available}")

    user = User(
        tenant_id     = cu.tenant_id,
        email         = data.email,
        #password_hash = bcrypt.hash(data.password),
        password_hash = data.password,
        role_id       = role_obj.id,
        first_name    = data.first_name,
        last_name     = data.last_name or "",
        phone         = data.phone or "",
        is_active     = True,
    )
    db.add(user)
    try:
        db.commit()
        db.refresh(user)
    except Exception as e:
        db.rollback()
        err = str(e).lower()
        if "unique" in err or "duplicate" in err:
            raise HTTPException(409, f"Email already exists")
        raise HTTPException(500, f"Create failed: {str(e)}")

    return serialize(with_role(db, user.id))


# ── Update ────────────────────────────────────────────────────
def _block_superadmin_target(db: Session, user: User, cu: User):
    """
    Raise 403 if the target user is a superadmin and the caller is not.
    An admin must never be able to modify, reset, or deactivate a superadmin.
    """
    target_role = get_role_name(user, db)
    if target_role == "superadmin" and get_role_name(cu, db) != "superadmin":
        raise HTTPException(
            403,
            "You do not have permission to modify a superadmin account."
        )


@router.put("/{user_id}")
def update_user(
    user_id: UUID,
    data:    UpdateUserIn,
    db:      Session = Depends(get_db),
    cu:      User    = Depends(get_current_user),
):
    require_admin(cu, db)
    user  = get404(db, user_id, cu.tenant_id)
    _block_superadmin_target(db, user, cu)   # ← new guard
    patch = data.model_dump(exclude_unset=True)

    if "role" in patch:
        role_name = patch.pop("role")
        # Prevent promoting anyone to superadmin unless caller is superadmin
        if role_name.lower() == "superadmin" and get_role_name(cu, db) != "superadmin":
            raise HTTPException(403, "Only a superadmin can assign the superadmin role.")
        role_obj  = find_role(db, cu.tenant_id, role_name)
        if not role_obj:
            raise HTTPException(400, f"Role '{role_name}' not found")
        user.role_id = role_obj.id

    for k, v in patch.items():
        if hasattr(user, k):
            setattr(user, k, v)

    db.commit()
    return serialize(with_role(db, user.id))


# ── Reset password ────────────────────────────────────────────
@router.put("/{user_id}/reset-password")
def reset_password(
    user_id: UUID,
    data:    ResetPasswordIn,
    db:      Session = Depends(get_db),
    cu:      User    = Depends(get_current_user),
):
    require_admin(cu, db)
    user = get404(db, user_id, cu.tenant_id)
    _block_superadmin_target(db, user, cu)   # ← new guard
    #user.password_hash = bcrypt.hash(data.new_password)
    user.password_hash = data.new_password
    db.commit()
    return {"message": f"Password reset for {user.email}"}


# ── Deactivate ────────────────────────────────────────────────
@router.delete("/{user_id}", status_code=204)
def deactivate_user(
    user_id: UUID,
    db:      Session = Depends(get_db),
    cu:      User    = Depends(get_current_user),
):
    require_admin(cu, db)
    if str(user_id) == str(cu.id):
        raise HTTPException(400, "Cannot deactivate your own account")
    user = get404(db, user_id, cu.tenant_id)
    _block_superadmin_target(db, user, cu)   # ← new guard
    user.is_active = False
    db.commit()


# ── Link student / guardian ───────────────────────────────────
@router.post("/{user_id}/link-student/{student_id}")
def link_student(user_id: UUID, student_id: UUID,
    db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    require_admin(cu, db)
    from models.student import Student
    s = db.query(Student).filter(Student.id == student_id, Student.tenant_id == cu.tenant_id).first()
    if not s: raise HTTPException(404, "Student not found")
    s.user_id = user_id; db.commit()
    return {"message": "Linked"}


@router.post("/{user_id}/link-guardian/{guardian_id}")
def link_guardian(user_id: UUID, guardian_id: UUID,
    db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    require_admin(cu, db)
    from models.student import Guardian
    g = db.query(Guardian).filter(Guardian.id == guardian_id, Guardian.tenant_id == cu.tenant_id).first()
    if not g: raise HTTPException(404, "Guardian not found")
    g.user_id = user_id; db.commit()
    return {"message": "Linked"}


# ── Unlink student / guardian ─────────────────────────────────
@router.post("/{user_id}/unlink-student")
def unlink_student(user_id: UUID,
    db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    require_admin(cu, db)
    from models.student import Student
    s = db.query(Student).filter(Student.user_id == user_id, Student.tenant_id == cu.tenant_id).first()
    if not s:
        raise HTTPException(404, "No linked student record found for this user")
    s.user_id = None
    db.commit()
    return {"message": "Unlinked"}



@router.post("/{user_id}/unlink-guardian")
def unlink_guardian(user_id: UUID,
    db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    require_admin(cu, db)
    from models.student import Guardian
    g = db.query(Guardian).filter(Guardian.user_id == user_id, Guardian.tenant_id == cu.tenant_id).first()
    if not g:
        raise HTTPException(404, "No linked guardian record found for this user")
    g.user_id = None
    db.commit()
    return {"message": "Unlinked"}

