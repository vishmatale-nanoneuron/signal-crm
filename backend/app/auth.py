"""Signal CRM — Authentication"""
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
from app.models import User, WebSignal

settings = get_settings()
bearer = HTTPBearer(auto_error=False)
auth = APIRouter(prefix="/auth", tags=["Auth"])

TRIAL_DAYS = 14
TRIAL_CREDITS = 20

DEMO_SIGNALS = [
    {"account_name": "Freshworks", "signal_type": "hiring_spike", "signal_strength": "high",
     "title": "Freshworks hiring 45+ enterprise sales roles in DACH",
     "summary": "Freshworks posted 45 new enterprise sales roles in Germany, Austria, Switzerland — 3x spike vs prior quarter.",
     "proof_text": "Job posting: 'Enterprise Account Executive - DACH' | Munich, Germany | Posted: 3 days ago",
     "proof_url": "https://careers.freshworks.com", "country_hint": "Germany",
     "recommended_action": "Contact VP Sales DACH. They are staffing up fast — offer localization or partner services now.", "score": 9,
     "before_snapshot": "Jobs tracked: 15 | Markets: India, USA, UK",
     "after_snapshot": "Jobs detected: 60 | Markets: Germany, Austria, Switzerland (NEW), India, USA, UK"},
    {"account_name": "Razorpay", "signal_type": "new_country_page", "signal_strength": "high",
     "title": "Razorpay launches /malaysia page with local payment rail content",
     "summary": "Razorpay added a Malaysia-specific page listing FPX, DuitNow, GrabPay integrations.",
     "proof_text": "Page title: 'Accept Payments in Malaysia | Razorpay' | First indexed: 5 days ago",
     "proof_url": "https://razorpay.com/malaysia", "country_hint": "Malaysia",
     "recommended_action": "Razorpay entering Malaysia needs local banking partners and compliance support. Reach out this week.", "score": 8,
     "before_snapshot": "Country pages: /in/, /sg/ | 2 markets",
     "after_snapshot": "Country pages: /in/, /sg/, /my/ (NEW), /ph/ (NEW) | 4 markets — Malaysia & Philippines added"},
    {"account_name": "Deel", "signal_type": "pricing_change", "signal_strength": "high",
     "title": "Deel raises India EOR pricing by 18%",
     "summary": "Deel updated India Employer-of-Record pricing from $499/mo to $589/mo.",
     "proof_text": "India EOR | Old: $499/month | New: $589/month | Change detected: 4 days ago",
     "proof_url": "https://www.deel.com/pricing", "country_hint": "India",
     "recommended_action": "18% price hike creates retention risk for Deel India EOR customers. Lead with price comparison.", "score": 9,
     "before_snapshot": "India EOR: $499/month | Global Payroll: $599/month | Contractor: $49/month",
     "after_snapshot": "India EOR: $589/month (+18%) | Global Payroll: $599/month | Contractor: $49/month"},
    {"account_name": "Zoho", "signal_type": "new_product", "signal_strength": "medium",
     "title": "Zoho launches Finance Plus bundle for UK SME accountants",
     "summary": "Zoho launched UK Finance Plus bundle with MTD compliance built-in.",
     "proof_text": "Product page: 'Zoho Finance Plus for UK Businesses' | Released: 8 days ago",
     "proof_url": "https://www.zoho.com/finance/uk/", "country_hint": "UK",
     "recommended_action": "Zoho entering UK SME accounting creates channel partner opportunities for implementation.", "score": 7,
     "before_snapshot": "Products: Zoho Books, Zoho Expense, Zoho Invoice, Zoho Inventory | 4 finance products",
     "after_snapshot": "Products: Zoho Books, Zoho Expense, Zoho Invoice, Zoho Inventory, Finance Plus UK (NEW) | MTD-compliant bundle added"},
    {"account_name": "Stripe", "signal_type": "compliance_update", "signal_strength": "high",
     "title": "Stripe updates KYC requirements for Indian merchants",
     "summary": "Stripe India updated: PAN and GSTIN now mandatory for all merchants by Q2 2026.",
     "proof_text": "Stripe India Help: 'Updated verification requirements' | Updated: 6 days ago",
     "proof_url": "https://support.stripe.com/in", "country_hint": "India",
     "recommended_action": "Non-compliant Stripe India merchants face payout holds. Offer compliance advisory services.", "score": 8,
     "before_snapshot": "India KYC: Bank account + PAN (optional) | Verification: Basic",
     "after_snapshot": "India KYC: Bank account + PAN (mandatory) + GSTIN (mandatory by Q2 2026) | Stricter verification"},
    {"account_name": "Shopify", "signal_type": "hiring_spike", "signal_strength": "medium",
     "title": "Shopify hiring 20+ Partnership Managers across Southeast Asia",
     "summary": "Shopify posted 20 new partnership and channel sales roles across Singapore, Malaysia, Indonesia.",
     "proof_text": "20 roles in 3 weeks: 'Partnerships Manager - SEA' across Singapore, KL, Jakarta",
     "proof_url": "https://careers.shopify.com", "country_hint": "Singapore",
     "recommended_action": "Shopify building SEA partner network. Apply as certified Shopify Plus partner now.", "score": 7,
     "before_snapshot": "Jobs tracked: 8 | Markets: Canada, USA, UK | Partnership roles: 2",
     "after_snapshot": "Jobs detected: 28 | Markets: Singapore (NEW), Malaysia (NEW), Indonesia (NEW) | Partnership roles: 20+"},
    {"account_name": "Remote.com", "signal_type": "partner_page", "signal_strength": "medium",
     "title": "Remote.com adds 12 new HR tool integration partners",
     "summary": "Remote.com launched an Integration Partners hub with 12 new HR, payroll, finance integrations.",
     "proof_text": "New page: remote.com/integrations | 12 new partners listed",
     "proof_url": "https://remote.com/integrations", "country_hint": "Netherlands",
     "recommended_action": "Remote.com expanding partner ecosystem. Apply as integration partner now.", "score": 6,
     "before_snapshot": "Integration partners: 8 (Workday, BambooHR, Xero, QuickBooks…)",
     "after_snapshot": "Integration partners: 20 (+12 new) | New: Darwinbox, greytHR, Keka, Leapsome, Personio, Pento…"},
    {"account_name": "Infosys", "signal_type": "leadership_change", "signal_strength": "medium",
     "title": "Infosys appoints new CRO for Europe",
     "summary": "Infosys announced new Chief Revenue Officer for Europe from IBM.",
     "proof_text": "Press release: 'Infosys Announces New CRO — Europe' | Published: 10 days ago",
     "proof_url": "https://www.infosys.com/newsroom", "country_hint": "Germany",
     "recommended_action": "New CRO at Infosys Europe means new strategic priorities. First 90 days are window for new vendor conversations.", "score": 7,
     "before_snapshot": "Europe CRO: Position vacant (prior CRO departed Jan 2026)",
     "after_snapshot": "Europe CRO: Appointed — ex-IBM Global Sales VP | Start date: March 2026 | Focus: DACH + Nordics"},
]


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt(12)).decode()


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False


