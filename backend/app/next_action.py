"""Signal CRM — Next Best Action Engine"""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from app.database import get_db
from app.auth import get_current_user
from app.models import User, WebSignal, Deal, WatchlistAccount

next_action_router = APIRouter(prefix="/next-actions", tags=["Next Actions"])
HIGH_RISK = {"Germany","France","Sweden","Italy","Canada","Brazil","Japan","Spain"}


def _days(dt: datetime) -> int:
    return (datetime.utcnow() - dt).days


@next_action_router.get("")
async def get_actions(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    rs = await db.execute(select(WebSignal).where(WebSignal.user_id==user.id, WebSignal.is_dismissed==False, WebSignal.is_actioned==False))
    signals = rs.scalars().all()
    rd = await db.execute(select(Deal).where(Deal.user_id==user.id))
    deals = rd.scalars().all()
    ra = await db.execute(select(WatchlistAccount).where(WatchlistAccount.user_id==user.id))
    accounts = ra.scalars().all()

    actions = []
    for s in signals:
        if s.signal_strength == "high":
            actions.append({"id": f"signal-{s.id}", "priority": "urgent", "type": "contact_now",
                "title": f"Contact {s.account_name} — {s.signal_type.replace('_',' ').title()} detected",
                "detail": s.recommended_action or f"High-strength signal at {s.account_name}.",
                "proof": s.title, "target_company": s.account_name, "target_country": s.country_hint})
    for s in signals:
        if s.signal_strength == "medium" and _days(s.detected_at) >= 3:
            actions.append({"id": f"sig-med-{s.id}", "priority": "high", "type": "contact_now",
                "title": f"Follow up on {s.account_name} — {_days(s.detected_at)} days old",
                "detail": s.recommended_action or "", "target_company": s.account_name})
    for d in deals:
        if d.stage not in ("won","lost"):
            if _days(d.updated_at) > 21:
                actions.append({"id": f"deal-stuck-{d.id}", "priority": "high", "type": "advance_deal",
                    "title": f"Deal '{d.title}' stuck in '{d.stage}' for {_days(d.updated_at)} days",
                    "detail": d.next_action or "Schedule a call or send a proposal.", "deal_id": d.id})
            if d.country in HIGH_RISK and not d.compliance_checked:
                actions.append({"id": f"deal-cmp-{d.id}", "priority": "high", "type": "compliance_check",
                    "title": f"Run compliance check for {d.company_name} — {d.country} has strict rules",
                    "detail": f"{d.country} has strict outbound compliance laws. Check before outreach.",
                    "deal_id": d.id, "target_country": d.country})
    if not accounts:
        actions.append({"id": "setup-watchlist", "priority": "medium", "type": "setup",
            "title": "Add companies to your watchlist to start receiving signals",
            "detail": "Add target accounts to your watchlist. Signal CRM will monitor for hiring spikes, pricing changes, new country pages, and more."})

    actions.sort(key=lambda x: {"urgent":0,"high":1,"medium":2,"low":3}.get(x.get("priority","low"),3))
    return {"success": True, "actions": actions[:15], "total": len(actions)}


@next_action_router.post("/{action_id}/complete")
async def complete_action(action_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Mark an action as done — dismisses the underlying signal or notes deal progress."""
    if action_id.startswith("signal-"):
        signal_id = int(action_id.split("-", 1)[1])
        result = await db.execute(
            select(WebSignal).where(WebSignal.id == signal_id, WebSignal.user_id == user.id)
        )
        signal = result.scalar_one_or_none()
        if not signal:
            raise HTTPException(status_code=404, detail="Signal not found")
        signal.is_actioned = True
        await db.commit()

    elif action_id.startswith("sig-med-"):
        signal_id = int(action_id.split("-", 2)[2])
        result = await db.execute(
            select(WebSignal).where(WebSignal.id == signal_id, WebSignal.user_id == user.id)
        )
        signal = result.scalar_one_or_none()
        if signal:
            signal.is_actioned = True
            await db.commit()

    elif action_id.startswith("deal-stuck-") or action_id.startswith("deal-cmp-"):
        # For deal-based actions just acknowledge — deal tracking happens in deals module
        pass

    # setup-watchlist and other static actions are client-side only
    return {"success": True, "action_id": action_id, "message": "Action marked as complete"}
