"""Signal CRM — Detection Engine API

Routes:
  POST /detect/scan/{account_id}   — scan a single watchlist company now
  POST /detect/scan-all            — scan all watchlist companies
  GET  /detect/status              — scan queue status
  POST /ai/analyze/{signal_id}     — AI analysis of a signal
  POST /ai/draft-email/{signal_id} — draft outreach email for a signal
"""
import json
import asyncio
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from app.database import get_db
from app.auth import get_current_user
from app.models import User, WatchlistAccount, WebSignal, TrackedPage
from app.scraper import scan_company
from app.openai_service import analyze_signal, draft_outreach_email

detect_router = APIRouter(prefix="/detect", tags=["Detection Engine"])
ai_router     = APIRouter(prefix="/ai",     tags=["AI"])

# In-memory scan queue status
_scan_status: dict[str, dict] = {}  # account_id → {status, last_scan, signals_found}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_prev_data(tracked_pages: list[TrackedPage]) -> dict:
    """Reconstruct prev_data dict from TrackedPage rows."""
    prev: dict = {}
    for tp in tracked_pages:
        if tp.page_type == "careers":
            prev["job_count"] = tp.job_count
            try:
                prev["countries"] = json.loads(tp.country_keys or "{}")
            except Exception:
                prev["countries"] = {}
        elif tp.page_type == "sitemap":
            prev["country_slugs_json"] = tp.country_keys or "[]"
        elif tp.page_type == "products":
            prev["products_json"] = tp.product_keys or "[]"
    return prev


async def _persist_signal(
    db: AsyncSession,
    user_id: str,
    account: WatchlistAccount,
    sig: dict,
) -> WebSignal:
    """Save a detected signal to the DB and update tracked page."""
    ws = WebSignal(
        user_id=user_id,
        account_id=account.id,
        account_name=account.company_name,
        signal_type=sig.get("signal_type", ""),
        signal_strength=sig.get("signal_strength", "medium"),
        title=sig.get("title", ""),
        summary=sig.get("summary", ""),
        proof_text=sig.get("proof_text", ""),
        proof_url=sig.get("proof_url", ""),
        country_hint=sig.get("country_hint", ""),
        recommended_action=sig.get("recommended_action", ""),
        score=sig.get("score", 5),
        before_snapshot=sig.get("before_snapshot", ""),
        after_snapshot=sig.get("after_snapshot", ""),
    )
    db.add(ws)

    # Update or create TrackedPage
    page_type = sig.get("page_type", "")
    page_url  = sig.get("page_url", "")
    if page_type and page_url:
        r = await db.execute(
            select(TrackedPage).where(
                TrackedPage.account_id == account.id,
                TrackedPage.page_type == page_type,
            )
        )
        tp = r.scalar_one_or_none()
        if not tp:
            tp = TrackedPage(
                account_id=account.id,
                page_type=page_type,
                url=page_url,
            )
            db.add(tp)

        tp.content_hash = sig.get("content_hash", "")
        tp.last_scanned_at = datetime.utcnow()

        if page_type == "careers":
            tp.job_count = sig.get("current_count", 0)
            tp.country_keys = json.dumps(sig.get("current_countries", {}))
            tp.content_text = sig.get("after_snapshot", "")
        elif page_type == "sitemap":
            tp.country_keys = json.dumps(sig.get("current_countries", []))
            tp.content_text = sig.get("after_snapshot", "")
        elif page_type == "products":
            tp.product_keys = json.dumps(sig.get("current_products", []))
            tp.content_text = sig.get("after_snapshot", "")

    await db.commit()
    await db.refresh(ws)
    return ws


# ---------------------------------------------------------------------------
# Background scan task
# ---------------------------------------------------------------------------

async def _run_scan(account_id: str, user_id: str, db: AsyncSession):
    """Background task: scrape a company and persist new signals."""
    try:
        _scan_status[account_id] = {"status": "scanning", "started_at": datetime.utcnow().isoformat()}

        r = await db.execute(
            select(WatchlistAccount).where(
                WatchlistAccount.id == account_id,
                WatchlistAccount.user_id == user_id,
            )
        )
        account = r.scalar_one_or_none()
        if not account:
            _scan_status[account_id] = {"status": "error", "error": "Account not found"}
            return

        domain = account.domain.strip().lstrip("https://").lstrip("http://")
        if not domain:
            _scan_status[account_id] = {"status": "error", "error": "No domain set"}
            return

        # Load previous tracked pages
        tp_r = await db.execute(
            select(TrackedPage).where(TrackedPage.account_id == account_id)
        )
        tracked_pages = tp_r.scalars().all()
        prev_data = _get_prev_data(list(tracked_pages))

        # Run scraper
        signals = await scan_company(
            domain=domain,
            watch_hiring=account.watch_hiring,
            watch_expansion=account.watch_expansion,
            watch_products=True,
            prev_data=prev_data,
        )

        # Persist each detected signal
        saved = []
        for sig in signals:
            ws = await _persist_signal(db, user_id, account, sig)
            saved.append(ws.id)

        # Update last_checked on account
        account.last_checked = datetime.utcnow()
        await db.commit()

        _scan_status[account_id] = {
            "status": "done",
            "finished_at": datetime.utcnow().isoformat(),
            "signals_found": len(saved),
            "signal_ids": saved,
        }

    except Exception as e:
        _scan_status[account_id] = {"status": "error", "error": str(e)[:200]}


