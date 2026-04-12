"""Signal CRM — Background Scheduler
Jobs:
  • Daily  @ 06:00 UTC — watchlist scans + digest email
  • Hourly @ :00     — task due reminders + stale deal alerts
"""
import asyncio
from datetime import datetime, timedelta
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import AsyncSessionLocal
from app.models import User, WatchlistAccount, WebSignal, Deal, Task, Notification, _uuid
from app.digest_email import send_daily_digest, send_signal_alert

# Lazy import to avoid circular deps at module load
async def _get_scraper():
    from app.scraper import scan_company
    return scan_company

async def _run_user_scan(user: User, db: AsyncSession):
    """Scan all watchlist companies for one user, create signals for new findings."""
    try:
        from app.scraper import scan_company
        import httpx, json
        accounts_r = await db.execute(
            select(WatchlistAccount).where(WatchlistAccount.user_id == user.id)
        )
        accounts = accounts_r.scalars().all()
        if not accounts:
            return 0

        new_signals = 0
        async with httpx.AsyncClient(timeout=20, follow_redirects=True,
                                     headers={"User-Agent": "Signal CRM Scanner/3.0"}) as client:
            for acct in accounts:
                if not acct.domain:
                    continue
                try:
                    result = await scan_company(
                        domain=acct.domain,
                        watch_hiring=acct.watch_hiring,
                        watch_expansion=acct.watch_expansion,
                        watch_products=True,
                        prev_data={},
                        client=client,
                    )
                    for sig in result.get("signals", []):
                        from app.models import WebSignal as WS
                        from app.models import _uuid
                        ws = WS(
                            user_id=user.id,
                            account_id=acct.id,
                            account_name=acct.company_name,
                            signal_type=sig.get("type", "hiring_spike"),
                            signal_strength=sig.get("strength", "medium"),
                            title=sig.get("title", ""),
                            summary=sig.get("summary", ""),
                            proof_text=sig.get("proof", ""),
                            proof_url=sig.get("url", ""),
                            country_hint=acct.country or acct.hq_country or "",
                            recommended_action=sig.get("action", "Review this signal and take action."),
                            score=sig.get("score", 6),
                            before_snapshot=sig.get("before", ""),
                            after_snapshot=sig.get("after", ""),
                        )
                        db.add(ws)
                        new_signals += 1

                        # Send real-time alert for HIGH priority signals
                        if sig.get("strength") == "high" and user.email:
                            sig_dict = {
                                "id": ws.id, "account_name": acct.company_name,
                                "signal_type": ws.signal_type, "title": ws.title,
                                "summary": ws.summary, "recommended_action": ws.recommended_action,
                            }
                            asyncio.create_task(
                                send_signal_alert(user.email, user.name or "there", sig_dict)
                            )
                    # Update last_checked
                    acct.last_checked = datetime.utcnow()
                except Exception as e:
                    print(f"[Scheduler] Scan error {acct.domain}: {e}")

        if new_signals:
            await db.commit()
        return new_signals
    except Exception as e:
        print(f"[Scheduler] User scan error {user.id}: {e}")
        return 0


async def _send_digest_for_user(user: User, db: AsyncSession):
    """Send daily digest email to one user."""
    if not user.email:
        return

    # Top unactioned signals
    sigs_r = await db.execute(
        select(WebSignal)
        .where(WebSignal.user_id == user.id, WebSignal.is_dismissed == False)
        .order_by(WebSignal.score.desc(), WebSignal.detected_at.desc())
        .limit(5)
    )
    signals = sigs_r.scalars().all()
    if not signals:
        return

    # Pipeline stats
    deals_r = await db.execute(select(Deal).where(Deal.user_id == user.id))
    deals = deals_r.scalars().all()
    active = [d for d in deals if d.stage not in ("won", "lost")]
    pipeline_val = sum(d.value for d in active)

    # Action streak: days with at least one actioned signal in last 30 days
    actioned_r = await db.execute(
        select(WebSignal)
        .where(WebSignal.user_id == user.id, WebSignal.is_actioned == True,
               WebSignal.detected_at >= datetime.utcnow() - timedelta(days=30))
        .order_by(WebSignal.detected_at.desc())
    )
    actioned = actioned_r.scalars().all()
    # Count consecutive days with actions
    streak = 0
    if actioned:
        days_with_action = set()
        for s in actioned:
            days_with_action.add(s.detected_at.date())
        today = datetime.utcnow().date()
        for i in range(30):
            if (today - timedelta(days=i)) in days_with_action:
                streak += 1
            else:
                break

    sigs_list = [
        {
            "account_name": s.account_name, "signal_type": s.signal_type,
            "signal_strength": s.signal_strength, "title": s.title,
            "score": s.score, "recommended_action": s.recommended_action,
        }
        for s in signals
    ]

    await send_daily_digest(
        user_email=user.email,
        user_name=user.name or "there",
        signals=sigs_list,
        deals_active=len(active),
        pipeline_val=pipeline_val,
        streak=streak,
    )


