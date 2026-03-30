"""Signal CRM — Payment System"""
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

PLANS = [
    {"id":"starter","name":"Starter","price_inr":8000,"price_usd":97,"period":"month","highlighted":False,
     "features":["50 watchlist accounts","Signal feed","Buyer map 30+ countries","Compliance checker","Deal pipeline","Lead discovery","Email support"],
     "best_for":"Solo founders, small export firms"},
    {"id":"pro","name":"Pro","price_inr":25000,"price_usd":299,"period":"month","highlighted":True,
     "features":["Unlimited watchlist","Real-time signal alerts","All buyer maps","Full compliance library","AI next best actions","Lead discovery + import","Priority support","5 team members"],
     "best_for":"B2B agencies, IT consulting firms, SaaS companies"},
    {"id":"business","name":"Business","price_inr":75000,"price_usd":899,"period":"month","highlighted":False,
     "features":["Everything in Pro","Custom signal monitoring","Dedicated account manager","API access","White-label reporting","Unlimited team members","Onboarding included"],
     "best_for":"Export agencies, large logistics companies, enterprise teams"},
]


@payment_router.get("/plans")
async def get_plans():
    return {"success": True, "plans": PLANS, "note": "All plans include 14-day free trial. Cancel anytime.", "contact": "sales@nanoneuron.ai"}


@payment_router.get("/methods")
async def get_payment_methods():
    return {"success": True, "methods": [
        {"id":"razorpay","name":"Razorpay (UPI / Cards / Net Banking)","recommended":True,"instant_activation":True,"currencies":["INR"],"razorpay_key_id":settings.RAZORPAY_KEY_ID,"note":"Instant payment confirmation."},
        {"id":"bank_transfer_inr","name":"Bank Transfer (NEFT / RTGS / IMPS)","recommended":False,"instant_activation":False,"currencies":["INR"],"bank_name":settings.BANK_NAME,"account_number":settings.BANK_ACCOUNT_NUMBER,"account_holder":settings.BANK_ACCOUNT_HOLDER,"ifsc":settings.BANK_IFSC,"note":"Activation within 4 hours."},
        {"id":"bank_transfer_usd","name":"SWIFT / Wire Transfer (USD)","recommended":False,"currencies":["USD"],"swift_code":"AXISINBBA02","note":"Contact sales@nanoneuron.ai for SWIFT details."},
    ], "upi_id": settings.UPI_ID or "Contact support@nanoneuron.ai", "support_email": "support@nanoneuron.ai"}


class CreateOrderReq(BaseModel):
    plan_id: str; currency: str = "INR"


@payment_router.post("/razorpay/create-order")
async def create_order(req: CreateOrderReq, user: User = Depends(get_user_no_trial_check)):
    plan = next((p for p in PLANS if p["id"] == req.plan_id), None)
    if not plan: raise HTTPException(400, "Invalid plan")
    if not settings.RAZORPAY_KEY_ID or not settings.RAZORPAY_KEY_SECRET:
        raise HTTPException(503, "Payment gateway not configured. Contact support@nanoneuron.ai")
    try:
        import razorpay
        client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
        order = client.order.create({"amount": plan["price_inr"] * 100, "currency": "INR",
            "receipt": f"sig-{user.id[:8]}-{uuid.uuid4().hex[:8]}",
            "notes": {"user_id": user.id, "user_email": user.email, "plan": req.plan_id}})
        return {"success": True, "order_id": order["id"], "amount": order["amount"],
                "currency": order["currency"], "key_id": settings.RAZORPAY_KEY_ID,
                "plan": plan, "user": {"name": user.name, "email": user.email}}
    except Exception as e:
        raise HTTPException(502, f"Payment error: {str(e)}")


class VerifyPaymentReq(BaseModel):
    razorpay_order_id: str; razorpay_payment_id: str; razorpay_signature: str; plan_id: str


@payment_router.post("/razorpay/verify")
async def verify_payment(req: VerifyPaymentReq, user: User = Depends(get_user_no_trial_check), db: AsyncSession = Depends(get_db)):
    msg = f"{req.razorpay_order_id}|{req.razorpay_payment_id}"
    expected = hmac.new(settings.RAZORPAY_KEY_SECRET.encode(), msg.encode(), hashlib.sha256).hexdigest()
    if expected != req.razorpay_signature: raise HTTPException(400, "Invalid payment signature.")
    plan = next((p for p in PLANS if p["id"] == req.plan_id), None)
    if not plan: raise HTTPException(400, "Invalid plan")
    r = await db.execute(select(User).where(User.id == user.id))
    u = r.scalar_one_or_none()
    if u:
        u.plan = req.plan_id; u.is_paid = True; u.credits = 999999
        await db.commit()
    return {"success": True, "message": f"Payment verified! {plan['name']} plan is now active.", "plan": plan, "activated": True}


class ManualPaymentReq(BaseModel):
    plan_id: str; transaction_ref: str; notes: str = ""


@payment_router.post("/manual/confirm")
async def manual_payment(req: ManualPaymentReq, user: User = Depends(get_user_no_trial_check)):
    plan = next((p for p in PLANS if p["id"] == req.plan_id), None)
    if not plan: raise HTTPException(400, "Invalid plan")
    return {"success": True, "message": "Payment request received. We will verify and activate within 4 hours.",
            "plan": plan, "transaction_ref": req.transaction_ref,
            "next_step": f"Email receipt to support@nanoneuron.ai with subject: 'Signal CRM Payment - {user.email}'"}
