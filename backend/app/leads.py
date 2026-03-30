"""Signal CRM — Lead Discovery"""
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from app.database import get_db
from app.auth import get_current_user
from app.models import User, Lead, WebSignal

leads_router = APIRouter(prefix="/leads", tags=["Leads"])

LEAD_DIRECTORY = {
    "India": {"SaaS": [
        {"company":"Chargebee","contact_name":"Krish Subramanian","title":"CEO","country":"India","industry":"SaaS"},
        {"company":"Postman","contact_name":"Abhinav Asthana","title":"CEO","country":"India","industry":"SaaS"},
        {"company":"MoEngage","contact_name":"Raviteja Dodda","title":"CEO","country":"India","industry":"SaaS"},
        {"company":"BrowserStack","contact_name":"Ritesh Arora","title":"CEO","country":"India","industry":"SaaS"},
    ], "Fintech": [
        {"company":"Zerodha","contact_name":"Nithin Kamath","title":"CEO","country":"India","industry":"Fintech"},
        {"company":"CRED","contact_name":"Kunal Shah","title":"CEO","country":"India","industry":"Fintech"},
        {"company":"PhonePe","contact_name":"Sameer Nigam","title":"CEO","country":"India","industry":"Fintech"},
    ], "IT Services": [
        {"company":"Infosys","contact_name":"Salil Parekh","title":"CEO","country":"India","industry":"IT Services"},
        {"company":"Wipro","contact_name":"Thierry Delaporte","title":"CEO","country":"India","industry":"IT Services"},
    ]},
    "USA": {"SaaS": [
        {"company":"HubSpot","contact_name":"Yamini Rangan","title":"CEO","country":"USA","industry":"SaaS"},
        {"company":"Zendesk","contact_name":"Tom Eggemeier","title":"CEO","country":"USA","industry":"SaaS"},
        {"company":"Twilio","contact_name":"Khozema Shipchandler","title":"CEO","country":"USA","industry":"SaaS"},
    ], "Fintech": [
        {"company":"Stripe","contact_name":"Patrick Collison","title":"CEO","country":"USA","industry":"Fintech"},
        {"company":"Plaid","contact_name":"Zach Perret","title":"CEO","country":"USA","industry":"Fintech"},
    ]},
    "Germany": {"SaaS": [
        {"company":"SAP","contact_name":"Christian Klein","title":"CEO","country":"Germany","industry":"SaaS"},
        {"company":"Personio","contact_name":"Hanno Renner","title":"CEO","country":"Germany","industry":"SaaS"},
    ]},
    "UK": {"Fintech": [
        {"company":"Revolut","contact_name":"Nik Storonsky","title":"CEO","country":"UK","industry":"Fintech"},
        {"company":"Monzo","contact_name":"TS Anil","title":"CEO","country":"UK","industry":"Fintech"},
    ]},
    "Singapore": {"SaaS": [
        {"company":"Sea Limited","contact_name":"Forrest Li","title":"CEO","country":"Singapore","industry":"SaaS"},
        {"company":"Grab","contact_name":"Anthony Tan","title":"CEO","country":"Singapore","industry":"SaaS"},
    ]},
    "UAE": {"SaaS": [
        {"company":"Careem","contact_name":"Mudassir Sheikha","title":"CEO","country":"UAE","industry":"SaaS"},
    ]},
}


class CreateLeadReq(BaseModel):
    company: str; contact_name: str = ""; title: str = ""; email: str = ""
    phone: str = ""; country: str; industry: str = ""; status: str = "new"; notes: str = ""


class UpdateLeadReq(BaseModel):
    company: Optional[str] = None; contact_name: Optional[str] = None; title: Optional[str] = None
    email: Optional[str] = None; phone: Optional[str] = None; country: Optional[str] = None
    industry: Optional[str] = None; status: Optional[str] = None; notes: Optional[str] = None


def _fmt(l: Lead):
    return {"id": l.id, "company": l.company, "contact_name": l.contact_name, "title": l.title,
            "email": l.email, "phone": l.phone, "country": l.country, "industry": l.industry,
            "status": l.status, "source": l.source, "score": l.score, "notes": l.notes,
            "created_at": l.created_at.isoformat()}


@leads_router.get("")
async def list_leads(country: str = Query(None), industry: str = Query(None),
    status: str = Query(None), user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    q = select(Lead).where(Lead.user_id == user.id)
    if country: q = q.where(Lead.country == country)
    if industry: q = q.where(Lead.industry == industry)
    if status: q = q.where(Lead.status == status)
    r = await db.execute(q.order_by(Lead.created_at.desc()))
    leads = r.scalars().all()
    return {"success": True, "leads": [_fmt(l) for l in leads], "total": len(leads)}


@leads_router.post("")
async def create_lead(req: CreateLeadReq, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    lead = Lead(user_id=user.id, company=req.company, contact_name=req.contact_name, title=req.title,
        email=req.email, phone=req.phone, country=req.country, industry=req.industry,
        status=req.status, source="manual", notes=req.notes)
    db.add(lead)
    await db.commit()
    await db.refresh(lead)
    return {"success": True, "lead": _fmt(lead)}


@leads_router.put("/{lead_id}")
async def update_lead(lead_id: str, req: UpdateLeadReq, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(Lead).where(Lead.id == lead_id, Lead.user_id == user.id))
    lead = r.scalar_one_or_none()
    if not lead: raise HTTPException(404, "Lead not found")
    for k, v in req.model_dump(exclude_none=True).items(): setattr(lead, k, v)
    await db.commit()
    await db.refresh(lead)
    return {"success": True, "lead": _fmt(lead)}


@leads_router.delete("/{lead_id}")
async def delete_lead(lead_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(Lead).where(Lead.id == lead_id, Lead.user_id == user.id))
    lead = r.scalar_one_or_none()
    if not lead: raise HTTPException(404, "Lead not found")
    await db.delete(lead)
    await db.commit()
    return {"success": True, "message": "Lead deleted."}


@leads_router.get("/discover")
async def discover_leads(country: str = Query(...), industry: str = Query(None),
    user: User = Depends(get_current_user)):
    country_data = LEAD_DIRECTORY.get(country, {})
    if not country_data:
        return {"success": True, "leads": [], "available_countries": list(LEAD_DIRECTORY.keys())}
    results = country_data.get(industry, []) if industry else [l for ls in country_data.values() for l in ls]
    return {"success": True, "leads": results[:20], "total": len(results), "country": country}


@leads_router.post("/import-from-signals")
async def import_from_signals(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(WebSignal).where(WebSignal.user_id == user.id,
        WebSignal.signal_strength == "high", WebSignal.is_actioned == False).limit(10))
    signals = r.scalars().all()
    imported = 0
    for s in signals:
        lead = Lead(user_id=user.id, company=s.account_name, country=s.country_hint or "",
            source="signal", notes=f"Signal: {s.title}. {s.recommended_action}", score=s.score or 8)
        db.add(lead)
        imported += 1
    await db.commit()
    return {"success": True, "imported": imported}


@leads_router.get("/stats")
async def lead_stats(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(Lead).where(Lead.user_id == user.id))
    leads = r.scalars().all()
    by_status = {}
    by_country = {}
    for l in leads:
        by_status[l.status] = by_status.get(l.status, 0) + 1
        by_country[l.country] = by_country.get(l.country, 0) + 1
    return {"success": True, "total": len(leads), "by_status": by_status,
            "by_country": dict(sorted(by_country.items(), key=lambda x: x[1], reverse=True)[:10])}
