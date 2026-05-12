from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from ..database import get_db
from .. import models

router = APIRouter(prefix="/stats", tags=["stats"])

@router.get("/public")
async def get_public_stats(db: AsyncSession = Depends(get_db)):
    # Общее количество объектов
    total_objects_result = await db.execute(select(func.count()).select_from(models.InfrastructureObject))
    total_objects = total_objects_result.scalar()
    
    # Решённые инциденты (статус resolved)
    resolved_incidents_result = await db.execute(
        select(func.count()).select_from(models.Incident).where(models.Incident.status == "resolved")
    )
    resolved_incidents = resolved_incidents_result.scalar()
    
    # Активные тревоги (объекты со статусом alert)
    active_alerts_result = await db.execute(
        select(func.count()).select_from(models.InfrastructureObject).where(models.InfrastructureObject.status == "alert")
    )
    active_alerts = active_alerts_result.scalar()
    
    # Количество пользователей по ролям
    admins_result = await db.execute(
        select(func.count()).select_from(models.User).where(models.User.role == "admin", models.User.status == "ACTIVE")
    )
    admins = admins_result.scalar()
    
    operators_result = await db.execute(
        select(func.count()).select_from(models.User).where(models.User.role == "operator", models.User.status == "ACTIVE")
    )
    operators = operators_result.scalar()
    
    engineers_result = await db.execute(
        select(func.count()).select_from(models.User).where(models.User.role == "engineer", models.User.status == "ACTIVE")
    )
    engineers = engineers_result.scalar()
    
    return {
        "total_objects": total_objects or 0,
        "resolved_incidents": resolved_incidents or 0,
        "active_alerts": active_alerts or 0,
        "admins": admins or 0,
        "operators": operators or 0,
        "engineers": engineers or 0
    }
