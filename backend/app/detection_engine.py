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


class ChatMsg(BaseModel):
    role: str     # "user" | "assistant"
    content: str


class ChatReq(BaseModel):
    messages: list[ChatMsg]


@ai_router.post("/chat")
async def ai_chat(
    req: ChatReq,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Conversational AI assistant with full user context (signals, pipeline)."""
    from app.config import get_settings
    from app.models import Deal
    import os

    settings = get_settings()
    api_key = settings.OPENAI_API_KEY or os.environ.get("OPENAI_API_KEY", "")

    # Load user's top signals for context
    sig_r = await db.execute(
        select(WebSignal)
        .where(WebSignal.user_id == user.id, WebSignal.is_dismissed == False)
        .order_by(WebSignal.score.desc())
        .limit(6)
    )
    signals = sig_r.scalars().all()
    signals_ctx = "\n".join([
        f"  - {s.account_name}: {s.title} (type={s.signal_type}, score={s.score}/10, country={s.country_hint})"
        for s in signals
    ]) or "  No signals detected yet"

    # Pipeline stats
    deal_r = await db.execute(select(Deal).where(Deal.user_id == user.id))
    deals = deal_r.scalars().all()
    active = [d for d in deals if d.stage not in ("won", "lost")]
    won = [d for d in deals if d.stage == "won"]
    pipeline_val = sum(d.value for d in active)

    system_prompt = f"""You are Signal AI, a sharp B2B sales assistant built into Signal CRM.

You help {user.name or "this user"} at {user.company_name or "their company"} win cross-border deals.
Target markets: Indian exporters, IT services firms, SaaS agencies expanding globally.

USER'S LIVE DATA:
Active signals (top 6):
{signals_ctx}

Pipeline: {len(active)} active deals | Value: ₹{pipeline_val:,.0f} | Won: {len(won)} deals

WHAT YOU CAN DO:
- Prioritize which signals to act on (and why)
- Suggest specific outreach strategies for named companies
- Draft cold emails or LinkedIn messages
- Explain compliance rules for any country
- Recommend next pipeline actions
- Answer cross-border sales strategy questions

RULES:
- Be concise and specific — max 4-5 sentences per response
- Always recommend a concrete next action
- Reference actual signals/companies from the user's data when relevant
- Use ₹ for Indian amounts, $ for USD"""

    last_msg = req.messages[-1].content.lower() if req.messages else ""

    # Rule-based fallback (when no API key)
    if not api_key:
        if any(w in last_msg for w in ["priorit", "top signal", "act on", "which signal", "best signal"]):
            if signals:
                s = signals[0]
                resp = f"Your #1 signal right now is **{s.account_name}** — _{s.title}_ (Score: {s.score}/10).\n\n**Why:** {s.recommended_action}\n\n→ Open the dashboard, click **Full Analysis** on this signal, then draft an email."
            else:
                resp = "No active signals yet. Go to **Watchlist** → add companies → click **Scan Now** to detect hiring spikes, country launches, and product changes."
        elif any(w in last_msg for w in ["email", "draft", "outreach", "message"]):
            resp = "To draft an outreach email:\n1. Dashboard → click **Full Analysis** on any signal\n2. Click **✉ Draft Outreach Email**\n3. Enter your offering → Generate\n\nOr use **Email Templates** (top nav) for any country."
        elif any(w in last_msg for w in ["pipeline", "deal", "stage", "pipeline"]):
            resp = f"Your pipeline: **{len(active)} active deals** worth ₹{pipeline_val:,.0f}.\n\nGo to **Deals** page → use Kanban to move deals forward → each signal card has **+ Add to Pipeline** to create a deal in one click."
        elif any(w in last_msg for w in ["compliance", "gdpr", "law", "legal", "cold email"]):
            resp = "Go to **Compliance** in the top nav → select a country → see cold email rules, GDPR/PDPA/CASL requirements, penalties, and opt-in rules. Each Lead card also has a ⚖ Compliance quick-link."
        elif any(w in last_msg for w in ["country", "market", "expand", "germany", "singapore", "uae", "usa", "uk"]):
            resp = "Go to **Country Intel** → search any country → see timezone, best contact hours, decision speed, buyer persona, and compliance status. You can also filter by risk level."
        elif any(w in last_msg for w in ["watchlist", "scan", "monitor", "detect"]):
            resp = "Go to **Watchlist** → add a company domain (e.g. freshworks.com) → click **Scan** to detect hiring spikes, new country pages, and product launches. Click **Scan All** to run all companies at once."
        else:
            resp = f"Hi! I'm Signal AI. You have **{len(signals)} active signals** and **{len(active)} deals** in pipeline.\n\nAsk me:\n• _Which signals should I act on today?_\n• _Draft an email for [Company]_\n• _Can I cold email Germany?_\n• _What's my best pipeline deal?_"
        return {"success": True, "message": resp, "source": "rule-based"}

    # OpenAI path
    try:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=api_key)

        msgs = [{"role": "system", "content": system_prompt}]
        for m in req.messages[-12:]:
            msgs.append({"role": m.role, "content": m.content})

        result = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=msgs,
            max_tokens=350,
            temperature=0.45,
        )
        return {"success": True, "message": result.choices[0].message.content, "source": "gpt-4o-mini"}

    except Exception:
        if signals:
            s = signals[0]
            return {"success": True, "message": f"AI temporarily unavailable.\n\nYour top signal: **{s.account_name}** — {s.title}. Score: {s.score}/10.\n\nRecommended action: {s.recommended_action}", "source": "fallback"}
        return {"success": True, "message": "AI temporarily unavailable. Check your OpenAI API key in Railway settings.", "source": "fallback"}


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
