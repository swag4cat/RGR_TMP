from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

# Существующие классы
class UserCreate(BaseModel):
    username: str
    email: str
    password: str
    role: str = "operator"

class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    role: str
    created_at: datetime

    class Config:
        from_attributes = True

# Новые классы для объектов
class ObjectCreate(BaseModel):
    name: str
    description: Optional[str] = None
    type: str
    latitude: float
    longitude: float

class ObjectResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    type: str
    latitude: float
    longitude: float
    status: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class ObjectUpdate(BaseModel):
    status: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None

class IncidentResponse(BaseModel):
    id: int
    object_id: int
    triggered_by: int
    resolved_by: Optional[int] = None
    status: str
    triggered_at: datetime
    resolved_at: Optional[datetime] = None

class LogResponse(BaseModel):
    id: int
    user_id: Optional[int] = None
    action: str
    details: Optional[dict] = None
    ip_address: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
