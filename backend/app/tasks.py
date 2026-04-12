"""Signal CRM v2 — Tasks API
Follow-up task management with priorities, due dates,
linked contacts/deals/accounts, and smart due-today queries.
"""
from datetime import datetime, date, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from pydantic import BaseModel
from typing import Optional
from app.database import get_db
from app.auth import get_current_user
from app.models import User, Task

tasks_router = APIRouter(prefix="/tasks", tags=["Tasks"])

PRIORITIES = ["low", "medium", "high", "urgent"]
STATUSES   = ["open", "in_progress", "done", "cancelled"]
PRIORITY_ORDER = {"urgent": 0, "high": 1, "medium": 2, "low": 3}


def _fmt(t: Task) -> dict:
    today = date.today()
    is_overdue = bool(t.due_date and t.status not in ["done", "cancelled"] and
                      datetime.strptime(t.due_date, "%Y-%m-%d").date() < today)
    is_today   = bool(t.due_date and
                      datetime.strptime(t.due_date, "%Y-%m-%d").date() == today)
    return {
        "id": t.id,
        "contact_id": t.contact_id, "account_id": t.account_id, "deal_id": t.deal_id,
        "title": t.title, "description": t.description,
        "priority": t.priority, "status": t.status,
        "due_date": t.due_date, "is_overdue": is_overdue, "is_today": is_today,
        "reminder_at": t.reminder_at.isoformat() if t.reminder_at else None,
        "completed_at": t.completed_at.isoformat() if t.completed_at else None,
        "created_at": t.created_at.isoformat(),
        "updated_at": t.updated_at.isoformat(),
    }


class CreateTaskReq(BaseModel):
    title: str; description: str = ""
    priority: str = "medium"; status: str = "open"
    due_date: Optional[str] = None
    contact_id: Optional[str] = None
    account_id: Optional[str] = None
    deal_id: Optional[str] = None


class UpdateTaskReq(BaseModel):
    title: Optional[str] = None; description: Optional[str] = None
    priority: Optional[str] = None; status: Optional[str] = None
    due_date: Optional[str] = None


@tasks_router.get("")
async def list_tasks(
    status: str = Query(""),
    priority: str = Query(""),
    filter: str = Query("", description="today|overdue|upcoming"),
    contact_id: str = Query(""),
    deal_id: str = Query(""),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Task).where(Task.user_id == user.id)
    if status:
        stmt = stmt.where(Task.status == status)
    if priority:
        stmt = stmt.where(Task.priority == priority)
    if contact_id:
        stmt = stmt.where(Task.contact_id == contact_id)
    if deal_id:
        stmt = stmt.where(Task.deal_id == deal_id)

    today_str = date.today().isoformat()
    if filter == "today":
        stmt = stmt.where(Task.due_date == today_str, Task.status.notin_(["done", "cancelled"]))
    elif filter == "overdue":
        stmt = stmt.where(Task.due_date < today_str, Task.status.notin_(["done", "cancelled"]))
    elif filter == "upcoming":
        week_later = (date.today() + timedelta(days=7)).isoformat()
        stmt = stmt.where(Task.due_date.between(today_str, week_later), Task.status.notin_(["done", "cancelled"]))

    rows = (await db.execute(stmt.order_by(Task.due_date.asc().nullslast()))).scalars().all()

    # Priority summary
    open_tasks = [t for t in rows if t.status not in ["done", "cancelled"]]
    overdue    = [t for t in open_tasks if t.due_date and datetime.strptime(t.due_date, "%Y-%m-%d").date() < date.today()]

    return {
        "success": True, "tasks": [_fmt(t) for t in rows],
        "total": len(rows),
        "stats": {
            "open": len(open_tasks),
            "overdue": len(overdue),
            "urgent": len([t for t in open_tasks if t.priority == "urgent"]),
            "due_today": len([t for t in open_tasks if t.due_date == today_str]),
        },
    }


@tasks_router.post("")
async def create_task(
    req: CreateTaskReq,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if req.priority not in PRIORITIES:
        raise HTTPException(400, f"Invalid priority: {PRIORITIES}")
    t = Task(
        user_id=user.id, title=req.title, description=req.description,
        priority=req.priority, status=req.status, due_date=req.due_date,
        contact_id=req.contact_id, account_id=req.account_id, deal_id=req.deal_id,
    )
    db.add(t)
    await db.commit()
    await db.refresh(t)
    return {"success": True, "task": _fmt(t)}


@tasks_router.put("/{task_id}")
async def update_task(
    task_id: str, req: UpdateTaskReq,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(Task).where(Task.id == task_id, Task.user_id == user.id))
    t = r.scalar_one_or_none()
    if not t:
        raise HTTPException(404, "Task not found")
    for k, v in req.model_dump(exclude_none=True).items():
        setattr(t, k, v)
    if req.status == "done" and not t.completed_at:
        t.completed_at = datetime.utcnow()
    t.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(t)
    return {"success": True, "task": _fmt(t)}


@tasks_router.post("/{task_id}/complete")
async def complete_task(
    task_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(Task).where(Task.id == task_id, Task.user_id == user.id))
    t = r.scalar_one_or_none()
    if not t:
        raise HTTPException(404, "Task not found")
    t.status = "done"
    t.completed_at = datetime.utcnow()
    t.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(t)
    return {"success": True, "task": _fmt(t)}


@tasks_router.delete("/{task_id}")
async def delete_task(
    task_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(Task).where(Task.id == task_id, Task.user_id == user.id))
    t = r.scalar_one_or_none()
    if not t:
        raise HTTPException(404, "Task not found")
    await db.delete(t)
    await db.commit()
    return {"success": True, "message": "Task deleted."}
