"""Signal CRM — Relational Database Models v2.0
Full relational schema:
  users → subscriptions (1:many, one active at a time)
  users → payment_transactions (1:many, immutable audit trail)
  users → watchlist_accounts → web_signals, tracked_pages
  users → deals, leads, compliance_saves
  users → accounts → contacts → activities, tasks, sequence_enrollments
  users → pipelines → pipeline_stages
  users → sequences → sequence_steps
  users → notifications, ai_insights

Design decisions (async-safe):
- No SQLAlchemy lazy-load relationships (incompatible with async sessions)
- All data fetched via explicit select() queries
- ON DELETE CASCADE everywhere (clean user deletion)
- Composite indexes on every (user_id, timestamp) pair for fast filtering
- String(36) UUIDs as primary keys (portable, no sequence contention)
"""
import uuid
from datetime import datetime
from sqlalchemy import (
    String, Boolean, Integer, Float, DateTime, Text,
    ForeignKey, Index, UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


def _uuid() -> str:
    return str(uuid.uuid4())


# ─────────────────────────────────────────────────────────────────────────────
# Users — core identity table
# ─────────────────────────────────────────────────────────────────────────────
class User(Base):
    __tablename__ = "sig_users"

    id:            Mapped[str]           = mapped_column(String(36),  primary_key=True, default=_uuid)
    email:         Mapped[str]           = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str]           = mapped_column(String(255), nullable=False)
    name:          Mapped[str]           = mapped_column(String(255), default="")
    company_name:  Mapped[str]           = mapped_column(String(255), default="")
    phone:         Mapped[str]           = mapped_column(String(50),  default="")
    avatar_url:    Mapped[str]           = mapped_column(String(500), default="")
    credits:       Mapped[int]           = mapped_column(Integer,     default=20)
    plan:          Mapped[str]           = mapped_column(String(50),  default="trial")
    is_paid:       Mapped[bool]          = mapped_column(Boolean,     default=False)
    is_active:     Mapped[bool]          = mapped_column(Boolean,     default=True)
    is_verified:   Mapped[bool]          = mapped_column(Boolean,     default=True)
    is_owner:      Mapped[bool]          = mapped_column(Boolean,     default=False)   # CEO / Founder access
    trial_start:   Mapped[datetime]      = mapped_column(DateTime,    default=datetime.utcnow)
    trial_end:     Mapped[datetime|None] = mapped_column(DateTime,    nullable=True)
    last_login_at: Mapped[datetime|None] = mapped_column(DateTime,    nullable=True)
    created_at:    Mapped[datetime]      = mapped_column(DateTime,    default=datetime.utcnow)
    updated_at:    Mapped[datetime]      = mapped_column(DateTime,    default=datetime.utcnow)


# ─────────────────────────────────────────────────────────────────────────────
# Subscriptions — one active per user (like Stripe's subscription object)
# ─────────────────────────────────────────────────────────────────────────────
class Subscription(Base):
    __tablename__ = "sig_subscriptions"
    __table_args__ = (
        Index("ix_sub_user_id", "user_id"),
        Index("ix_sub_status",  "status"),
    )

    id:                   Mapped[str]           = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id:              Mapped[str]           = mapped_column(String(36), ForeignKey("sig_users.id", ondelete="CASCADE"), nullable=False)
    plan:                 Mapped[str]           = mapped_column(String(50), default="trial")    # trial|starter|pro|enterprise
    status:               Mapped[str]           = mapped_column(String(30), default="active")   # active|canceled|expired|past_due
    billing_cycle:        Mapped[str]           = mapped_column(String(20), default="monthly")  # monthly|annual
    amount:               Mapped[float]         = mapped_column(Float,      default=0.0)
    currency:             Mapped[str]           = mapped_column(String(10), default="INR")
    payment_method:       Mapped[str]           = mapped_column(String(50), default="trial")    # razorpay|swift|neft|trial
    current_period_start: Mapped[datetime]      = mapped_column(DateTime,   default=datetime.utcnow)
    current_period_end:   Mapped[datetime|None] = mapped_column(DateTime,   nullable=True)
    canceled_at:          Mapped[datetime|None] = mapped_column(DateTime,   nullable=True)
    created_at:           Mapped[datetime]      = mapped_column(DateTime,   default=datetime.utcnow)
    updated_at:           Mapped[datetime]      = mapped_column(DateTime,   default=datetime.utcnow)


