"""Signal CRM v2 — Pipelines API
Multi-pipeline support with custom stages, probabilities, colors.
Visual kanban data endpoint for frontend rendering.
"""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from typing import Optional, List
from app.database import get_db
from app.auth import get_current_user
from app.models import User, Pipeline, PipelineStage, Deal

pipelines_router = APIRouter(prefix="/pipelines", tags=["Pipelines"])

# Default stage definitions for a new pipeline
DEFAULT_STAGES = [
    {"name": "Signal",       "order_num": 0, "probability": 10,  "color": "#6366f1"},
    {"name": "Qualified",    "order_num": 1, "probability": 25,  "color": "#8b5cf6"},
    {"name": "Demo",         "order_num": 2, "probability": 40,  "color": "#a855f7"},
    {"name": "Proposal",     "order_num": 3, "probability": 60,  "color": "#00F0FF"},
    {"name": "Negotiation",  "order_num": 4, "probability": 80,  "color": "#00FF94"},
    {"name": "Closed Won",   "order_num": 5, "probability": 100, "color": "#22c55e"},
    {"name": "Closed Lost",  "order_num": 6, "probability": 0,   "color": "#ef4444"},
]


def _fmt_pipeline(p: Pipeline, stages: list) -> dict:
    return {
        "id": p.id, "name": p.name, "currency": p.currency,
        "is_default": p.is_default, "created_at": p.created_at.isoformat(),
        "stages": [
            {"id": s.id, "name": s.name, "order_num": s.order_num,
             "probability": s.probability, "color": s.color}
            for s in sorted(stages, key=lambda x: x.order_num)
        ],
    }


class CreatePipelineReq(BaseModel):
    name: str; currency: str = "INR"; is_default: bool = False


class CreateStageReq(BaseModel):
    name: str; order_num: int = 0; probability: int = 50; color: str = "#6366f1"


class UpdateStageReq(BaseModel):
    name: Optional[str] = None; order_num: Optional[int] = None
    probability: Optional[int] = None; color: Optional[str] = None


@pipelines_router.get("")
async def list_pipelines(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(Pipeline).where(Pipeline.user_id == user.id).order_by(Pipeline.is_default.desc()))
    pipelines = r.scalars().all()

    # If no pipelines, auto-create a default one
    if not pipelines:
        p = Pipeline(user_id=user.id, name="Sales Pipeline", currency="INR", is_default=True)
        db.add(p)
        await db.flush()
        for sd in DEFAULT_STAGES:
            db.add(PipelineStage(pipeline_id=p.id, **sd))
        await db.commit()
        await db.refresh(p)
        pipelines = [p]

    result = []
    for p in pipelines:
        sr = await db.execute(select(PipelineStage).where(PipelineStage.pipeline_id == p.id))
        stages = sr.scalars().all()
        result.append(_fmt_pipeline(p, stages))

    return {"success": True, "pipelines": result}


