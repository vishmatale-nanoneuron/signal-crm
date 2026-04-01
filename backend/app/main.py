"""Signal CRM — Privacy-Aware Cross-Border Signal CRM"""
import asyncio
import os
import time
from collections import defaultdict
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from contextlib import asynccontextmanager
from app.config import get_settings
from app.database import engine, Base
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

# ---------------------------------------------------------------------------
# In-memory rate limiter (per-IP, resets every window)
# ---------------------------------------------------------------------------
_rate_store: dict[str, list[float]] = defaultdict(list)

def _is_rate_limited(ip: str, path: str) -> bool:
    """Return True if this IP should be blocked.

    Auth endpoints: 10 req / 60s
    All other endpoints: 120 req / 60s
    """
    limit  = 10  if path.startswith("/api/auth/login") or path.startswith("/api/auth/register") else 120
    window = 60  # seconds
    now    = time.time()
    hits   = _rate_store[ip]
    _rate_store[ip] = [t for t in hits if now - t < window]
    if len(_rate_store[ip]) >= limit:
        return True
    _rate_store[ip].append(now)
    return False


class SecurityMiddleware(BaseHTTPMiddleware):
    """Add security headers + rate limiting to every response."""

    async def dispatch(self, request: Request, call_next):
        ip = request.client.host if request.client else "unknown"

        # Rate limiting
        if _is_rate_limited(ip, request.url.path):
            return Response(
                content='{"detail":"Too many requests. Slow down."}',
                status_code=429,
                media_type="application/json",
                headers={"Retry-After": "60"},
            )

        response: Response = await call_next(request)

        # Security headers on every response
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


async def _bg_init_db():
    """Background task: create tables with retries, non-blocking for startup."""
    await asyncio.sleep(3)
    for attempt in range(10):
        try:
            async with engine.connect() as conn:
                await conn.run_sync(Base.metadata.create_all)
                await conn.commit()
            print("✓ Signal CRM — DB tables ready")
            return
        except Exception as e:
            print(f"⚠ DB init attempt {attempt + 1}/10: {type(e).__name__} — retrying in 15s")
            await asyncio.sleep(15)
    print("✗ DB init gave up after 10 attempts — check DATABASE_URL")


@asynccontextmanager
async def lifespan(app: FastAPI):
    env    = os.environ.get("RAILWAY_ENVIRONMENT", "local")
    db_hint = os.environ.get("DATABASE_URL", "")[:40]
    print(f"✓ Signal CRM v3.0 starting — env={env} db={db_hint}...")
    asyncio.ensure_future(_bg_init_db())
    print("✓ Signal CRM v2.1 ready")
    yield
    await engine.dispose()
    print("Signal CRM — Shutdown")


app = FastAPI(
    title="Signal CRM API",
    version="2.1.0",
    lifespan=lifespan,
    description="Privacy-aware cross-border signal CRM — Turn web changes into sales actions.",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Security middleware first (before CORS)
app.add_middleware(SecurityMiddleware)

# CORS
_cors = list(settings.CORS_ORIGINS)
if settings.EXTRA_CORS_ORIGINS:
    _cors += [o.strip() for o in settings.EXTRA_CORS_ORIGINS.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register all routers
for router in [
    auth, watchlist_router, signals_router, buyer_map_router,
    compliance_router, deals_router, next_action_router,
    payment_router, leads_router, country_intel_router,
    analytics_router, email_router, detect_router, ai_router,
]:
    app.include_router(router, prefix="/api")


@app.get("/api/health")
async def health():
    return {
        "status": "healthy",
        "app": "Signal CRM",
        "version": "2.1.0",
        "security": "hardened",
        "modules": [
            "auth", "signals", "watchlist", "buyer-map",
            "compliance", "deals", "leads", "next-actions", "payment",
        ],
    }


@app.get("/")
async def root():
    return {
        "message": "Signal CRM API — Turn web changes into sales actions.",
        "docs": "/docs",
        "health": "/api/health",
        "website": "nanoneuron.ai",
    }