# ─────────────────────────────────────────────────────────────────────────────
# Payment Transactions — immutable audit trail, never modified after insert
# ─────────────────────────────────────────────────────────────────────────────
class PaymentTransaction(Base):
    __tablename__ = "sig_payment_transactions"
    __table_args__ = (
        Index("ix_txn_user_id",    "user_id"),
        Index("ix_txn_created_at", "created_at"),
        Index("ix_txn_status",     "status"),
    )

    id:                  Mapped[str]           = mapped_column(String(36),  primary_key=True, default=_uuid)
    user_id:             Mapped[str]           = mapped_column(String(36),  ForeignKey("sig_users.id", ondelete="CASCADE"), nullable=False)
    subscription_id:     Mapped[str|None]      = mapped_column(String(36),  ForeignKey("sig_subscriptions.id", ondelete="SET NULL"), nullable=True)
    plan:                Mapped[str]           = mapped_column(String(50),  default="")
    amount:              Mapped[float]         = mapped_column(Float,       default=0.0)
    currency:            Mapped[str]           = mapped_column(String(10),  default="INR")
    status:              Mapped[str]           = mapped_column(String(30),  default="pending")  # pending|success|failed|refunded
    payment_method:      Mapped[str]           = mapped_column(String(50),  default="")
    razorpay_order_id:   Mapped[str]           = mapped_column(String(100), default="")
    razorpay_payment_id: Mapped[str]           = mapped_column(String(100), default="")
    transaction_ref:     Mapped[str]           = mapped_column(String(200), default="")   # SWIFT/NEFT UTR
    notes:               Mapped[str]           = mapped_column(Text,        default="")
    failure_reason:      Mapped[str]           = mapped_column(Text,        default="")
    created_at:          Mapped[datetime]      = mapped_column(DateTime,    default=datetime.utcnow)
    # No updated_at — transactions are immutable


# ─────────────────────────────────────────────────────────────────────────────
# Watchlist Accounts — companies being monitored
# ─────────────────────────────────────────────────────────────────────────────
class WatchlistAccount(Base):
    __tablename__ = "sig_watchlist_accounts"
    __table_args__ = (
        Index("ix_watchlist_user_id", "user_id"),
        Index("ix_watchlist_domain",  "domain"),
    )

    id:               Mapped[str]           = mapped_column(String(36),  primary_key=True, default=_uuid)
    user_id:          Mapped[str]           = mapped_column(String(36),  ForeignKey("sig_users.id", ondelete="CASCADE"), nullable=False)
    company_name:     Mapped[str]           = mapped_column(String(255), nullable=False)
    domain:           Mapped[str]           = mapped_column(String(255), default="")
    industry:         Mapped[str]           = mapped_column(String(100), default="")
    country:          Mapped[str]           = mapped_column(String(100), default="")
    hq_country:       Mapped[str]           = mapped_column(String(100), default="")
    employee_size:    Mapped[str]           = mapped_column(String(50),  default="")
    priority:         Mapped[str]           = mapped_column(String(20),  default="medium")
    watch_hiring:     Mapped[bool]          = mapped_column(Boolean,     default=True)
    watch_pricing:    Mapped[bool]          = mapped_column(Boolean,     default=True)
    watch_compliance: Mapped[bool]          = mapped_column(Boolean,     default=True)
    watch_leadership: Mapped[bool]          = mapped_column(Boolean,     default=True)
    watch_expansion:  Mapped[bool]          = mapped_column(Boolean,     default=True)
    notes:            Mapped[str]           = mapped_column(Text,        default="")
    last_checked:     Mapped[datetime|None] = mapped_column(DateTime,    nullable=True)
    created_at:       Mapped[datetime]      = mapped_column(DateTime,    default=datetime.utcnow)


