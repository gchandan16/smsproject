# backend/models/__init__.py
# Import all models here so Alembic can detect them for migrations
from models.tenant import Tenant
from models.role   import Role
from models.user   import User
