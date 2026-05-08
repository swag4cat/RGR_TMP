from sqlalchemy.ext.asyncio import AsyncSession
from .. import models
from fastapi import Request

async def log_action(
    db: AsyncSession,
    user_id: int = None,
    action: str = None,
    details: dict = None,
    request: Request = None
):
    """Универсальная функция для записи логов"""
    ip_address = None
    if request:
        ip_address = request.client.host if request.client else None
    
    log_entry = models.Log(
        user_id=user_id,
        action=action,
        details=details,
        ip_address=ip_address
    )
    db.add(log_entry)
    await db.commit()