# ─────────────────────────────────────────────────────────────────────────────
# Web Signals — detected competitive intelligence events
# ─────────────────────────────────────────────────────────────────────────────
class WebSignal(Base):
    __tablename__ = "sig_web_signals"
    __table_args__ = (
        Index("ix_signals_user_id",        "user_id"),
        Index("ix_signals_detected_at",    "detected_at"),
        Index("ix_signals_user_actioned",  "user_id", "is_actioned"),   # composite for action-plan queries
        Index("ix_signals_user_strength",  "user_id", "signal_strength"),
    )

    id:                 Mapped[str]      = mapped_column(String(36),  primary_key=True, default=_uuid)
    user_id:            Mapped[str]      = mapped_column(String(36),  ForeignKey("sig_users.id", ondelete="CASCADE"), nullable=False)
    account_id:         Mapped[str|None] = mapped_column(String(36),  ForeignKey("sig_watchlist_accounts.id", ondelete="SET NULL"), nullable=True)
    account_name:       Mapped[str]      = mapped_column(String(255), default="")
    signal_type:        Mapped[str]      = mapped_column(String(50),  default="")
    signal_strength:    Mapped[str]      = mapped_column(String(20),  default="medium")
    title:              Mapped[str]      = mapped_column(String(500), default="")
    summary:            Mapped[str]      = mapped_column(Text,        default="")
    proof_text:         Mapped[str]      = mapped_column(Text,        default="")
    proof_url:          Mapped[str]      = mapped_column(String(500), default="")
    country_hint:       Mapped[str]      = mapped_column(String(100), default="")
    recommended_action: Mapped[str]      = mapped_column(Text,        default="")
    score:              Mapped[int]      = mapped_column(Integer,     default=5)
    is_actioned:        Mapped[bool]     = mapped_column(Boolean,     default=False)
    is_dismissed:       Mapped[bool]     = mapped_column(Boolean,     default=False)
    before_snapshot:    Mapped[str]      = mapped_column(Text,        default="")
    after_snapshot:     Mapped[str]      = mapped_column(Text,        default="")
    detected_at:        Mapped[datetime] = mapped_column(DateTime,    default=datetime.utcnow)


# ─────────────────────────────────────────────────────────────────────────────
# Deals — CRM pipeline
# ─────────────────────────────────────────────────────────────────────────────
class Deal(Base):
    __tablename__ = "sig_deals"
    __table_args__ = (
        Index("ix_deals_user_id", "user_id"),
        Index("ix_deals_stage",   "user_id", "stage"),   # composite for pipeline queries
    )

    id:                 Mapped[str]      = mapped_column(String(36),  primary_key=True, default=_uuid)
    user_id:            Mapped[str]      = mapped_column(String(36),  ForeignKey("sig_users.id", ondelete="CASCADE"), nullable=False)
    title:              Mapped[str]      = mapped_column(String(255), nullable=False)
    company_name:       Mapped[str]      = mapped_column(String(255), default="")
    contact_name:       Mapped[str]      = mapped_column(String(255), default="")
    contact_title:      Mapped[str]      = mapped_column(String(255), default="")
    value:              Mapped[float]    = mapped_column(Float,       default=0.0)
    currency:           Mapped[str]      = mapped_column(String(10),  default="INR")
    stage:              Mapped[str]      = mapped_column(String(50),  default="signal")
    country:            Mapped[str]      = mapped_column(String(100), default="")
    industry:           Mapped[str]      = mapped_column(String(100), default="")
    signal_trigger:     Mapped[str]      = mapped_column(String(500), default="")
    compliance_checked: Mapped[bool]     = mapped_column(Boolean,     default=False)
    next_action:        Mapped[str]      = mapped_column(Text,        default="")
    probability:        Mapped[int]      = mapped_column(Integer,     default=10)
    close_date:         Mapped[str]      = mapped_column(String(50),  default="")
    notes:              Mapped[str]      = mapped_column(Text,        default="")
    created_at:         Mapped[datetime] = mapped_column(DateTime,    default=datetime.utcnow)
    updated_at:         Mapped[datetime] = mapped_column(DateTime,    default=datetime.utcnow)


# ─────────────────────────────────────────────────────────────────────────────
# Leads — prospect database
# ─────────────────────────────────────────────────────────────────────────────
class Lead(Base):
    __tablename__ = "sig_leads"
    __table_args__ = (
        Index("ix_leads_user_id", "user_id"),
        Index("ix_leads_status",  "user_id", "status"),
    )

    id:           Mapped[str]      = mapped_column(String(36),  primary_key=True, default=_uuid)
    user_id:      Mapped[str]      = mapped_column(String(36),  ForeignKey("sig_users.id", ondelete="CASCADE"), nullable=False)
    company:      Mapped[str]      = mapped_column(String(255), default="")
    contact_name: Mapped[str]      = mapped_column(String(255), default="")
    title:        Mapped[str]      = mapped_column(String(255), default="")
    email:        Mapped[str]      = mapped_column(String(255), default="")
    phone:        Mapped[str]      = mapped_column(String(50),  default="")
    country:      Mapped[str]      = mapped_column(String(100), default="")
    industry:     Mapped[str]      = mapped_column(String(100), default="")
    status:       Mapped[str]      = mapped_column(String(50),  default="new")
    source:       Mapped[str]      = mapped_column(String(50),  default="manual")
    score:        Mapped[int]      = mapped_column(Integer,     default=5)
    notes:        Mapped[str]      = mapped_column(Text,        default="")
    created_at:   Mapped[datetime] = mapped_column(DateTime,    default=datetime.utcnow)