def create_token(user_id: str) -> str:
    return jwt.encode(
        {"sub": user_id, "exp": datetime.utcnow() + timedelta(days=7)},
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
        return {"status": "trial", "paid": False, "days_left": max(0, days_left),
                "trial_end": user.trial_end.strftime("%Y-%m-%d")}
    return {"status": "expired", "paid": False, "days_left": 0}


async def _seed_demo_signals(user_id: str, db: AsyncSession) -> None:
    """Seed demo signals for new user so dashboard is never empty"""
    now = datetime.utcnow()
    for i, s in enumerate(DEMO_SIGNALS):
        db.add(WebSignal(
            user_id=user_id,
            account_name=s["account_name"], signal_type=s["signal_type"],
            signal_strength=s["signal_strength"], title=s["title"],
            summary=s["summary"], proof_text=s["proof_text"],
            proof_url=s["proof_url"], country_hint=s["country_hint"],
            recommended_action=s["recommended_action"], score=s["score"],
            before_snapshot=s.get("before_snapshot", ""),
            after_snapshot=s.get("after_snapshot", ""),
            detected_at=now - timedelta(days=i),
        ))
    await db.commit()


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
            raise HTTPException(403, {
                "error": "trial_expired",
                "message": "Your 14-day trial has ended. Upgrade to continue.",
                "payment_required": True,
            })
        if t["status"] == "blocked":
            raise HTTPException(403, "Account blocked. Contact support@nanoneuron.ai")
        return user
    except JWTError:
        raise HTTPException(401, "Invalid or expired token. Please login again.")


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
    # Auto-seed demo signals so dashboard is populated on first login
    await _seed_demo_signals(user.id, db)
    return {
        "success": True,
        "token": create_token(user.id),
        "user": {
            "id": user.id, "name": user.name, "email": user.email,
            "credits": user.credits, "plan": user.plan, "is_paid": user.is_paid,
            "company": user.company_name,
        },
        "trial": {
            "status": "trial", "days_left": TRIAL_DAYS,
            "trial_end": user.trial_end.strftime("%Y-%m-%d"), "paid": False,
        },
        "message": f"Welcome to Signal CRM! Your 14-day free trial starts now.",
    }


@auth.post("/login")
async def login(req: LoginReq, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(User).where(User.email == req.email))
    user = r.scalar_one_or_none()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(401, "Invalid email or password")
    if not user.is_active:
        raise HTTPException(403, "Account disabled. Contact support@nanoneuron.ai")
    # Record last login time
    try:
        user.last_login_at = datetime.utcnow()
        await db.commit()
    except Exception:
        await db.rollback()
    return {
        "success": True,
        "token": create_token(user.id),
        "user": {
            "id": user.id, "name": user.name, "email": user.email,
            "credits": user.credits, "plan": user.plan, "is_paid": user.is_paid,
            "company": user.company_name,
            "last_login_at": user.last_login_at.isoformat() if user.last_login_at else None,
        },
        "trial": _trial_info(user),
    }


class ProfileUpdateReq(BaseModel):
    name:         str | None = None
    company_name: str | None = None
    phone:        str | None = None


class PasswordChangeReq(BaseModel):
    current_password: str
    new_password:     str


@auth.patch("/profile")
async def update_profile(
    req: ProfileUpdateReq,
    user: User = Depends(get_user_no_trial_check),
    db: AsyncSession = Depends(get_db),
):
    """Update display name, company, phone."""
    changed = False
    if req.name is not None:
        user.name = req.name.strip()
        changed = True
    if req.company_name is not None:
        user.company_name = req.company_name.strip()
        changed = True
    if req.phone is not None:
        user.phone = req.phone.strip()
        changed = True
    if changed:
        user.updated_at = datetime.utcnow()
        await db.commit()
        await db.refresh(user)
    return {
        "success": True,
        "message": "Profile updated.",
        "user": {
            "id":      user.id,
            "name":    user.name,
            "email":   user.email,
            "company": user.company_name,
            "phone":   getattr(user, "phone", ""),
            "plan":    user.plan,
        },
    }


@auth.post("/change-password")
async def change_password(
    req: PasswordChangeReq,
    user: User = Depends(get_user_no_trial_check),
    db: AsyncSession = Depends(get_db),
):
    """Change password — requires current password for verification."""
    if not verify_password(req.current_password, user.password_hash):
        raise HTTPException(400, "Current password is incorrect.")
    if len(req.new_password) < 8:
        raise HTTPException(400, "New password must be at least 8 characters.")
    user.password_hash = hash_password(req.new_password)
    user.updated_at    = datetime.utcnow()
    await db.commit()
    return {"success": True, "message": "Password changed successfully."}


@auth.get("/me")
async def me(user: User = Depends(get_user_no_trial_check), db: AsyncSession = Depends(get_db)):
    return {
        "success": True,
        "user": {
            "id":            user.id,
            "name":          user.name,
            "email":         user.email,
            "company":       user.company_name,
            "phone":         getattr(user, "phone", ""),
            "avatar_url":    getattr(user, "avatar_url", ""),
            "credits":       user.credits,
            "plan":          user.plan,
            "is_paid":       user.is_paid,
            "is_verified":   getattr(user, "is_verified", True),
            "created_at":    user.created_at.isoformat(),
            "last_login_at": user.last_login_at.isoformat() if getattr(user, "last_login_at", None) else None,
        },
        "trial": _trial_info(user),
    }
