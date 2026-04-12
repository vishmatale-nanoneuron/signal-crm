"""Signal CRM v2 — Notifications API
In-app notification feed: signals, task reminders, deal moves,
and AI-generated insights. Mark as read, bulk-clear.
"""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update
from app.database import get_db
from app.auth import get_current_user
from app.models import User, Notification

notifications_router = APIRouter(prefix="/notifications", tags=["Notifications"])


def _fmt(n: Notification) -> dict:
    return {
        "id": n.id, "type": n.type, "title": n.title, "body": n.body,
        "entity_type": n.entity_type, "entity_id": n.entity_id,
        "is_read": n.is_read, "created_at": n.created_at.isoformat(),
    }


@notifications_router.get("")
async def list_notifications(
    unread_only: bool = Query(False),
    limit: int = Query(30, le=100),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Notification).where(Notification.user_id == user.id)
    if unread_only:
        stmt = stmt.where(Notification.is_read == False)
    stmt = stmt.order_by(Notification.created_at.desc()).limit(limit)
    rows = (await db.execute(stmt)).scalars().all()

    unread_count_r = await db.execute(
        select(func.count(Notification.id))
        .where(Notification.user_id == user.id, Notification.is_read == False)
    )
    unread_count = unread_count_r.scalar_one()

    return {
        "success": True,
        "notifications": [_fmt(n) for n in rows],
        "unread_count": unread_count,
    }


@notifications_router.post("/{notif_id}/read")
async def mark_read(
    notif_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(Notification).where(Notification.id == notif_id, Notification.user_id == user.id))
    n = r.scalar_one_or_none()
    if not n:
        raise HTTPException(404, "Notification not found")
    n.is_read = True
    await db.commit()
    return {"success": True}


@notifications_router.post("/read-all")
async def mark_all_read(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await db.execute(
        update(Notification)
        .where(Notification.user_id == user.id, Notification.is_read == False)
        .values(is_read=True)
    )
    await db.commit()
    return {"success": True, "message": "All notifications marked as read."}


@notifications_router.delete("/{notif_id}")
async def delete_notification(
    notif_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(Notification).where(Notification.id == notif_id, Notification.user_id == user.id))
    n = r.scalar_one_or_none()
    if not n:
        raise HTTPException(404, "Notification not found")
    await db.delete(n)
    await db.commit()
    return {"success": True}
