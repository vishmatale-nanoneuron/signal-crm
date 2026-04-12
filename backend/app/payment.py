"""Signal CRM — Global Payment System
Supports: Razorpay (India), SWIFT/Wire (195 countries)
Revenue maximization: Annual billing (17% discount), 16 currencies, referral credits
"""
import hmac, hashlib, uuid
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
from app.database import get_db
from app.auth import get_user_no_trial_check, get_current_user
from app.models import User
from app.config import get_settings

settings = get_settings()
payment_router = APIRouter(prefix="/payment", tags=["Payment"])

# ── Monthly pricing (USD base) ────────────────────────────────────────────────
# Annual = 10× monthly price (pay 10, get 12) = 17% off
PLANS = [
    {
        "id": "starter", "name": "Starter", "highlighted": False,
        "price": {
            "INR": 4999,  "USD": 59,   "EUR": 55,  "GBP": 47,
            "AED": 217,   "SGD": 80,   "AUD": 91,  "CAD": 81,
            "JPY": 8800,  "BRL": 299,  "MYR": 275, "SAR": 222,
            "ZAR": 1099,  "IDR": 920000, "THB": 2100, "NGN": 48000,
        },
        "period": "month",
        "best_for": "Solo founders, consultants, small export teams",
        "credits_monthly": 50,
        "watchlist_limit": 5,
        "team_seats": 1,
        "features": [
            "50 signal credits / month",
            "5 watchlist companies",
            "Global buyer map — 195 countries",
            "Compliance checker — 44 frameworks",
            "Deal pipeline + kanban",
            "Lead discovery",
            "Contacts & Accounts CRM",
            "Email support",
        ],
    },
    {
        "id": "pro", "name": "Pro", "highlighted": True,
        "price": {
            "INR": 8000,  "USD": 95,   "EUR": 88,  "GBP": 75,
            "AED": 349,   "SGD": 129,  "AUD": 147, "CAD": 129,
            "JPY": 14200, "BRL": 479,  "MYR": 440, "SAR": 357,
            "ZAR": 1750,  "IDR": 1480000, "THB": 3350, "NGN": 77000,
        },
        "period": "month",
        "best_for": "B2B agencies, IT firms, SaaS going global",
        "credits_monthly": 999999,
        "watchlist_limit": 25,
        "team_seats": 5,
        "features": [
            "Unlimited signal credits",
            "25 watchlist companies",
            "AI next-best-action engine (Claude)",
            "Full buyer map — all 195 countries",
            "Compliance library — 44 jurisdictions",
            "Full CRM: Contacts, Accounts, Activities",
            "Tasks, Sequences, Forecasting",
            "CEO Revenue Dashboard",
            "Priority support",
            "5 team seats",
        ],
    },
    {
        "id": "enterprise", "name": "Enterprise", "highlighted": False,
        "price": {
            "INR": 19999, "USD": 239,  "EUR": 220, "GBP": 189,
            "AED": 878,   "SGD": 324,  "AUD": 369, "CAD": 324,
            "JPY": 35700, "BRL": 1199, "MYR": 1099, "SAR": 897,
            "ZAR": 4399,  "IDR": 3700000, "THB": 8400, "NGN": 193000,
        },
        "period": "month",
        "best_for": "Export agencies, consulting firms, enterprise teams",
        "credits_monthly": 999999,
        "watchlist_limit": 999999,
        "team_seats": 999999,
        "features": [
            "Everything in Pro",
            "Unlimited watchlist companies",
            "Custom signal monitoring rules",
            "Dedicated account manager",
            "REST API access",
            "White-label reporting",
            "Unlimited team members",
            "Custom onboarding",
            "SLA 99.9% uptime guarantee",
            "Priority phone + email support",
        ],
    },
]

ANNUAL_DISCOUNT_MONTHS = 10  # pay 10, get 12 = 17% off

