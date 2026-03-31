"""Signal CRM — Global Payment System (Razorpay INR + SWIFT International)"""
import hmac, hashlib, uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from app.database import get_db
from app.auth import get_user_no_trial_check
from app.models import User
from app.config import get_settings

settings = get_settings()
payment_router = APIRouter(prefix="/payment", tags=["Payment"])

# ── Global Plans ─────────────────────────────────────────────────────────────
PLANS = [
    {
        "id": "starter", "name": "Starter", "highlighted": False,
        "price": {"INR": 4999, "USD": 59, "EUR": 55, "GBP": 47, "AED": 217, "SGD": 80, "AUD": 91, "CAD": 81},
        "period": "month",
        "best_for": "Solo founders, consultants, small export teams",
        "features": [
            "50 signal credits / month",
            "5 watchlist companies",
            "Buyer map — 50+ countries",
            "Compliance checker",
            "Deal pipeline",
            "Lead discovery",
            "Email support",
        ],
    },
    {
        "id": "pro", "name": "Pro", "highlighted": True,
        "price": {"INR": 8000, "USD": 95, "EUR": 88, "GBP": 75, "AED": 349, "SGD": 129, "AUD": 147, "CAD": 129},
        "period": "month",
        "best_for": "B2B agencies, IT firms, SaaS companies going global",
        "features": [
            "Unlimited signal credits",
            "25 watchlist companies",
            "AI next-best-action engine",
            "Full buyer map — all industries & countries",
            "Compliance library — 40+ jurisdictions",
            "Deal pipeline + lead import",
            "Priority support",
            "Up to 5 team members",
        ],
    },
    {
        "id": "enterprise", "name": "Enterprise", "highlighted": False,
        "price": {"INR": 19999, "USD": 239, "EUR": 220, "GBP": 189, "AED": 878, "SGD": 324, "AUD": 369, "CAD": 324},
        "period": "month",
        "best_for": "Export agencies, large consulting firms, enterprise teams",
        "features": [
            "Everything in Pro",
            "Unlimited watchlist",
            "Custom signal monitoring",
            "Dedicated account manager",
            "API access",
            "White-label reporting",
            "Unlimited team members",
            "Custom onboarding + SLA 99.9%",
        ],
    },
]

# ── Currency metadata ─────────────────────────────────────────────────────────
CURRENCIES = {
    "INR": {"symbol": "₹", "name": "Indian Rupee",       "flag": "🇮🇳", "method": "razorpay"},
    "USD": {"symbol": "$", "name": "US Dollar",           "flag": "🇺🇸", "method": "swift"},
    "EUR": {"symbol": "€", "name": "Euro",                "flag": "🇪🇺", "method": "swift"},
    "GBP": {"symbol": "£", "name": "British Pound",       "flag": "🇬🇧", "method": "swift"},
    "AED": {"symbol": "د.إ","name": "UAE Dirham",         "flag": "🇦🇪", "method": "swift"},
    "SGD": {"symbol": "S$","name": "Singapore Dollar",    "flag": "🇸🇬", "method": "swift"},
    "AUD": {"symbol": "A$","name": "Australian Dollar",   "flag": "🇦🇺", "method": "swift"},
    "CAD": {"symbol": "C$","name": "Canadian Dollar",     "flag": "🇨🇦", "method": "swift"},
}

# ── Country → default currency map ───────────────────────────────────────────
COUNTRY_CURRENCY = {
    "India": "INR",
    "United States": "USD", "USA": "USD", "United Kingdom": "GBP", "UK": "GBP",
    "Germany": "EUR", "France": "EUR", "Netherlands": "EUR", "Spain": "EUR",
    "Italy": "EUR", "Belgium": "EUR", "Austria": "EUR", "Poland": "EUR",
    "Sweden": "EUR", "Switzerland": "EUR", "Denmark": "EUR", "Norway": "EUR",
    "UAE": "AED", "Saudi Arabia": "AED", "Kuwait": "AED", "Qatar": "AED",
    "Singapore": "SGD", "Malaysia": "SGD",
    "Australia": "AUD", "New Zealand": "AUD",
    "Canada": "CAD",
    "Japan": "USD", "South Korea": "USD", "China": "USD", "Taiwan": "USD",
    "Brazil": "USD", "Mexico": "USD", "Argentina": "USD",
    "Nigeria": "USD", "South Africa": "USD", "Kenya": "USD", "Egypt": "USD",
    "Indonesia": "USD", "Vietnam": "USD", "Philippines": "USD", "Thailand": "USD",
    "Israel": "USD", "Turkey": "USD",
}


# ── Endpoints ─────────────────────────────────────────────────────────────────

@payment_router.get("/plans")
async def get_plans(currency: str = "USD"):
    currency = currency.upper() if currency.upper() in CURRENCIES else "USD"
    cur = CURRENCIES[currency]
    return {
        "success": True,
        "currency": currency,
        "currency_symbol": cur["symbol"],
        "currency_name": cur["name"],
        "payment_method": cur["method"],
        "plans": [
            {**{k: v for k, v in p.items() if k != "price"},
             "price_local": p["price"].get(currency, p["price"]["USD"]),
             "price_usd": p["price"]["USD"],
             "all_prices": p["price"]}
            for p in PLANS
        ],
        "note": "All plans include 14-day free trial. Cancel anytime.",
        "contact": "sales@nanoneuron.ai",
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
