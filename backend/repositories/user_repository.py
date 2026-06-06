# backend/repositories/user_repository.py
from uuid import UUID
from typing import Optional
from datetime import datetime, timezone
from sqlalchemy.orm import Session, joinedload
from models.user import User
from repositories.base import BaseRepository

class UserRepository(BaseRepository[User]):
    def __init__(self, db: Session):
        super().__init__(User, db)

    def get_by_email(self, email: str) -> Optional[User]:
        """Find user by email — loads role + tenant in same query."""
        return (
            self.db.query(User)
            .options(
                joinedload(User.role),
                joinedload(User.tenant)
            )
            .filter(
                User.email == email,
                User.is_active == True
            )
            .first()
        )

    def get_by_id_with_relations(self, user_id: UUID) -> Optional[User]:
        """Used by get_current_user dependency on every request."""
        return (
            self.db.query(User)
            .options(
                joinedload(User.role),
                joinedload(User.tenant)
            )
            .filter(
                User.id == user_id,
                User.is_active == True
            )
            .first()
        )

    def update_last_login(self, user: User) -> None:
        user.last_login_at = datetime.now(timezone.utc)
        self.db.commit()
