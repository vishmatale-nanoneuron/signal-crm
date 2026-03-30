"""Signal CRM — Next Best Action Engine"""
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.auth import get_current_user
from app.models import User, WebSignal, Deal, WatchlistAccount

next_action_router = APIRouter(prefix="/next-actions", tags=["Next Actions"])

HIGH_RISK_COUNTRIES = {"Germany", "France", "Sweden", "Italy", "Canada", "Brazil", "Japan", "Spain"}


def _days_since(dt: datetime) -> int:
    return (datetime.utcnow() - dt).days


def _build_actions(signals: list, deals: list, accounts: list) -> list:
    actions = []

    # High-strength unactioned signals → contact now
    for s in signals:
        if s.signal_strength == "high" and not s.is_actioned and not s.is_dismissed:
            actions.append({
                "id": f"signal-{s.id}",
                "priority": "urgent",
                "type": "contact_now",
                "title": f"Contact {s.company_name} — {s.signal_type.replace('_', ' ').title()} detected",
                "detail": s.recommended_action or f"A high-strength {s.signal_type.replace('_', ' ')} was detected at {s.company_name}. Act before the window closes.",
                "proof": s.title,
                "proof_detail": s.summary,
                "target_company": s.company_name,
                "target_country": s.country_hint,
                "signal_id": str(s.id),
                "detected_at": s.detected_at.isoformat(),
            })

    # Medium signals older than 3 days and not actioned
    for s in signals:
        if s.signal_strength == "medium" and not s.is_actioned and not s.is_dismissed:
            if _days_since(s.detected_at) >= 3:
                actions.append({
                    "id": f"signal-med-{s.id}",
                    "priority": "high",
                    "type": "contact_now",
                    "title": f"Follow up on {s.company_name} signal — {_days_since(s.detected_at)} days old",
                    "detail": f"This signal is {_days_since(s.detected_at)} days old and hasn't been actioned. {s.recommended_action}",
                    "proof": s.title,
                    "proof_detail": s.summary,
                    "target_company": s.company_name,
                    "target_country": s.country_hint,
                    "signal_id": str(s.id),
                    "detected_at": s.detected_at.isoformat(),
                })

    # Deals stuck in same stage > 21 days
    for d in deals:
        if d.stage not in ("won", "lost"):
            days_stuck = _days_since(d.updated_at)
            if days_stuck >= 21:
                actions.append({
                    "id": f"deal-stuck-{d.id}",
                    "priority": "high",
                    "type": "move_deal",
                    "title": f"Deal stuck: {d.title} — {days_stuck} days in '{d.stage}'",
                    "detail": f"This deal has been in '{d.stage}' for {days_stuck} days. Either move it forward or mark it lost to keep your pipeline clean.",
                    "proof": f"Deal created: {d.created_at.strftime('%b %d')} | Last updated: {d.updated_at.strftime('%b %d')} | Current stage: {d.stage}",
                    "proof_detail": d.notes or "No notes recorded.",
                    "target_company": d.company_name,
                    "target_country": d.country,
                    "deal_id": str(d.id),
                    "detected_at": d.updated_at.isoformat(),
                })

    # Deals in high-risk compliance countries without compliance check
    for d in deals:
        if d.stage not in ("won", "lost") and not d.compliance_checked:
            if d.country and d.country in HIGH_RISK_COUNTRIES:
                actions.append({
                    "id": f"deal-compliance-{d.id}",
                    "priority": "urgent",
                    "type": "compliance_check",
                    "title": f"URGENT: Compliance check required before outreach to {d.company_name} ({d.country})",
                    "detail": f"{d.country} is a high-risk jurisdiction. You must complete the compliance checklist before contacting this prospect to avoid GDPR/legal exposure.",
                    "proof": f"{d.country} is classified as HIGH risk — includes GDPR or equivalent strict data protection laws.",
                    "proof_detail": f"Deal value: {d.currency} {d.value:,.0f} | Current stage: {d.stage} | Compliance: Not checked",
                    "target_company": d.company_name,
                    "target_country": d.country,
                    "deal_id": str(d.id),
                    "detected_at": datetime.utcnow().isoformat(),
                })

    # New country hints from signals that user hasn't targeted in deals
    deal_countries = {d.country for d in deals if d.country}
    new_country_signals = {}
    for s in signals:
        if s.country_hint and s.country_hint not in deal_countries:
            if s.country_hint not in new_country_signals:
                new_country_signals[s.country_hint] = s
    for country, s in list(new_country_signals.items())[:3]:
        actions.append({
            "id": f"new-country-{s.id}",
            "priority": "medium",
            "type": "research",
            "title": f"New country opportunity: {country} — signals detected but no deals yet",
            "detail": f"You have signals from {country} (e.g., {s.company_name}) but no active deals in this market. Research entry requirements and run a compliance check before outreach.",
            "proof": s.title,
            "proof_detail": f"Signal type: {s.signal_type.replace('_', ' ')} | Strength: {s.signal_strength} | Company: {s.company_name}",
            "target_company": s.company_name,
            "target_country": country,
            "signal_id": str(s.id),
            "detected_at": s.detected_at.isoformat(),
        })

    # No watchlist accounts → add some
    if len(accounts) == 0:
        actions.append({
            "id": "no-watchlist",
            "priority": "high",
            "type": "research",
            "title": "Add target companies to your Watchlist",
            "detail": "Your watchlist is empty. Add your top 5-10 target companies to start receiving web change signals. Signal CRM monitors their websites for hiring spikes, pricing changes, new country pages, and more.",
            "proof": "No watchlist accounts found.",
            "proof_detail": "Go to Watchlist → Add Account to get started.",
            "target_company": "",
            "target_country": "",
            "detected_at": datetime.utcnow().isoformat(),
        })

    # Sort: urgent first, then high, medium, low
    priority_order = {"urgent": 0, "high": 1, "medium": 2, "low": 3}
    actions.sort(key=lambda x: priority_order.get(x["priority"], 3))

    return actions[:15]  # Return top 15


@next_action_router.get("")
async def get_next_actions(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    signals_r = await db.execute(
        select(WebSignal).where(WebSignal.user_id == user.id, WebSignal.is_dismissed == False)
    )
    signals = signals_r.scalars().all()

    deals_r = await db.execute(select(Deal).where(Deal.user_id == user.id))
    deals = deals_r.scalars().all()

    accounts_r = await db.execute(select(WatchlistAccount).where(WatchlistAccount.user_id == user.id))
    accounts = accounts_r.scalars().all()

    actions = _build_actions(signals, deals, accounts)

    return {
        "success": True,
        "actions": actions,
        "total": len(actions),
        "urgent_count": len([a for a in actions if a["priority"] == "urgent"]),
        "summary": f"{len(actions)} recommended actions — {len([a for a in actions if a['priority'] == 'urgent'])} urgent",
    }
