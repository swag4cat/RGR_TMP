from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from typing import List, Optional
from ..database import get_db
from .. import models, schemas
from .auth import get_current_user

router = APIRouter(prefix="/logs", tags=["logs"])

@router.get("/", response_model=List[schemas.LogResponse])
async def get_logs(
    limit: int = Query(100, le=1000),
    offset: int = Query(0, ge=0),
    action: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):

    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin role required")
    
    query = select(models.Log).order_by(desc(models.Log.created_at))
    
    if action:
        query = query.where(models.Log.action == action)
    
    query = query.offset(offset).limit(limit)
    
    result = await db.execute(query)
    logs = result.scalars().all()
    
    return logs
