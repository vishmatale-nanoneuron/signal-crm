"""Signal CRM — CEO / Founder Command Center
Strictly owner-only. Returns full business intelligence:
- Revenue: MRR, ARR, plan distribution, revenue by plan
- Users: total, paid, trial, new signups, conversion rate
- Sales: pipeline value, deals by stage, win rate, avg deal size
- CRM: contacts, accounts, activity velocity, tasks health
- Top accounts by ARR
- Recent 10 signups
- Recent activity feed
- 30-day KPI trend (from ceo_snapshots)
- System health
- Founder strategic insight (AI-generated rule-based)
"""
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, text
from app.database import get_db, db_ping
from app.auth import get_user_no_trial_check
from app.models import (
    User, Deal, Account, Contact, Activity, Task,
    Notification, CeoSnapshot,
)
from app.config import get_settings

settings  = get_settings()
ceo_router = APIRouter(prefix="/ceo", tags=["CEO"])

# ── Plan pricing (INR/month) for MRR calc ──────────────────────────────────────
PLAN_MRR = {
    "starter":    4_999,
    "pro":        8_000,
    "enterprise": 19_999,
}


# ── Owner guard ────────────────────────────────────────────────────────────────
async def get_owner(
    user: User = Depends(get_user_no_trial_check),
) -> User:
    """Dependency: only the owner/founder can access CEO endpoints."""
    # Accept by DB flag OR by matching OWNER_EMAIL env var
    is_owner = getattr(user, "is_owner", False)
    email_match = (
        settings.OWNER_EMAIL
        and user.email.lower() == settings.OWNER_EMAIL.lower()
    )
    if not (is_owner or email_match):
        raise HTTPException(403, {
            "error": "forbidden",
            "message": "CEO dashboard is restricted to the account owner.",
        })
    return user


# ── Helpers ───────────────────────────────────────────────────────────────────
def _fmt_inr(v: float) -> str:
    v = v or 0
    if v >= 1e7:  return f"₹{v/1e7:.1f}Cr"
    if v >= 1e5:  return f"₹{v/1e5:.1f}L"
    if v >= 1e3:  return f"₹{v/1e3:.0f}K"
    return f"₹{v:.0f}"


def _founder_insight(metrics: dict) -> str:
    """Rule-based strategic insight for the founder."""
    paid    = metrics.get("paid_users", 0)
    total   = metrics.get("total_users", 1)
    trial   = metrics.get("trial_users", 0)
    conv    = metrics.get("conversion_rate", 0)
    mrr     = metrics.get("mrr", 0)
    pipeline = metrics.get("pipeline_value", 0)
    new_today = metrics.get("new_signups_today", 0)
    overdue_tasks = metrics.get("tasks_overdue", 0)
    win_rate = metrics.get("win_rate", 0)

    insights = []

    if conv < 10 and trial > 5:
        insights.append(
            f"Conversion rate is {conv:.0f}% with {trial} users still on trial. "
            "Priority: reach out personally to each trial user — a single call converts 3–4x better than email."
        )
    elif conv >= 30:
        insights.append(
            f"Strong {conv:.0f}% conversion rate. This is above SaaS benchmark (25%). "
            "Scale top-of-funnel — every new trial is likely worth ₹8K MRR."
        )

    if mrr > 0:
        arr_proj = mrr * 12
        insights.append(
            f"Current MRR ₹{mrr:,.0f} projects to ARR ₹{arr_proj:,.0f}. "
            "To hit ₹1Cr ARR you need {:.0f} more Pro subscribers.".format(
                max(0, (10_000_000 - arr_proj) / (8_000 * 12))
            )
        )

    if pipeline > mrr * 3:
        insights.append(
            f"Pipeline value is {pipeline/max(mrr,1):.1f}x your MRR — healthy signal. "
            "Focus on closing the top 3 deals to create a step-change in revenue."
        )
    elif pipeline < mrr and mrr > 0:
        insights.append(
            "Pipeline value is below MRR — top-of-funnel needs attention. "
            "Generate 10 new signal-triggered outreach actions this week."
        )

    if win_rate < 20 and win_rate > 0:
        insights.append(
            f"Win rate {win_rate:.0f}% is below target. Review recent lost deals for pattern. "
            "Common fixes: tighten ICP, improve demo-to-proposal time, add social proof."
        )

    if new_today > 0:
        insights.append(f"{new_today} new signup(s) today — reach out within 24h for best activation.")

    if overdue_tasks > 3:
        insights.append(
            f"{overdue_tasks} overdue tasks indicate execution debt. "
            "Clear these before adding new pipeline — stale deals kill win rate."
        )

    if not insights:
        insights.append(
            "Business fundamentals look stable. Focus on one growth lever this week: "
            "either increase trials (outbound) or improve trial-to-paid conversion (onboarding)."
        )

    return " ".join(insights[:3])


