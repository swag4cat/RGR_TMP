from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from ..database import get_db
from .. import models, schemas
from ..utils.logger import log_action
from .auth import get_current_user

router = APIRouter(prefix="/users", tags=["users"])

async def check_admin(current_user: dict):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin role required")

@router.get("/pending")
async def get_pending_users(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    await check_admin(current_user)

    result = await db.execute(
        select(models.User).where(models.User.status == "pending")
    )
    users = result.scalars().all()
    return users

@router.put("/{user_id}/approve")
async def approve_user(
    user_id: int,
    role: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    await check_admin(current_user)

    if role not in ["operator", "engineer", "admin"]:
        raise HTTPException(status_code=400, detail="Invalid role")

    result = await db.execute(select(models.User).where(models.User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.status = "active"
    user.role = role

    await db.commit()

    await log_action(
        db,
        user_id=current_user["id"],
        action="USER_APPROVED",
        details={"user_id": user_id, "role": role},
        request=request
    )

    return {"message": f"User {user.username} approved as {role}"}

@router.delete("/{user_id}")
async def delete_user(
    user_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    await check_admin(current_user)

    result = await db.execute(select(models.User).where(models.User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    await db.delete(user)
    await db.commit()

    await log_action(
        db,
        user_id=current_user["id"],
        action="USER_DELETED",
        details={"user_id": user_id, "username": user.username},
        request=request
    )

    return {"message": "User deleted"}

@router.get("/")
async def get_all_users(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    await check_admin(current_user)

    result = await db.execute(select(models.User))
    users = result.scalars().all()
    return users
