"""Signal CRM — Web Signal Management + Demo Seeder (Supabase)"""
from datetime import datetime, timedelta
import random
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from app.auth import get_current_user
from app.supabase_client import get_supabase

signals_router = APIRouter(prefix="/signals", tags=["Signals"])

DEMO_SIGNALS = [
    {"account_name": "Freshworks", "signal_type": "hiring_spike", "signal_strength": "high",
     "title": "Freshworks hiring 45+ enterprise sales roles in DACH region",
     "summary": "Freshworks posted 45 new enterprise sales roles in Germany, Austria, Switzerland in 30 days — a 3x spike vs prior quarter.",
     "proof_text": "Job posting: 'Enterprise Account Executive - DACH' | Munich, Germany | Posted: 3 days ago | 12 similar roles active",
     "proof_url": "https://careers.freshworks.com/jobs/enterprise-sales-dach", "country_hint": "Germany",
     "recommended_action": "Contact VP Sales DACH. They are staffing up fast — likely in pre-launch mode for DACH push.", "score": 9},
    {"account_name": "Razorpay", "signal_type": "new_country_page", "signal_strength": "high",
     "title": "Razorpay launches new /malaysia page with local payment rail content",
     "summary": "Razorpay quietly added a Malaysia-specific landing page listing FPX, DuitNow, and GrabPay integrations.",
     "proof_text": "Page title: 'Accept Payments in Malaysia | Razorpay' | First indexed: 5 days ago",
     "proof_url": "https://razorpay.com/malaysia", "country_hint": "Malaysia",
     "recommended_action": "Razorpay entering Malaysia needs local banking partners and compliance support. Reach out this week.", "score": 8},
    {"account_name": "Deel", "signal_type": "pricing_change", "signal_strength": "high",
     "title": "Deel raises EOR pricing for India market by 18%",
     "summary": "Deel updated India Employer-of-Record pricing from $499/mo to $589/mo. Creates opening for competitors.",
     "proof_text": "India EOR | Old: $499/month | New: $589/month | Change detected: 4 days ago",
     "proof_url": "https://www.deel.com/pricing", "country_hint": "India",
     "recommended_action": "18% price hike creates retention risk. Target Deel India EOR customers with price comparison.", "score": 9},
    {"account_name": "Zoho", "signal_type": "new_product", "signal_strength": "medium",
     "title": "Zoho launches Finance Plus bundle targeting UK SME accountants",
     "summary": "Zoho launched UK-specific Finance Plus bundle with MTD compliance built-in. Released 8 days ago.",
     "proof_text": "Product page: 'Zoho Finance Plus for UK Businesses' | Pricing: £25/month",
     "proof_url": "https://www.zoho.com/finance/uk/", "country_hint": "UK",
     "recommended_action": "Zoho entering UK SME accounting creates channel partner opportunities for implementation.", "score": 7},
    {"account_name": "Stripe", "signal_type": "compliance_update", "signal_strength": "high",
     "title": "Stripe updates KYC requirements for Indian merchants — PAN + GSTIN now mandatory",
     "summary": "Stripe India updated merchant verification: PAN and GSTIN now required for all merchants by Q2 2026.",
     "proof_text": "Stripe India Help: 'Updated verification requirements for Indian businesses' | Updated: 6 days ago",
     "proof_url": "https://support.stripe.com/in/topics/verification", "country_hint": "India",
     "recommended_action": "Non-compliant Stripe India merchants face payout holds. Offer compliance advisory services.", "score": 8},
    {"account_name": "Shopify", "signal_type": "hiring_spike", "signal_strength": "medium",
     "title": "Shopify hiring 20+ Partnership Managers across Southeast Asia",
     "summary": "Shopify posted 20 new partnership and channel sales roles across Singapore, Malaysia, Indonesia, Thailand.",
     "proof_text": "20 roles in 3 weeks: 'Partnerships Manager - SEA' across Singapore, KL, Jakarta, Bangkok",
     "proof_url": "https://careers.shopify.com/search?q=partnerships+manager+southeast+asia", "country_hint": "Singapore",
     "recommended_action": "Shopify building SEA partner network. Get in now as a certified Shopify Plus partner before slots fill.", "score": 7},
    {"account_name": "Remote.com", "signal_type": "partner_page", "signal_strength": "medium",
     "title": "Remote.com adds new 'Integration Partners' section featuring 12 new HR tools",
     "summary": "Remote.com launched an Integration Partners hub featuring 12 new HR, payroll, and finance integrations.",
     "proof_text": "New page: remote.com/integrations | 12 new partners listed | Last updated: 7 days ago",
     "proof_url": "https://remote.com/integrations", "country_hint": "Netherlands",
     "recommended_action": "Remote.com expanding partner ecosystem. Apply as integration partner — new partner slots available.", "score": 6},
    {"account_name": "Infosys", "signal_type": "leadership_change", "signal_strength": "medium",
     "title": "Infosys appoints new Chief Revenue Officer for Europe region",
     "summary": "Infosys announced appointment of new CRO for Europe, coming from IBM. Signals strategic shift in European GTM.",
     "proof_text": "Press release: 'Infosys Announces New Chief Revenue Officer — Europe' | Published: 10 days ago",
     "proof_url": "https://www.infosys.com/newsroom/press-releases/2026/new-cro-europe.html", "country_hint": "Germany",
     "recommended_action": "New CRO at Infosys Europe means new strategic priorities. First 90 days are window for new vendor conversations.", "score": 7},
]


