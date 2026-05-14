from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from datetime import datetime, timedelta
import random
from ..database import get_db
from .. import models
from ..utils.email import send_verification_email

router = APIRouter(prefix="/auth", tags=["auth"])

def generate_code() -> str:
    return f"{random.randint(100000, 999999)}"

@router.post("/send-verification/{user_id}")
async def send_verification(
    user_id: int,
    db: AsyncSession = Depends(get_db)
):

    result = await db.execute(
        select(models.User).where(models.User.id == user_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    await db.execute(
        delete(models.EmailVerification).where(models.EmailVerification.user_id == user_id)
    )
    
    code = generate_code()
    expires_at = datetime.now() + timedelta(minutes=10)
    
    verification = models.EmailVerification(
        user_id=user_id,
        code=code,
        expires_at=expires_at
    )
    db.add(verification)
    await db.commit()
    
    await send_verification_email(user.email, code)
    
    return {"message": "Verification code sent to email"}

class VerifyCodeRequest(BaseModel):
    user_id: int
    code: str

@router.post("/verify-code")
async def verify_code(request_data: VerifyCodeRequest, db: AsyncSession = Depends(get_db)):
    user_id = request_data.user_id
    code = request_data.code

    result = await db.execute(
        select(models.EmailVerification).where(
            models.EmailVerification.user_id == user_id,
            models.EmailVerification.code == code,
            models.EmailVerification.expires_at > datetime.now()
        )
    )
    verification = result.scalar_one_or_none()

    if not verification:
        raise HTTPException(status_code=400, detail="Invalid or expired code")

    user_result = await db.execute(
        select(models.User).where(models.User.id == user_id)
    )
    user = user_result.scalar_one_or_none()
    if user:
        user.status = "pending"
        user.is_2fa_enabled = True

    await db.delete(verification)
    await db.commit()

    return {"message": "Email verified successfully"}
