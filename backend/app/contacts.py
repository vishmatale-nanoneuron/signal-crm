"""Signal CRM v2 — Contacts API
World-class contact management with AI lead scoring,
activity timeline, sequence enrollment, smart search, and CSV import/export.
"""
import csv
import io
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from pydantic import BaseModel
from typing import Optional
from app.database import get_db
from app.auth import get_current_user
from app.models import User, Contact, Activity, Task, Deal, _uuid

contacts_router = APIRouter(prefix="/contacts", tags=["Contacts"])

STAGES = ["prospect", "mql", "sql", "opportunity", "customer", "churned"]
SOURCES = ["manual", "signal", "import", "form", "linkedin", "referral"]

# ── Stage → default score ────────────────────────────────────────────────────
STAGE_SCORE = {
    "prospect": 20, "mql": 40, "sql": 60,
    "opportunity": 75, "customer": 90, "churned": 10,
}


def _fmt(c: Contact) -> dict:
    return {
        "id": c.id, "account_id": c.account_id, "deal_id": c.deal_id,
        "first_name": c.first_name, "last_name": c.last_name,
        "name": f"{c.first_name} {c.last_name}".strip(),
        "email": c.email, "phone": c.phone,
        "title": c.title, "department": c.department,
        "linkedin": c.linkedin, "twitter": c.twitter,
        "country": c.country, "timezone": c.timezone, "language": c.language,
        "lead_score": c.lead_score, "health_score": c.health_score,
        "stage": c.stage, "source": c.source,
        "tags": c.tags, "notes": c.notes,
        "is_unsubscribed": c.is_unsubscribed,
        "last_contacted": c.last_contacted.isoformat() if c.last_contacted else None,
        "created_at": c.created_at.isoformat(),
        "updated_at": c.updated_at.isoformat(),
    }


class CreateContactReq(BaseModel):
    first_name: str; last_name: str = ""; email: str = ""; phone: str = ""
    title: str = ""; department: str = ""; linkedin: str = ""; twitter: str = ""
    country: str = ""; timezone: str = ""; language: str = "en"
    stage: str = "prospect"; source: str = "manual"
    account_id: Optional[str] = None; deal_id: Optional[str] = None
    tags: str = "[]"; notes: str = ""


class UpdateContactReq(BaseModel):
    first_name: Optional[str] = None; last_name: Optional[str] = None
    email: Optional[str] = None; phone: Optional[str] = None
    title: Optional[str] = None; department: Optional[str] = None
    linkedin: Optional[str] = None; twitter: Optional[str] = None
    country: Optional[str] = None; timezone: Optional[str] = None
    stage: Optional[str] = None; source: Optional[str] = None
    account_id: Optional[str] = None; deal_id: Optional[str] = None
    tags: Optional[str] = None; notes: Optional[str] = None
    lead_score: Optional[int] = None; health_score: Optional[int] = None
    is_unsubscribed: Optional[bool] = None


# ── List / search ─────────────────────────────────────────────────────────────
@contacts_router.get("")
async def list_contacts(
    q: str = Query("", description="Search name/email"),
    stage: str = Query("", description="Filter by stage"),
    country: str = Query("", description="Filter by country"),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Contact).where(Contact.user_id == user.id)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(
            Contact.first_name.ilike(like), Contact.last_name.ilike(like),
            Contact.email.ilike(like), Contact.title.ilike(like),
        ))
    if stage:
        stmt = stmt.where(Contact.stage == stage)
    if country:
        stmt = stmt.where(Contact.country == country)

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar_one()

    stmt = stmt.order_by(Contact.lead_score.desc(), Contact.updated_at.desc()).limit(limit).offset(offset)
    rows = (await db.execute(stmt)).scalars().all()

    # Stage summary
    stage_r = await db.execute(
        select(Contact.stage, func.count(Contact.id))
        .where(Contact.user_id == user.id)
        .group_by(Contact.stage)
    )
    stage_counts = {s: c for s, c in stage_r.all()}

    return {
        "success": True, "contacts": [_fmt(c) for c in rows],
        "total": total, "limit": limit, "offset": offset,
        "stages": stage_counts,
    }


