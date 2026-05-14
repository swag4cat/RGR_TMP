from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from datetime import datetime, timedelta
from ..database import get_db
from .. import models

router = APIRouter(prefix="/stats", tags=["stats"])

@router.get("/public")
async def get_public_stats(db: AsyncSession = Depends(get_db)):

    total_objects_result = await db.execute(select(func.count()).select_from(models.InfrastructureObject))
    total_objects = total_objects_result.scalar()


    resolved_incidents_result = await db.execute(
        select(func.count()).select_from(models.Incident).where(models.Incident.status == "resolved")
    )
    resolved_incidents = resolved_incidents_result.scalar()

    active_alerts_result = await db.execute(
        select(func.count()).select_from(models.InfrastructureObject).where(models.InfrastructureObject.status == "alert")
    )
    active_alerts = active_alerts_result.scalar()

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

@router.get("/admin")
async def get_admin_stats(db: AsyncSession = Depends(get_db)):
    today = datetime.now().date()
    incidents_by_day = []

    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        next_day = day + timedelta(days=1)

        result = await db.execute(
            select(func.count()).select_from(models.Incident).where(
                and_(
                    models.Incident.triggered_at >= day,
                    models.Incident.triggered_at < next_day
                )
            )
        )
        count = result.scalar() or 0
        incidents_by_day.append({
            "date": day.strftime("%d.%m"),
            "count": count
        })

    status_result = await db.execute(
        select(models.InfrastructureObject.status, func.count())
        .group_by(models.InfrastructureObject.status)
    )
    objects_by_status = [{"status": s, "count": c} for s, c in status_result.all()]

    users_result = await db.execute(
        select(models.User.role, func.count())
        .where(models.User.status == "ACTIVE")
        .group_by(models.User.role)
    )
    users_by_role = [{"role": r, "count": c} for r, c in users_result.all()]

    return {
        "incidents_by_day": incidents_by_day,
        "objects_by_status": objects_by_status,
        "users_by_role": users_by_role
    }
