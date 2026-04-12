"""Signal CRM v2 — Activities API
Unified activity timeline: calls, emails, meetings, notes, demos.
Every touch point logged and accessible.
"""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from typing import Optional
from app.database import get_db
from app.auth import get_current_user
from app.models import User, Activity, Contact

activities_router = APIRouter(prefix="/activities", tags=["Activities"])

TYPES = ["call", "email", "meeting", "note", "linkedin", "whatsapp", "demo", "task"]
DIRECTIONS = ["inbound", "outbound"]
OUTCOMES = [
    "connected", "voicemail", "no_answer", "meeting_booked",
    "demo_done", "replied", "opened", "completed", "",
]


def _fmt(a: Activity) -> dict:
    return {
        "id": a.id, "user_id": a.user_id,
        "contact_id": a.contact_id, "account_id": a.account_id, "deal_id": a.deal_id,
        "type": a.type, "direction": a.direction,
        "title": a.title, "body": a.body, "outcome": a.outcome,
        "duration_secs": a.duration_secs,
        "scheduled_at": a.scheduled_at.isoformat() if a.scheduled_at else None,
        "completed_at": a.completed_at.isoformat() if a.completed_at else None,
        "created_at": a.created_at.isoformat(),
    }


class CreateActivityReq(BaseModel):
    type: str = "note"; direction: str = "outbound"
    title: str = ""; body: str = ""; outcome: str = ""
    duration_secs: int = 0
    contact_id: Optional[str] = None; account_id: Optional[str] = None; deal_id: Optional[str] = None
    scheduled_at: Optional[str] = None; completed_at: Optional[str] = None


@activities_router.get("")
async def list_activities(
    type: str = Query(""),
    contact_id: str = Query(""),
    deal_id: str = Query(""),
    account_id: str = Query(""),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Activity).where(Activity.user_id == user.id)
    if type:
        stmt = stmt.where(Activity.type == type)
    if contact_id:
        stmt = stmt.where(Activity.contact_id == contact_id)
    if deal_id:
        stmt = stmt.where(Activity.deal_id == deal_id)
    if account_id:
        stmt = stmt.where(Activity.account_id == account_id)

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar_one()

    stmt = stmt.order_by(Activity.created_at.desc()).limit(limit).offset(offset)
    rows = (await db.execute(stmt)).scalars().all()

    # Type breakdown
    type_r = await db.execute(
        select(Activity.type, func.count(Activity.id))
        .where(Activity.user_id == user.id).group_by(Activity.type)
    )
    type_counts = {t: c for t, c in type_r.all()}

    return {
        "success": True, "activities": [_fmt(a) for a in rows],
        "total": total, "limit": limit, "offset": offset,
        "type_counts": type_counts,
    }


@activities_router.post("")
async def log_activity(
    req: CreateActivityReq,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if req.type not in TYPES:
        raise HTTPException(400, f"Invalid type: {TYPES}")

    act = Activity(
        user_id=user.id, type=req.type, direction=req.direction,
        title=req.title or f"{req.type.title()} logged",
        body=req.body, outcome=req.outcome, duration_secs=req.duration_secs,
        contact_id=req.contact_id, account_id=req.account_id, deal_id=req.deal_id,
        scheduled_at=datetime.fromisoformat(req.scheduled_at) if req.scheduled_at else None,
        completed_at=datetime.fromisoformat(req.completed_at) if req.completed_at else datetime.utcnow(),
    )
    db.add(act)

    # Update contact's last_contacted if linked
    if req.contact_id:
        cr = await db.execute(select(Contact).where(Contact.id == req.contact_id))
        contact = cr.scalar_one_or_none()
        if contact:
            contact.last_contacted = datetime.utcnow()
            contact.updated_at = datetime.utcnow()

    await db.commit()
    await db.refresh(act)
    return {"success": True, "activity": _fmt(act)}


@activities_router.delete("/{activity_id}")
async def delete_activity(
    activity_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(Activity).where(Activity.id == activity_id, Activity.user_id == user.id))
    a = r.scalar_one_or_none()
    if not a:
        raise HTTPException(404, "Activity not found")
    await db.delete(a)
    await db.commit()
    return {"success": True, "message": "Activity deleted."}
