"""Signal CRM — Auth with direct bcrypt (no passlib)"""
from datetime import datetime, timedelta
import bcrypt
from jose import jwt, JWTError
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, EmailStr
from app.config import get_settings
from app.database import get_db
from app.models import User

settings = get_settings()
bearer = HTTPBearer(auto_error=False)
auth = APIRouter(prefix="/auth", tags=["Auth"])

TRIAL_DAYS = 14
TRIAL_CREDITS = 20


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt(12)).decode()


def verify_password(pw: str, hashed: str) -> bool:
    return bcrypt.checkpw(pw.encode(), hashed.encode())


def create_token(user_id: str) -> str:
    return jwt.encode(
        {"sub": user_id, "exp": datetime.utcnow() + timedelta(hours=24)},
        settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM,
    )


def _trial_info(user: User) -> dict:
    now = datetime.utcnow()
    if user.is_paid:
        return {"status": "active", "plan": user.plan, "paid": True}
    if not user.trial_end:
        return {"status": "blocked", "paid": False}
    days_left = (user.trial_end - now).days
    if now < user.trial_end:
        return {"status": "trial", "paid": False, "days_left": max(0, days_left), "trial_end": user.trial_end.strftime("%Y-%m-%d")}
    return {"status": "expired", "paid": False, "days_left": 0}


async def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(bearer),
    db: AsyncSession = Depends(get_db),
) -> User:
    if not creds:
        raise HTTPException(401, "Login required")
    try:
        payload = jwt.decode(creds.credentials, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        r = await db.execute(select(User).where(User.id == payload["sub"]))
        user = r.scalar_one_or_none()
        if not user or not user.is_active:
            raise HTTPException(401, "Account not found")
        t = _trial_info(user)
        if t["status"] == "expired":
            raise HTTPException(403, {"error": "trial_expired", "message": "Trial expired. Upgrade to continue.", "payment_required": True})
        if t["status"] == "blocked":
            raise HTTPException(403, "Account blocked")
        return user
    except JWTError:
        raise HTTPException(401, "Invalid token")


async def get_user_no_trial_check(
    creds: HTTPAuthorizationCredentials = Depends(bearer),
    db: AsyncSession = Depends(get_db),
) -> User:
    if not creds:
        raise HTTPException(401, "Login required")
    try:
        payload = jwt.decode(creds.credentials, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        r = await db.execute(select(User).where(User.id == payload["sub"]))
        user = r.scalar_one_or_none()
        if not user:
            raise HTTPException(401, "User not found")
        return user
    except JWTError:
        raise HTTPException(401, "Invalid token")


class RegisterReq(BaseModel):
    name: str
    email: EmailStr
    password: str
    company_name: str = ""


class LoginReq(BaseModel):
    email: EmailStr
    password: str


@auth.post("/register")
async def register(req: RegisterReq, db: AsyncSession = Depends(get_db)):
    if len(req.password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")
    existing = await db.execute(select(User).where(User.email == req.email))
    if existing.scalar_one_or_none():
        raise HTTPException(400, "Email already registered. Please login.")
    now = datetime.utcnow()
    user = User(
        email=req.email,
        password_hash=hash_password(req.password),
        name=req.name.strip(),
        company_name=req.company_name.strip(),
        credits=TRIAL_CREDITS,
        plan="trial",
        trial_start=now,
        trial_end=now + timedelta(days=TRIAL_DAYS),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return {
        "success": True,
        "token": create_token(user.id),
        "user": {"id": user.id, "name": user.name, "email": user.email, "credits": user.credits, "plan": user.plan},
        "trial": {"days": TRIAL_DAYS, "credits": TRIAL_CREDITS, "ends": user.trial_end.strftime("%Y-%m-%d")},
        "message": f"Welcome to Signal CRM! {TRIAL_DAYS}-day free trial starts now.",
    }


@auth.post("/login")
async def login(req: LoginReq, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(User).where(User.email == req.email))
    user = r.scalar_one_or_none()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(401, "Invalid email or password")
    return {
        "success": True,
        "token": create_token(user.id),
        "user": {"id": user.id, "name": user.name, "email": user.email, "credits": user.credits, "plan": user.plan, "is_paid": user.is_paid},
        "trial": _trial_info(user),
    }


@auth.get("/me")
async def me(user: User = Depends(get_user_no_trial_check)):
    return {
        "success": True,
        "user": {"id": user.id, "name": user.name, "email": user.email, "credits": user.credits, "plan": user.plan, "is_paid": user.is_paid, "company": user.company_name},
        "trial": _trial_info(user),
    }
