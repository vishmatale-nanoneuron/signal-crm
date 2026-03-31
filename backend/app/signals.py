"""Signal CRM — Signals"""
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.auth import get_current_user
from app.models import User, WebSignal

signals_router = APIRouter(prefix="/signals", tags=["Signals"])

DEMO_SIGNALS = [
    {"account_name":"Freshworks","signal_type":"hiring_spike","signal_strength":"high","title":"Freshworks hiring 45+ enterprise sales roles in DACH","summary":"Freshworks posted 45 new enterprise sales roles in Germany, Austria, Switzerland — 3x spike vs prior quarter.","proof_text":"Job posting: 'Enterprise Account Executive - DACH' | Munich, Germany | Posted: 3 days ago","proof_url":"https://careers.freshworks.com","country_hint":"Germany","recommended_action":"Contact VP Sales DACH. They are staffing up fast — offer localization or partner services now.","score":9},
    {"account_name":"Razorpay","signal_type":"new_country_page","signal_strength":"high","title":"Razorpay launches /malaysia page with local payment rail content","summary":"Razorpay added a Malaysia-specific page listing FPX, DuitNow, GrabPay integrations.","proof_text":"Page title: 'Accept Payments in Malaysia | Razorpay' | First indexed: 5 days ago","proof_url":"https://razorpay.com/malaysia","country_hint":"Malaysia","recommended_action":"Razorpay entering Malaysia needs local banking partners and compliance support. Reach out this week.","score":8},
    {"account_name":"Deel","signal_type":"pricing_change","signal_strength":"high","title":"Deel raises India EOR pricing by 18%","summary":"Deel updated India Employer-of-Record pricing from $499/mo to $589/mo.","proof_text":"India EOR | Old: $499/month | New: $589/month | Change detected: 4 days ago","proof_url":"https://www.deel.com/pricing","country_hint":"India","recommended_action":"18% price hike creates retention risk for Deel India EOR customers. Lead with price comparison.","score":9},
    {"account_name":"Zoho","signal_type":"new_product","signal_strength":"medium","title":"Zoho launches Finance Plus bundle for UK SME accountants","summary":"Zoho launched UK Finance Plus bundle with MTD compliance built-in.","proof_text":"Product page: 'Zoho Finance Plus for UK Businesses' | Released: 8 days ago","proof_url":"https://www.zoho.com/finance/uk/","country_hint":"UK","recommended_action":"Zoho entering UK SME accounting creates channel partner opportunities for implementation.","score":7},
    {"account_name":"Stripe","signal_type":"compliance_update","signal_strength":"high","title":"Stripe updates KYC requirements for Indian merchants","summary":"Stripe India updated: PAN and GSTIN now mandatory for all merchants by Q2 2026.","proof_text":"Stripe India Help: 'Updated verification requirements' | Updated: 6 days ago","proof_url":"https://support.stripe.com/in","country_hint":"India","recommended_action":"Non-compliant Stripe India merchants face payout holds. Offer compliance advisory services.","score":8},
    {"account_name":"Shopify","signal_type":"hiring_spike","signal_strength":"medium","title":"Shopify hiring 20+ Partnership Managers across Southeast Asia","summary":"Shopify posted 20 new partnership and channel sales roles across Singapore, Malaysia, Indonesia.","proof_text":"20 roles in 3 weeks: 'Partnerships Manager - SEA' across Singapore, KL, Jakarta","proof_url":"https://careers.shopify.com","country_hint":"Singapore","recommended_action":"Shopify building SEA partner network. Apply as certified Shopify Plus partner now.","score":7},
    {"account_name":"Remote.com","signal_type":"partner_page","signal_strength":"medium","title":"Remote.com adds 12 new HR tool integration partners","summary":"Remote.com launched an Integration Partners hub with 12 new HR, payroll, finance integrations.","proof_text":"New page: remote.com/integrations | 12 new partners listed","proof_url":"https://remote.com/integrations","country_hint":"Netherlands","recommended_action":"Remote.com expanding partner ecosystem. Apply as integration partner now.","score":6},
    {"account_name":"Infosys","signal_type":"leadership_change","signal_strength":"medium","title":"Infosys appoints new CRO for Europe","summary":"Infosys announced new Chief Revenue Officer for Europe from IBM.","proof_text":"Press release: 'Infosys Announces New CRO — Europe' | Published: 10 days ago","proof_url":"https://www.infosys.com/newsroom","country_hint":"Germany","recommended_action":"New CRO at Infosys Europe means new strategic priorities. First 90 days are window for new vendor conversations.","score":7},
]