# ── 16-currency global coverage ───────────────────────────────────────────────
CURRENCIES = {
    "INR": {"symbol": "₹",   "name": "Indian Rupee",        "flag": "🇮🇳", "method": "razorpay", "region": "India"},
    "USD": {"symbol": "$",   "name": "US Dollar",            "flag": "🇺🇸", "method": "swift",    "region": "Americas / Global"},
    "EUR": {"symbol": "€",   "name": "Euro",                 "flag": "🇪🇺", "method": "swift",    "region": "Europe"},
    "GBP": {"symbol": "£",   "name": "British Pound",        "flag": "🇬🇧", "method": "swift",    "region": "United Kingdom"},
    "AED": {"symbol": "د.إ", "name": "UAE Dirham",           "flag": "🇦🇪", "method": "swift",    "region": "UAE / Gulf"},
    "SGD": {"symbol": "S$",  "name": "Singapore Dollar",     "flag": "🇸🇬", "method": "swift",    "region": "Southeast Asia"},
    "AUD": {"symbol": "A$",  "name": "Australian Dollar",    "flag": "🇦🇺", "method": "swift",    "region": "Oceania"},
    "CAD": {"symbol": "C$",  "name": "Canadian Dollar",      "flag": "🇨🇦", "method": "swift",    "region": "Canada"},
    "JPY": {"symbol": "¥",   "name": "Japanese Yen",         "flag": "🇯🇵", "method": "swift",    "region": "Japan"},
    "BRL": {"symbol": "R$",  "name": "Brazilian Real",       "flag": "🇧🇷", "method": "swift",    "region": "Brazil / LatAm"},
    "MYR": {"symbol": "RM",  "name": "Malaysian Ringgit",    "flag": "🇲🇾", "method": "swift",    "region": "Malaysia"},
    "SAR": {"symbol": "﷼",   "name": "Saudi Riyal",          "flag": "🇸🇦", "method": "swift",    "region": "Saudi Arabia / Gulf"},
    "ZAR": {"symbol": "R",   "name": "South African Rand",   "flag": "🇿🇦", "method": "swift",    "region": "Africa"},
    "IDR": {"symbol": "Rp",  "name": "Indonesian Rupiah",    "flag": "🇮🇩", "method": "swift",    "region": "Indonesia"},
    "THB": {"symbol": "฿",   "name": "Thai Baht",            "flag": "🇹🇭", "method": "swift",    "region": "Thailand"},
    "NGN": {"symbol": "₦",   "name": "Nigerian Naira",       "flag": "🇳🇬", "method": "swift",    "region": "Nigeria / West Africa"},
}

# ── 80-country → currency map ─────────────────────────────────────────────────
COUNTRY_CURRENCY = {
    # South Asia
    "India": "INR",
    # Americas
    "United States": "USD", "USA": "USD", "Mexico": "USD", "Argentina": "USD",
    "Colombia": "USD", "Chile": "USD", "Peru": "USD", "Ecuador": "USD",
    "Brazil": "BRL",
    "Canada": "CAD",
    # Europe
    "United Kingdom": "GBP", "UK": "GBP",
    "Germany": "EUR", "France": "EUR", "Netherlands": "EUR", "Spain": "EUR",
    "Italy": "EUR", "Belgium": "EUR", "Austria": "EUR", "Poland": "EUR",
    "Sweden": "EUR", "Switzerland": "EUR", "Denmark": "EUR", "Norway": "EUR",
    "Finland": "EUR", "Portugal": "EUR", "Czech Republic": "EUR", "Hungary": "EUR",
    "Romania": "EUR", "Greece": "EUR", "Ireland": "EUR", "Croatia": "EUR",
    # Middle East
    "UAE": "AED", "Saudi Arabia": "SAR", "Kuwait": "AED", "Qatar": "AED",
    "Bahrain": "AED", "Oman": "AED", "Jordan": "USD", "Lebanon": "USD",
    "Israel": "USD", "Egypt": "USD", "Turkey": "USD",
    # Southeast Asia
    "Singapore": "SGD", "Malaysia": "MYR", "Indonesia": "IDR",
    "Thailand": "THB", "Vietnam": "USD", "Philippines": "USD",
    "Myanmar": "USD", "Cambodia": "USD", "Laos": "USD",
    # East Asia
    "Japan": "JPY", "South Korea": "USD", "China": "USD", "Taiwan": "USD",
    "Hong Kong": "USD", "Macau": "USD",
    # Oceania
    "Australia": "AUD", "New Zealand": "AUD", "Papua New Guinea": "AUD",
    # Africa
    "Nigeria": "NGN", "South Africa": "ZAR", "Kenya": "USD", "Ghana": "USD",
    "Ethiopia": "USD", "Tanzania": "USD", "Uganda": "USD", "Rwanda": "USD",
    "Morocco": "USD", "Tunisia": "USD", "Senegal": "USD",
    # South Asia (others)
    "Bangladesh": "USD", "Pakistan": "USD", "Sri Lanka": "USD", "Nepal": "USD",
}


