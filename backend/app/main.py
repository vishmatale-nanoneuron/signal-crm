"""Signal CRM — Privacy-Aware Cross-Border Signal CRM"""
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


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("Signal CRM v2.0 — Database tables ready")
    yield
    await engine.dispose()


app = FastAPI(title="Signal CRM", version="2.0.0", lifespan=lifespan,
    description="Privacy-aware cross-border signal CRM — Turn web changes into sales actions.")

_cors = list(settings.CORS_ORIGINS)
if settings.EXTRA_CORS_ORIGINS:
    _cors += [o.strip() for o in settings.EXTRA_CORS_ORIGINS.split(",") if o.strip()]

app.add_middleware(CORSMiddleware, allow_origins=_cors, allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"])

for router in [auth, watchlist_router, signals_router, buyer_map_router, compliance_router,
               deals_router, next_action_router, payment_router, leads_router]:
    app.include_router(router, prefix="/api")


@app.get("/api/health")
async def health():
    return {"status": "healthy", "app": "Signal CRM", "version": "2.0.0", "database": "postgresql",
            "modules": ["auth","signals","watchlist","buyer-map","compliance","deals","leads","next-actions","payment"]}


@app.get("/")
async def root():
    return {"message": "Signal CRM API", "docs": "/docs", "health": "/api/health"}
