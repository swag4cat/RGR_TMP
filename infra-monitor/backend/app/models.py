from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum, ForeignKey, Float, JSON
from sqlalchemy.sql import func
from .database import Base
import enum

class UserRole(str, enum.Enum):
    OPERATOR = "operator"
    ENGINEER = "engineer"
    ADMIN = "admin"

class ObjectStatus(str, enum.Enum):
    NORMAL = "normal"
    WARNING = "warning"
    ALERT = "alert"
    RESOLVED = "resolved"

class UserStatus(str, enum.Enum):
    PENDING = "pending"   # ожидает подтверждения
    ACTIVE = "active"     # активен
    BLOCKED = "blocked"   # заблокирован

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(100), unique=True, nullable=False)
    hashed_password = Column(String(200), nullable=False)
    role = Column(Enum(UserRole), default=UserRole.OPERATOR, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Для 2FA (пока не используем)
    is_2fa_enabled = Column(Boolean, default=False)

    # К какому объекту прикреплен (для оператора)
    assigned_object_id = Column(Integer, nullable=True)

    status = Column(Enum(UserStatus), default=UserStatus.PENDING, nullable=False)


class InfrastructureObject(Base):
    __tablename__ = "objects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(String(500), nullable=True)
    type = Column(String(50), nullable=False)  # ТЭЦ, подстанция, водозабор и т.д.
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    status = Column(Enum(ObjectStatus), default=ObjectStatus.NORMAL, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Кто создал
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)


class Incident(Base):
    __tablename__ = "incidents"

    id = Column(Integer, primary_key=True, index=True)
    object_id = Column(Integer, ForeignKey("objects.id", ondelete="CASCADE"), nullable=False)
    triggered_by = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    resolved_by = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    status = Column(Enum(ObjectStatus), default=ObjectStatus.ALERT)
    triggered_at = Column(DateTime(timezone=True), server_default=func.now())
    resolved_at = Column(DateTime(timezone=True), nullable=True)


class Log(Base):
    __tablename__ = "logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    action = Column(String(100), nullable=False)
    details = Column(JSON, nullable=True)
    ip_address = Column(String(45), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
