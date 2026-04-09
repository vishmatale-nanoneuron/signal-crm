"""Signal CRM — Relational Database Models
Full relational schema:
  users → subscriptions (1:many, one active at a time)
  users → payment_transactions (1:many, immutable audit trail)
  users → watchlist_accounts → web_signals, tracked_pages
  users → deals, leads, compliance_saves

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