# ─────────────────────────────────────────────────────────────────────────────
# Tracked Pages — web pages we scrape for watchlist companies
# ─────────────────────────────────────────────────────────────────────────────
class TrackedPage(Base):
    __tablename__ = "sig_tracked_pages"
    __table_args__ = (
        Index("ix_tracked_pages_account_id", "account_id"),
        Index("ix_tracked_pages_type",       "account_id", "page_type"),
    )

    id:              Mapped[str]           = mapped_column(String(36),  primary_key=True, default=_uuid)
    account_id:      Mapped[str]           = mapped_column(String(36),  ForeignKey("sig_watchlist_accounts.id", ondelete="CASCADE"), nullable=False)
    page_type:       Mapped[str]           = mapped_column(String(50),  default="")    # careers|sitemap|products
    url:             Mapped[str]           = mapped_column(String(500), default="")
    content_hash:    Mapped[str]           = mapped_column(String(64),  default="")   # MD5 of last content
    content_text:    Mapped[str]           = mapped_column(Text,        default="")
    country_keys:    Mapped[str]           = mapped_column(Text,        default="[]") # JSON list
    product_keys:    Mapped[str]           = mapped_column(Text,        default="[]") # JSON list
    job_count:       Mapped[int]           = mapped_column(Integer,     default=0)
    last_scanned_at: Mapped[datetime|None] = mapped_column(DateTime,    nullable=True)
    created_at:      Mapped[datetime]      = mapped_column(DateTime,    default=datetime.utcnow)


# ─────────────────────────────────────────────────────────────────────────────
# Page Snapshots — before/after evidence for detected signals
# ─────────────────────────────────────────────────────────────────────────────
class PageSnapshot(Base):
    __tablename__ = "sig_page_snapshots"
    __table_args__ = (
        Index("ix_snapshots_signal_id", "signal_id"),
    )

    id:              Mapped[str]           = mapped_column(String(36), primary_key=True, default=_uuid)
    signal_id:       Mapped[str]           = mapped_column(String(36), ForeignKey("sig_web_signals.id", ondelete="CASCADE"), nullable=False)
    tracked_page_id: Mapped[str|None]      = mapped_column(String(36), ForeignKey("sig_tracked_pages.id", ondelete="SET NULL"), nullable=True)
    before_content:  Mapped[str]           = mapped_column(Text,       default="")
    after_content:   Mapped[str]           = mapped_column(Text,       default="")
    change_type:     Mapped[str]           = mapped_column(String(50), default="")
    change_details:  Mapped[str]           = mapped_column(Text,       default="")
    snapshot_at:     Mapped[datetime]      = mapped_column(DateTime,   default=datetime.utcnow)


# ─────────────────────────────────────────────────────────────────────────────
# Compliance Saves — saved compliance results per user
# ─────────────────────────────────────────────────────────────────────────────
class ComplianceSave(Base):
    __tablename__ = "sig_compliance_saves"
    __table_args__ = (
        Index("ix_compliance_user_id", "user_id"),
    )

    id:         Mapped[str]      = mapped_column(String(36),  primary_key=True, default=_uuid)
    user_id:    Mapped[str]      = mapped_column(String(36),  ForeignKey("sig_users.id", ondelete="CASCADE"), nullable=False)
    country:    Mapped[str]      = mapped_column(String(100), default="")
    framework:  Mapped[str]      = mapped_column(String(100), default="")
    notes:      Mapped[str]      = mapped_column(Text,        default="")
    created_at: Mapped[datetime] = mapped_column(DateTime,    default=datetime.utcnow)


# ═════════════════════════════════════════════════════════════════════════════
# v2.0 MODELS — World-Class CRM Additions
# ═════════════════════════════════════════════════════════════════════════════