class DismissSignalReq(BaseModel):
    signal_id: str


class ActionSignalReq(BaseModel):
    signal_id: str
    action_note: str = ""


@signals_router.get("")
def list_signals(
    signal_type: str = Query(None),
    country: str = Query(None),
    dismissed: bool = Query(False),
    user: dict = Depends(get_current_user),
):
    sb = get_supabase()
    q = sb.table("web_signals").select("*").eq("user_id", user["id"])
    if not dismissed:
        q = q.eq("is_dismissed", False)
    if signal_type:
        q = q.eq("signal_type", signal_type)
    if country:
        q = q.eq("country_hint", country)
    result = q.order("detected_at", desc=True).execute()
    return {"success": True, "signals": result.data or [], "total": len(result.data or [])}


@signals_router.post("/seed")
def seed_signals(user: dict = Depends(get_current_user)):
    sb = get_supabase()
    # Check if already seeded
    existing = sb.table("web_signals").select("id").eq("user_id", user["id"]).limit(1).execute()
    if existing.data:
        return {"success": True, "message": "Signals already seeded.", "count": 0}

    now = datetime.utcnow()
    rows = []
    for i, s in enumerate(DEMO_SIGNALS):
        rows.append({
            "user_id": user["id"],
            "account_name": s["account_name"],
            "signal_type": s["signal_type"],
            "signal_strength": s.get("signal_strength", "medium"),
            "title": s["title"],
            "summary": s["summary"],
            "proof_text": s.get("proof_text", ""),
            "proof_url": s.get("proof_url", ""),
            "country_hint": s.get("country_hint", ""),
            "recommended_action": s.get("recommended_action", ""),
            "score": s.get("score", 5),
            "is_actioned": False,
            "is_dismissed": False,
            "detected_at": (now - timedelta(days=i)).isoformat(),
        })
    sb.table("web_signals").insert(rows).execute()
    return {"success": True, "message": f"Seeded {len(rows)} demo signals.", "count": len(rows)}


@signals_router.post("/{signal_id}/action")
def action_signal(signal_id: str, user: dict = Depends(get_current_user)):
    sb = get_supabase()
    existing = sb.table("web_signals").select("id").eq("id", signal_id).eq("user_id", user["id"]).execute()
    if not existing.data:
        raise HTTPException(404, "Signal not found")
    sb.table("web_signals").update({"is_actioned": True}).eq("id", signal_id).execute()
    return {"success": True, "message": "Signal marked as actioned."}


@signals_router.post("/{signal_id}/dismiss")
def dismiss_signal(signal_id: str, user: dict = Depends(get_current_user)):
    sb = get_supabase()
    existing = sb.table("web_signals").select("id").eq("id", signal_id).eq("user_id", user["id"]).execute()
    if not existing.data:
        raise HTTPException(404, "Signal not found")
    sb.table("web_signals").update({"is_dismissed": True}).eq("id", signal_id).execute()
    return {"success": True, "message": "Signal dismissed."}
