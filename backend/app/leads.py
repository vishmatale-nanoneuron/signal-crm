"""Signal CRM — Lead Discovery Engine (Supabase)"""
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from app.auth import get_current_user
from app.supabase_client import get_supabase

leads_router = APIRouter(prefix="/leads", tags=["Leads"])

# Curated lead directory by country + industry
LEAD_DIRECTORY = {
    "India": {
        "SaaS": [
            {"company": "Chargebee", "contact_name": "Krish Subramanian", "title": "CEO", "country": "India", "industry": "SaaS", "source": "directory"},
            {"company": "Postman", "contact_name": "Abhinav Asthana", "title": "CEO", "country": "India", "industry": "SaaS", "source": "directory"},
            {"company": "MoEngage", "contact_name": "Raviteja Dodda", "title": "CEO", "country": "India", "industry": "SaaS", "source": "directory"},
            {"company": "BrowserStack", "contact_name": "Ritesh Arora", "title": "CEO", "country": "India", "industry": "SaaS", "source": "directory"},
            {"company": "Clevertap", "contact_name": "Sunil Thomas", "title": "Co-founder", "country": "India", "industry": "SaaS", "source": "directory"},
        ],
        "Fintech": [
            {"company": "Zerodha", "contact_name": "Nithin Kamath", "title": "CEO", "country": "India", "industry": "Fintech", "source": "directory"},
            {"company": "CRED", "contact_name": "Kunal Shah", "title": "CEO", "country": "India", "industry": "Fintech", "source": "directory"},
            {"company": "Groww", "contact_name": "Lalit Keshre", "title": "CEO", "country": "India", "industry": "Fintech", "source": "directory"},
            {"company": "PhonePe", "contact_name": "Sameer Nigam", "title": "CEO", "country": "India", "industry": "Fintech", "source": "directory"},
        ],
        "IT Services": [
            {"company": "Infosys", "contact_name": "Salil Parekh", "title": "CEO", "country": "India", "industry": "IT Services", "source": "directory"},
            {"company": "Wipro", "contact_name": "Thierry Delaporte", "title": "CEO", "country": "India", "industry": "IT Services", "source": "directory"},
            {"company": "HCLTech", "contact_name": "C Vijayakumar", "title": "CEO", "country": "India", "industry": "IT Services", "source": "directory"},
        ],
    },
    "USA": {
        "SaaS": [
            {"company": "Salesforce", "contact_name": "Marc Benioff", "title": "CEO", "country": "USA", "industry": "SaaS", "source": "directory"},
            {"company": "HubSpot", "contact_name": "Yamini Rangan", "title": "CEO", "country": "USA", "industry": "SaaS", "source": "directory"},
            {"company": "Zendesk", "contact_name": "Tom Eggemeier", "title": "CEO", "country": "USA", "industry": "SaaS", "source": "directory"},
            {"company": "Twilio", "contact_name": "Khozema Shipchandler", "title": "CEO", "country": "USA", "industry": "SaaS", "source": "directory"},
        ],
        "Fintech": [
            {"company": "Stripe", "contact_name": "Patrick Collison", "title": "CEO", "country": "USA", "industry": "Fintech", "source": "directory"},
            {"company": "Plaid", "contact_name": "Zach Perret", "title": "CEO", "country": "USA", "industry": "Fintech", "source": "directory"},
            {"company": "Brex", "contact_name": "Henrique Dubugras", "title": "CEO", "country": "USA", "industry": "Fintech", "source": "directory"},
        ],
        "Logistics": [
            {"company": "Flexport", "contact_name": "Ryan Petersen", "title": "CEO", "country": "USA", "industry": "Logistics", "source": "directory"},
            {"company": "Project44", "contact_name": "Jett McCandless", "title": "CEO", "country": "USA", "industry": "Logistics", "source": "directory"},
        ],
    },
    "Germany": {
        "SaaS": [
            {"company": "SAP", "contact_name": "Christian Klein", "title": "CEO", "country": "Germany", "industry": "SaaS", "source": "directory"},
            {"company": "TeamViewer", "contact_name": "Oliver Steil", "title": "CEO", "country": "Germany", "industry": "SaaS", "source": "directory"},
            {"company": "Personio", "contact_name": "Hanno Renner", "title": "CEO", "country": "Germany", "industry": "SaaS", "source": "directory"},
        ],
        "Manufacturing": [
            {"company": "Siemens", "contact_name": "Roland Busch", "title": "CEO", "country": "Germany", "industry": "Manufacturing", "source": "directory"},
            {"company": "Bosch", "contact_name": "Stefan Hartung", "title": "CEO", "country": "Germany", "industry": "Manufacturing", "source": "directory"},
        ],
    },
    "UK": {
        "SaaS": [
            {"company": "Revolut", "contact_name": "Nik Storonsky", "title": "CEO", "country": "UK", "industry": "Fintech", "source": "directory"},
            {"company": "Monzo", "contact_name": "TS Anil", "title": "CEO", "country": "UK", "industry": "Fintech", "source": "directory"},
            {"company": "Deliveroo", "contact_name": "Will Shu", "title": "CEO", "country": "UK", "industry": "SaaS", "source": "directory"},
        ],
    },
    "Singapore": {
        "SaaS": [
            {"company": "Sea Limited", "contact_name": "Forrest Li", "title": "CEO", "country": "Singapore", "industry": "SaaS", "source": "directory"},
            {"company": "Grab", "contact_name": "Anthony Tan", "title": "CEO", "country": "Singapore", "industry": "SaaS", "source": "directory"},
        ],
        "Logistics": [
            {"company": "Ninjavan", "contact_name": "Lai Chang Wen", "title": "CEO", "country": "Singapore", "industry": "Logistics", "source": "directory"},
        ],
    },
    "UAE": {
        "SaaS": [
            {"company": "Careem", "contact_name": "Mudassir Sheikha", "title": "CEO", "country": "UAE", "industry": "SaaS", "source": "directory"},
            {"company": "Noon", "contact_name": "Mohamed Alabbar", "title": "CEO", "country": "UAE", "industry": "SaaS", "source": "directory"},
        ],
    },
}