@pipelines_router.get("/{pipeline_id}/kanban")
async def kanban_view(
    pipeline_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Kanban board: deals grouped by stage with value rollups."""
    pr = await db.execute(select(Pipeline).where(Pipeline.id == pipeline_id, Pipeline.user_id == user.id))
    p = pr.scalar_one_or_none()
    if not p:
        raise HTTPException(404, "Pipeline not found")

    sr = await db.execute(
        select(PipelineStage).where(PipelineStage.pipeline_id == pipeline_id).order_by(PipelineStage.order_num)
    )
    stages = sr.scalars().all()

    deals_r = await db.execute(select(Deal).where(Deal.user_id == user.id))
    all_deals = deals_r.scalars().all()

    # Map deals to stages by name (case-insensitive)
    stage_names_lower = {s.name.lower(): s for s in stages}
    kanban = {}
    for s in stages:
        kanban[s.id] = {
            "stage_id": s.id, "name": s.name, "probability": s.probability,
            "color": s.color, "order_num": s.order_num,
            "deals": [], "count": 0, "value": 0,
        }

    # Also include deals from the legacy stage field
    ungrouped = []
    for d in all_deals:
        matched = stage_names_lower.get(d.stage.lower())
        if matched:
            kanban[matched.id]["deals"].append({
                "id": d.id, "title": d.title, "company_name": d.company_name,
                "contact_name": d.contact_name, "value": d.value, "currency": d.currency,
                "country": d.country, "probability": d.probability,
                "close_date": d.close_date, "signal_trigger": d.signal_trigger,
                "updated_at": d.updated_at.isoformat(),
            })
            kanban[matched.id]["count"] += 1
            kanban[matched.id]["value"] += d.value
        else:
            ungrouped.append(d)

    total_value   = sum(d.value for d in all_deals if d.stage.lower() not in ["closed lost", "lost"])
    won_value     = sum(d.value for d in all_deals if d.stage.lower() in ["closed won", "won"])
    weighted_value = sum(
        d.value * (d.probability / 100)
        for d in all_deals if d.stage.lower() not in ["closed lost", "lost"]
    )

    return {
        "success": True,
        "pipeline": {"id": p.id, "name": p.name, "currency": p.currency},
        "columns": list(kanban.values()),
        "summary": {
            "total_deals": len(all_deals),
            "total_pipeline_value": total_value,
            "won_value": won_value,
            "weighted_forecast": round(weighted_value, 2),
            "active_deals": len([d for d in all_deals if d.stage.lower() not in ["closed won", "won", "closed lost", "lost"]]),
        },
    }


@pipelines_router.post("")
async def create_pipeline(
    req: CreatePipelineReq,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if req.is_default:
        # Unset other defaults
        existing = (await db.execute(select(Pipeline).where(Pipeline.user_id == user.id, Pipeline.is_default == True))).scalars().all()
        for ep in existing:
            ep.is_default = False

    p = Pipeline(user_id=user.id, name=req.name, currency=req.currency, is_default=req.is_default)
    db.add(p)
    await db.flush()
    for sd in DEFAULT_STAGES:
        db.add(PipelineStage(pipeline_id=p.id, **sd))
    await db.commit()
    await db.refresh(p)

    sr = await db.execute(select(PipelineStage).where(PipelineStage.pipeline_id == p.id))
    stages = sr.scalars().all()
    return {"success": True, "pipeline": _fmt_pipeline(p, stages)}


@pipelines_router.post("/{pipeline_id}/stages")
async def add_stage(
    pipeline_id: str, req: CreateStageReq,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    pr = await db.execute(select(Pipeline).where(Pipeline.id == pipeline_id, Pipeline.user_id == user.id))
    if not pr.scalar_one_or_none():
        raise HTTPException(404, "Pipeline not found")
    s = PipelineStage(pipeline_id=pipeline_id, name=req.name, order_num=req.order_num,
                      probability=req.probability, color=req.color)
    db.add(s)
    await db.commit()
    await db.refresh(s)
    return {"success": True, "stage": {"id": s.id, "name": s.name, "order_num": s.order_num,
                                        "probability": s.probability, "color": s.color}}


@pipelines_router.put("/{pipeline_id}/stages/{stage_id}")
async def update_stage(
    pipeline_id: str, stage_id: str, req: UpdateStageReq,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    pr = await db.execute(select(Pipeline).where(Pipeline.id == pipeline_id, Pipeline.user_id == user.id))
    if not pr.scalar_one_or_none():
        raise HTTPException(404, "Pipeline not found")
    sr = await db.execute(select(PipelineStage).where(PipelineStage.id == stage_id, PipelineStage.pipeline_id == pipeline_id))
    s = sr.scalar_one_or_none()
    if not s:
        raise HTTPException(404, "Stage not found")
    for k, v in req.model_dump(exclude_none=True).items():
        setattr(s, k, v)
    await db.commit()
    return {"success": True}


@pipelines_router.delete("/{pipeline_id}")
async def delete_pipeline(
    pipeline_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    pr = await db.execute(select(Pipeline).where(Pipeline.id == pipeline_id, Pipeline.user_id == user.id))
    p = pr.scalar_one_or_none()
    if not p:
        raise HTTPException(404, "Pipeline not found")
    if p.is_default:
        raise HTTPException(400, "Cannot delete the default pipeline.")
    await db.delete(p)
    await db.commit()
    return {"success": True, "message": "Pipeline deleted."}
