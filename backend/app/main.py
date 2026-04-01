"""Signal CRM — FastAPI Application
Production-grade backend (architecture mirrors OpenAI/ChatGPT API design):
- Request-ID tracing on every response
- Security headers (CSP, HSTS, X-Frame-Options)
- Per-IP rate limiting (auth: 10/min, API: 120/min)
- Async DB init with retry (background task — non-blocking startup)
- Idempotent column migrations (IF NOT EXISTS)
- Scheduler: daily digest + watchlist scans at 06:00 UTC
- Structured /api/health with DB pool stats
"""
import asyncio
import os
import time
import uuid
from collections import defaultdict

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from contextlib import asynccontextmanager

from app.config import get_settings
from app.database import engine, Base, db_ping

# ── Routers ──────────────────────────────────────────────────────────────────
from app.auth import auth
from app.watchlist import watchlist_router
from app.signals import signals_router
from app.buyer_map import buyer_map_router
from app.compliance import compliance_router
from app.deals import deals_router
from app.next_action import next_action_router
from app.payment import payment_router
from app.leads import leads_router
from app.country_intel import country_intel_router
from app.analytics import analytics_router
from app.email_templates import email_router
from app.detection_engine import detect_router, ai_router

settings = get_settings()

# ─────────────────────────────────────────────────────────────────────────────
# Rate limiter (in-process, per-IP sliding window)
# ─────────────────────────────────────────────────────────────────────────────
_rate_store: dict[str, list[float]] = defaultdict(list)

def _get_real_ip(request: Request) -> str:
    fwd = request.headers.get("X-Forwarded-For", "")
    if fwd:
        return fwd.split(",")[0].strip()
    cf = request.headers.get("CF-Connecting-IP", "")
    if cf:
        return cf
    return request.client.host if request.client else "unknown"


def _is_rate_limited(ip: str, path: str) -> bool:
    """True if this IP exceeds its limit for the given path."""
    limit  = 10  if path.startswith("/api/auth/login") or path.startswith("/api/auth/register") else 120
    window = 60
    now    = time.time()
    hits   = _rate_store[ip]
    _rate_store[ip] = [t for t in hits if now - t < window]
    if len(_rate_store[ip]) >= limit:
        return True
    _rate_store[ip].append(now)
    return False


# ─────────────────────────────────────────────────────────────────────────────
# Security + Request-ID middleware (runs on every request)
# ─────────────────────────────────────────────────────────────────────────────
class SecurityMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        ip = _get_real_ip(request)

        # Rate limiting
        if _is_rate_limited(ip, request.url.path):
            return Response(
                content='{"detail":"Too many requests. Slow down.","code":"RATE_LIMITED"}',
                status_code=429,
                media_type="application/json",
                headers={"Retry-After": "60"},
            )

        # Attach unique request ID for tracing (like ChatGPT's X-Request-ID)
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        request.state.request_id = request_id

        response: Response = await call_next(request)

        # ── Security headers (OWASP + Google recommendations) ──
        response.headers["X-Request-ID"]              = request_id
        response.headers["X-Content-Type-Options"]    = "nosniff"
        response.headers["X-Frame-Options"]           = "DENY"
        response.headers["X-XSS-Protection"]          = "1; mode=block"
        response.headers["Referrer-Policy"]           = "strict-origin-when-cross-origin"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"
        response.headers["Permissions-Policy"]        = "camera=(), microphone=(), geolocation=(), payment=()"
        response.headers["Content-Security-Policy"]   = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' https://checkout.razorpay.com; "
            "connect-src 'self' https://signal-crm-api-production.up.railway.app https://api.razorpay.com; "
            "img-src 'self' data: https:; "
            "style-src 'self' 'unsafe-inline'; "
            "frame-src https://api.razorpay.com; "
            "object-src 'none'; "
            "base-uri 'self';"
        )
        # Never cache auth or API responses
        if request.url.path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, private"
            response.headers["Pragma"]        = "no-cache"

        return response


# ─────────────────────────────────────────────────────────────────────────────
# Database initialisation (background, non-blocking)
# ─────────────────────────────────────────────────────────────────────────────
_MIGRATIONS = [
    # Core table columns added after initial deploy
    "ALTER TABLE web_signals    ADD COLUMN IF NOT EXISTS before_snapshot TEXT DEFAULT ''",
    "ALTER TABLE web_signals    ADD COLUMN IF NOT EXISTS after_snapshot  TEXT DEFAULT ''",
    "ALTER TABLE tracked_pages  ADD COLUMN IF NOT EXISTS country_keys    TEXT DEFAULT '[]'",
    "ALTER TABLE tracked_pages  ADD COLUMN IF NOT EXISTS product_keys    TEXT DEFAULT '[]'",
    # User table enhancements
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS phone         VARCHAR(50)  DEFAULT ''",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url    VARCHAR(500) DEFAULT ''",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified   BOOLEAN      DEFAULT TRUE",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP    NULL",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at    TIMESTAMP    DEFAULT NOW()",
]

