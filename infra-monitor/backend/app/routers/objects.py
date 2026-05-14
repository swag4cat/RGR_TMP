from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, func
from typing import List
from ..database import get_db
from .. import models, schemas
from ..utils.logger import log_action
from .auth import get_current_user

router = APIRouter(prefix="/objects", tags=["objects"])

async def check_admin(current_user: dict):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin role required")

@router.post("/", response_model=schemas.ObjectResponse)
async def create_object(
    obj_data: schemas.ObjectCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    await check_admin(current_user)
    
    new_object = models.InfrastructureObject(
        name=obj_data.name,
        description=obj_data.description,
        type=obj_data.type,
        latitude=obj_data.latitude,
        longitude=obj_data.longitude,
        created_by=current_user["id"]
    )
    db.add(new_object)
    await db.commit()
    await db.refresh(new_object)
    
    await log_action(
        db, 
        user_id=current_user["id"],
        action="OBJECT_CREATED",
        details={"object_id": new_object.id, "name": new_object.name},
        request=request
    )
    
    return new_object

@router.get("/", response_model=List[schemas.ObjectResponse])
async def get_objects(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    result = await db.execute(select(models.InfrastructureObject))
    objects = result.scalars().all()
    
    if current_user["role"] == "operator":
        user_result = await db.execute(
            select(models.User).where(models.User.id == current_user["id"])
        )
        user = user_result.scalar_one_or_none()
        if user and user.assigned_object_id:
            objects = [obj for obj in objects if obj.id == user.assigned_object_id]
        else:
            objects = []
    
    return objects

@router.put("/{object_id}/status")
async def update_status(
    object_id: int,
    status_update: schemas.ObjectUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):

    if current_user["role"] not in ["admin", "engineer"]:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    result = await db.execute(
        select(models.InfrastructureObject).where(models.InfrastructureObject.id == object_id)
    )
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Object not found")
    
    old_status = obj.status
    obj.status = status_update.status
    await db.commit()
    
    await log_action(
        db,
        user_id=current_user["id"],
        action="STATUS_CHANGED",
        details={"object_id": object_id, "old_status": old_status, "new_status": status_update.status},
        request=request
    )
    
    return {"message": "Status updated", "new_status": status_update.status}

@router.post("/{object_id}/alert")
async def trigger_alert(
    object_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):

    if current_user["role"] != "operator":
        raise HTTPException(status_code=403, detail="Only operator can trigger alert")
    
    user_result = await db.execute(
        select(models.User).where(models.User.id == current_user["id"])
    )
    user = user_result.scalar_one_or_none()
    
    if not user or user.assigned_object_id != object_id:
        raise HTTPException(status_code=403, detail="You are not assigned to this object")
    
    result = await db.execute(
        select(models.InfrastructureObject).where(models.InfrastructureObject.id == object_id)
    )
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Object not found")
    
    obj.status = "alert"
    
    incident = models.Incident(
        object_id=object_id,
        triggered_by=current_user["id"],
        status="alert"
    )
    db.add(incident)
    await db.commit()
    
    await log_action(
        db,
        user_id=current_user["id"],
        action="ALERT_TRIGGERED",
        details={"object_id": object_id},
        request=request
    )
    
    return {"message": "Alert triggered!"}

@router.post("/{object_id}/resolve")
async def resolve_alert(
    object_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):

    if current_user["role"] not in ["engineer", "admin"]:
        raise HTTPException(status_code=403, detail="Engineer or admin role required")

    result = await db.execute(
        select(models.InfrastructureObject).where(models.InfrastructureObject.id == object_id)
    )
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Object not found")

    if obj.status != "alert":
        raise HTTPException(status_code=400, detail="Object is not in alert state")

    obj.status = "resolved"

    incident_result = await db.execute(
        select(models.Incident)
        .where(models.Incident.object_id == object_id)
        .where(models.Incident.status == "alert")
        .order_by(models.Incident.triggered_at.desc())
        .limit(1)
    )
    incident = incident_result.scalar_one_or_none()
    if incident:
        incident.status = "resolved"
        incident.resolved_by = current_user["id"]
        incident.resolved_at = func.now()

    await db.commit()

    await log_action(
        db,
        user_id=current_user["id"],
        action="ALERT_RESOLVED",
        details={"object_id": object_id},
        request=request
    )

    return {"message": "Alert resolved"}

@router.delete("/{object_id}")
async def delete_object(
    object_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    await check_admin(current_user)

    result = await db.execute(
        select(models.InfrastructureObject).where(models.InfrastructureObject.id == object_id)
    )
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Object not found")

    await db.delete(obj)
    await db.commit()

    await log_action(
        db,
        user_id=current_user["id"],
        action="OBJECT_DELETED",
        details={"object_id": object_id, "name": obj.name},
        request=request
    )

    return {"message": "Object deleted"}

@router.put("/{object_id}")
async def update_object(
    object_id: int,
    obj_update: schemas.ObjectUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    await check_admin(current_user)

    result = await db.execute(
        select(models.InfrastructureObject).where(models.InfrastructureObject.id == object_id)
    )
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Object not found")

    if obj_update.name:
        obj.name = obj_update.name
    if obj_update.description is not None:
        obj.description = obj_update.description
    if obj_update.status:
        obj.status = obj_update.status

    await db.commit()

    await log_action(
        db,
        user_id=current_user["id"],
        action="OBJECT_UPDATED",
        details={"object_id": object_id, "updates": obj_update.dict()},
        request=request
    )

    return {"message": "Object updated"}
