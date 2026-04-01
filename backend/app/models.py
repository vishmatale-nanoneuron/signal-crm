"""Signal CRM — Relational Database Models"""
import uuid
from datetime import datetime
from sqlalchemy import String, Boolean, Integer, Float, DateTime, Text, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


def _uuid() -> str:
    return str(uuid.uuid4())


# ─────────────────────────────────────────────────────────────
# CORE: Users
# ─────────────────────────────────────────────────────────────
class User(Base):
    __tablename__ = "users"

    id:            Mapped[str]      = mapped_column(String(36), primary_key=True, default=_uuid)
    email:         Mapped[str]      = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str]      = mapped_column(String(255), nullable=False)
    name:          Mapped[str]      = mapped_column(String(255), default="")
    company_name:  Mapped[str]      = mapped_column(String(255), default="")
    phone:         Mapped[str]      = mapped_column(String(50),  default="")
    avatar_url:    Mapped[str]      = mapped_column(String(500), default="")
    credits:       Mapped[int]      = mapped_column(Integer, default=20)
    plan:          Mapped[str]      = mapped_column(String(50),  default="trial")
    is_paid:       Mapped[bool]     = mapped_column(Boolean, default=False)
    is_active:     Mapped[bool]     = mapped_column(Boolean, default=True)
    is_verified:   Mapped[bool]     = mapped_column(Boolean, default=True)
    trial_start:   Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    trial_end:     Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at:    Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at:    Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    subscriptions: Mapped[list["Subscription"]]         = relationship("Subscription",       back_populates="user", cascade="all, delete-orphan")
    transactions:  Mapped[list["PaymentTransaction"]]   = relationship("PaymentTransaction", back_populates="user", cascade="all, delete-orphan")


# ─────────────────────────────────────────────────────────────
# BILLING: Subscriptions
# ─────────────────────────────────────────────────────────────
class Subscription(Base):
    """One active subscription per user at a time — like Stripe's subscription object."""
    __tablename__ = "subscriptions"
    __table_args__ = (
        Index("ix_sub_user_id", "user_id"),
        Index("ix_sub_status",  "status"),
    )

    id:                   Mapped[str]      = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id:              Mapped[str]      = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    plan:                 Mapped[str]      = mapped_column(String(50),  default="trial")
    status:               Mapped[str]      = mapped_column(String(30),  default="active")   # active | canceled | expired | past_due
    billing_cycle:        Mapped[str]      = mapped_column(String(20),  default="monthly")  # monthly | annual
    amount:               Mapped[float]    = mapped_column(Float, default=0.0)
    currency:             Mapped[str]      = mapped_column(String(10),  default="INR")
    payment_method:       Mapped[str]      = mapped_column(String(50),  default="trial")    # razorpay | swift | neft | trial
    current_period_start: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    current_period_end:   Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    canceled_at:          Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at:           Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at:           Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user:         Mapped["User"]                       = relationship("User",                back_populates="subscriptions")
    transactions: Mapped[list["PaymentTransaction"]]   = relationship("PaymentTransaction",  back_populates="subscription")


# ─────────────────────────────────────────────────────────────
# BILLING: Payment Transactions (immutable audit trail)
# ─────────────────────────────────────────────────────────────
class PaymentTransaction(Base):
    """Every charge attempt — never deleted, never modified."""
    __tablename__ = "payment_transactions"
    __table_args__ = (
        Index("ix_txn_user_id",    "user_id"),
        Index("ix_txn_created_at", "created_at"),
    )

    id:                  Mapped[str]      = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id:             Mapped[str]      = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    subscription_id:     Mapped[str | None] = mapped_column(String(36), ForeignKey("subscriptions.id", ondelete="SET NULL"), nullable=True)
    plan:                Mapped[str]      = mapped_column(String(50),  default="")
    amount:              Mapped[float]    = mapped_column(Float, default=0.0)
    currency:            Mapped[str]      = mapped_column(String(10),  default="INR")
    status:              Mapped[str]      = mapped_column(String(30),  default="pending")  # pending | success | failed | refunded
    payment_method:      Mapped[str]      = mapped_column(String(50),  default="")
    razorpay_order_id:   Mapped[str]      = mapped_column(String(100), default="")
    razorpay_payment_id: Mapped[str]      = mapped_column(String(100), default="")
    transaction_ref:     Mapped[str]      = mapped_column(String(200), default="")
    notes:               Mapped[str]      = mapped_column(Text, default="")
    failure_reason:      Mapped[str]      = mapped_column(Text, default="")
    created_at:          Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user:         Mapped["User"]               = relationship("User",         back_populates="transactions")
    subscription: Mapped["Subscription | None"] = relationship("Subscription", back_populates="transactions")


