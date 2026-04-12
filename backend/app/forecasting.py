"""Signal CRM v2 — Revenue Forecasting API
AI-powered revenue forecast: weighted pipeline, stage velocity,
win rate analysis, monthly projection, and deal health scores.
"""
from datetime import datetime, date, timedelta
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from app.database import get_db
from app.auth import get_current_user
from app.models import User, Deal

forecasting_router = APIRouter(prefix="/forecast", tags=["Forecasting"])

STAGE_PROB = {
    "signal": 10, "qualified": 25, "demo": 40,
    "proposal": 60, "negotiation": 80, "closed won": 100, "won": 100,
    "closed lost": 0, "lost": 0,
}
WIN_STAGES  = {"closed won", "won"}
LOSE_STAGES = {"closed lost", "lost"}
ACTIVE_STAGES = set(STAGE_PROB.keys()) - WIN_STAGES - LOSE_STAGES


@forecasting_router.get("")
async def get_forecast(
    period: str = Query("quarter", description="month|quarter|year"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Full pipeline forecast with AI-weighted projections."""
    today = date.today()

    # Date window
    if period == "month":
        end_date = (today.replace(day=1) + timedelta(days=32)).replace(day=1)
    elif period == "year":
        end_date = today.replace(month=12, day=31)
    else:  # quarter
        qm = ((today.month - 1) // 3 + 1) * 3
        end_date = today.replace(month=qm, day=30)

    r = await db.execute(select(Deal).where(Deal.user_id == user.id))
    all_deals = r.scalars().all()

    # Stage grouping
    by_stage: dict[str, list] = {}
    for d in all_deals:
        by_stage.setdefault(d.stage, []).append(d)

    # Compute metrics
    won_value    = sum(d.value for d in all_deals if d.stage.lower() in WIN_STAGES)
    lost_value   = sum(d.value for d in all_deals if d.stage.lower() in LOSE_STAGES)
    active_deals = [d for d in all_deals if d.stage.lower() not in WIN_STAGES | LOSE_STAGES]
    pipeline_value = sum(d.value for d in active_deals)
    weighted_value = sum(
        d.value * (STAGE_PROB.get(d.stage.lower(), d.probability) / 100)
        for d in active_deals
    )

    total_closed = len([d for d in all_deals if d.stage.lower() in WIN_STAGES | LOSE_STAGES])
    win_rate     = len([d for d in all_deals if d.stage.lower() in WIN_STAGES]) / max(total_closed, 1)
    avg_deal_val = won_value / max(len([d for d in all_deals if d.stage.lower() in WIN_STAGES]), 1)

    # Monthly breakdown (last 6 months won deals)
    monthly: dict[str, float] = {}
    for d in all_deals:
        if d.stage.lower() in WIN_STAGES:
            m = d.updated_at.strftime("%b %Y")
            monthly[m] = monthly.get(m, 0) + d.value

    # Stage funnel
    funnel = []
    for stage_name in ["signal", "qualified", "demo", "proposal", "negotiation", "closed won"]:
        matched = [d for d in all_deals if d.stage.lower() == stage_name or
                   (stage_name == "closed won" and d.stage.lower() == "won")]
        funnel.append({
            "stage": stage_name.title(),
            "count": len(matched),
            "value": sum(d.value for d in matched),
            "probability": STAGE_PROB.get(stage_name, 50),
        })

    # Deals closing soon (next 30 days)
    soon_str = (today + timedelta(days=30)).isoformat()
    closing_soon = [
        {
            "id": d.id, "title": d.title, "company": d.company_name,
            "value": d.value, "currency": d.currency, "stage": d.stage,
            "close_date": d.close_date, "probability": d.probability,
        }
        for d in active_deals
        if d.close_date and d.close_date <= soon_str
    ]
    closing_soon.sort(key=lambda x: x["close_date"])

    # AI forecast projection
    projected_won = weighted_value * win_rate * 1.1  # slight optimism factor

    return {
        "success": True,
        "period": period,
        "summary": {
            "pipeline_value": round(pipeline_value, 2),
            "weighted_forecast": round(weighted_value, 2),
            "projected_won": round(projected_won, 2),
            "won_value": round(won_value, 2),
            "lost_value": round(lost_value, 2),
            "win_rate_pct": round(win_rate * 100, 1),
            "avg_deal_size": round(avg_deal_val, 2),
            "active_deals": len(active_deals),
            "total_deals": len(all_deals),
        },
        "stage_funnel": funnel,
        "monthly_won": [{"month": k, "value": v} for k, v in sorted(monthly.items())[-6:]],
        "closing_soon": closing_soon[:10],
        "ai_insight": _generate_forecast_insight(win_rate, pipeline_value, weighted_value, active_deals),
    }


def _generate_forecast_insight(win_rate: float, pipeline_value: float,
                                weighted_value: float, active_deals: list) -> str:
    """Rule-based AI insight for the forecast."""
    if not active_deals:
        return "No active deals in pipeline. Add deals from your signals to start forecasting."
    if win_rate >= 0.6:
        msg = f"Strong win rate of {round(win_rate*100)}%. "
    elif win_rate >= 0.35:
        msg = f"Healthy win rate of {round(win_rate*100)}%. "
    else:
        msg = f"Win rate at {round(win_rate*100)}% — focus on qualifying leads earlier. "

    high_val = sorted(active_deals, key=lambda d: d.value, reverse=True)[:3]
    if high_val:
        names = ", ".join(d.company_name or d.title for d in high_val[:2])
        msg += f"Top opportunities: {names}. "

    stalled = [d for d in active_deals if (datetime.utcnow() - d.updated_at).days > 14]
    if stalled:
        msg += f"{len(stalled)} deal(s) haven't moved in 14+ days — review and act."
    return msg
