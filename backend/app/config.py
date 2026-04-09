from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # ── Database (Supabase direct connection) ─────────────────
    # Use the direct connection URL from Supabase:
    # Settings → Database → Connection string → URI (port 5432)
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/signal_crm"

    # ── Supabase project keys ─────────────────────────────────
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_SERVICE_KEY: str = ""

    # ── JWT Auth ──────────────────────────────────────────────
    JWT_SECRET: str = "SignalCRM2026SecretKeyChangeInProd"
    JWT_ALGORITHM: str = "HS256"

    # ── CORS ──────────────────────────────────────────────────
    CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://localhost:3001",
        "https://nanoneuron.ai",
        "https://www.nanoneuron.ai",
        "https://signal.nanoneuron.ai",
        "https://signal-crm.nanoneuron.ai",
        "https://signal-crm.pages.dev",
        "https://signal-crm-frontend.pages.dev",
        "https://signal-crm.vercel.app",
    ]
    EXTRA_CORS_ORIGINS: str = ""

    # ── AI APIs ───────────────────────────────────────────────
    ANTHROPIC_API_KEY: str = ""
    OPENAI_API_KEY: str = ""

    # ── Payments ──────────────────────────────────────────────
    RAZORPAY_KEY_ID: str = ""
    RAZORPAY_KEY_SECRET: str = ""

    # ── Bank (SWIFT / NEFT) ───────────────────────────────────
    BANK_NAME: str = "Axis Bank Ltd"
    BANK_ACCOUNT_NUMBER: str = "922020067340454"
    BANK_ACCOUNT_HOLDER: str = "Nanoneuron Services"
    BANK_IFSC: str = "UTIB0005124"
    UPI_ID: str = ""
    SWIFT_CODE: str = "AXISINBB"
    BANK_SWIFT_ADDRESS: str = "Axis Bank Ltd, Tilekar Road Branch, Pune, Maharashtra, India"
    BANK_USD_ACCOUNT: str = ""
    BANK_EUR_ACCOUNT: str = ""

    # ── Email / SMTP ──────────────────────────────────────────
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    FROM_EMAIL: str = "signal@nanoneuron.ai"
    FROM_NAME: str = "Signal CRM"

    def get_async_db_url(self) -> str:
        """Normalise any postgres:// variant → postgresql+asyncpg://
        Supabase provides postgres:// — this fixes it for SQLAlchemy async."""
        url = self.DATABASE_URL
        if url.startswith("postgres://"):
            url = "postgresql+asyncpg://" + url[len("postgres://"):]
        elif url.startswith("postgresql://") and "+asyncpg" not in url:
            url = "postgresql+asyncpg://" + url[len("postgresql://"):]
        return url

    def is_supabase(self) -> bool:
        """True when DATABASE_URL points to Supabase (supabase.co domain)."""
        return "supabase.co" in self.DATABASE_URL or "supabase.com" in self.DATABASE_URL

    def uses_pgbouncer(self) -> bool:
        """True when using Supabase Transaction Mode pooler (port 6543)."""
        return ":6543/" in self.DATABASE_URL

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache()
def get_settings():
    return Settings()