INDUSTRIES = ["SaaS", "Fintech", "IT Services", "Logistics", "Manufacturing", "HR Tech", "Ecommerce", "Other"]
STATUSES = ["new", "contacted", "replied", "qualified", "converted", "rejected"]


class CreateLeadReq(BaseModel):
    company: str
    contact_name: str = ""
    title: str = ""
    email: str = ""
    phone: str = ""
    country: str
    industry: str = ""
    status: str = "new"
    notes: str = ""


class UpdateLeadReq(BaseModel):
    company: Optional[str] = None
    contact_name: Optional[str] = None
    title: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    country: Optional[str] = None
    industry: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None


@leads_router.get("")
def list_leads(
    country: str = Query(None),
    industry: str = Query(None),
    status: str = Query(None),
    user: dict = Depends(get_current_user),
):
    sb = get_supabase()
    q = sb.table("leads").select("*").eq("user_id", user["id"])
    if country:
        q = q.eq("country", country)
    if industry:
        q = q.eq("industry", industry)
    if status:
        q = q.eq("status", status)
    result = q.order("created_at", desc=True).execute()
    return {"success": True, "leads": result.data or [], "total": len(result.data or [])}


@leads_router.post("")
def create_lead(req: CreateLeadReq, user: dict = Depends(get_current_user)):
    sb = get_supabase()
    row = {
        "user_id": user["id"],
        "company": req.company,
        "contact_name": req.contact_name,
        "title": req.title,
        "email": req.email,
        "phone": req.phone,
        "country": req.country,
        "industry": req.industry,
        "status": req.status,
        "source": "manual",
        "notes": req.notes,
        "score": 5,
    }
    result = sb.table("leads").insert(row).execute()
    return {"success": True, "lead": result.data[0], "message": "Lead added."}


