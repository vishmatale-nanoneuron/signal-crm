"""Signal CRM — Analytics Engine"""
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.auth import get_current_user
from app.models import User, Deal, Lead, WebSignal, WatchlistAccount

analytics_router = APIRouter(prefix="/analytics", tags=["Analytics"])

STAGES = ["signal", "qualified", "proposal", "negotiation", "won", "lost"]
STAGE_PROB = {"signal": 10, "qualified": 25, "proposal": 50, "negotiation": 75, "won": 100, "lost": 0}


@analytics_router.get("/overview")
async def overview(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    deals_r  = await db.execute(select(Deal).where(Deal.user_id == user.id))
    deals    = deals_r.scalars().all()
    leads_r  = await db.execute(select(Lead).where(Lead.user_id == user.id))
    leads    = leads_r.scalars().all()
    sigs_r   = await db.execute(select(WebSignal).where(WebSignal.user_id == user.id))
    signals  = sigs_r.scalars().all()

    won    = [d for d in deals if d.stage == "won"]
    lost   = [d for d in deals if d.stage == "lost"]
    active = [d for d in deals if d.stage not in ("won", "lost")]
    closed = won + lost

    win_rate          = round(len(won) / len(closed) * 100) if closed else 0
    pipeline_value    = sum(d.value for d in active)
    weighted_pipeline = sum(d.value * STAGE_PROB.get(d.stage, 10) / 100 for d in active)
    won_value         = sum(d.value for d in won)
    avg_deal_size     = round(won_value / len(won)) if won else 0

    cycles    = [(d.updated_at - d.created_at).days for d in won if d.updated_at > d.created_at]
    avg_cycle = round(sum(cycles) / len(cycles)) if cycles else 0

    # Revenue by country (top 10)
    country_map: dict = {}
    for d in deals:
        c = d.country or "Unknown"
        if c not in country_map:
            country_map[c] = {"deals": 0, "value": 0, "won": 0}
        country_map[c]["deals"] += 1
        country_map[c]["value"] += d.value
        if d.stage == "won":
            country_map[c]["won"] += 1
    by_country = sorted(
        [{"country": k, **v} for k, v in country_map.items()],
        key=lambda x: x["value"], reverse=True
    )[:10]

    # Stage funnel
    funnel = []
    for s in STAGES:
        stage_deals = [d for d in deals if d.stage == s]
        funnel.append({
            "stage": s,
            "count": len(stage_deals),
            "value": sum(d.value for d in stage_deals),
            "probability": STAGE_PROB[s],
        })

    # Signals this month
    now        = datetime.utcnow()
    month_ago  = now - timedelta(days=30)
    sigs_month = [s for s in signals if s.detected_at >= month_ago]

    # Lead status breakdown
    lead_status: dict = {}
    for l in leads:
        lead_status[l.status] = lead_status.get(l.status, 0) + 1

    return {
        "success": True,
        "overview": {
            "total_deals":            len(deals),
            "active_deals":           len(active),
            "pipeline_value":         pipeline_value,
            "weighted_pipeline":      round(weighted_pipeline),
            "won_value":              won_value,
            "avg_deal_size":          avg_deal_size,
            "win_rate":               win_rate,
            "avg_deal_cycle_days":    avg_cycle,
            "total_leads":            len(leads),
            "total_signals":          len(signals),
            "signals_this_month":     len(sigs_month),
            "high_priority_signals":  len([s for s in signals if s.signal_strength == "high" and not s.is_actioned]),
            "countries_in_pipeline":  len(country_map),
        },
        "funnel":      funnel,
        "by_country":  by_country,
        "lead_status": lead_status,
    }
