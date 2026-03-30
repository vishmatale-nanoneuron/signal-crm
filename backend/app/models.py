import uuid
from datetime import datetime
from sqlalchemy import String, Boolean, Integer, Float, DateTime, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    name: Mapped[str] = mapped_column(String(255), default="")
    company_name: Mapped[str] = mapped_column(String(255), default="")
    credits: Mapped[int] = mapped_column(Integer, default=20)
    plan: Mapped[str] = mapped_column(String(50), default="trial")
    is_paid: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    trial_start: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    trial_end: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class WatchlistAccount(Base):
    __tablename__ = "watchlist_accounts"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    company_name: Mapped[str] = mapped_column(String(255))
    domain: Mapped[str] = mapped_column(String(255))
    industry: Mapped[str] = mapped_column(String(100), default="")
    country: Mapped[str] = mapped_column(String(100), default="")
    hq_country: Mapped[str] = mapped_column(String(100), default="")
    employee_size: Mapped[str] = mapped_column(String(50), default="")
    priority: Mapped[str] = mapped_column(String(20), default="medium")
    watch_hiring: Mapped[bool] = mapped_column(Boolean, default=True)
    watch_pricing: Mapped[bool] = mapped_column(Boolean, default=True)
    watch_compliance: Mapped[bool] = mapped_column(Boolean, default=True)
    watch_leadership: Mapped[bool] = mapped_column(Boolean, default=True)
    watch_expansion: Mapped[bool] = mapped_column(Boolean, default=True)
    notes: Mapped[str] = mapped_column(Text, default="")
    last_checked: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class WebSignal(Base):
    __tablename__ = "web_signals"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    account_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("watchlist_accounts.id", ondelete="SET NULL"), nullable=True)
    account_name: Mapped[str] = mapped_column(String(255))
    signal_type: Mapped[str] = mapped_column(String(50))
    signal_strength: Mapped[str] = mapped_column(String(20), default="medium")
    title: Mapped[str] = mapped_column(String(500))
    summary: Mapped[str] = mapped_column(Text)
    proof_text: Mapped[str] = mapped_column(Text, default="")
    proof_url: Mapped[str] = mapped_column(String(500), default="")
    country_hint: Mapped[str] = mapped_column(String(100), default="")
    recommended_action: Mapped[str] = mapped_column(Text, default="")
    score: Mapped[int] = mapped_column(Integer, default=5)
    is_actioned: Mapped[bool] = mapped_column(Boolean, default=False)
    is_dismissed: Mapped[bool] = mapped_column(Boolean, default=False)
    detected_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Deal(Base):
    __tablename__ = "deals"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(255))
    company_name: Mapped[str] = mapped_column(String(255), default="")
    contact_name: Mapped[str] = mapped_column(String(255), default="")
    contact_title: Mapped[str] = mapped_column(String(255), default="")
    value: Mapped[float] = mapped_column(Float, default=0)
    currency: Mapped[str] = mapped_column(String(10), default="INR")
    stage: Mapped[str] = mapped_column(String(50), default="signal")
    country: Mapped[str] = mapped_column(String(100), default="")
    industry: Mapped[str] = mapped_column(String(100), default="")
    signal_trigger: Mapped[str] = mapped_column(String(500), default="")
    compliance_checked: Mapped[bool] = mapped_column(Boolean, default=False)
    next_action: Mapped[str] = mapped_column(Text, default="")
    probability: Mapped[int] = mapped_column(Integer, default=10)
    close_date: Mapped[str] = mapped_column(String(50), default="")
    notes: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Lead(Base):
    __tablename__ = "leads"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    company: Mapped[str] = mapped_column(String(255))
    contact_name: Mapped[str] = mapped_column(String(255), default="")
    title: Mapped[str] = mapped_column(String(255), default="")
    email: Mapped[str] = mapped_column(String(255), default="")
    phone: Mapped[str] = mapped_column(String(50), default="")
    country: Mapped[str] = mapped_column(String(100), default="")
    industry: Mapped[str] = mapped_column(String(100), default="")
    status: Mapped[str] = mapped_column(String(50), default="new")
    source: Mapped[str] = mapped_column(String(50), default="manual")
    score: Mapped[int] = mapped_column(Integer, default=5)
    notes: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ComplianceSave(Base):
    __tablename__ = "compliance_saves"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    country: Mapped[str] = mapped_column(String(100))
    framework: Mapped[str] = mapped_column(String(100), default="")
    notes: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