def _signal_dict(s):
    return {
        "id": s.id, "company_name": s.account_name, "account_name": s.account_name,
        "signal_type": s.signal_type, "signal_strength": s.signal_strength,
        "title": s.title, "summary": s.summary, "proof_text": s.proof_text,
        "proof_url": s.proof_url, "country_hint": s.country_hint,
        "recommended_action": s.recommended_action, "score": s.score,
        "is_actioned": s.is_actioned, "detected_at": s.detected_at.isoformat(),
    }


@signals_router.get("/feed")
async def signals_feed(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    r = await db.execute(
        select(WebSignal).where(WebSignal.user_id == user.id, WebSignal.is_dismissed == False)
        .order_by(WebSignal.score.desc(), WebSignal.detected_at.desc())
    )
    signals = r.scalars().all()
    high_priority = sum(1 for s in signals if s.signal_strength == "high")
    actioned = sum(1 for s in signals if s.is_actioned)
    return {
        "success": True,
        "stats": {
            "total": len(signals),
            "high_priority": high_priority,
            "actioned": actioned,
            "watchlisted_companies": 0,
        },
        "feed": [_signal_dict(s) for s in signals],
    }


@signals_router.get("")
async def list_signals(signal_type: str = Query(None), country: str = Query(None),
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    q = select(WebSignal).where(WebSignal.user_id == user.id, WebSignal.is_dismissed == False)
    if signal_type: q = q.where(WebSignal.signal_type == signal_type)
    if country: q = q.where(WebSignal.country_hint == country)
    r = await db.execute(q.order_by(WebSignal.detected_at.desc()))
    signals = r.scalars().all()
    return {"success": True, "signals": [_signal_dict(s) for s in signals], "total": len(signals)}


@signals_router.post("/seed")
async def seed_signals(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(WebSignal).where(WebSignal.user_id == user.id).limit(1))
    if existing.scalar_one_or_none():
        return {"success": True, "message": "Already seeded.", "count": 0}
    now = datetime.utcnow()
    for i, s in enumerate(DEMO_SIGNALS):
        db.add(WebSignal(user_id=user.id, account_name=s["account_name"], signal_type=s["signal_type"],
            signal_strength=s["signal_strength"], title=s["title"], summary=s["summary"],
            proof_text=s["proof_text"], proof_url=s["proof_url"], country_hint=s["country_hint"],
            recommended_action=s["recommended_action"], score=s["score"],
            detected_at=now - timedelta(days=i)))
    await db.commit()
    return {"success": True, "message": f"Seeded {len(DEMO_SIGNALS)} signals.", "count": len(DEMO_SIGNALS)}


@signals_router.post("/{signal_id}/action")
async def action_signal(signal_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(WebSignal).where(WebSignal.id == signal_id, WebSignal.user_id == user.id))
    s = r.scalar_one_or_none()
    if not s: raise HTTPException(404, "Signal not found")
    s.is_actioned = True
    await db.commit()
    return {"success": True, "message": "Marked as actioned."}


@signals_router.post("/{signal_id}/dismiss")
async def dismiss_signal(signal_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(WebSignal).where(WebSignal.id == signal_id, WebSignal.user_id == user.id))
    s = r.scalar_one_or_none()
    if not s: raise HTTPException(404, "Signal not found")
    s.is_dismissed = True
    await db.commit()
    return {"success": True, "message": "Dismissed."}
