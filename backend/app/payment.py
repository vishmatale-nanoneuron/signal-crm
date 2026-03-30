"""Signal CRM — Payment System (Razorpay + Bank Transfer)"""
import hmac
import hashlib
import uuid
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from app.database import get_db
from app.auth import get_user_no_trial_check
from app.models import User
from app.config import get_settings

settings = get_settings()
payment_router = APIRouter(prefix="/payment", tags=["Payment"])

PLANS = [
    {
        "id": "starter",
        "name": "Starter",
        "price_inr": 8000,
        "price_usd": 97,
        "period": "month",
        "features": [
            "Up to 50 watchlist accounts",
            "Signal feed with proof",
            "Buyer map for 30+ countries",
            "Compliance checker",
            "Deal pipeline",
            "Next best action engine",
            "Email support",
        ],
        "best_for": "Solo founders, small export firms",
        "highlighted": False,
    },
    {
        "id": "pro",
        "name": "Pro",
        "price_inr": 25000,
        "price_usd": 299,
        "period": "month",
        "features": [
            "Unlimited watchlist accounts",
            "Real-time signal alerts",
            "All buyer maps + custom titles",
            "Full compliance library (30+ countries)",
            "Advanced pipeline with notes",
            "AI next best actions",
            "Priority support",
            "Up to 5 team members",
        ],
        "best_for": "B2B agencies, IT consulting firms, SaaS companies",
        "highlighted": True,
    },
    {
        "id": "business",
        "name": "Business",
        "price_inr": 75000,
        "price_usd": 899,
        "period": "month",
        "features": [
            "Everything in Pro",
            "Custom signal monitoring",
            "Dedicated account manager",
            "Custom compliance frameworks",
            "API access",
            "White-label reporting",
            "Unlimited team members",
            "Onboarding and training included",
        ],
        "best_for": "Export agencies, large logistics companies, enterprise teams",
        "highlighted": False,
    },
]


@payment_router.get("/plans")
async def get_plans():
    return {
        "success": True,
        "plans": PLANS,
        "note": "All plans include 14-day free trial. Cancel anytime.",
        "contact": "sales@nanoneuron.ai",
    }


@payment_router.get("/methods")
async def get_payment_methods():
    return {
        "success": True,
        "methods": [
            {
                "id": "razorpay",
                "name": "Razorpay (UPI / Cards / Net Banking)",
                "recommended": True,
                "instant_activation": True,
                "currencies": ["INR"],
                "note": "Instant payment confirmation and account activation.",
                "razorpay_key_id": settings.RAZORPAY_KEY_ID,
            },
            {
                "id": "bank_transfer_inr",
                "name": "Bank Transfer (NEFT / RTGS / IMPS)",
                "recommended": False,
                "instant_activation": False,
                "currencies": ["INR"],
                "bank_name": settings.BANK_NAME,
                "account_number": settings.BANK_ACCOUNT_NUMBER,
                "account_holder": settings.BANK_ACCOUNT_HOLDER,
                "ifsc": settings.BANK_IFSC,
                "note": "Send payment and email receipt to support@nanoneuron.ai. Activation within 4 hours.",
            },
            {
                "id": "bank_transfer_usd",
                "name": "SWIFT / Wire Transfer (USD)",
                "recommended": False,
                "instant_activation": False,
                "currencies": ["USD"],
                "beneficiary": "Nanoneuron Services",
                "swift_code": "AXISINBBA02",
                "note": "For international clients. Contact sales@nanoneuron.ai for SWIFT details.",
            },
        ],
        "upi_id": settings.UPI_ID or "Not configured — contact support@nanoneuron.ai",
        "support_email": "support@nanoneuron.ai",
    }


class CreateOrderReq(BaseModel):
    plan_id: str
    currency: str = "INR"


@payment_router.post("/razorpay/create-order")
async def create_razorpay_order(
    req: CreateOrderReq,
    user: User = Depends(get_user_no_trial_check),
):
    plan = next((p for p in PLANS if p["id"] == req.plan_id), None)
    if not plan:
        raise HTTPException(400, f"Invalid plan. Choose from: {[p['id'] for p in PLANS]}")

    if not settings.RAZORPAY_KEY_ID or not settings.RAZORPAY_KEY_SECRET:
        raise HTTPException(503, "Payment gateway not configured. Contact support@nanoneuron.ai")

    try:
        import razorpay
        client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
        amount_paise = plan["price_inr"] * 100  # Razorpay uses paise
        order = client.order.create({
            "amount": amount_paise,
            "currency": "INR",
            "receipt": f"signal-crm-{user.id[:8]}-{uuid.uuid4().hex[:8]}",
            "notes": {
                "user_id": str(user.id),
                "user_email": user.email,
                "plan": req.plan_id,
                "product": "Signal CRM",
            },
        })
        return {
            "success": True,
            "order_id": order["id"],
            "amount": order["amount"],
            "currency": order["currency"],
            "key_id": settings.RAZORPAY_KEY_ID,
            "plan": plan,
            "user": {"name": user.name, "email": user.email},
        }
    except ImportError:
        raise HTTPException(503, "Razorpay not installed. Contact support.")
    except Exception as e:
        raise HTTPException(502, f"Payment gateway error: {str(e)}")


class VerifyPaymentReq(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    plan_id: str


@payment_router.post("/razorpay/verify")
async def verify_razorpay_payment(
    req: VerifyPaymentReq,
    user: User = Depends(get_user_no_trial_check),
    db: AsyncSession = Depends(get_db),
):
    # Verify signature
    msg = f"{req.razorpay_order_id}|{req.razorpay_payment_id}"
    expected_sig = hmac.new(
        settings.RAZORPAY_KEY_SECRET.encode("utf-8"),
        msg.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    if expected_sig != req.razorpay_signature:
        raise HTTPException(400, "Payment verification failed. Invalid signature.")

    plan = next((p for p in PLANS if p["id"] == req.plan_id), None)
    if not plan:
        raise HTTPException(400, "Invalid plan")

    # Activate account
    r = await db.execute(select(User).where(User.id == user.id))
    u = r.scalar_one_or_none()
    if u:
        u.plan = req.plan_id
        u.is_paid = True
        u.credits = 999999  # unlimited
        await db.commit()

    return {
        "success": True,
        "message": f"Payment verified! Your {plan['name']} plan is now active.",
        "plan": plan,
        "payment_id": req.razorpay_payment_id,
        "activated": True,
    }


class ManualPaymentReq(BaseModel):
    plan_id: str
    transaction_ref: str
    notes: str = ""


@payment_router.post("/manual/confirm")
async def confirm_manual_payment(
    req: ManualPaymentReq,
    user: User = Depends(get_user_no_trial_check),
):
    plan = next((p for p in PLANS if p["id"] == req.plan_id), None)
    if not plan:
        raise HTTPException(400, "Invalid plan")
    return {
        "success": True,
        "message": "Manual payment request received. We'll verify and activate your account within 4 hours. Please email your payment receipt to support@nanoneuron.ai.",
        "plan": plan,
        "transaction_ref": req.transaction_ref,
        "support_email": "support@nanoneuron.ai",
        "next_step": "Email receipt to support@nanoneuron.ai with subject: 'Signal CRM Payment - " + user.email + "'",
    }