# ── Single contact + timeline ─────────────────────────────────────────────────
@contacts_router.get("/{contact_id}")
async def get_contact(
    contact_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(Contact).where(Contact.id == contact_id, Contact.user_id == user.id))
    c = r.scalar_one_or_none()
    if not c:
        raise HTTPException(404, "Contact not found")

    # Activity timeline for this contact
    act_r = await db.execute(
        select(Activity)
        .where(Activity.contact_id == contact_id)
        .order_by(Activity.created_at.desc())
        .limit(20)
    )
    activities = act_r.scalars().all()

    # Open tasks
    task_r = await db.execute(
        select(Task).where(Task.contact_id == contact_id, Task.status != "done")
        .order_by(Task.due_date.asc().nullslast())
    )
    tasks = task_r.scalars().all()

    return {
        "success": True, "contact": _fmt(c),
        "activities": [
            {"id": a.id, "type": a.type, "title": a.title, "body": a.body,
             "outcome": a.outcome, "direction": a.direction,
             "duration_secs": a.duration_secs,
             "created_at": a.created_at.isoformat()}
            for a in activities
        ],
        "tasks": [
            {"id": t.id, "title": t.title, "priority": t.priority,
             "status": t.status, "due_date": t.due_date}
            for t in tasks
        ],
    }