# ─────────────────────────────────────────────────────────────────────────────
# Account — Company / Account management (separate from watchlist)
# ─────────────────────────────────────────────────────────────────────────────
class Account(Base):
    __tablename__ = "sig_accounts"
    __table_args__ = (
        Index("ix_accounts_user_id",  "user_id"),
        Index("ix_accounts_stage",    "user_id", "stage"),
        Index("ix_accounts_country",  "country"),
    )

    id:            Mapped[str]           = mapped_column(String(36),  primary_key=True, default=_uuid)
    user_id:       Mapped[str]           = mapped_column(String(36),  ForeignKey("sig_users.id", ondelete="CASCADE"), nullable=False)
    name:          Mapped[str]           = mapped_column(String(300), nullable=False)
    domain:        Mapped[str]           = mapped_column(String(255), default="")
    industry:      Mapped[str]           = mapped_column(String(100), default="")
    country:       Mapped[str]           = mapped_column(String(100), default="")
    city:          Mapped[str]           = mapped_column(String(100), default="")
    employees:     Mapped[str]           = mapped_column(String(50),  default="")
    revenue_range: Mapped[str]           = mapped_column(String(50),  default="")
    phone:         Mapped[str]           = mapped_column(String(50),  default="")
    linkedin:      Mapped[str]           = mapped_column(String(500), default="")
    website:       Mapped[str]           = mapped_column(String(500), default="")
    stage:         Mapped[str]           = mapped_column(String(50),  default="prospect")
    health_score:  Mapped[int]           = mapped_column(Integer,     default=75)
    churn_risk:    Mapped[float]         = mapped_column(Float,       default=0.1)
    arr:           Mapped[float]         = mapped_column(Float,       default=0.0)
    tags:          Mapped[str]           = mapped_column(Text,        default="[]")
    notes:         Mapped[str]           = mapped_column(Text,        default="")
    assigned_to:   Mapped[str|None]      = mapped_column(String(36),  ForeignKey("sig_users.id", ondelete="SET NULL"), nullable=True)
    created_at:    Mapped[datetime]      = mapped_column(DateTime,    default=datetime.utcnow)
    updated_at:    Mapped[datetime]      = mapped_column(DateTime,    default=datetime.utcnow)


# ─────────────────────────────────────────────────────────────────────────────
# Contact — People / Contact management
# ─────────────────────────────────────────────────────────────────────────────
class Contact(Base):
    __tablename__ = "sig_contacts"
    __table_args__ = (
        Index("ix_contacts_user_id",    "user_id"),
        Index("ix_contacts_account_id", "account_id"),
        Index("ix_contacts_stage",      "user_id", "stage"),
        Index("ix_contacts_score",      "user_id", "lead_score"),
    )

    id:              Mapped[str]           = mapped_column(String(36),  primary_key=True, default=_uuid)
    user_id:         Mapped[str]           = mapped_column(String(36),  ForeignKey("sig_users.id", ondelete="CASCADE"), nullable=False)
    account_id:      Mapped[str|None]      = mapped_column(String(36),  ForeignKey("sig_accounts.id", ondelete="SET NULL"), nullable=True)
    deal_id:         Mapped[str|None]      = mapped_column(String(36),  ForeignKey("sig_deals.id", ondelete="SET NULL"), nullable=True)
    first_name:      Mapped[str]           = mapped_column(String(100), default="")
    last_name:       Mapped[str]           = mapped_column(String(100), default="")
    email:           Mapped[str]           = mapped_column(String(255), default="")
    phone:           Mapped[str]           = mapped_column(String(50),  default="")
    title:           Mapped[str]           = mapped_column(String(255), default="")
    department:      Mapped[str]           = mapped_column(String(100), default="")
    linkedin:        Mapped[str]           = mapped_column(String(500), default="")
    twitter:         Mapped[str]           = mapped_column(String(255), default="")
    country:         Mapped[str]           = mapped_column(String(100), default="")
    timezone:        Mapped[str]           = mapped_column(String(100), default="")
    language:        Mapped[str]           = mapped_column(String(10),  default="en")
    lead_score:      Mapped[int]           = mapped_column(Integer,     default=50)
    health_score:    Mapped[int]           = mapped_column(Integer,     default=75)
    stage:           Mapped[str]           = mapped_column(String(50),  default="prospect")
    source:          Mapped[str]           = mapped_column(String(50),  default="manual")
    tags:            Mapped[str]           = mapped_column(Text,        default="[]")
    notes:           Mapped[str]           = mapped_column(Text,        default="")
    is_unsubscribed: Mapped[bool]          = mapped_column(Boolean,     default=False)
    last_contacted:  Mapped[datetime|None] = mapped_column(DateTime,    nullable=True)
    created_at:      Mapped[datetime]      = mapped_column(DateTime,    default=datetime.utcnow)
    updated_at:      Mapped[datetime]      = mapped_column(DateTime,    default=datetime.utcnow)


