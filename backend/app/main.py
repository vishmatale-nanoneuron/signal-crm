"""Signal CRM — Privacy-Aware Cross-Border Signal CRM"""
import asyncio
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
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

settings = get_settings()


async def _bg_init_db():
    """Background task: create tables with retries, non-blocking for startup."""
    await asyncio.sleep(3)  # Let uvicorn fully start first
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
    env = os.environ.get("RAILWAY_ENVIRONMENT", "local")
    db_hint = os.environ.get("DATABASE_URL", "")[:40]
    print(f"✓ Signal CRM v2.0 starting — env={env} db={db_hint}...")
    # Fire DB init as a background task — NEVER block startup
    asyncio.ensure_future(_bg_init_db())
    print("✓ Signal CRM v2.0 ready")
    yield
    await engine.dispose()
    print("Signal CRM — Shutdown")


app = FastAPI(
    title="Signal CRM API",
    version="2.0.0",
    lifespan=lifespan,
    description="Privacy-aware cross-border signal CRM — Turn web changes into sales actions.",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Build CORS origins list
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
    payment_router, leads_router,
]:
    app.include_router(router, prefix="/api")


@app.get("/api/health")
async def health():
    return {
        "status": "healthy",
        "app": "Signal CRM",
        "version": "2.0.0",
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
