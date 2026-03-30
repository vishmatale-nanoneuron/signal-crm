"""Signal CRM — Deal Pipeline (Supabase)"""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.auth import get_current_user
from app.supabase_client import get_supabase

deals_router = APIRouter(prefix="/deals", tags=["Deals"])

STAGES = ["signal", "qualified", "proposal", "negotiation", "won", "lost"]
STAGE_PROBABILITY = {"signal": 10, "qualified": 25, "proposal": 50, "negotiation": 75, "won": 100, "lost": 0}


class CreateDealReq(BaseModel):
    title: str
    company_name: str = ""
    contact_name: str = ""
    contact_title: str = ""
    value: float = 0
    currency: str = "INR"
    stage: str = "signal"
    country: str = ""
    industry: str = ""
    signal_trigger: str = ""
    next_action: str = ""
    close_date: str = ""
    notes: str = ""


class UpdateDealReq(BaseModel):
    title: Optional[str] = None
    company_name: Optional[str] = None
    contact_name: Optional[str] = None
    contact_title: Optional[str] = None
    value: Optional[float] = None
    currency: Optional[str] = None
    stage: Optional[str] = None
    country: Optional[str] = None
    industry: Optional[str] = None
    signal_trigger: Optional[str] = None
    compliance_checked: Optional[bool] = None
    next_action: Optional[str] = None
    probability: Optional[int] = None
    close_date: Optional[str] = None
    notes: Optional[str] = None


@deals_router.get("")
def list_deals(user: dict = Depends(get_current_user)):
    sb = get_supabase()
    result = sb.table("deals").select("*").eq("user_id", user["id"]).order("updated_at", desc=True).execute()
    return {"success": True, "deals": result.data or [], "total": len(result.data or [])}


@deals_router.get("/pipeline")
def pipeline_summary(user: dict = Depends(get_current_user)):
    sb = get_supabase()
    result = sb.table("deals").select("*").eq("user_id", user["id"]).execute()
    deals = result.data or []
    stages = {}
    for stage in STAGES:
        stage_deals = [d for d in deals if d.get("stage") == stage]
        stages[stage] = {"count": len(stage_deals), "value": sum(d.get("value", 0) or 0 for d in stage_deals), "deals": stage_deals}
    total_value = sum(d.get("value", 0) or 0 for d in deals if d.get("stage") not in ["lost"])
    won_value = sum(d.get("value", 0) or 0 for d in deals if d.get("stage") == "won")
    return {
        "success": True, "pipeline": stages,
        "summary": {"total_deals": len(deals), "total_pipeline_value": total_value, "won_value": won_value,
                    "active_deals": len([d for d in deals if d.get("stage") not in ["won", "lost"]])},
    }


@deals_router.post("")
def create_deal(req: CreateDealReq, user: dict = Depends(get_current_user)):
    if req.stage not in STAGES:
        raise HTTPException(400, f"Invalid stage. Must be one of: {STAGES}")
    sb = get_supabase()
    row = {
        "user_id": user["id"], "title": req.title, "company_name": req.company_name,
        "contact_name": req.contact_name, "contact_title": req.contact_title,
        "value": req.value, "currency": req.currency, "stage": req.stage,
        "country": req.country, "industry": req.industry, "signal_trigger": req.signal_trigger,
        "next_action": req.next_action, "probability": STAGE_PROBABILITY.get(req.stage, 10),
        "close_date": req.close_date, "notes": req.notes, "compliance_checked": False,
        "updated_at": datetime.utcnow().isoformat(),
    }
    result = sb.table("deals").insert(row).execute()
    return {"success": True, "deal": result.data[0]}


@deals_router.put("/{deal_id}")
def update_deal(deal_id: str, req: UpdateDealReq, user: dict = Depends(get_current_user)):
    sb = get_supabase()
    existing = sb.table("deals").select("id,stage,probability").eq("id", deal_id).eq("user_id", user["id"]).execute()
    if not existing.data:
        raise HTTPException(404, "Deal not found")
    updates = {k: v for k, v in req.model_dump(exclude_none=True).items()}
    if req.stage and req.stage in STAGES and req.probability is None:
        updates["probability"] = STAGE_PROBABILITY.get(req.stage, existing.data[0].get("probability", 10))
    updates["updated_at"] = datetime.utcnow().isoformat()
    result = sb.table("deals").update(updates).eq("id", deal_id).eq("user_id", user["id"]).execute()
    return {"success": True, "deal": result.data[0]}


@deals_router.delete("/{deal_id}")
def delete_deal(deal_id: str, user: dict = Depends(get_current_user)):
    sb = get_supabase()
    existing = sb.table("deals").select("id").eq("id", deal_id).eq("user_id", user["id"]).execute()
    if not existing.data:
        raise HTTPException(404, "Deal not found")
    sb.table("deals").delete().eq("id", deal_id).eq("user_id", user["id"]).execute()
    return {"success": True, "message": "Deal deleted."}


@deals_router.post("/{deal_id}/move")
def move_deal(deal_id: str, user: dict = Depends(get_current_user)):
    sb = get_supabase()
    existing = sb.table("deals").select("*").eq("id", deal_id).eq("user_id", user["id"]).maybe_single().execute()
    if not existing.data:
        raise HTTPException(404, "Deal not found")
    deal = existing.data
    stage = deal.get("stage", "signal")
    idx = STAGES.index(stage) if stage in STAGES else 0
    if idx >= len(STAGES) - 1:
        raise HTTPException(400, "Deal is already at the final stage.")
    new_stage = STAGES[idx + 1]
    result = sb.table("deals").update({
        "stage": new_stage, "probability": STAGE_PROBABILITY.get(new_stage, 10),
        "updated_at": datetime.utcnow().isoformat(),
    }).eq("id", deal_id).eq("user_id", user["id"]).execute()
    return {"success": True, "deal": result.data[0], "message": f"Deal moved to '{new_stage}'."}