# ─────────────────────────────────────────────────────────────────────────────
# Activity — Unified interaction timeline
# ─────────────────────────────────────────────────────────────────────────────
class Activity(Base):
    __tablename__ = "sig_activities"
    __table_args__ = (
        Index("ix_activities_user_id",    "user_id"),
        Index("ix_activities_contact_id", "contact_id"),
        Index("ix_activities_deal_id",    "deal_id"),
        Index("ix_activities_created_at", "user_id", "created_at"),
    )

    id:            Mapped[str]           = mapped_column(String(36),  primary_key=True, default=_uuid)
    user_id:       Mapped[str]           = mapped_column(String(36),  ForeignKey("sig_users.id", ondelete="CASCADE"), nullable=False)
    contact_id:    Mapped[str|None]      = mapped_column(String(36),  ForeignKey("sig_contacts.id", ondelete="SET NULL"), nullable=True)
    account_id:    Mapped[str|None]      = mapped_column(String(36),  ForeignKey("sig_accounts.id", ondelete="SET NULL"), nullable=True)
    deal_id:       Mapped[str|None]      = mapped_column(String(36),  ForeignKey("sig_deals.id", ondelete="SET NULL"), nullable=True)
    type:          Mapped[str]           = mapped_column(String(30),  default="note")
    direction:     Mapped[str]           = mapped_column(String(20),  default="outbound")
    title:         Mapped[str]           = mapped_column(String(500), default="")
    body:          Mapped[str]           = mapped_column(Text,        default="")
    outcome:       Mapped[str]           = mapped_column(String(100), default="")
    duration_secs: Mapped[int]           = mapped_column(Integer,     default=0)
    scheduled_at:  Mapped[datetime|None] = mapped_column(DateTime,    nullable=True)
    completed_at:  Mapped[datetime|None] = mapped_column(DateTime,    nullable=True)
    created_at:    Mapped[datetime]      = mapped_column(DateTime,    default=datetime.utcnow)


# ─────────────────────────────────────────────────────────────────────────────
# Task — Follow-up task management
# ─────────────────────────────────────────────────────────────────────────────
class Task(Base):
    __tablename__ = "sig_tasks"
    __table_args__ = (
        Index("ix_tasks_user_id",  "user_id"),
        Index("ix_tasks_status",   "user_id", "status"),
        Index("ix_tasks_due_date", "user_id", "due_date"),
    )

    id:           Mapped[str]           = mapped_column(String(36),  primary_key=True, default=_uuid)
    user_id:      Mapped[str]           = mapped_column(String(36),  ForeignKey("sig_users.id", ondelete="CASCADE"), nullable=False)
    contact_id:   Mapped[str|None]      = mapped_column(String(36),  ForeignKey("sig_contacts.id", ondelete="SET NULL"), nullable=True)
    account_id:   Mapped[str|None]      = mapped_column(String(36),  ForeignKey("sig_accounts.id", ondelete="SET NULL"), nullable=True)
    deal_id:      Mapped[str|None]      = mapped_column(String(36),  ForeignKey("sig_deals.id", ondelete="SET NULL"), nullable=True)
    title:        Mapped[str]           = mapped_column(String(500), nullable=False)
    description:  Mapped[str]           = mapped_column(Text,        default="")
    priority:     Mapped[str]           = mapped_column(String(20),  default="medium")
    status:       Mapped[str]           = mapped_column(String(30),  default="open")
    due_date:     Mapped[str|None]      = mapped_column(String(20),  nullable=True)
    reminder_at:  Mapped[datetime|None] = mapped_column(DateTime,    nullable=True)
    completed_at: Mapped[datetime|None] = mapped_column(DateTime,    nullable=True)
    created_at:   Mapped[datetime]      = mapped_column(DateTime,    default=datetime.utcnow)
    updated_at:   Mapped[datetime]      = mapped_column(DateTime,    default=datetime.utcnow)


# ─────────────────────────────────────────────────────────────────────────────
# Pipeline — Multiple pipeline support
# ─────────────────────────────────────────────────────────────────────────────
class Pipeline(Base):
    __tablename__ = "sig_pipelines"
    __table_args__ = (Index("ix_pipelines_user_id", "user_id"),)

    id:         Mapped[str]      = mapped_column(String(36),  primary_key=True, default=_uuid)
    user_id:    Mapped[str]      = mapped_column(String(36),  ForeignKey("sig_users.id", ondelete="CASCADE"), nullable=False)
    name:       Mapped[str]      = mapped_column(String(100), nullable=False)
    currency:   Mapped[str]      = mapped_column(String(10),  default="INR")
    is_default: Mapped[bool]     = mapped_column(Boolean,     default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime,    default=datetime.utcnow)


