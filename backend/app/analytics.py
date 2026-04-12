"""Signal CRM — Analytics Engine"""
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from app.database import get_db
from app.auth import get_current_user
from app.models import User, Deal, Lead, WebSignal, WatchlistAccount, Contact, Account

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


@analytics_router.get("/monthly-revenue")
async def monthly_revenue(
    months: int = Query(6, le=12, ge=3),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return monthly won revenue + deal count for the last N months."""
    now = datetime.utcnow()
    deals_r = await db.execute(select(Deal).where(Deal.user_id == user.id))
    deals = deals_r.scalars().all()

    # Build month buckets
    buckets = {}
    for i in range(months - 1, -1, -1):
        m = (now.replace(day=1) - timedelta(days=i * 30)).replace(day=1)
        key = m.strftime("%b %Y")
        buckets[key] = {"month": key, "revenue": 0, "deals_won": 0, "pipeline": 0}

    def _month_key(dt):
        return dt.strftime("%b %Y") if dt else None

    for d in deals:
        mk = _month_key(d.updated_at)
        if mk and mk in buckets:
            buckets[mk]["pipeline"] += d.value
            if d.stage == "won":
                buckets[mk]["revenue"] += d.value
                buckets[mk]["deals_won"] += 1

    result = list(buckets.values())
    max_rev = max((r["revenue"] for r in result), default=0) or 1

    # Add bar height pct (0-100)
    for r in result:
        r["pct"] = round(r["revenue"] / max_rev * 100)

    total_won = sum(r["revenue"] for r in result)
    prev_half = sum(r["revenue"] for r in result[:months // 2])
    curr_half = sum(r["revenue"] for r in result[months // 2:])
    growth = round((curr_half - prev_half) / prev_half * 100) if prev_half else 0

    return {
        "success": True,
        "months": result,
        "total_revenue": total_won,
        "growth_pct": growth,
    }


@analytics_router.get("/search")
async def global_search(
    q: str = Query(..., min_length=2, description="Search query"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Global search across contacts, accounts, deals, and signals."""
    if not q or len(q.strip()) < 2:
        return {"success": True, "results": []}

    term = f"%{q.strip().lower()}%"

    # Contacts
    cr = await db.execute(
        select(Contact).where(
            Contact.user_id == user.id,
            or_(
                Contact.first_name.ilike(term),
                Contact.last_name.ilike(term),
                Contact.email.ilike(term),
                Contact.title.ilike(term),
            )
        ).limit(5)
    )
    contacts = [
        {
            "type": "contact", "id": c.id,
            "title": f"{c.first_name} {c.last_name}".strip(),
            "subtitle": c.title or c.email or "",
            "url": "/dashboard/contacts",
            "meta": c.stage,
        }
        for c in cr.scalars().all()
    ]

    # Accounts
    ar = await db.execute(
        select(Account).where(
            Account.user_id == user.id,
            or_(Account.name.ilike(term), Account.domain.ilike(term))
        ).limit(5)
    )
    accounts = [
        {
            "type": "account", "id": a.id,
            "title": a.name,
            "subtitle": a.domain or a.country or "",
            "url": "/dashboard/accounts",
            "meta": a.stage,
        }
        for a in ar.scalars().all()
    ]

    # Deals
    dr = await db.execute(
        select(Deal).where(
            Deal.user_id == user.id,
            or_(Deal.title.ilike(term), Deal.company_name.ilike(term))
        ).limit(5)
    )
    deals = [
        {
            "type": "deal", "id": d.id,
            "title": d.company_name or d.title,
            "subtitle": d.title if d.company_name else "",
            "url": "/dashboard/deals",
            "meta": d.stage,
        }
        for d in dr.scalars().all()
    ]

    # Signals
    sr = await db.execute(
        select(WebSignal).where(
            WebSignal.user_id == user.id,
            or_(
                WebSignal.account_name.ilike(term),
                WebSignal.title.ilike(term),
            )
        ).order_by(WebSignal.score.desc()).limit(4)
    )
    signals = [
        {
            "type": "signal", "id": s.id,
            "title": s.account_name,
            "subtitle": s.title[:60] if s.title else "",
            "url": "/dashboard/signals",
            "meta": s.signal_strength,
        }
        for s in sr.scalars().all()
    ]

    results = contacts + accounts + deals + signals
    return {"success": True, "q": q, "results": results, "total": len(results)}