@leads_router.put("/{lead_id}")
def update_lead(lead_id: str, req: UpdateLeadReq, user: dict = Depends(get_current_user)):
    sb = get_supabase()
    existing = sb.table("leads").select("id").eq("id", lead_id).eq("user_id", user["id"]).execute()
    if not existing.data:
        raise HTTPException(404, "Lead not found")
    updates = {k: v for k, v in req.model_dump(exclude_none=True).items()}
    if not updates:
        raise HTTPException(400, "No fields to update")
    result = sb.table("leads").update(updates).eq("id", lead_id).eq("user_id", user["id"]).execute()
    return {"success": True, "lead": result.data[0]}


@leads_router.delete("/{lead_id}")
def delete_lead(lead_id: str, user: dict = Depends(get_current_user)):
    sb = get_supabase()
    existing = sb.table("leads").select("id").eq("id", lead_id).eq("user_id", user["id"]).execute()
    if not existing.data:
        raise HTTPException(404, "Lead not found")
    sb.table("leads").delete().eq("id", lead_id).eq("user_id", user["id"]).execute()
    return {"success": True, "message": "Lead deleted."}


@leads_router.get("/discover")
def discover_leads(
    country: str = Query(...),
    industry: str = Query(None),
    user: dict = Depends(get_current_user),
):
    """Discover leads from curated directory by country and industry."""
    country_data = LEAD_DIRECTORY.get(country, {})
    if not country_data:
        return {"success": True, "leads": [], "message": f"No curated leads for {country} yet.", "available_countries": list(LEAD_DIRECTORY.keys())}

    results = []
    if industry and industry in country_data:
        results = country_data[industry]
    else:
        for ind_leads in country_data.values():
            results.extend(ind_leads)

    return {
        "success": True,
        "leads": results[:20],
        "total": len(results),
        "country": country,
        "industry": industry,
        "note": "These are curated public profiles. Add to your lead list and personalize outreach.",
    }


@leads_router.post("/import-from-signals")
def import_from_signals(user: dict = Depends(get_current_user)):
    """Convert high-signal watchlist accounts into leads."""
    sb = get_supabase()
    signals = sb.table("web_signals").select("*").eq("user_id", user["id"]).eq("signal_strength", "high").eq("is_actioned", False).execute().data or []

    imported = 0
    for s in signals[:10]:
        row = {
            "user_id": user["id"],
            "company": s.get("account_name", ""),
            "country": s.get("country_hint", ""),
            "industry": "",
            "status": "new",
            "source": "signal",
            "notes": f"Signal: {s.get('title', '')}. {s.get('recommended_action', '')}",
            "score": s.get("score", 8),
        }
        sb.table("leads").insert(row).execute()
        imported += 1

    return {"success": True, "imported": imported, "message": f"Imported {imported} leads from high-strength signals."}


@leads_router.get("/stats")
def lead_stats(user: dict = Depends(get_current_user)):
    sb = get_supabase()
    all_leads = sb.table("leads").select("status,country,industry").eq("user_id", user["id"]).execute().data or []
    by_status = {}
    by_country = {}
    by_industry = {}
    for lead in all_leads:
        s = lead.get("status", "new")
        c = lead.get("country", "Unknown")
        i = lead.get("industry", "Other")
        by_status[s] = by_status.get(s, 0) + 1
        by_country[c] = by_country.get(c, 0) + 1
        by_industry[i] = by_industry.get(i, 0) + 1
    return {
        "success": True,
        "total": len(all_leads),
        "by_status": by_status,
        "by_country": dict(sorted(by_country.items(), key=lambda x: x[1], reverse=True)[:10]),
        "by_industry": dict(sorted(by_industry.items(), key=lambda x: x[1], reverse=True)[:10]),
    }
