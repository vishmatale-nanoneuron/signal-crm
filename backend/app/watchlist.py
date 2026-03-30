"""Signal CRM — Watchlist Account Management"""
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
    company_name: str
    domain: str
    industry: str = ""
    country: str = ""
    hq_country: str = ""
    employee_size: str = ""
    priority: str = "medium"
    watch_hiring: bool = True
    watch_pricing: bool = True
    watch_compliance: bool = True
    watch_leadership: bool = True
    watch_expansion: bool = True
    notes: str = ""


class UpdateAccountReq(BaseModel):
    company_name: Optional[str] = None
    domain: Optional[str] = None
    industry: Optional[str] = None
    country: Optional[str] = None
    hq_country: Optional[str] = None
    employee_size: Optional[str] = None
    priority: Optional[str] = None
    watch_hiring: Optional[bool] = None
    watch_pricing: Optional[bool] = None
    watch_compliance: Optional[bool] = None
    watch_leadership: Optional[bool] = None
    watch_expansion: Optional[bool] = None
    notes: Optional[str] = None


@watchlist_router.get("")
async def list_accounts(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(WatchlistAccount)
        .where(WatchlistAccount.user_id == user.id)
        .order_by(WatchlistAccount.created_at.desc())
    )
    accounts = result.scalars().all()

    # Get signal counts per account
    signal_counts = {}
    if accounts:
        ids = [a.id for a in accounts]
        for account_id in ids:
            cnt = await db.execute(
                select(func.count(WebSignal.id)).where(
                    WebSignal.account_id == account_id,
                    WebSignal.is_dismissed == False,
                )
            )
            signal_counts[account_id] = cnt.scalar() or 0

    return {
        "success": True,
        "accounts": [
            {
                "id": str(a.id),
                "company_name": a.company_name,
                "domain": a.domain,
                "industry": a.industry,
                "country": a.country,
                "hq_country": a.hq_country,
                "employee_size": a.employee_size,
                "priority": a.priority,
                "watch_hiring": a.watch_hiring,
                "watch_pricing": a.watch_pricing,
                "watch_compliance": a.watch_compliance,
                "watch_leadership": a.watch_leadership,
                "watch_expansion": a.watch_expansion,
                "last_checked": a.last_checked.isoformat() if a.last_checked else None,
                "signal_count": signal_counts.get(a.id, 0),
                "notes": a.notes,
                "created_at": a.created_at.isoformat(),
            }
            for a in accounts
        ],
        "total": len(accounts),
    }


@watchlist_router.post("")
async def add_account(
    req: AddAccountReq,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Check for duplicate domain
    existing = await db.execute(
        select(WatchlistAccount).where(
            WatchlistAccount.user_id == user.id,
            WatchlistAccount.domain == req.domain.lower().strip(),
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(400, f"'{req.domain}' is already in your watchlist")

    account = WatchlistAccount(
        user_id=user.id,
        company_name=req.company_name.strip(),
        domain=req.domain.lower().strip(),
        industry=req.industry,
        country=req.country,
        hq_country=req.hq_country,
        employee_size=req.employee_size,
        priority=req.priority,
        watch_hiring=req.watch_hiring,
        watch_pricing=req.watch_pricing,
        watch_compliance=req.watch_compliance,
        watch_leadership=req.watch_leadership,
        watch_expansion=req.watch_expansion,
        notes=req.notes,
        last_checked=datetime.utcnow(),
    )
    db.add(account)
    await db.commit()
    await db.refresh(account)

    return {
        "success": True,
        "account": {
            "id": str(account.id),
            "company_name": account.company_name,
            "domain": account.domain,
            "industry": account.industry,
            "country": account.country,
            "priority": account.priority,
            "signal_count": 0,
        },
        "message": f"'{account.company_name}' added to watchlist.",
    }


@watchlist_router.put("/{account_id}")
async def update_account(
    account_id: str,
    req: UpdateAccountReq,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(WatchlistAccount).where(
            WatchlistAccount.id == account_id, WatchlistAccount.user_id == user.id
        )
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(404, "Account not found")

    for field, value in req.model_dump(exclude_none=True).items():
        setattr(account, field, value)

    await db.commit()
    await db.refresh(account)

    return {
        "success": True,
        "account": {
            "id": str(account.id),
            "company_name": account.company_name,
            "domain": account.domain,
            "priority": account.priority,
            "watch_hiring": account.watch_hiring,
            "watch_pricing": account.watch_pricing,
            "watch_compliance": account.watch_compliance,
            "watch_leadership": account.watch_leadership,
            "watch_expansion": account.watch_expansion,
        },
        "message": "Account updated.",
    }


@watchlist_router.delete("/{account_id}")
async def delete_account(
    account_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(WatchlistAccount).where(
            WatchlistAccount.id == account_id, WatchlistAccount.user_id == user.id
        )
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(404, "Account not found")

    await db.delete(account)
    await db.commit()

    return {"success": True, "message": f"'{account.company_name}' removed from watchlist."}


@watchlist_router.get("/{account_id}/signals")
async def account_signals(
    account_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Verify ownership
    acc_result = await db.execute(
        select(WatchlistAccount).where(
            WatchlistAccount.id == account_id, WatchlistAccount.user_id == user.id
        )
    )
    account = acc_result.scalar_one_or_none()
    if not account:
        raise HTTPException(404, "Account not found")

    result = await db.execute(
        select(WebSignal)
        .where(WebSignal.account_id == account_id, WebSignal.is_dismissed == False)
        .order_by(WebSignal.detected_at.desc())
    )
    signals = result.scalars().all()

    return {
        "success": True,
        "account": {"id": str(account.id), "company_name": account.company_name},
        "signals": [
            {
                "id": str(s.id),
                "signal_type": s.signal_type,
                "signal_strength": s.signal_strength,
                "title": s.title,
                "summary": s.summary,
                "proof_text": s.proof_text,
                "proof_url": s.proof_url,
                "country_hint": s.country_hint,
                "recommended_action": s.recommended_action,
                "is_actioned": s.is_actioned,
                "detected_at": s.detected_at.isoformat(),
            }
            for s in signals
        ],
        "total": len(signals),
    }