# ─────────────────────────────────────────────────────────────
# CRM: Watchlist Accounts
# ─────────────────────────────────────────────────────────────
class WatchlistAccount(Base):
    __tablename__ = "watchlist_accounts"
    __table_args__ = (Index("ix_watchlist_user_id", "user_id"),)

    id:               Mapped[str]      = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id:          Mapped[str]      = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    company_name:     Mapped[str]      = mapped_column(String(255), nullable=False)
    domain:           Mapped[str]      = mapped_column(String(255), default="")
    industry:         Mapped[str]      = mapped_column(String(100), default="")
    country:          Mapped[str]      = mapped_column(String(100), default="")
    hq_country:       Mapped[str]      = mapped_column(String(100), default="")
    employee_size:    Mapped[str]      = mapped_column(String(50),  default="")
    priority:         Mapped[str]      = mapped_column(String(20),  default="medium")
    watch_hiring:     Mapped[bool]     = mapped_column(Boolean, default=True)
    watch_pricing:    Mapped[bool]     = mapped_column(Boolean, default=True)
    watch_compliance: Mapped[bool]     = mapped_column(Boolean, default=True)
    watch_leadership: Mapped[bool]     = mapped_column(Boolean, default=True)
    watch_expansion:  Mapped[bool]     = mapped_column(Boolean, default=True)
    notes:            Mapped[str]      = mapped_column(Text, default="")
    last_checked:     Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at:       Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


# ─────────────────────────────────────────────────────────────
# CRM: Signals
# ─────────────────────────────────────────────────────────────
class WebSignal(Base):
    __tablename__ = "web_signals"
    __table_args__ = (
        Index("ix_signals_user_id",    "user_id"),
        Index("ix_signals_detected_at","detected_at"),
    )

    id:                 Mapped[str]      = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id:            Mapped[str]      = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    account_id:         Mapped[str | None] = mapped_column(String(36), ForeignKey("watchlist_accounts.id", ondelete="SET NULL"), nullable=True)
    account_name:       Mapped[str]      = mapped_column(String(255), default="")
    signal_type:        Mapped[str]      = mapped_column(String(50),  default="")
    signal_strength:    Mapped[str]      = mapped_column(String(20),  default="medium")
    title:              Mapped[str]      = mapped_column(String(500), default="")
    summary:            Mapped[str]      = mapped_column(Text, default="")
    proof_text:         Mapped[str]      = mapped_column(Text, default="")
    proof_url:          Mapped[str]      = mapped_column(String(500), default="")
    country_hint:       Mapped[str]      = mapped_column(String(100), default="")
    recommended_action: Mapped[str]      = mapped_column(Text, default="")
    score:              Mapped[int]      = mapped_column(Integer, default=5)
    is_actioned:        Mapped[bool]     = mapped_column(Boolean, default=False)
    is_dismissed:       Mapped[bool]     = mapped_column(Boolean, default=False)
    before_snapshot:    Mapped[str]      = mapped_column(Text, default="")
    after_snapshot:     Mapped[str]      = mapped_column(Text, default="")
    detected_at:        Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


