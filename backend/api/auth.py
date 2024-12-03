# backend/api/auth.py

from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
from supabase import create_client, Client
from backend.service.security import (
    SECRET_KEY,
    ALGORITHM,
    ACCESS_TOKEN_EXPIRE_MINUTES,
    pwd_context,
    create_access_token,
)
from backend.models import UserCreate, UserOut
from backend.service.startup import get_supabase_client
from fastapi.security import OAuth2PasswordBearer
import os
import logging

# 设置日志
logger = logging.getLogger(__name__)

router = APIRouter()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

# 获取 Supabase 客户端
supabase: Client = get_supabase_client()

# 工具函数
def get_user_by_email(email: str):
    response = supabase.table("users").select("*").eq("email", email).execute()
    if response.data:
        return response.data[0]
    return None

def get_user_by_id(user_id: str):
    response = supabase.table("users").select("*").eq("id", user_id).execute()
    if response.data:
        return response.data[0]
    return None

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

# 用户注册
@router.post("/register", response_model=UserOut)
def register(user: UserCreate):
    existing_user = get_user_by_email(user.email)
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_password = pwd_context.hash(user.password)
    new_user = {
        "email": user.email,
        "username": user.username,
        "hashed_password": hashed_password,
        "created_at": datetime.utcnow().isoformat(),
    }
    
    response = supabase.table("users").insert(new_user).execute()
    
    # 打印响应对象以调试
    logger.info(f"Supabase response: {response}")
    
    # 检查是否有数据返回
    if response.data and len(response.data) > 0:
        # 操作成功，返回新创建的用户信息
        created_user = response.data[0]
        return UserOut(
            id=created_user["id"],
            email=created_user["email"],
            username=created_user.get("username"),
            created_at=created_user["created_at"],
        )
    else:
        logger.error("Error creating user: No data returned from Supabase.")
        raise HTTPException(status_code=500, detail="Error creating user")

# 用户登录
@router.post("/login")
async def login(request: Request):
    data = await request.json()
    email = data.get("email")
    password = data.get("password")
    if not email or not password:
        raise HTTPException(status_code=400, detail="Email and password are required")
    user = get_user_by_email(email)
    if not user or not verify_password(password, user["hashed_password"]):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user["id"]}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

# 获取当前用户
async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=401,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
        user = get_user_by_id(user_id)
        if user is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    return user

# 获取用户信息
@router.get("/userinfo", response_model=UserOut)
def read_users_me(current_user: dict = Depends(get_current_user)):
    return UserOut(
        id=current_user["id"],
        email=current_user["email"],
        username=current_user.get("username"),
        created_at=current_user["created_at"],
    )