# ─────────────────────────────────────────────────────────────────────────────
# PipelineStage — Custom stages per pipeline
# ─────────────────────────────────────────────────────────────────────────────
class PipelineStage(Base):
    __tablename__ = "sig_pipeline_stages"
    __table_args__ = (Index("ix_stages_pipeline_id", "pipeline_id"),)

    id:          Mapped[str]      = mapped_column(String(36), primary_key=True, default=_uuid)
    pipeline_id: Mapped[str]      = mapped_column(String(36), ForeignKey("sig_pipelines.id", ondelete="CASCADE"), nullable=False)
    name:        Mapped[str]      = mapped_column(String(100), nullable=False)
    order_num:   Mapped[int]      = mapped_column(Integer,    default=0)
    probability: Mapped[int]      = mapped_column(Integer,    default=50)
    color:       Mapped[str]      = mapped_column(String(20), default="#6366f1")
    created_at:  Mapped[datetime] = mapped_column(DateTime,   default=datetime.utcnow)


# ─────────────────────────────────────────────────────────────────────────────
# Sequence — Email / outreach sequences
# ─────────────────────────────────────────────────────────────────────────────
class Sequence(Base):
    __tablename__ = "sig_sequences"
    __table_args__ = (
        Index("ix_sequences_user_id", "user_id"),
        Index("ix_sequences_status",  "user_id", "status"),
    )

    id:             Mapped[str]      = mapped_column(String(36),  primary_key=True, default=_uuid)
    user_id:        Mapped[str]      = mapped_column(String(36),  ForeignKey("sig_users.id", ondelete="CASCADE"), nullable=False)
    name:           Mapped[str]      = mapped_column(String(200), nullable=False)
    description:    Mapped[str]      = mapped_column(Text,        default="")
    status:         Mapped[str]      = mapped_column(String(20),  default="draft")
    steps_count:    Mapped[int]      = mapped_column(Integer,     default=0)
    enrolled_count: Mapped[int]      = mapped_column(Integer,     default=0)
    open_rate:      Mapped[float]    = mapped_column(Float,       default=0.0)
    reply_rate:     Mapped[float]    = mapped_column(Float,       default=0.0)
    created_at:     Mapped[datetime] = mapped_column(DateTime,    default=datetime.utcnow)
    updated_at:     Mapped[datetime] = mapped_column(DateTime,    default=datetime.utcnow)


# ─────────────────────────────────────────────────────────────────────────────
# SequenceStep — Individual steps in a sequence
# ─────────────────────────────────────────────────────────────────────────────
class SequenceStep(Base):
    __tablename__ = "sig_sequence_steps"
    __table_args__ = (Index("ix_seq_steps_sequence_id", "sequence_id"),)

    id:          Mapped[str]      = mapped_column(String(36),  primary_key=True, default=_uuid)
    sequence_id: Mapped[str]      = mapped_column(String(36),  ForeignKey("sig_sequences.id", ondelete="CASCADE"), nullable=False)
    order_num:   Mapped[int]      = mapped_column(Integer,     default=1)
    type:        Mapped[str]      = mapped_column(String(30),  default="email")
    subject:     Mapped[str]      = mapped_column(String(500), default="")
    body:        Mapped[str]      = mapped_column(Text,        default="")
    delay_days:  Mapped[int]      = mapped_column(Integer,     default=1)
    created_at:  Mapped[datetime] = mapped_column(DateTime,    default=datetime.utcnow)


# ─────────────────────────────────────────────────────────────────────────────
# SequenceEnrollment — Contacts enrolled in sequences
# ─────────────────────────────────────────────────────────────────────────────
class SequenceEnrollment(Base):
    __tablename__ = "sig_sequence_enrollments"
    __table_args__ = (
        Index("ix_enrollments_sequence_id", "sequence_id"),
        Index("ix_enrollments_contact_id",  "contact_id"),
        UniqueConstraint("sequence_id", "contact_id", name="uq_enrollment"),
    )

    id:           Mapped[str]           = mapped_column(String(36),  primary_key=True, default=_uuid)
    sequence_id:  Mapped[str]           = mapped_column(String(36),  ForeignKey("sig_sequences.id", ondelete="CASCADE"), nullable=False)
    contact_id:   Mapped[str]           = mapped_column(String(36),  ForeignKey("sig_contacts.id", ondelete="CASCADE"), nullable=False)
    status:       Mapped[str]           = mapped_column(String(30),  default="active")
    current_step: Mapped[int]           = mapped_column(Integer,     default=0)
    started_at:   Mapped[datetime]      = mapped_column(DateTime,    default=datetime.utcnow)
    next_step_at: Mapped[datetime|None] = mapped_column(DateTime,    nullable=True)
    completed_at: Mapped[datetime|None] = mapped_column(DateTime,    nullable=True)
    created_at:   Mapped[datetime]      = mapped_column(DateTime,    default=datetime.utcnow)


