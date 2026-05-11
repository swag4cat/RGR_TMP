from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from ..database import get_db
from .. import models
from ..utils.logger import log_action
from .auth import get_current_user

router = APIRouter(prefix="/admin", tags=["admin"])

async def check_admin(current_user: dict):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin role required")

@router.post("/assign-operator/{user_id}/{object_id}")
async def assign_operator(
    user_id: int,
    object_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    await check_admin(current_user)

    # Проверяем пользователя
    user_result = await db.execute(
        select(models.User).where(models.User.id == user_id)
    )
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.role != "operator":
        raise HTTPException(status_code=400, detail="User is not an operator")

    # Проверяем объект
    obj_result = await db.execute(
        select(models.InfrastructureObject).where(models.InfrastructureObject.id == object_id)
    )
    obj = obj_result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Object not found")

    # Запоминаем старый объект (если был)
    old_object_id = user.assigned_object_id

    # Назначаем новый объект
    user.assigned_object_id = object_id
    await db.commit()

    # Логируем
    await log_action(
        db,
        user_id=current_user["id"],
        action="OPERATOR_ASSIGNED",
        details={"operator_id": user_id, "object_id": object_id, "old_object_id": old_object_id},
        request=request
    )

    # Возвращаем сообщение в зависимости от того, был ли перепривязан
    if old_object_id:
        return {"message": f"Operator {user.username} reassigned from object {old_object_id} to {object_id}"}
    else:
        return {"message": f"Operator {user.username} assigned to object {object_id}"}

@router.post("/unassign-operator/{user_id}")
async def unassign_operator(
    user_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    await check_admin(current_user)

    # Находим оператора
    result = await db.execute(select(models.User).where(models.User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.role != "operator":
        raise HTTPException(status_code=400, detail="User is not an operator")

    # Отвязываем
    old_object_id = user.assigned_object_id
    user.assigned_object_id = None
    await db.commit()

    # Логируем
    await log_action(
        db,
        user_id=current_user["id"],
        action="OPERATOR_UNASSIGNED",
        details={"user_id": user_id, "old_object_id": old_object_id},
        request=request
    )

    return {"message": f"Operator {user.username} unassigned from object {old_object_id}"}