_DB_READY = False    # module-level flag — checked by /api/health


async def _bg_init_db():
    """Background task: create all tables + run column migrations.
    Retries up to 10× with 15 s back-off — never blocks startup."""
    global _DB_READY
    await asyncio.sleep(2)   # let workers stabilise first

    for attempt in range(10):
        try:
            import sqlalchemy
            async with engine.connect() as conn:
                await conn.run_sync(Base.metadata.create_all)
                await conn.commit()

            async with engine.connect() as conn:
                for sql in _MIGRATIONS:
                    try:
                        await conn.execute(sqlalchemy.text(sql))
                    except Exception as me:
                        print(f"⚠ Migration skipped ({type(me).__name__}): {sql[:70]}")
                await conn.commit()

            _DB_READY = True
            print("✓ Signal CRM — DB tables ready + migrations applied")
            return

        except Exception as exc:
            print(f"⚠ DB init attempt {attempt + 1}/10 — {type(exc).__name__}: {exc} — retrying in 15 s")
            await asyncio.sleep(15)

    print("✗ DB init gave up after 10 attempts — check DATABASE_URL")


# ─────────────────────────────────────────────────────────────────────────────
# Application lifespan
# ─────────────────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    env     = os.environ.get("RAILWAY_ENVIRONMENT", "local")
    db_hint = os.environ.get("DATABASE_URL", "")[:40]
    print(f"✓ Signal CRM v3.2 starting — env={env} db={db_hint}…")

    # Non-blocking DB init
    asyncio.ensure_future(_bg_init_db())

    # Scheduler (daily scans + digest emails at 06:00 UTC)
    from app.scheduler import start_scheduler
    _scheduler = start_scheduler()

    print("✓ Signal CRM v3.2 ready")
    yield

    if _scheduler:
        _scheduler.shutdown(wait=False)
    await engine.dispose()
    print("✓ Signal CRM — Shutdown clean")


# ─────────────────────────────────────────────────────────────────────────────
# FastAPI app
# ─────────────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Signal CRM API",
    version="3.2.0",
    lifespan=lifespan,
    description=(
        "Privacy-aware cross-border signal CRM — "
        "Turn competitor web changes into sales actions."
    ),
    docs_url="/docs",
    redoc_url="/redoc",
    # Structured error responses (like OpenAI API)
    responses={
        400: {"description": "Bad request"},
        401: {"description": "Authentication required"},
        403: {"description": "Access forbidden / trial expired"},
        404: {"description": "Not found"},
        429: {"description": "Rate limit exceeded"},
        500: {"description": "Internal server error"},
    },
)

# ── Middleware stack (order matters: last added = first executed) ─────────────
app.add_middleware(SecurityMiddleware)

_cors = list(settings.CORS_ORIGINS)
if settings.EXTRA_CORS_ORIGINS:
    _cors += [o.strip() for o in settings.EXTRA_CORS_ORIGINS.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID"],
)

# ── Routers ──────────────────────────────────────────────────────────────────
for _router in [
    auth, watchlist_router, signals_router, buyer_map_router,
    compliance_router, deals_router, next_action_router,
    payment_router, leads_router, country_intel_router,
    analytics_router, email_router, detect_router, ai_router,
]:
    app.include_router(_router, prefix="/api")


# ─────────────────────────────────────────────────────────────────────────────
# System endpoints
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/api/health", tags=["System"])
async def health():
    """Comprehensive health check with DB pool stats — like OpenAI's /v1/health."""
    db_stats = await db_ping()
    return {
        "status":   "healthy" if db_stats["ok"] else "degraded",
        "app":      "Signal CRM",
        "version":  "3.2.0",
        "env":      os.environ.get("RAILWAY_ENVIRONMENT", "local"),
        "db":       db_stats,
        "db_ready": _DB_READY,
        "security": "hardened",
        "modules": [
            "auth", "signals", "watchlist", "buyer-map",
            "compliance", "deals", "leads", "next-actions",
            "payment", "analytics", "email-templates", "country-intel",
            "detection-engine", "ai-chat",
        ],
        "features": {
            "hiring_spike_detection":  True,
            "country_page_detection":  True,
            "new_product_detection":   True,
            "daily_digest_email":      True,
            "auto_scan_scheduler":     True,
            "razorpay_payments":       bool(settings.RAZORPAY_KEY_ID),
            "ai_chat":                 bool(settings.OPENAI_API_KEY),
        },
    }


@app.get("/api/db/health", tags=["System"])
async def db_health():
    """Database connection + pool stats — for monitoring dashboards."""
    return await db_ping()


@app.get("/", tags=["System"])
async def root():
    return {
        "message": "Signal CRM API — Turn web changes into sales actions.",
        "docs":    "/docs",
        "health":  "/api/health",
        "version": "3.2.0",
        "website": "nanoneuron.ai",
    }