async def run_daily_job():
    """Main daily job: scan all users' watchlists + send digest emails."""
    print(f"[Scheduler] Daily job started — {datetime.utcnow().isoformat()}")
    async with AsyncSessionLocal() as db:
        users_r = await db.execute(
            select(User).where(User.is_active == True)
        )
        users = users_r.scalars().all()
        print(f"[Scheduler] Processing {len(users)} users")

        for user in users:
            # Skip expired free trials
            if not user.is_paid and user.trial_end and datetime.utcnow() > user.trial_end:
                continue
            new_sigs = await _run_user_scan(user, db)
            if new_sigs:
                print(f"[Scheduler] {user.email}: {new_sigs} new signals detected")
            await _send_digest_for_user(user, db)

    print(f"[Scheduler] Daily job complete — {datetime.utcnow().isoformat()}")


async def run_task_reminders():
    """Hourly: fire in-app notifications for tasks whose reminder_at is now±30min."""
    now = datetime.utcnow()
    window_start = now - timedelta(minutes=5)
    window_end   = now + timedelta(minutes=55)  # within the next hour
    try:
        async with AsyncSessionLocal() as db:
            tasks_r = await db.execute(
                select(Task).where(
                    Task.reminder_at >= window_start,
                    Task.reminder_at <= window_end,
                    Task.status.in_(["open", "in_progress"]),
                )
            )
            tasks = tasks_r.scalars().all()
            count = 0
            for t in tasks:
                # Avoid duplicate notifications: clear reminder_at after firing
                n = Notification(
                    id=_uuid(), user_id=t.user_id,
                    type="task_due",
                    title=f"Task Due: {t.title}",
                    body=f"Priority: {t.priority}. Due: {t.due_date.strftime('%d %b %Y') if t.due_date else 'today'}",
                    entity_type="task",
                    entity_id=t.id,
                )
                db.add(n)
                t.reminder_at = None  # prevent re-firing
                count += 1
            if count:
                await db.commit()
                print(f"[Scheduler] Task reminders fired: {count}")
    except Exception as e:
        print(f"[Scheduler] Task reminder error: {e}")


async def run_stale_deal_alerts():
    """Daily: notify users about deals stale for 14+ days."""
    try:
        async with AsyncSessionLocal() as db:
            cutoff = datetime.utcnow() - timedelta(days=14)
            deals_r = await db.execute(
                select(Deal).where(
                    Deal.updated_at <= cutoff,
                    Deal.stage.notin_(["won", "lost"]),
                )
            )
            deals = deals_r.scalars().all()
            count = 0
            for d in deals:
                n = Notification(
                    id=_uuid(), user_id=d.user_id,
                    type="warning",
                    title=f"Deal Going Cold: {d.company_name or d.title}",
                    body=f"No activity in {(datetime.utcnow()-d.updated_at).days} days. Stage: {d.stage}. Take action now.",
                    entity_type="deal",
                    entity_id=d.id,
                )
                db.add(n)
                count += 1
            if count:
                await db.commit()
                print(f"[Scheduler] Stale deal alerts: {count}")
    except Exception as e:
        print(f"[Scheduler] Stale deal alert error: {e}")


def start_scheduler():
    """Start APScheduler: daily job @ 06:00 UTC + hourly task reminders."""
    try:
        from apscheduler.schedulers.asyncio import AsyncIOScheduler
        from apscheduler.triggers.cron import CronTrigger

        scheduler = AsyncIOScheduler()
        scheduler.add_job(
            run_daily_job,
            CronTrigger(hour=6, minute=0, timezone="UTC"),
            id="daily_digest",
            replace_existing=True,
            misfire_grace_time=3600,
        )
        scheduler.add_job(
            run_task_reminders,
            CronTrigger(minute=0, timezone="UTC"),  # every hour on the hour
            id="task_reminders",
            replace_existing=True,
            misfire_grace_time=300,
        )
        scheduler.add_job(
            run_stale_deal_alerts,
            CronTrigger(hour=7, minute=0, timezone="UTC"),  # daily @ 07:00 UTC
            id="stale_deal_alerts",
            replace_existing=True,
            misfire_grace_time=3600,
        )
        scheduler.start()
        print("✓ Signal CRM — Scheduler started (daily digest @06:00, task reminders @:00, stale deals @07:00 UTC)")
        return scheduler
    except ImportError:
        print("⚠ APScheduler not installed — scheduler disabled")
        return None
