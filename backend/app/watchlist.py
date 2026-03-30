"""Signal CRM — Watchlist"""
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from app.database import get_db
from app.auth import get_current_user
from app.models import User, WatchlistAccount, WebSignal

watchlist_router = APIRouter(prefix="/watchlist", tags=["Watchlist"])


class AddAccountReq(BaseModel):
    company_name: str; domain: str; industry: str = ""; country: str = ""; hq_country: str = ""
    employee_size: str = ""; priority: str = "medium"; watch_hiring: bool = True
    watch_pricing: bool = True; watch_compliance: bool = True
    watch_leadership: bool = True; watch_expansion: bool = True; notes: str = ""


class UpdateAccountReq(BaseModel):
    company_name: Optional[str] = None; domain: Optional[str] = None; industry: Optional[str] = None
    country: Optional[str] = None; hq_country: Optional[str] = None; employee_size: Optional[str] = None
    priority: Optional[str] = None; watch_hiring: Optional[bool] = None; watch_pricing: Optional[bool] = None
    watch_compliance: Optional[bool] = None; watch_leadership: Optional[bool] = None
    watch_expansion: Optional[bool] = None; notes: Optional[str] = None


@watchlist_router.get("")
async def list_accounts(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(WatchlistAccount).where(WatchlistAccount.user_id == user.id).order_by(WatchlistAccount.created_at.desc()))
    accounts = result.scalars().all()
    return {"success": True, "accounts": [
        {"id": a.id, "company_name": a.company_name, "domain": a.domain, "industry": a.industry,
         "country": a.country, "priority": a.priority, "notes": a.notes,
         "watch_hiring": a.watch_hiring, "watch_pricing": a.watch_pricing,
         "created_at": a.created_at.isoformat()} for a in accounts
    ], "total": len(accounts)}


@watchlist_router.post("")
async def add_account(req: AddAccountReq, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    domain = req.domain.lower().strip()
    existing = await db.execute(select(WatchlistAccount).where(WatchlistAccount.user_id == user.id, WatchlistAccount.domain == domain))
    if existing.scalar_one_or_none():
        raise HTTPException(400, f"'{domain}' is already in your watchlist")
    acc = WatchlistAccount(user_id=user.id, company_name=req.company_name.strip(), domain=domain,
        industry=req.industry, country=req.country, hq_country=req.hq_country,
        employee_size=req.employee_size, priority=req.priority, watch_hiring=req.watch_hiring,
        watch_pricing=req.watch_pricing, watch_compliance=req.watch_compliance,
        watch_leadership=req.watch_leadership, watch_expansion=req.watch_expansion,
        notes=req.notes, last_checked=datetime.utcnow())
    db.add(acc)
    await db.commit()
    await db.refresh(acc)
    return {"success": True, "account": {"id": acc.id, "company_name": acc.company_name, "domain": acc.domain}, "message": f"'{acc.company_name}' added."}


@watchlist_router.put("/{account_id}")
async def update_account(account_id: str, req: UpdateAccountReq, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(WatchlistAccount).where(WatchlistAccount.id == account_id, WatchlistAccount.user_id == user.id))
    acc = r.scalar_one_or_none()
    if not acc: raise HTTPException(404, "Account not found")
    for k, v in req.model_dump(exclude_none=True).items(): setattr(acc, k, v)
    await db.commit()
    return {"success": True, "message": "Updated."}


@watchlist_router.delete("/{account_id}")
async def delete_account(account_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(WatchlistAccount).where(WatchlistAccount.id == account_id, WatchlistAccount.user_id == user.id))
    acc = r.scalar_one_or_none()
    if not acc: raise HTTPException(404, "Account not found")
    await db.delete(acc)
    await db.commit()
    return {"success": True, "message": f"'{acc.company_name}' removed."}
