"""Signal CRM — Supabase Auth"""
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from app.supabase_client import get_supabase

bearer = HTTPBearer(auto_error=False)
auth = APIRouter(prefix="/auth", tags=["Auth"])

TRIAL_DAYS = 14
TRIAL_CREDITS = 20


def _supabase_error(e: Exception) -> str:
    msg = str(e)
    if "already registered" in msg.lower() or "duplicate" in msg.lower():
        return "Email already registered. Please login instead."
    if "invalid" in msg.lower() and "password" in msg.lower():
        return "Invalid email or password."
    return msg


class RegisterReq(BaseModel):
    name: str
    email: EmailStr
    password: str
    company_name: str = ""


class LoginReq(BaseModel):
    email: EmailStr
    password: str


def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(bearer),
) -> dict:
    if not creds:
        raise HTTPException(401, "Login required")
    try:
        sb = get_supabase()
        resp = sb.auth.get_user(creds.credentials)
        if not resp or not resp.user:
            raise HTTPException(401, "Invalid or expired token")
        user = resp.user
        # Get profile
        profile_resp = sb.table("profiles").select("*").eq("id", str(user.id)).maybe_single().execute()
        profile = profile_resp.data or {}

        # Trial check
        trial_end_str = profile.get("trial_end")
        is_paid = profile.get("is_paid", False)
        if not is_paid and trial_end_str:
            trial_end = datetime.fromisoformat(trial_end_str.replace("Z", "+00:00")).replace(tzinfo=None)
            if datetime.utcnow() > trial_end:
                raise HTTPException(
                    403,
                    {
                        "error": "trial_expired",
                        "message": "Trial expired. Upgrade to continue.",
                        "payment_required": True,
                    },
                )
        return {
            "id": str(user.id),
            "email": user.email,
            "name": profile.get("name", ""),
            "company_name": profile.get("company_name", ""),
            "credits": profile.get("credits", TRIAL_CREDITS),
            "plan": profile.get("plan", "trial"),
            "is_paid": is_paid,
            "trial_end": trial_end_str,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(401, f"Authentication failed: {_supabase_error(e)}")


def get_user_no_trial_check(
    creds: HTTPAuthorizationCredentials = Depends(bearer),
) -> dict:
    if not creds:
        raise HTTPException(401, "Login required")
    try:
        sb = get_supabase()
        resp = sb.auth.get_user(creds.credentials)
        if not resp or not resp.user:
            raise HTTPException(401, "Invalid token")
        user = resp.user
        profile_resp = sb.table("profiles").select("*").eq("id", str(user.id)).maybe_single().execute()
        profile = profile_resp.data or {}
        return {
            "id": str(user.id),
            "email": user.email,
            "name": profile.get("name", ""),
            "company_name": profile.get("company_name", ""),
            "credits": profile.get("credits", TRIAL_CREDITS),
            "plan": profile.get("plan", "trial"),
            "is_paid": profile.get("is_paid", False),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(401, f"Authentication failed: {_supabase_error(e)}")


@auth.post("/register")
def register(req: RegisterReq):
    if len(req.password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")
    sb = get_supabase()
    try:
        result = sb.auth.admin.create_user({
            "email": req.email,
            "password": req.password,
            "email_confirm": True,
            "user_metadata": {"name": req.name, "company_name": req.company_name},
        })
        user_id = str(result.user.id)
    except Exception as e:
        raise HTTPException(400, _supabase_error(e))

    now = datetime.utcnow()
    trial_end = now + timedelta(days=TRIAL_DAYS)

    # Upsert profile (trigger may have already created it)
    sb.table("profiles").upsert({
        "id": user_id,
        "name": req.name.strip(),
        "company_name": req.company_name.strip(),
        "credits": TRIAL_CREDITS,
        "plan": "trial",
        "is_paid": False,
        "trial_start": now.isoformat(),
        "trial_end": trial_end.isoformat(),
    }).execute()

    # Sign in to get token
    try:
        session = sb.auth.sign_in_with_password({"email": req.email, "password": req.password})
        token = session.session.access_token
    except Exception as e:
        raise HTTPException(500, f"Account created but login failed: {_supabase_error(e)}")

    return {
        "success": True,
        "token": token,
        "user": {
            "id": user_id,
            "name": req.name,
            "email": req.email,
            "credits": TRIAL_CREDITS,
            "plan": "trial",
        },
        "trial": {
            "days": TRIAL_DAYS,
            "credits": TRIAL_CREDITS,
            "ends": trial_end.strftime("%Y-%m-%d"),
        },
        "message": f"Welcome to Signal CRM! {TRIAL_DAYS}-day free trial starts now.",
    }


@auth.post("/login")
def login(req: LoginReq):
    sb = get_supabase()
    try:
        session = sb.auth.sign_in_with_password({"email": req.email, "password": req.password})
        token = session.session.access_token
        user_id = str(session.user.id)
    except Exception as e:
        raise HTTPException(401, "Invalid email or password")

    profile_resp = sb.table("profiles").select("*").eq("id", user_id).maybe_single().execute()
    profile = profile_resp.data or {}

    trial_end_str = profile.get("trial_end")
    is_paid = profile.get("is_paid", False)
    now = datetime.utcnow()

    trial_info = {"status": "active", "paid": True} if is_paid else {}
    if not is_paid and trial_end_str:
        trial_end = datetime.fromisoformat(trial_end_str.replace("Z", "+00:00")).replace(tzinfo=None)
        days_left = (trial_end - now).days
        if now < trial_end:
            trial_info = {"status": "trial", "days_left": max(0, days_left), "trial_end": trial_end.strftime("%Y-%m-%d")}
        else:
            trial_info = {"status": "expired", "days_left": 0}

    return {
        "success": True,
        "token": token,
        "user": {
            "id": user_id,
            "name": profile.get("name", session.user.email.split("@")[0]),
            "email": session.user.email,
            "credits": profile.get("credits", TRIAL_CREDITS),
            "plan": profile.get("plan", "trial"),
            "is_paid": is_paid,
        },
        "trial": trial_info,
    }


@auth.get("/me")
def me(user: dict = Depends(get_user_no_trial_check)):
    sb = get_supabase()
    trial_end_str = user.get("trial_end") or ""
    is_paid = user.get("is_paid", False)
    now = datetime.utcnow()

    trial_info = {"status": "active", "paid": True} if is_paid else {}
    if not is_paid and trial_end_str:
        trial_end = datetime.fromisoformat(trial_end_str.replace("Z", "+00:00")).replace(tzinfo=None)
        days_left = (trial_end - now).days
        if now < trial_end:
            trial_info = {"status": "trial", "days_left": max(0, days_left)}
        else:
            trial_info = {"status": "expired", "days_left": 0}

    return {
        "success": True,
        "user": {
            "id": user["id"],
            "name": user.get("name", ""),
            "email": user.get("email", ""),
            "credits": user.get("credits", TRIAL_CREDITS),
            "plan": user.get("plan", "trial"),
            "is_paid": is_paid,
            "company": user.get("company_name", ""),
        },
        "trial": trial_info,
    }