# ── Main CEO dashboard endpoint ────────────────────────────────────────────────
@ceo_router.get("/dashboard")
async def ceo_dashboard(
    owner: User = Depends(get_owner),
    db: AsyncSession = Depends(get_db),
):
    now   = datetime.utcnow()
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_ago  = now - timedelta(days=7)
    month_ago = now - timedelta(days=30)

    # ── Users ─────────────────────────────────────────────────────────────────
    r = await db.execute(select(func.count()).select_from(User).where(User.is_active == True))
    total_users = r.scalar() or 0

    r = await db.execute(select(func.count()).select_from(User).where(
        and_(User.is_active == True, User.is_paid == True)
    ))
    paid_users = r.scalar() or 0

    r = await db.execute(select(func.count()).select_from(User).where(
        and_(User.is_active == True, User.is_paid == False)
    ))
    trial_users = r.scalar() or 0

    r = await db.execute(select(func.count()).select_from(User).where(
        and_(User.is_active == True, User.created_at >= today)
    ))
    new_today = r.scalar() or 0

    r = await db.execute(select(func.count()).select_from(User).where(
        and_(User.is_active == True, User.created_at >= week_ago)
    ))
    new_week = r.scalar() or 0

    r = await db.execute(select(func.count()).select_from(User).where(
        and_(User.is_active == True, User.created_at >= month_ago)
    ))
    new_month = r.scalar() or 0

    conversion_rate = round((paid_users / max(total_users, 1)) * 100, 1)

    # Plan distribution
    r = await db.execute(
        select(User.plan, func.count().label("cnt"))
        .where(and_(User.is_active == True, User.is_paid == True))
        .group_by(User.plan)
    )
    plan_dist = {row.plan: row.cnt for row in r.fetchall()}

    # MRR from paid users' plans
    mrr = sum(PLAN_MRR.get(plan, 0) * cnt for plan, cnt in plan_dist.items())
    arr = mrr * 12

    # ── Deals / Pipeline ──────────────────────────────────────────────────────
    r = await db.execute(select(func.count()).select_from(Deal))
    total_deals = r.scalar() or 0

    r = await db.execute(
        select(Deal.stage, func.count().label("cnt"), func.sum(Deal.value).label("val"))
        .group_by(Deal.stage)
    )
    deals_by_stage = {}
    pipeline_value = 0.0
    won_value = 0.0
    for row in r.fetchall():
        deals_by_stage[row.stage] = {"count": row.cnt, "value": float(row.val or 0)}
        if row.stage not in ("won", "lost", "closed won", "closed lost"):
            pipeline_value += float(row.val or 0)
        if row.stage in ("won", "closed won"):
            won_value += float(row.val or 0)

    total_closed = sum(
        v["count"] for k, v in deals_by_stage.items()
        if k in ("won", "lost", "closed won", "closed lost")
    )
    won_count = sum(
        v["count"] for k, v in deals_by_stage.items()
        if k in ("won", "closed won")
    )
    win_rate = round((won_count / max(total_closed, 1)) * 100, 1)
    avg_deal = round(pipeline_value / max(total_deals - total_closed, 1))

    # ── CRM stats ─────────────────────────────────────────────────────────────
    r = await db.execute(select(func.count()).select_from(Contact))
    total_contacts = r.scalar() or 0

    r = await db.execute(select(func.count()).select_from(Account))
    total_accounts = r.scalar() or 0

    r = await db.execute(select(func.sum(Account.arr)).select_from(Account))
    total_account_arr = float(r.scalar() or 0)

    r = await db.execute(select(func.count()).select_from(Activity).where(
        Activity.created_at >= today
    ))
    activities_today = r.scalar() or 0

    r = await db.execute(select(func.count()).select_from(Activity).where(
        Activity.created_at >= week_ago
    ))
    activities_week = r.scalar() or 0

    # Tasks
    r = await db.execute(
        select(func.count()).select_from(Task)
        .where(and_(Task.status == "open"))
    )
    tasks_open = r.scalar() or 0

    r = await db.execute(
        select(func.count()).select_from(Task)
        .where(and_(
            Task.status == "open",
            Task.due_date < now,
            Task.due_date.isnot(None),
        ))
    )
    tasks_overdue = r.scalar() or 0

    # ── Top 5 accounts by ARR ─────────────────────────────────────────────────
    r = await db.execute(
        select(Account.id, Account.name, Account.arr, Account.stage, Account.industry, Account.country)
        .order_by(Account.arr.desc())
        .limit(5)
    )
    top_accounts = [
        {
            "id": row.id, "name": row.name,
            "arr": float(row.arr or 0), "arr_fmt": _fmt_inr(float(row.arr or 0)),
            "stage": row.stage, "industry": row.industry or "", "country": row.country or "",
        }
        for row in r.fetchall()
    ]

    # ── Recent 10 signups ─────────────────────────────────────────────────────
    r = await db.execute(
        select(User.id, User.name, User.email, User.company_name, User.plan, User.is_paid, User.created_at)
        .order_by(User.created_at.desc())
        .limit(10)
    )
    recent_signups = [
        {
            "id": row.id, "name": row.name, "email": row.email,
            "company": row.company_name or "", "plan": row.plan,
            "is_paid": row.is_paid,
            "joined": row.created_at.strftime("%d %b %Y %H:%M"),
        }
        for row in r.fetchall()
    ]

    # ── Recent activity feed (last 15 across all users) ───────────────────────
    r = await db.execute(
        select(Activity.id, Activity.type, Activity.title, Activity.outcome, Activity.created_at)
        .order_by(Activity.created_at.desc())
        .limit(15)
    )
    activity_feed = [
        {
            "id": row.id, "type": row.type,
            "title": row.title or f"{row.type} logged",
            "outcome": row.outcome or "",
            "time": row.created_at.strftime("%d %b %H:%M"),
        }
        for row in r.fetchall()
    ]

    # ── 30-day KPI snapshots ──────────────────────────────────────────────────
    r = await db.execute(
        select(CeoSnapshot)
        .order_by(CeoSnapshot.snapshot_date.desc())
        .limit(30)
    )
    snapshots_raw = r.scalars().all()
    kpi_trend = [
        {
            "date": s.snapshot_date.strftime("%d %b"),
            "paid_users":    s.paid_users,
            "mrr":           s.mrr,
            "pipeline":      s.pipeline_value,
            "new_signups":   s.new_signups_today,
        }
        for s in reversed(snapshots_raw)
    ]

    # ── System health ─────────────────────────────────────────────────────────
    db_health = await db_ping()

    # ── Assemble metrics dict for insight generation ──────────────────────────
    metrics = {
        "paid_users": paid_users,
        "total_users": total_users,
        "trial_users": trial_users,
        "conversion_rate": conversion_rate,
        "mrr": mrr,
        "pipeline_value": pipeline_value,
        "new_signups_today": new_today,
        "tasks_overdue": tasks_overdue,
        "win_rate": win_rate,
    }
    founder_insight = _founder_insight(metrics)

    # ── Save today's snapshot (upsert-style: just insert) ────────────────────
    try:
        snap = CeoSnapshot(
            snapshot_date=now,
            total_users=total_users, paid_users=paid_users, trial_users=trial_users,
            new_signups_today=new_today, mrr=mrr, arr=arr,
            total_deals=total_deals, pipeline_value=pipeline_value, won_value=won_value,
            total_contacts=total_contacts, total_accounts=total_accounts,
            total_arr=total_account_arr, activities_today=activities_today,
            tasks_open=tasks_open,
        )
        db.add(snap)
        await db.commit()
    except Exception:
        await db.rollback()

    return {
        "success": True,
        "generated_at": now.isoformat(),
        "owner": {"name": owner.name, "email": owner.email},

        # ── Revenue ─────────────────────────────────────────────────────────
        "revenue": {
            "mrr":          mrr,
            "mrr_fmt":      _fmt_inr(mrr),
            "arr":          arr,
            "arr_fmt":      _fmt_inr(arr),
            "plan_dist":    plan_dist,
            "plan_mrr":     {k: v * PLAN_MRR.get(k, 0) for k, v in plan_dist.items()},
        },

        # ── Users ────────────────────────────────────────────────────────────
        "users": {
            "total":           total_users,
            "paid":            paid_users,
            "trial":           trial_users,
            "new_today":       new_today,
            "new_week":        new_week,
            "new_month":       new_month,
            "conversion_rate": conversion_rate,
        },

        # ── Pipeline ─────────────────────────────────────────────────────────
        "pipeline": {
            "total_deals":     total_deals,
            "pipeline_value":  pipeline_value,
            "pipeline_fmt":    _fmt_inr(pipeline_value),
            "won_value":       won_value,
            "won_fmt":         _fmt_inr(won_value),
            "win_rate":        win_rate,
            "avg_deal_size":   avg_deal,
            "avg_deal_fmt":    _fmt_inr(avg_deal),
            "by_stage":        deals_by_stage,
        },

        # ── CRM ──────────────────────────────────────────────────────────────
        "crm": {
            "total_contacts":   total_contacts,
            "total_accounts":   total_accounts,
            "total_arr":        total_account_arr,
            "total_arr_fmt":    _fmt_inr(total_account_arr),
            "activities_today": activities_today,
            "activities_week":  activities_week,
            "tasks_open":       tasks_open,
            "tasks_overdue":    tasks_overdue,
        },

        # ── Intelligence ─────────────────────────────────────────────────────
        "top_accounts":    top_accounts,
        "recent_signups":  recent_signups,
        "activity_feed":   activity_feed,
        "kpi_trend":       kpi_trend,

        # ── System ───────────────────────────────────────────────────────────
        "system": {
            "db_ok":    db_health.get("ok", False),
            "db_ms":    db_health.get("latency_ms", 0),
            "version":  "4.0.0",
            "env":      __import__("os").environ.get("RAILWAY_ENVIRONMENT", "local"),
        },

        # ── Founder insight ──────────────────────────────────────────────────
        "founder_insight": founder_insight,
    }


@ceo_router.get("/snapshots")
async def get_snapshots(
    days: int = 30,
    owner: User = Depends(get_owner),
    db: AsyncSession = Depends(get_db),
):
    """Return last N days of KPI snapshots for charting."""
    since = datetime.utcnow() - timedelta(days=days)
    r = await db.execute(
        select(CeoSnapshot)
        .where(CeoSnapshot.snapshot_date >= since)
        .order_by(CeoSnapshot.snapshot_date.asc())
    )
    snaps = r.scalars().all()
    return {
        "success": True,
        "snapshots": [
            {
                "date":        s.snapshot_date.strftime("%d %b"),
                "paid_users":  s.paid_users,
                "total_users": s.total_users,
                "mrr":         s.mrr,
                "arr":         s.arr,
                "pipeline":    s.pipeline_value,
                "won":         s.won_value,
                "new_signups": s.new_signups_today,
                "contacts":    s.total_contacts,
                "accounts":    s.total_accounts,
            }
            for s in snaps
        ],
    }
