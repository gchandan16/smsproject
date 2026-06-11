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

    def _with_role(self, q):
        """Eager-load role_obj on any query."""
        return q.options(
            joinedload(User.role_obj),  # updated from User.role
            joinedload(User.tenant),
        )

    def get_by_email(self, email: str) -> Optional[User]:
        return (
            self._with_role(self.db.query(User))
            .filter(User.email == email, User.is_active == True)
            .first()
        )

    def get_by_id_with_relations(self, user_id: UUID) -> Optional[User]:
        return (
            self._with_role(self.db.query(User))
            .filter(User.id == user_id, User.is_active == True)
            .first()
        )

    def update_last_login(self, user: User) -> None:
        user.last_login_at = datetime.now(timezone.utc)
        self.db.commit()
