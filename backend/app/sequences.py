"""Signal CRM v2 — Sequences API
Email / outreach sequence builder. Create multi-step campaigns,
enroll contacts, track open/reply rates.
"""
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from typing import Optional, List
from app.database import get_db
from app.auth import get_current_user
from app.models import User, Sequence, SequenceStep, SequenceEnrollment, Contact

sequences_router = APIRouter(prefix="/sequences", tags=["Sequences"])


def _fmt_sequence(s: Sequence, steps: list = None) -> dict:
    return {
        "id": s.id, "name": s.name, "description": s.description,
        "status": s.status, "steps_count": s.steps_count,
        "enrolled_count": s.enrolled_count,
        "open_rate": round(s.open_rate * 100, 1),
        "reply_rate": round(s.reply_rate * 100, 1),
        "created_at": s.created_at.isoformat(),
        "updated_at": s.updated_at.isoformat(),
        "steps": [
            {"id": st.id, "order_num": st.order_num, "type": st.type,
             "subject": st.subject, "body": st.body, "delay_days": st.delay_days}
            for st in sorted(steps or [], key=lambda x: x.order_num)
        ],
    }


class CreateSequenceReq(BaseModel):
    name: str; description: str = ""


class UpdateSequenceReq(BaseModel):
    name: Optional[str] = None; description: Optional[str] = None
    status: Optional[str] = None


class AddStepReq(BaseModel):
    type: str = "email"; order_num: int = 1
    subject: str = ""; body: str = ""; delay_days: int = 1


class EnrollContactReq(BaseModel):
    contact_id: str


@sequences_router.get("")
async def list_sequences(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(Sequence).where(Sequence.user_id == user.id).order_by(Sequence.updated_at.desc()))
    sequences = r.scalars().all()
    result = []
    for s in sequences:
        sr = await db.execute(select(SequenceStep).where(SequenceStep.sequence_id == s.id))
        steps = sr.scalars().all()
        result.append(_fmt_sequence(s, steps))
    return {"success": True, "sequences": result, "total": len(result)}


@sequences_router.get("/{sequence_id}")
async def get_sequence(
    sequence_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(Sequence).where(Sequence.id == sequence_id, Sequence.user_id == user.id))
    s = r.scalar_one_or_none()
    if not s:
        raise HTTPException(404, "Sequence not found")
    sr = await db.execute(select(SequenceStep).where(SequenceStep.sequence_id == sequence_id))
    steps = sr.scalars().all()
    er = await db.execute(
        select(SequenceEnrollment).where(SequenceEnrollment.sequence_id == sequence_id)
    )
    enrollments = er.scalars().all()
    return {
        "success": True,
        "sequence": _fmt_sequence(s, steps),
        "enrollments": [
            {"id": e.id, "contact_id": e.contact_id, "status": e.status,
             "current_step": e.current_step, "started_at": e.started_at.isoformat()}
            for e in enrollments
        ],
    }


@sequences_router.post("")
async def create_sequence(
    req: CreateSequenceReq,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    s = Sequence(user_id=user.id, name=req.name, description=req.description)
    db.add(s)
    await db.commit()
    await db.refresh(s)
    return {"success": True, "sequence": _fmt_sequence(s, [])}


@sequences_router.put("/{sequence_id}")
async def update_sequence(
    sequence_id: str, req: UpdateSequenceReq,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(Sequence).where(Sequence.id == sequence_id, Sequence.user_id == user.id))
    s = r.scalar_one_or_none()
    if not s:
        raise HTTPException(404, "Sequence not found")
    for k, v in req.model_dump(exclude_none=True).items():
        setattr(s, k, v)
    s.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(s)
    return {"success": True, "sequence": _fmt_sequence(s)}


@sequences_router.post("/{sequence_id}/steps")
async def add_step(
    sequence_id: str, req: AddStepReq,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(Sequence).where(Sequence.id == sequence_id, Sequence.user_id == user.id))
    s = r.scalar_one_or_none()
    if not s:
        raise HTTPException(404, "Sequence not found")
    step = SequenceStep(
        sequence_id=sequence_id, order_num=req.order_num,
        type=req.type, subject=req.subject, body=req.body, delay_days=req.delay_days,
    )
    db.add(step)
    s.steps_count += 1
    s.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(step)
    return {"success": True, "step": {"id": step.id, "order_num": step.order_num,
                                       "type": step.type, "subject": step.subject,
                                       "delay_days": step.delay_days}}


@sequences_router.delete("/{sequence_id}/steps/{step_id}")
async def delete_step(
    sequence_id: str, step_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(Sequence).where(Sequence.id == sequence_id, Sequence.user_id == user.id))
    s = r.scalar_one_or_none()
    if not s:
        raise HTTPException(404, "Sequence not found")
    sr = await db.execute(select(SequenceStep).where(SequenceStep.id == step_id, SequenceStep.sequence_id == sequence_id))
    step = sr.scalar_one_or_none()
    if not step:
        raise HTTPException(404, "Step not found")
    await db.delete(step)
    s.steps_count = max(0, s.steps_count - 1)
    s.updated_at = datetime.utcnow()
    await db.commit()
    return {"success": True}


@sequences_router.post("/{sequence_id}/enroll")
async def enroll_contact(
    sequence_id: str, req: EnrollContactReq,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(Sequence).where(Sequence.id == sequence_id, Sequence.user_id == user.id))
    s = r.scalar_one_or_none()
    if not s:
        raise HTTPException(404, "Sequence not found")
    if s.status == "draft":
        raise HTTPException(400, "Activate the sequence before enrolling contacts.")
    cr = await db.execute(select(Contact).where(Contact.id == req.contact_id, Contact.user_id == user.id))
    if not cr.scalar_one_or_none():
        raise HTTPException(404, "Contact not found")

    # Check not already enrolled
    er = await db.execute(
        select(SequenceEnrollment).where(
            SequenceEnrollment.sequence_id == sequence_id,
            SequenceEnrollment.contact_id == req.contact_id,
            SequenceEnrollment.status == "active",
        )
    )
    if er.scalar_one_or_none():
        raise HTTPException(400, "Contact already enrolled in this sequence.")

    enrollment = SequenceEnrollment(
        sequence_id=sequence_id, contact_id=req.contact_id,
        status="active", current_step=0,
        next_step_at=datetime.utcnow() + timedelta(days=1),
    )
    db.add(enrollment)
    s.enrolled_count += 1
    s.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(enrollment)
    return {"success": True, "enrollment": {"id": enrollment.id, "status": enrollment.status}}


@sequences_router.delete("/{sequence_id}")
async def delete_sequence(
    sequence_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(Sequence).where(Sequence.id == sequence_id, Sequence.user_id == user.id))
    s = r.scalar_one_or_none()
    if not s:
        raise HTTPException(404, "Sequence not found")
    await db.delete(s)
    await db.commit()
    return {"success": True, "message": "Sequence deleted."}
