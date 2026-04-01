"""Signal CRM — Advanced Database Layer
Production-grade async PostgreSQL setup (mirrors OpenAI/Linear architecture):
- Async connection pool with health ping
- SSL-aware (Railway public vs internal)
- Statement timeout + idle-in-transaction guards
- Pool stats exposed for observability
- Context manager for background jobs
"""
import os
import ssl
import time
import logging
from contextlib import asynccontextmanager
from sqlalchemy.ext.asyncio import (
    create_async_engine,
    AsyncSession,
    async_sessionmaker,
    AsyncEngine,
)
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import text

logger = logging.getLogger("signal.db")

# ─── URL: normalise postgres:// → postgresql+asyncpg:// ─────────────────────
def _normalise_url(url: str) -> str:
    if url.startswith("postgres://"):
        return "postgresql+asyncpg://" + url[len("postgres://"):]
    if url.startswith("postgresql://") and "+asyncpg" not in url:
        return "postgresql+asyncpg://" + url[len("postgresql://"):]
    return url

_raw_url = os.environ.get("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/signal_crm")

# ─── SSL: public rlwy.net proxy needs SSL; internal railway.internal doesn't ─
def _build_ssl(raw_url: str):
    if "rlwy.net" in raw_url or ("railway.app" in raw_url and "railway.internal" not in raw_url):
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        return ctx
    return False

_ssl_ctx = _build_ssl(_raw_url)
_db_url  = _normalise_url(_raw_url)

# ─── Engine — production pool settings ───────────────────────────────────────
# pool_size=5       → 5 persistent connections per Gunicorn worker
# max_overflow=10   → 10 extra burst connections (auto-closed when idle)
# pool_recycle=600  → recycle connections every 10 min (avoids PG idle timeout)
# pool_timeout=30   → wait up to 30 s for a free connection
# pool_pre_ping     → test connection before use (catches stale/dropped conns)
engine: AsyncEngine = create_async_engine(
    _db_url,
    echo=False,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
    pool_recycle=600,
    pool_timeout=30,
    connect_args={
        "ssl": _ssl_ctx,
        "command_timeout": 30,
        "server_settings": {
            "application_name":                      "signal_crm_api",
            "statement_timeout":                     "25000",  # 25 s max query
            "idle_in_transaction_session_timeout":   "30000",  # 30 s idle txn
        },
    },
)

# ─── Session factory ─────────────────────────────────────────────────────────
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,   # keep objects usable after commit
    autoflush=True,
    autocommit=False,
)


# ─── SQLAlchemy declarative base ─────────────────────────────────────────────
class Base(DeclarativeBase):
    pass


# ─── FastAPI dependency — per-request session ────────────────────────────────
async def get_db():
    """Yields a scoped async session. Auto-rolls-back on exception."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise


# ─── Background-task context manager (scheduler / cron jobs) ─────────────────
@asynccontextmanager
async def get_db_ctx():
    """Use in background tasks — auto-commits on success, rolls back on error."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


# ─── Health probe ─────────────────────────────────────────────────────────────
async def db_ping() -> dict:
    """Ping the database and return latency + pool stats."""
    t0 = time.monotonic()
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        latency_ms = round((time.monotonic() - t0) * 1000, 1)
        pool = engine.pool
        return {
            "ok":          True,
            "latency_ms":  latency_ms,
            "pool_size":   pool.size(),
            "checked_out": pool.checkedout(),
            "overflow":    pool.overflow(),
        }
    except Exception as exc:
        logger.error("DB ping failed: %s", exc)
        return {"ok": False, "error": str(exc)[:120]}