# ---------------------------------------------------------------------------
# Routes — Detection
# ---------------------------------------------------------------------------

@detect_router.post("/scan/{account_id}")
async def scan_account(
    account_id: str,
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Trigger a scan for a single watchlist company."""
    r = await db.execute(
        select(WatchlistAccount).where(
            WatchlistAccount.id == account_id,
            WatchlistAccount.user_id == user.id,
        )
    )
    account = r.scalar_one_or_none()
    if not account:
        raise HTTPException(404, "Account not found")
    if not account.domain:
        raise HTTPException(400, "Company has no domain set — add it first")

    status = _scan_status.get(account_id, {})
    if status.get("status") == "scanning":
        return {"success": True, "message": "Scan already in progress", "status": status}

    _scan_status[account_id] = {"status": "queued", "queued_at": datetime.utcnow().isoformat()}
    background_tasks.add_task(_run_scan, account_id, user.id, db)

    return {
        "success": True,
        "message": f"Scanning {account.company_name} ({account.domain})…",
        "account_id": account_id,
        "domain": account.domain,
    }


@detect_router.get("/status/{account_id}")
async def scan_status(
    account_id: str,
    user: User = Depends(get_current_user),
):
    """Poll scan status for an account."""
    status = _scan_status.get(account_id, {"status": "idle"})
    return {"success": True, "account_id": account_id, "scan": status}


@detect_router.post("/scan-all")
async def scan_all_accounts(
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Queue scans for all watchlist companies."""
    r = await db.execute(
        select(WatchlistAccount).where(WatchlistAccount.user_id == user.id)
    )
    accounts = r.scalars().all()
    if not accounts:
        return {"success": True, "message": "No companies in watchlist", "queued": 0}

    queued = 0
    for acc in accounts:
        if acc.domain and _scan_status.get(acc.id, {}).get("status") != "scanning":
            _scan_status[acc.id] = {"status": "queued", "queued_at": datetime.utcnow().isoformat()}
            background_tasks.add_task(_run_scan, acc.id, user.id, db)
            queued += 1

    return {
        "success": True,
        "message": f"Queued {queued} companies for scanning",
        "queued": queued,
        "total": len(accounts),
    }


# ---------------------------------------------------------------------------
# Routes — AI
# ---------------------------------------------------------------------------

@ai_router.get("/analyze/{signal_id}")
async def ai_analyze(
    signal_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """AI analysis of a signal — why it matters, urgency, suggested action."""
    r = await db.execute(
        select(WebSignal).where(WebSignal.id == signal_id, WebSignal.user_id == user.id)
    )
    s = r.scalar_one_or_none()
    if not s:
        raise HTTPException(404, "Signal not found")

    signal_dict = {
        "account_name": s.account_name,
        "signal_type": s.signal_type,
        "title": s.title,
        "summary": s.summary,
        "country_hint": s.country_hint,
        "proof_text": s.proof_text,
        "recommended_action": s.recommended_action,
        "score": s.score,
    }

    analysis = await analyze_signal(signal_dict)
    return {"success": True, "signal_id": signal_id, "analysis": analysis}


class DraftEmailReq(BaseModel):
    sender_name: str = "[Your Name]"
    sender_company: str = "[Your Company]"
    offering: str = "cross-border IT services"


@ai_router.post("/draft-email/{signal_id}")
async def ai_draft_email(
    signal_id: str,
    req: DraftEmailReq,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """AI-drafted cold outreach email based on a signal."""
    r = await db.execute(
        select(WebSignal).where(WebSignal.id == signal_id, WebSignal.user_id == user.id)
    )
    s = r.scalar_one_or_none()
    if not s:
        raise HTTPException(404, "Signal not found")

    signal_dict = {
        "account_name": s.account_name,
        "signal_type": s.signal_type,
        "title": s.title,
        "country_hint": s.country_hint,
        "proof_text": s.proof_text,
    }

    email = await draft_outreach_email(
        signal_dict,
        sender_name=req.sender_name,
        sender_company=req.sender_company,
        offering=req.offering,
    )
    return {"success": True, "signal_id": signal_id, "email_draft": email}
