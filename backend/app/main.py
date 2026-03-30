"""Signal CRM — Privacy-Aware Cross-Border Signal CRM (Supabase)"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings
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

app = FastAPI(
    title="Signal CRM",
    version="2.0.0",
    docs_url="/docs",
    description="Privacy-aware cross-border signal CRM — Turn web changes into sales actions.",
)

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

app.include_router(auth, prefix="/api")
app.include_router(watchlist_router, prefix="/api")
app.include_router(signals_router, prefix="/api")
app.include_router(buyer_map_router, prefix="/api")
app.include_router(compliance_router, prefix="/api")
app.include_router(deals_router, prefix="/api")
app.include_router(next_action_router, prefix="/api")
app.include_router(payment_router, prefix="/api")
app.include_router(leads_router, prefix="/api")


@app.get("/api/health")
def health():
    return {
        "status": "healthy",
        "app": "Signal CRM",
        "version": "2.0.0",
        "database": "supabase",
        "tagline": "Turn web changes into sales actions",
        "modules": ["auth", "signals", "watchlist", "buyer-map", "compliance", "deals", "leads", "next-actions", "payment"],
    }


@app.get("/")
def root():
    return {
        "message": "Signal CRM — Privacy-Aware Cross-Border Signal CRM",
        "docs": "/docs",
        "health": "/api/health",
        "version": "2.0.0",
    }
