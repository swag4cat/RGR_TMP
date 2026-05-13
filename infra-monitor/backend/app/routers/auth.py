from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import timedelta
from jose import JWTError, jwt
import os

from ..utils.captcha import verify_recaptcha
from ..database import get_db
from .. import models, schemas
from ..auth import verify_password, create_access_token, get_password_hash
from .verification import send_verification

from pydantic import BaseModel

class RegisterRequest(BaseModel):
    username: str
    email: str
    password: str
    captcha_token: str

router = APIRouter(prefix="/auth", tags=["auth"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

SECRET_KEY = os.getenv("SECRET_KEY", "supersecretkeyforjwt12345")
ALGORITHM = "HS256"

@router.post("/register")
async def register(user_data: RegisterRequest, db: AsyncSession = Depends(get_db)):
    # 1. Проверяем капчу
    is_valid_captcha = await verify_recaptcha(user_data.captcha_token)
    if not is_valid_captcha:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid captcha"
        )

    # 2. Проверка существования пользователя
    result = await db.execute(
        select(models.User).where(models.User.username == user_data.username)
    )
    existing_user = result.scalar_one_or_none()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already exists"
        )

    # 3. Создаём пользователя (статус pending)
    hashed = get_password_hash(user_data.password)
    new_user = models.User(
        username=user_data.username,
        email=user_data.email,
        hashed_password=hashed,
        role="operator",  # временно
        status="pending"
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    await send_verification(new_user.id, db)  # нужно импортировать

    return {"message": "Registration successful. Check your email for verification code.", "user_id": new_user.id}

@router.post("/login")
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db)
):
    # Ищем пользователя
    result = await db.execute(
        select(models.User).where(models.User.username == form_data.username)
    )
    user = result.scalar_one_or_none()

    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Создаем токен
    access_token = create_access_token(
        data={"sub": user.username, "user_id": user.id, "role": user.role}
    )

    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect credentials")

    # Проверка статуса
    if user.status != "active":
        raise HTTPException(status_code=401, detail="Account not approved by admin")

    return {"access_token": access_token, "token_type": "bearer", "user_id": user.id, "role": user.role}

@router.get("/me")
async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("user_id")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    result = await db.execute(select(models.User).where(models.User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")

    return {
    "id": user.id,
    "username": user.username,
    "role": user.role,
    "assigned_object_id": user.assigned_object_id
}