# ── Endpoints ─────────────────────────────────────────────────────────────────

@payment_router.get("/plans")
async def get_plans(
    currency: str = Query("USD"),
    billing: str = Query("monthly", description="monthly or annual"),
):
    currency = currency.upper() if currency.upper() in CURRENCIES else "USD"
    cur = CURRENCIES[currency]
    is_annual = billing.lower() == "annual"

    plans_out = []
    for p in PLANS:
        monthly_price = p["price"].get(currency, p["price"]["USD"])
        if is_annual:
            # Annual: pay 10 months, get 12 (17% off)
            annual_total = monthly_price * ANNUAL_DISCOUNT_MONTHS
            effective_monthly = round(annual_total / 12)
        else:
            annual_total = None
            effective_monthly = monthly_price

        plans_out.append({
            **{k: v for k, v in p.items() if k not in ("price",)},
            "price_local": effective_monthly,
            "price_usd": p["price"]["USD"] if not is_annual else round(p["price"]["USD"] * ANNUAL_DISCOUNT_MONTHS / 12),
            "annual_total": annual_total,
            "billing": billing.lower(),
            "savings_pct": 17 if is_annual else 0,
            "all_prices": p["price"],
        })

    return {
        "success": True,
        "currency": currency,
        "currency_symbol": cur["symbol"],
        "currency_name": cur["name"],
        "currency_flag": cur["flag"],
        "currency_region": cur.get("region", ""),
        "payment_method": cur["method"],
        "billing": billing.lower(),
        "plans": plans_out,
        "annual_savings_months": 2,
        "note": "All plans include 14-day free trial. Cancel anytime.",
        "contact": "sales@nanoneuron.ai",
        "swift_fallback": "All currencies accepted via SWIFT/Wire transfer to Axis Bank.",
    }


@payment_router.get("/currencies")
async def get_currencies():
    return {"success": True, "currencies": CURRENCIES, "country_map": COUNTRY_CURRENCY}


@payment_router.get("/methods")
async def get_payment_methods():
    return {
        "success": True,
        "methods": [
            {
                "id": "razorpay",
                "name": "Razorpay — UPI / Cards / Net Banking",
                "currencies": ["INR"],
                "regions": ["India"],
                "recommended_for": "India",
                "instant_activation": True,
                "razorpay_key_id": settings.RAZORPAY_KEY_ID,
                "note": "Instant activation after payment.",
            },
            {
                "id": "swift_usd",
                "name": "SWIFT / Wire Transfer (USD)",
                "currencies": ["USD"],
                "regions": ["USA", "Global"],
                "recommended_for": "International",
                "instant_activation": False,
                "swift_code": settings.SWIFT_CODE,
                "bank_name": settings.BANK_NAME,
                "account_holder": settings.BANK_ACCOUNT_HOLDER,
                "account_number": settings.BANK_ACCOUNT_NUMBER,
                "ifsc": settings.BANK_IFSC,
                "bank_address": settings.BANK_SWIFT_ADDRESS,
                "note": "Activation within 4–8 business hours after receipt confirmation.",
            },
            {
                "id": "swift_eur",
                "name": "SWIFT / Wire Transfer (EUR)",
                "currencies": ["EUR"],
                "regions": ["Europe", "EU"],
                "recommended_for": "Europe",
                "instant_activation": False,
                "swift_code": settings.SWIFT_CODE,
                "bank_name": settings.BANK_NAME,
                "account_holder": settings.BANK_ACCOUNT_HOLDER,
                "account_number": settings.BANK_ACCOUNT_NUMBER,
                "ifsc": settings.BANK_IFSC,
                "bank_address": settings.BANK_SWIFT_ADDRESS,
                "note": "Activation within 4–8 business hours. EUR accepted via SWIFT.",
            },
            {
                "id": "swift_gbp",
                "name": "SWIFT / Wire Transfer (GBP)",
                "currencies": ["GBP"],
                "regions": ["United Kingdom"],
                "recommended_for": "UK",
                "instant_activation": False,
                "swift_code": settings.SWIFT_CODE,
                "bank_name": settings.BANK_NAME,
                "account_holder": settings.BANK_ACCOUNT_HOLDER,
                "account_number": settings.BANK_ACCOUNT_NUMBER,
                "ifsc": settings.BANK_IFSC,
                "bank_address": settings.BANK_SWIFT_ADDRESS,
                "note": "Activation within 4–8 business hours. GBP via SWIFT.",
            },
            {
                "id": "bank_transfer_inr",
                "name": "Bank Transfer — NEFT / RTGS / IMPS (INR)",
                "currencies": ["INR"],
                "regions": ["India"],
                "recommended_for": "India",
                "instant_activation": False,
                "bank_name": settings.BANK_NAME,
                "account_number": settings.BANK_ACCOUNT_NUMBER,
                "account_holder": settings.BANK_ACCOUNT_HOLDER,
                "ifsc": settings.BANK_IFSC,
                "upi_id": settings.UPI_ID,
                "note": "Activation within 4 hours of receipt. UPI also accepted.",
            },
        ],
        "support_email": "support@nanoneuron.ai",
        "sales_email": "sales@nanoneuron.ai",
    }


