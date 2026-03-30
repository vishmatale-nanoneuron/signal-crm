import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, Integer, Float, DateTime, Text, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


def gen_uuid():
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"
    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    name = Column(String, nullable=False)
    company_name = Column(String, default="")
    plan = Column(String, default="trial")  # trial, starter, pro, business
    is_paid = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    trial_start = Column(DateTime, default=datetime.utcnow)
    trial_end = Column(DateTime, nullable=True)
    credits = Column(Integer, default=10)
    created_at = Column(DateTime, default=datetime.utcnow)


class WatchlistAccount(Base):
    __tablename__ = "watchlist_accounts"
    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    user_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False)
    company_name = Column(String, nullable=False)
    domain = Column(String, nullable=False)
    industry = Column(String, default="")
    country = Column(String, default="")
    hq_country = Column(String, default="")
    employee_size = Column(String, default="")  # 1-50, 51-200, 201-1000, 1000+
    watch_hiring = Column(Boolean, default=True)
    watch_pricing = Column(Boolean, default=True)
    watch_compliance = Column(Boolean, default=True)
    watch_leadership = Column(Boolean, default=True)
    watch_expansion = Column(Boolean, default=True)
    last_checked = Column(DateTime, nullable=True)
    signal_count = Column(Integer, default=0)
    priority = Column(String, default="medium")  # high, medium, low
    notes = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)


class WebSignal(Base):
    __tablename__ = "web_signals"
    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    user_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False)
    account_id = Column(UUID(as_uuid=False), ForeignKey("watchlist_accounts.id"), nullable=True)
    company_name = Column(String, nullable=False)
    domain = Column(String, nullable=False)
    signal_type = Column(String, nullable=False)  # hiring_spike, new_country_page, pricing_change, leadership_change, new_product, compliance_update, partner_page
    signal_strength = Column(String, default="medium")  # high, medium, low
    title = Column(String, nullable=False)
    summary = Column(Text, nullable=False)
    proof_url = Column(String, default="")
    proof_text = Column(Text, default="")
    detected_at = Column(DateTime, default=datetime.utcnow)
    is_actioned = Column(Boolean, default=False)
    is_dismissed = Column(Boolean, default=False)
    country_hint = Column(String, default="")
    recommended_action = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)


class Deal(Base):
    __tablename__ = "deals"
    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    user_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False)
    title = Column(String, nullable=False)
    company_name = Column(String, default="")
    contact_name = Column(String, default="")
    contact_title = Column(String, default="")
    value = Column(Float, default=0)
    currency = Column(String, default="INR")
    stage = Column(String, default="signal")  # signal, qualified, proposal, negotiation, won, lost
    country = Column(String, default="")
    industry = Column(String, default="")
    signal_trigger = Column(Text, default="")
    compliance_checked = Column(Boolean, default=False)
    next_action = Column(Text, default="")
    probability = Column(Integer, default=20)
    close_date = Column(String, default="")
    notes = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)


class ComplianceNote(Base):
    __tablename__ = "compliance_notes"
    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    user_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False)
    country = Column(String, nullable=False)
    framework = Column(String, default="")
    checklist = Column(JSON, default=list)
    checked_items = Column(JSON, default=list)
    notes = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)
