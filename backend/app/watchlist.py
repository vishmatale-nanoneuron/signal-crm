"""Signal CRM — Watchlist Account Management (Supabase)"""
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.auth import get_current_user
from app.supabase_client import get_supabase

watchlist_router = APIRouter(prefix="/watchlist", tags=["Watchlist"])


class AddAccountReq(BaseModel):
    company_name: str
    domain: str
    industry: str = ""
    country: str = ""
    hq_country: str = ""
    employee_size: str = ""
    priority: str = "medium"
    watch_hiring: bool = True
    watch_pricing: bool = True
    watch_compliance: bool = True
    watch_leadership: bool = True
    watch_expansion: bool = True
    notes: str = ""


class UpdateAccountReq(BaseModel):
    company_name: Optional[str] = None
    domain: Optional[str] = None
    industry: Optional[str] = None
    country: Optional[str] = None
    hq_country: Optional[str] = None
    employee_size: Optional[str] = None
    priority: Optional[str] = None
    watch_hiring: Optional[bool] = None
    watch_pricing: Optional[bool] = None
    watch_compliance: Optional[bool] = None
    watch_leadership: Optional[bool] = None
    watch_expansion: Optional[bool] = None
    notes: Optional[str] = None


@watchlist_router.get("")
def list_accounts(user: dict = Depends(get_current_user)):
    sb = get_supabase()
    result = sb.table("watchlist_accounts").select("*").eq("user_id", user["id"]).order("created_at", desc=True).execute()
    accounts = result.data or []
    return {"success": True, "accounts": accounts, "total": len(accounts)}


@watchlist_router.post("")
def add_account(req: AddAccountReq, user: dict = Depends(get_current_user)):
    sb = get_supabase()
    domain = req.domain.lower().strip()
    existing = sb.table("watchlist_accounts").select("id").eq("user_id", user["id"]).eq("domain", domain).execute()
    if existing.data:
        raise HTTPException(400, f"'{domain}' is already in your watchlist")
    row = {
        "user_id": user["id"],
        "company_name": req.company_name.strip(),
        "domain": domain,
        "industry": req.industry,
        "country": req.country,
        "hq_country": req.hq_country,
        "employee_size": req.employee_size,
        "priority": req.priority,
        "watch_hiring": req.watch_hiring,
        "watch_pricing": req.watch_pricing,
        "watch_compliance": req.watch_compliance,
        "watch_leadership": req.watch_leadership,
        "watch_expansion": req.watch_expansion,
        "notes": req.notes,
        "last_checked": datetime.utcnow().isoformat(),
    }
    result = sb.table("watchlist_accounts").insert(row).execute()
    return {"success": True, "account": result.data[0], "message": f"'{req.company_name}' added to watchlist."}


@watchlist_router.put("/{account_id}")
def update_account(account_id: str, req: UpdateAccountReq, user: dict = Depends(get_current_user)):
    sb = get_supabase()
    existing = sb.table("watchlist_accounts").select("id").eq("id", account_id).eq("user_id", user["id"]).execute()
    if not existing.data:
        raise HTTPException(404, "Account not found")
    updates = {k: v for k, v in req.model_dump(exclude_none=True).items()}
    if not updates:
        raise HTTPException(400, "No fields to update")
    result = sb.table("watchlist_accounts").update(updates).eq("id", account_id).eq("user_id", user["id"]).execute()
    return {"success": True, "account": result.data[0], "message": "Account updated."}


@watchlist_router.delete("/{account_id}")
def delete_account(account_id: str, user: dict = Depends(get_current_user)):
    sb = get_supabase()
    existing = sb.table("watchlist_accounts").select("company_name").eq("id", account_id).eq("user_id", user["id"]).execute()
    if not existing.data:
        raise HTTPException(404, "Account not found")
    name = existing.data[0].get("company_name", "")
    sb.table("watchlist_accounts").delete().eq("id", account_id).eq("user_id", user["id"]).execute()
    return {"success": True, "message": f"'{name}' removed from watchlist."}


@watchlist_router.get("/{account_id}/signals")
def account_signals(account_id: str, user: dict = Depends(get_current_user)):
    sb = get_supabase()
    acc = sb.table("watchlist_accounts").select("id,company_name").eq("id", account_id).eq("user_id", user["id"]).maybe_single().execute()
    if not acc.data:
        raise HTTPException(404, "Account not found")
    signals = sb.table("web_signals").select("*").eq("account_id", account_id).eq("is_dismissed", False).order("detected_at", desc=True).execute()
    return {"success": True, "account": acc.data, "signals": signals.data or [], "total": len(signals.data or [])}