# ── Razorpay (India) ──────────────────────────────────────────────────────────

class CreateOrderReq(BaseModel):
    plan_id: str
    currency: str = "INR"


@payment_router.post("/razorpay/create-order")
async def create_razorpay_order(req: CreateOrderReq, user: User = Depends(get_user_no_trial_check)):
    plan = next((p for p in PLANS if p["id"] == req.plan_id), None)
    if not plan:
        raise HTTPException(400, "Invalid plan ID")
    if not settings.RAZORPAY_KEY_ID or not settings.RAZORPAY_KEY_SECRET:
        raise HTTPException(503, "Payment gateway not configured. Contact support@nanoneuron.ai")
    try:
        import razorpay
        client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
        amount_inr = plan["price"]["INR"]
        order = client.order.create({
            "amount": amount_inr * 100,
            "currency": "INR",
            "receipt": f"sig-{user.id[:8]}-{uuid.uuid4().hex[:8]}",
            "notes": {"user_id": user.id, "user_email": user.email, "plan": req.plan_id},
        })
        return {
            "success": True,
            "order_id": order["id"],
            "amount": order["amount"],
            "currency": "INR",
            "key_id": settings.RAZORPAY_KEY_ID,
            "plan": plan,
            "user": {"name": user.name, "email": user.email},
        }
    except Exception as e:
        raise HTTPException(502, f"Payment error: {str(e)}")