# ─────────────────────────────────────────────────────────────────────────────
# Notification — In-app notification feed
# ─────────────────────────────────────────────────────────────────────────────
class Notification(Base):
    __tablename__ = "sig_notifications"
    __table_args__ = (
        Index("ix_notifs_user_id",    "user_id"),
        Index("ix_notifs_created_at", "user_id", "created_at"),
    )

    id:          Mapped[str]      = mapped_column(String(36),  primary_key=True, default=_uuid)
    user_id:     Mapped[str]      = mapped_column(String(36),  ForeignKey("sig_users.id", ondelete="CASCADE"), nullable=False)
    type:        Mapped[str]      = mapped_column(String(30),  default="info")
    title:       Mapped[str]      = mapped_column(String(500), nullable=False)
    body:        Mapped[str]      = mapped_column(Text,        default="")
    entity_type: Mapped[str]      = mapped_column(String(50),  default="")
    entity_id:   Mapped[str]      = mapped_column(String(36),  default="")
    is_read:     Mapped[bool]     = mapped_column(Boolean,     default=False)
    created_at:  Mapped[datetime] = mapped_column(DateTime,    default=datetime.utcnow)


# ─────────────────────────────────────────────────────────────────────────────
# AIInsight — Cached AI-generated insights
# ─────────────────────────────────────────────────────────────────────────────
class AIInsight(Base):
    __tablename__ = "sig_ai_insights"
    __table_args__ = (
        Index("ix_insights_user_id", "user_id"),
        Index("ix_insights_entity",  "entity_type", "entity_id"),
    )

    id:           Mapped[str]           = mapped_column(String(36),  primary_key=True, default=_uuid)
    user_id:      Mapped[str]           = mapped_column(String(36),  ForeignKey("sig_users.id", ondelete="CASCADE"), nullable=False)
    entity_type:  Mapped[str]           = mapped_column(String(50),  default="")
    entity_id:    Mapped[str]           = mapped_column(String(36),  default="")
    insight_type: Mapped[str]           = mapped_column(String(50),  default="")
    title:        Mapped[str]           = mapped_column(String(500), default="")
    body:         Mapped[str]           = mapped_column(Text,        default="")
    score:        Mapped[int|None]      = mapped_column(Integer,     nullable=True)
    confidence:   Mapped[float]         = mapped_column(Float,       default=0.8)
    expires_at:   Mapped[datetime|None] = mapped_column(DateTime,    nullable=True)
    created_at:   Mapped[datetime]      = mapped_column(DateTime,    default=datetime.utcnow)


# ─────────────────────────────────────────────────────────────────────────────
# CeoSnapshot — Daily KPI snapshots for CEO command center
# ─────────────────────────────────────────────────────────────────────────────
class CeoSnapshot(Base):
    __tablename__ = "sig_ceo_snapshots"
    __table_args__ = (
        Index("ix_ceo_snap_date", "snapshot_date"),
    )

    id:                  Mapped[str]      = mapped_column(String(36),  primary_key=True, default=_uuid)
    snapshot_date:       Mapped[datetime] = mapped_column(DateTime,    default=datetime.utcnow)
    total_users:         Mapped[int]      = mapped_column(Integer,     default=0)
    paid_users:          Mapped[int]      = mapped_column(Integer,     default=0)
    trial_users:         Mapped[int]      = mapped_column(Integer,     default=0)
    new_signups_today:   Mapped[int]      = mapped_column(Integer,     default=0)
    mrr:                 Mapped[float]    = mapped_column(Float,       default=0.0)
    arr:                 Mapped[float]    = mapped_column(Float,       default=0.0)
    total_deals:         Mapped[int]      = mapped_column(Integer,     default=0)
    pipeline_value:      Mapped[float]    = mapped_column(Float,       default=0.0)
    won_value:           Mapped[float]    = mapped_column(Float,       default=0.0)
    total_contacts:      Mapped[int]      = mapped_column(Integer,     default=0)
    total_accounts:      Mapped[int]      = mapped_column(Integer,     default=0)
    total_arr:           Mapped[float]    = mapped_column(Float,       default=0.0)
    activities_today:    Mapped[int]      = mapped_column(Integer,     default=0)
    tasks_open:          Mapped[int]      = mapped_column(Integer,     default=0)
    created_at:          Mapped[datetime] = mapped_column(DateTime,    default=datetime.utcnow)