# ─────────────────────────────────────────────────────────────
# CRM: Deals
# ─────────────────────────────────────────────────────────────
class Deal(Base):
    __tablename__ = "deals"
    __table_args__ = (Index("ix_deals_user_id", "user_id"),)

    id:                 Mapped[str]      = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id:            Mapped[str]      = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title:              Mapped[str]      = mapped_column(String(255), nullable=False)
    company_name:       Mapped[str]      = mapped_column(String(255), default="")
    contact_name:       Mapped[str]      = mapped_column(String(255), default="")
    contact_title:      Mapped[str]      = mapped_column(String(255), default="")
    value:              Mapped[float]    = mapped_column(Float, default=0.0)
    currency:           Mapped[str]      = mapped_column(String(10),  default="INR")
    stage:              Mapped[str]      = mapped_column(String(50),  default="signal")
    country:            Mapped[str]      = mapped_column(String(100), default="")
    industry:           Mapped[str]      = mapped_column(String(100), default="")
    signal_trigger:     Mapped[str]      = mapped_column(String(500), default="")
    compliance_checked: Mapped[bool]     = mapped_column(Boolean, default=False)
    next_action:        Mapped[str]      = mapped_column(Text, default="")
    probability:        Mapped[int]      = mapped_column(Integer, default=10)
    close_date:         Mapped[str]      = mapped_column(String(50),  default="")
    notes:              Mapped[str]      = mapped_column(Text, default="")
    created_at:         Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at:         Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


# ─────────────────────────────────────────────────────────────
# CRM: Leads
# ─────────────────────────────────────────────────────────────
class Lead(Base):
    __tablename__ = "leads"
    __table_args__ = (Index("ix_leads_user_id", "user_id"),)

    id:           Mapped[str]      = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id:      Mapped[str]      = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    company:      Mapped[str]      = mapped_column(String(255), default="")
    contact_name: Mapped[str]      = mapped_column(String(255), default="")
    title:        Mapped[str]      = mapped_column(String(255), default="")
    email:        Mapped[str]      = mapped_column(String(255), default="")
    phone:        Mapped[str]      = mapped_column(String(50),  default="")
    country:      Mapped[str]      = mapped_column(String(100), default="")
    industry:     Mapped[str]      = mapped_column(String(100), default="")
    status:       Mapped[str]      = mapped_column(String(50),  default="new")
    source:       Mapped[str]      = mapped_column(String(50),  default="manual")
    score:        Mapped[int]      = mapped_column(Integer, default=5)
    notes:        Mapped[str]      = mapped_column(Text, default="")
    created_at:   Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


# ─────────────────────────────────────────────────────────────
# SCRAPING: Tracked Pages + Snapshots
# ─────────────────────────────────────────────────────────────
class TrackedPage(Base):
    __tablename__ = "tracked_pages"
    __table_args__ = (Index("ix_tracked_pages_account_id", "account_id"),)

    id:              Mapped[str]      = mapped_column(String(36), primary_key=True, default=_uuid)
    account_id:      Mapped[str]      = mapped_column(String(36), ForeignKey("watchlist_accounts.id", ondelete="CASCADE"), nullable=False)
    page_type:       Mapped[str]      = mapped_column(String(50),  default="")
    url:             Mapped[str]      = mapped_column(String(500), default="")
    content_hash:    Mapped[str]      = mapped_column(String(64),  default="")
    content_text:    Mapped[str]      = mapped_column(Text, default="")
    country_keys:    Mapped[str]      = mapped_column(Text, default="")
    product_keys:    Mapped[str]      = mapped_column(Text, default="")
    job_count:       Mapped[int]      = mapped_column(Integer, default=0)
    last_scanned_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at:      Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class PageSnapshot(Base):
    __tablename__ = "page_snapshots"
    __table_args__ = (Index("ix_snapshots_signal_id", "signal_id"),)

    id:              Mapped[str]      = mapped_column(String(36), primary_key=True, default=_uuid)
    signal_id:       Mapped[str]      = mapped_column(String(36), ForeignKey("web_signals.id", ondelete="CASCADE"), nullable=False)
    tracked_page_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("tracked_pages.id", ondelete="SET NULL"), nullable=True)
    before_content:  Mapped[str]      = mapped_column(Text, default="")
    after_content:   Mapped[str]      = mapped_column(Text, default="")
    change_type:     Mapped[str]      = mapped_column(String(50),  default="")
    change_details:  Mapped[str]      = mapped_column(Text, default="")
    snapshot_at:     Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ComplianceSave(Base):
    __tablename__ = "compliance_saves"
    __table_args__ = (Index("ix_compliance_user_id", "user_id"),)

    id:         Mapped[str]      = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id:    Mapped[str]      = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    country:    Mapped[str]      = mapped_column(String(100), default="")
    framework:  Mapped[str]      = mapped_column(String(100), default="")
    notes:      Mapped[str]      = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