class VerifyPaymentReq(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    plan_id: str


@payment_router.post("/razorpay/verify")
async def verify_razorpay(req: VerifyPaymentReq, user: User = Depends(get_user_no_trial_check), db: AsyncSession = Depends(get_db)):
    msg = f"{req.razorpay_order_id}|{req.razorpay_payment_id}"
    expected = hmac.new(settings.RAZORPAY_KEY_SECRET.encode(), msg.encode(), hashlib.sha256).hexdigest()
    if expected != req.razorpay_signature:
        raise HTTPException(400, "Invalid payment signature. Contact support@nanoneuron.ai")
    plan = next((p for p in PLANS if p["id"] == req.plan_id), None)
    if not plan:
        raise HTTPException(400, "Invalid plan ID")
    r = await db.execute(select(User).where(User.id == user.id))
    u = r.scalar_one_or_none()
    if u:
        u.plan = req.plan_id
        u.is_paid = True
        u.credits = 999999
        await db.commit()
    return {"success": True, "message": f"Payment verified! {plan['name']} plan is now active.", "plan": plan, "activated": True}


# ── SWIFT / Manual (International) ───────────────────────────────────────────

class ManualPaymentReq(BaseModel):
    plan_id: str
    currency: str = "USD"
    transaction_ref: str
    notes: str = ""


@payment_router.post("/manual/confirm")
async def manual_payment(req: ManualPaymentReq, user: User = Depends(get_user_no_trial_check)):
    plan = next((p for p in PLANS if p["id"] == req.plan_id), None)
    if not plan:
        raise HTTPException(400, "Invalid plan ID")
    currency = req.currency.upper() if req.currency.upper() in CURRENCIES else "USD"
    amount = plan["price"].get(currency, plan["price"]["USD"])
    symbol = CURRENCIES[currency]["symbol"]
    return {
        "success": True,
        "message": f"Payment request received for {symbol}{amount} {currency}. We will verify and activate within 4–8 hours.",
        "plan": plan,
        "transaction_ref": req.transaction_ref,
        "currency": currency,
        "amount": amount,
        "next_step": f"Email your SWIFT receipt to sales@nanoneuron.ai with subject: 'Signal CRM Payment - {user.email}'",
        "activation_time": "4–8 business hours",
    }


# ── Admin: manually activate a user (ops team use) ───────────────────────────

class ActivateReq(BaseModel):
    user_email: str
    plan_id: str
    admin_key: str


@payment_router.post("/admin/activate")
async def admin_activate(req: ActivateReq, db: AsyncSession = Depends(get_db)):
    if req.admin_key != settings.JWT_SECRET[:16]:
        raise HTTPException(403, "Unauthorized")
    r = await db.execute(select(User).where(User.email == req.user_email))
    u = r.scalar_one_or_none()
    if not u:
        raise HTTPException(404, "User not found")
    plan = next((p for p in PLANS if p["id"] == req.plan_id), None)
    if not plan:
        raise HTTPException(400, "Invalid plan ID")
    u.plan = req.plan_id
    u.is_paid = True
    u.credits = 999999
    await db.commit()
    return {"success": True, "message": f"{u.email} activated on {plan['name']} plan."}


# ── Currency auto-detect from IP (best-effort, no external API) ──────────────
@payment_router.get("/detect-currency")
async def detect_currency(country: str = Query("", description="Country name from client")):
    """Return best currency for a given country."""
    c = COUNTRY_CURRENCY.get(country, "USD")
    cur = CURRENCIES.get(c, CURRENCIES["USD"])
    return {"success": True, "currency": c, "symbol": cur["symbol"], "flag": cur["flag"], "method": cur["method"]}


# ── Referral system ───────────────────────────────────────────────────────────
@payment_router.get("/referral/code")
async def get_referral_code(user: User = Depends(get_current_user)):
    """Get or generate referral code for the current user."""
    # Simple deterministic referral code: SIG + first 8 chars of user id
    code = f"SIG{user.id[:8].upper()}"
    return {
        "success": True,
        "referral_code": code,
        "referral_url": f"https://signal.nanoneuron.ai/login?ref={code}",
        "reward": "1 free month of Pro plan for each paid referral",
        "your_email": user.email,
    }


@payment_router.post("/referral/apply")
async def apply_referral(
    code: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Apply a referral code — give the referred user 7 extra trial days."""
    # Find referrer by extracting user_id from code
    if not code.startswith("SIG") or len(code) < 11:
        raise HTTPException(400, "Invalid referral code")
    partial_id = code[3:].lower()
    r = await db.execute(select(User).where(User.id.startswith(partial_id)))
    referrer = r.scalar_one_or_none()
    if not referrer:
        raise HTTPException(404, "Referral code not found")
    if referrer.id == user.id:
        raise HTTPException(400, "Cannot use your own referral code")

    # Extend referred user's trial by 7 days
    if user.trial_end:
        user.trial_end = user.trial_end + timedelta(days=7)
    else:
        user.trial_end = datetime.utcnow() + timedelta(days=21)
    await db.commit()
    return {
        "success": True,
        "message": "Referral code applied! Your trial has been extended by 7 days.",
        "new_trial_end": user.trial_end.isoformat() if user.trial_end else None,
    }


# ── Revenue summary (owner only) ─────────────────────────────────────────────
@payment_router.get("/revenue/summary")
async def revenue_summary(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Owner-only: total paid users and plan distribution."""
    if user.email != settings.OWNER_EMAIL:
        raise HTTPException(403, "Owner access only")
    all_users_r = await db.execute(select(User).where(User.is_active == True))
    all_users = all_users_r.scalars().all()
    paid = [u for u in all_users if u.is_paid]
    trial = [u for u in all_users if not u.is_paid]
    plan_dist = {}
    for u in paid:
        plan_dist[u.plan] = plan_dist.get(u.plan, 0) + 1

    # Estimate MRR (assume Pro pricing as average)
    avg_plan_prices = {"starter": 59, "pro": 95, "enterprise": 239}
    mrr_usd = sum(avg_plan_prices.get(u.plan, 59) for u in paid)

    return {
        "success": True,
        "total_users": len(all_users),
        "paid_users": len(paid),
        "trial_users": len(trial),
        "conversion_rate_pct": round(len(paid) / len(all_users) * 100, 1) if all_users else 0,
        "plan_distribution": plan_dist,
        "estimated_mrr_usd": mrr_usd,
        "estimated_arr_usd": mrr_usd * 12,
    }
