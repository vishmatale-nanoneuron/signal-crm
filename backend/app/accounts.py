"""Signal CRM v2 — Accounts API
World-class account/company management with health scoring,
churn prediction, ARR tracking, and contact rollups.
"""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from pydantic import BaseModel
from typing import Optional
from app.database import get_db
from app.auth import get_current_user
from app.models import User, Account, Contact, Activity, Deal, Task

accounts_router = APIRouter(prefix="/accounts", tags=["Accounts"])

STAGES = ["prospect", "customer", "partner", "churned"]
EMPLOYEE_BANDS = ["1-10", "11-50", "51-200", "201-500", "500+"]


def _fmt(a: Account) -> dict:
    return {
        "id": a.id, "name": a.name, "domain": a.domain,
        "industry": a.industry, "country": a.country, "city": a.city,
        "employees": a.employees, "revenue_range": a.revenue_range,
        "phone": a.phone, "linkedin": a.linkedin, "website": a.website,
        "stage": a.stage, "health_score": a.health_score,
        "churn_risk": a.churn_risk, "arr": a.arr,
        "tags": a.tags, "notes": a.notes,
        "assigned_to": a.assigned_to,
        "created_at": a.created_at.isoformat(),
        "updated_at": a.updated_at.isoformat(),
    }


class CreateAccountReq(BaseModel):
    name: str; domain: str = ""; industry: str = ""; country: str = ""
    city: str = ""; employees: str = ""; revenue_range: str = ""
    phone: str = ""; linkedin: str = ""; website: str = ""
    stage: str = "prospect"; arr: float = 0.0
    tags: str = "[]"; notes: str = ""


class UpdateAccountReq(BaseModel):
    name: Optional[str] = None; domain: Optional[str] = None
    industry: Optional[str] = None; country: Optional[str] = None
    city: Optional[str] = None; employees: Optional[str] = None
    revenue_range: Optional[str] = None; phone: Optional[str] = None
    linkedin: Optional[str] = None; website: Optional[str] = None
    stage: Optional[str] = None; arr: Optional[float] = None
    health_score: Optional[int] = None; churn_risk: Optional[float] = None
    tags: Optional[str] = None; notes: Optional[str] = None


@accounts_router.get("")
async def list_accounts(
    q: str = Query(""),
    stage: str = Query(""),
    industry: str = Query(""),
    country: str = Query(""),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Account).where(Account.user_id == user.id)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(Account.name.ilike(like), Account.domain.ilike(like)))
    if stage:
        stmt = stmt.where(Account.stage == stage)
    if industry:
        stmt = stmt.where(Account.industry.ilike(f"%{industry}%"))
    if country:
        stmt = stmt.where(Account.country == country)

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar_one()

    stmt = stmt.order_by(Account.health_score.desc(), Account.updated_at.desc()).limit(limit).offset(offset)
    rows = (await db.execute(stmt)).scalars().all()

    # Stage summary
    stage_r = await db.execute(
        select(Account.stage, func.count(Account.id))
        .where(Account.user_id == user.id).group_by(Account.stage)
    )
    stage_counts = {s: c for s, c in stage_r.all()}

    # Total ARR
    arr_r = await db.execute(
        select(func.sum(Account.arr)).where(Account.user_id == user.id)
    )
    total_arr = arr_r.scalar_one() or 0

    return {
        "success": True, "accounts": [_fmt(a) for a in rows],
        "total": total, "limit": limit, "offset": offset,
        "stages": stage_counts, "total_arr": total_arr,
    }


@accounts_router.get("/{account_id}")
async def get_account(
    account_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(Account).where(Account.id == account_id, Account.user_id == user.id))
    a = r.scalar_one_or_none()
    if not a:
        raise HTTPException(404, "Account not found")

    contacts_r = await db.execute(
        select(Contact).where(Contact.account_id == account_id).limit(20)
    )
    contacts = contacts_r.scalars().all()

    deals_r = await db.execute(
        select(Deal).where(Deal.company_name == a.name, Deal.user_id == user.id).limit(10)
    )
    deals = deals_r.scalars().all()

    activities_r = await db.execute(
        select(Activity)
        .where(Activity.account_id == account_id)
        .order_by(Activity.created_at.desc()).limit(10)
    )
    activities = activities_r.scalars().all()

    return {
        "success": True, "account": _fmt(a),
        "contacts": [
            {"id": c.id, "name": f"{c.first_name} {c.last_name}".strip(),
             "title": c.title, "email": c.email, "lead_score": c.lead_score}
            for c in contacts
        ],
        "deals": [
            {"id": d.id, "title": d.title, "stage": d.stage,
             "value": d.value, "currency": d.currency}
            for d in deals
        ],
        "activities": [
            {"id": act.id, "type": act.type, "title": act.title,
             "outcome": act.outcome, "created_at": act.created_at.isoformat()}
            for act in activities
        ],
        "contact_count": len(contacts),
        "deal_count": len(deals),
    }


@accounts_router.post("")
async def create_account(
    req: CreateAccountReq,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if req.stage not in STAGES:
        raise HTTPException(400, f"Invalid stage: {STAGES}")
    a = Account(
        user_id=user.id, name=req.name, domain=req.domain,
        industry=req.industry, country=req.country, city=req.city,
        employees=req.employees, revenue_range=req.revenue_range,
        phone=req.phone, linkedin=req.linkedin, website=req.website,
        stage=req.stage, arr=req.arr, tags=req.tags, notes=req.notes,
    )
    db.add(a)
    await db.commit()
    await db.refresh(a)
    return {"success": True, "account": _fmt(a)}


@accounts_router.put("/{account_id}")
async def update_account(
    account_id: str, req: UpdateAccountReq,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(Account).where(Account.id == account_id, Account.user_id == user.id))
    a = r.scalar_one_or_none()
    if not a:
        raise HTTPException(404, "Account not found")
    for k, v in req.model_dump(exclude_none=True).items():
        setattr(a, k, v)
    a.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(a)
    return {"success": True, "account": _fmt(a)}


@accounts_router.delete("/{account_id}")
async def delete_account(
    account_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(Account).where(Account.id == account_id, Account.user_id == user.id))
    a = r.scalar_one_or_none()
    if not a:
        raise HTTPException(404, "Account not found")
    await db.delete(a)
    await db.commit()
    return {"success": True, "message": "Account deleted."}


@accounts_router.get("/export/csv-data")
async def export_accounts(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(Account).where(Account.user_id == user.id).order_by(Account.arr.desc()))
    accounts = r.scalars().all()
    return {
        "success": True,
        "rows": [
            {
                "Name": a.name, "Domain": a.domain, "Industry": a.industry,
                "Country": a.country, "City": a.city, "Employees": a.employees,
                "Revenue Range": a.revenue_range, "Stage": a.stage.title(),
                "ARR (INR)": a.arr, "Health Score": a.health_score,
                "Churn Risk %": round(a.churn_risk * 100, 1),
                "Website": a.website, "LinkedIn": a.linkedin,
                "Created": a.created_at.strftime("%Y-%m-%d"),
            }
            for a in accounts
        ],
    }
