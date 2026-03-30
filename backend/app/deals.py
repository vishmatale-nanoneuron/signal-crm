"""Signal CRM — Deal Pipeline"""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from typing import Optional
from app.database import get_db
from app.auth import get_current_user
from app.models import User, Deal

deals_router = APIRouter(prefix="/deals", tags=["Deals"])

STAGES = ["signal", "qualified", "proposal", "negotiation", "won", "lost"]
STAGE_PROBABILITY = {"signal": 10, "qualified": 25, "proposal": 50, "negotiation": 75, "won": 100, "lost": 0}


def _fmt(d: Deal) -> dict:
    return {
        "id": str(d.id),
        "title": d.title,
        "company_name": d.company_name,
        "contact_name": d.contact_name,
        "contact_title": d.contact_title,
        "value": d.value,
        "currency": d.currency,
        "stage": d.stage,
        "country": d.country,
        "industry": d.industry,
        "signal_trigger": d.signal_trigger,
        "compliance_checked": d.compliance_checked,
        "next_action": d.next_action,
        "probability": d.probability,
        "close_date": d.close_date,
        "notes": d.notes,
        "created_at": d.created_at.isoformat(),
        "updated_at": d.updated_at.isoformat(),
    }


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
async def list_deals(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Deal).where(Deal.user_id == user.id).order_by(Deal.updated_at.desc())
    )
    deals = result.scalars().all()
    return {"success": True, "deals": [_fmt(d) for d in deals], "total": len(deals)}


@deals_router.get("/pipeline")
async def pipeline_summary(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Deal).where(Deal.user_id == user.id))
    deals = result.scalars().all()
    stages = {}
    for stage in STAGES:
        stage_deals = [d for d in deals if d.stage == stage]
        stages[stage] = {
            "count": len(stage_deals),
            "value": sum(d.value for d in stage_deals),
            "deals": [_fmt(d) for d in stage_deals],
        }
    total_value = sum(d.value for d in deals if d.stage not in ["lost"])
    won_value = sum(d.value for d in deals if d.stage == "won")
    return {
        "success": True,
        "pipeline": stages,
        "summary": {
            "total_deals": len(deals),
            "total_pipeline_value": total_value,
            "won_value": won_value,
            "active_deals": len([d for d in deals if d.stage not in ["won", "lost"]]),
        },
    }


@deals_router.post("")
async def create_deal(req: CreateDealReq, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if req.stage not in STAGES:
        raise HTTPException(400, f"Invalid stage. Must be one of: {STAGES}")
    deal = Deal(
        user_id=user.id,
        title=req.title,
        company_name=req.company_name,
        contact_name=req.contact_name,
        contact_title=req.contact_title,
        value=req.value,
        currency=req.currency,
        stage=req.stage,
        country=req.country,
        industry=req.industry,
        signal_trigger=req.signal_trigger,
        next_action=req.next_action,
        probability=STAGE_PROBABILITY.get(req.stage, 10),
        close_date=req.close_date,
        notes=req.notes,
    )
    db.add(deal)
    await db.commit()
    await db.refresh(deal)
    return {"success": True, "deal": _fmt(deal)}


@deals_router.put("/{deal_id}")
async def update_deal(deal_id: str, req: UpdateDealReq, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Deal).where(Deal.id == deal_id, Deal.user_id == user.id))
    deal = result.scalar_one_or_none()
    if not deal:
        raise HTTPException(404, "Deal not found")
    for field, val in req.model_dump(exclude_none=True).items():
        setattr(deal, field, val)
    if req.stage and req.stage in STAGES and req.probability is None:
        deal.probability = STAGE_PROBABILITY.get(req.stage, deal.probability)
    deal.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(deal)
    return {"success": True, "deal": _fmt(deal)}


@deals_router.delete("/{deal_id}")
async def delete_deal(deal_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Deal).where(Deal.id == deal_id, Deal.user_id == user.id))
    deal = result.scalar_one_or_none()
    if not deal:
        raise HTTPException(404, "Deal not found")
    await db.delete(deal)
    await db.commit()
    return {"success": True, "message": "Deal deleted."}


@deals_router.post("/{deal_id}/move")
async def move_deal(deal_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Deal).where(Deal.id == deal_id, Deal.user_id == user.id))
    deal = result.scalar_one_or_none()
    if not deal:
        raise HTTPException(404, "Deal not found")
    idx = STAGES.index(deal.stage) if deal.stage in STAGES else 0
    if idx >= len(STAGES) - 1:
        raise HTTPException(400, "Deal is already at the final stage.")
    deal.stage = STAGES[idx + 1]
    deal.probability = STAGE_PROBABILITY.get(deal.stage, deal.probability)
    deal.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(deal)
    return {"success": True, "deal": _fmt(deal), "message": f"Deal moved to '{deal.stage}'."}
