"""Signal CRM — Next Best Action Engine (Supabase)"""
from datetime import datetime
from fastapi import APIRouter, Depends
from app.auth import get_current_user
from app.supabase_client import get_supabase

next_action_router = APIRouter(prefix="/next-actions", tags=["Next Actions"])
HIGH_RISK_COUNTRIES = {"Germany", "France", "Sweden", "Italy", "Canada", "Brazil", "Japan", "Spain"}


def _days_since(dt_str: str) -> int:
    try:
        dt = datetime.fromisoformat(dt_str.replace("Z", "+00:00")).replace(tzinfo=None)
        return (datetime.utcnow() - dt).days
    except Exception:
        return 0


@next_action_router.get("")
def get_next_actions(user: dict = Depends(get_current_user)):
    sb = get_supabase()
    signals = (sb.table("web_signals").select("*").eq("user_id", user["id"])
               .eq("is_dismissed", False).eq("is_actioned", False).execute().data or [])
    deals = (sb.table("deals").select("*").eq("user_id", user["id"]).execute().data or [])
    accounts = (sb.table("watchlist_accounts").select("*").eq("user_id", user["id"]).execute().data or [])

    actions = []

    for s in signals:
        if s.get("signal_strength") == "high":
            actions.append({
                "id": f"signal-{s['id']}", "priority": "urgent", "type": "contact_now",
                "title": f"Contact {s['account_name']} — {s['signal_type'].replace('_', ' ').title()} detected",
                "detail": s.get("recommended_action") or f"High-strength {s['signal_type']} detected at {s['account_name']}.",
                "proof": s.get("title", ""), "proof_detail": s.get("summary", ""),
                "target_company": s.get("account_name", ""), "target_country": s.get("country_hint", ""),
                "signal_id": str(s["id"]), "detected_at": s.get("detected_at", ""),
            })

    for s in signals:
        if s.get("signal_strength") == "medium" and _days_since(s.get("detected_at", "")) >= 3:
            actions.append({
                "id": f"signal-med-{s['id']}", "priority": "high", "type": "contact_now",
                "title": f"Follow up on {s['account_name']} signal — {_days_since(s.get('detected_at', ''))} days old",
                "detail": s.get("recommended_action", ""), "proof": s.get("title", ""),
                "target_company": s.get("account_name", ""), "target_country": s.get("country_hint", ""),
            })

    for d in deals:
        if d.get("stage") not in ("won", "lost"):
            days_stuck = _days_since(d.get("updated_at", ""))
            country = d.get("country", "")
            if days_stuck > 21:
                actions.append({
                    "id": f"deal-stuck-{d['id']}", "priority": "high", "type": "advance_deal",
                    "title": f"Deal '{d['title']}' stuck in '{d['stage']}' for {days_stuck} days",
                    "detail": f"Move this deal forward — {d.get('next_action') or 'schedule a call or send a proposal'}.",
                    "deal_id": str(d["id"]), "target_company": d.get("company_name", ""),
                })
            if country in HIGH_RISK_COUNTRIES and not d.get("compliance_checked"):
                actions.append({
                    "id": f"deal-compliance-{d['id']}", "priority": "high", "type": "compliance_check",
                    "title": f"Run compliance check for {d.get('company_name', '')} — {country} has strict outreach rules",
                    "detail": f"{country} has strict outbound compliance requirements (GDPR/privacy law). Check before outreach.",
                    "deal_id": str(d["id"]), "target_country": country,
                })

    if len(accounts) == 0:
        actions.append({
            "id": "setup-watchlist", "priority": "medium", "type": "setup",
            "title": "Add companies to your watchlist to start receiving signals",
            "detail": "Add competitor or target accounts to your watchlist. Signal CRM will monitor for hiring spikes, new country pages, pricing changes, and more.",
        })

    actions.sort(key=lambda x: {"urgent": 0, "high": 1, "medium": 2, "low": 3}.get(x.get("priority", "low"), 3))
    return {"success": True, "actions": actions[:15], "total": len(actions)}