# ── Create ────────────────────────────────────────────────────────────────────
@contacts_router.post("")
async def create_contact(
    req: CreateContactReq,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if req.stage not in STAGES:
        raise HTTPException(400, f"Invalid stage. Must be one of: {STAGES}")
    score = STAGE_SCORE.get(req.stage, 50)
    c = Contact(
        user_id=user.id,
        first_name=req.first_name, last_name=req.last_name,
        email=req.email, phone=req.phone, title=req.title,
        department=req.department, linkedin=req.linkedin, twitter=req.twitter,
        country=req.country, timezone=req.timezone, language=req.language,
        lead_score=score, stage=req.stage, source=req.source,
        account_id=req.account_id, deal_id=req.deal_id,
        tags=req.tags, notes=req.notes,
    )
    db.add(c)
    await db.commit()
    await db.refresh(c)
    return {"success": True, "contact": _fmt(c)}


# ── Update ────────────────────────────────────────────────────────────────────
@contacts_router.put("/{contact_id}")
async def update_contact(
    contact_id: str, req: UpdateContactReq,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(Contact).where(Contact.id == contact_id, Contact.user_id == user.id))
    c = r.scalar_one_or_none()
    if not c:
        raise HTTPException(404, "Contact not found")
    for k, v in req.model_dump(exclude_none=True).items():
        setattr(c, k, v)
    if req.stage and req.lead_score is None:
        c.lead_score = STAGE_SCORE.get(req.stage, c.lead_score)
    c.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(c)
    return {"success": True, "contact": _fmt(c)}


# ── Delete ────────────────────────────────────────────────────────────────────
@contacts_router.delete("/{contact_id}")
async def delete_contact(
    contact_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(Contact).where(Contact.id == contact_id, Contact.user_id == user.id))
    c = r.scalar_one_or_none()
    if not c:
        raise HTTPException(404, "Contact not found")
    await db.delete(c)
    await db.commit()
    return {"success": True, "message": "Contact deleted."}


# ── AI Score refresh ──────────────────────────────────────────────────────────
@contacts_router.post("/{contact_id}/score")
async def ai_score_contact(
    contact_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Recompute lead score based on activity recency, stage, and engagement."""
    r = await db.execute(select(Contact).where(Contact.id == contact_id, Contact.user_id == user.id))
    c = r.scalar_one_or_none()
    if not c:
        raise HTTPException(404, "Contact not found")

    # Simple scoring heuristic — in prod this would call Claude/OpenAI
    base = STAGE_SCORE.get(c.stage, 50)
    recency_bonus = 0
    if c.last_contacted:
        days_since = (datetime.utcnow() - c.last_contacted).days
        if days_since <= 7:   recency_bonus = 15
        elif days_since <= 30: recency_bonus = 8
        elif days_since <= 90: recency_bonus = 3
    has_email    = 5 if c.email else 0
    has_phone    = 5 if c.phone else 0
    has_linkedin = 5 if c.linkedin else 0

    c.lead_score  = min(100, base + recency_bonus + has_email + has_phone + has_linkedin)
    c.health_score = max(0, c.health_score - (max(0, (datetime.utcnow() - (c.last_contacted or c.created_at)).days - 30)))
    c.updated_at  = datetime.utcnow()
    await db.commit()
    await db.refresh(c)
    return {"success": True, "contact": _fmt(c), "new_score": c.lead_score}


# ── Export ────────────────────────────────────────────────────────────────────
@contacts_router.get("/export/csv-data")
async def export_contacts(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(Contact).where(Contact.user_id == user.id).order_by(Contact.lead_score.desc()))
    contacts = r.scalars().all()
    return {
        "success": True,
        "rows": [
            {
                "Name": f"{c.first_name} {c.last_name}".strip(),
                "Email": c.email, "Phone": c.phone,
                "Title": c.title, "Department": c.department,
                "Company": c.account_id or "", "Country": c.country,
                "Stage": c.stage.title(), "Lead Score": c.lead_score,
                "Source": c.source, "LinkedIn": c.linkedin,
                "Last Contacted": c.last_contacted.strftime("%Y-%m-%d") if c.last_contacted else "",
                "Created": c.created_at.strftime("%Y-%m-%d"),
            }
            for c in contacts
        ],
    }


# ── CSV Import ────────────────────────────────────────────────────────────────
_CSV_FIELD_MAP = {
    # CSV column → Contact field
    "first_name": "first_name", "firstname": "first_name", "first": "first_name",
    "last_name": "last_name", "lastname": "last_name", "last": "last_name",
    "name": "__fullname__",  # split on first space
    "full_name": "__fullname__", "fullname": "__fullname__",
    "email": "email", "email_address": "email",
    "phone": "phone", "mobile": "phone", "phone_number": "phone",
    "title": "title", "job_title": "title", "position": "title",
    "department": "department", "dept": "department",
    "company": "__company_notes__",  # stored in notes as "Company: X"
    "company_name": "__company_notes__",
    "country": "country", "location": "country",
    "linkedin": "linkedin", "linkedin_url": "linkedin",
    "stage": "stage", "status": "stage",
    "notes": "notes", "note": "notes",
    "source": "source",
}

def _parse_contact_row(row: dict) -> dict:
    """Normalise a CSV row dict → Contact kwargs."""
    lowered = {k.strip().lower().replace(" ", "_"): v.strip() for k, v in row.items()}
    out = {
        "first_name": "", "last_name": "", "email": "", "phone": "",
        "title": "", "department": "", "country": "", "linkedin": "",
        "stage": "prospect", "source": "import", "notes": "",
    }
    for csv_col, val in lowered.items():
        field = _CSV_FIELD_MAP.get(csv_col)
        if not field or not val:
            continue
        if field == "__fullname__":
            parts = val.split(" ", 1)
            out["first_name"] = parts[0]
            out["last_name"]  = parts[1] if len(parts) > 1 else ""
        elif field == "__company_notes__":
            out["notes"] = f"Company: {val}" + (f"\n{out['notes']}" if out["notes"] else "")
        elif field in out:
            if field == "stage" and val.lower() not in STAGES:
                val = "prospect"
            out[field] = val
    return out


@contacts_router.post("/import")
async def import_contacts_csv(
    file: UploadFile = File(..., description="CSV file with contacts"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Bulk import contacts from CSV. Skips rows with duplicate emails."""
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(400, "Only CSV files are supported.")
    raw = await file.read()
    try:
        text = raw.decode("utf-8-sig")  # handle BOM
    except UnicodeDecodeError:
        text = raw.decode("latin-1")

    reader = csv.DictReader(io.StringIO(text))
    rows = list(reader)
    if not rows:
        return {"success": True, "created": 0, "skipped": 0, "errors": ["Empty CSV"]}

    # Fetch existing emails for dedup
    existing_r = await db.execute(
        select(Contact.email).where(Contact.user_id == user.id)
    )
    existing_emails = {e for (e,) in existing_r.all() if e}

    created = skipped = 0
    errors = []
    for i, row in enumerate(rows[:500]):  # max 500 rows per import
        try:
            data = _parse_contact_row(row)
            if not data["first_name"]:
                skipped += 1
                continue
            if data["email"] and data["email"] in existing_emails:
                skipped += 1
                continue
            c = Contact(
                id=_uuid(), user_id=user.id,
                first_name=data["first_name"], last_name=data["last_name"],
                email=data["email"], phone=data["phone"],
                title=data["title"], department=data["department"],
                country=data["country"], linkedin=data["linkedin"],
                stage=data["stage"], source=data["source"],
                notes=data["notes"],
                lead_score=STAGE_SCORE.get(data["stage"], 20),
            )
            db.add(c)
            if data["email"]:
                existing_emails.add(data["email"])
            created += 1
        except Exception as e:
            errors.append(f"Row {i+2}: {str(e)[:80]}")

    await db.commit()
    return {
        "success": True,
        "created": created,
        "skipped": skipped,
        "errors": errors[:10],
        "message": f"Imported {created} contacts" + (f", skipped {skipped} duplicates" if skipped else ""),
    }
