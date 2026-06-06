# backend/repositories/base.py
from typing import Generic, TypeVar, Type, Optional, List
from uuid import UUID
from sqlalchemy.orm import Session
from database import Base

ModelType = TypeVar("ModelType", bound=Base)

class BaseRepository(Generic[ModelType]):
    def __init__(self, model: Type[ModelType], db: Session):
        self.model = model
        self.db    = db

    def get_by_id(self, id: UUID, tenant_id: UUID) -> Optional[ModelType]:
        return (
            self.db.query(self.model)
            .filter(self.model.id == id,
                    self.model.tenant_id == tenant_id)
            .first()
        )

    def get_all(self, tenant_id: UUID, skip: int = 0, limit: int = 50):
        return (
            self.db.query(self.model)
            .filter(self.model.tenant_id == tenant_id)
            .offset(skip).limit(limit).all()
        )

    def create(self, obj: ModelType) -> ModelType:
        self.db.add(obj)
        self.db.commit()
        self.db.refresh(obj)
        return obj

    def update(self, obj: ModelType, data: dict) -> ModelType:
        for key, value in data.items():
            if hasattr(obj, key):
                setattr(obj, key, value)
        self.db.commit()
        self.db.refresh(obj)
        return obj

    def delete(self, obj: ModelType) -> None:
        self.db.delete(obj)
        self.db.commit()
