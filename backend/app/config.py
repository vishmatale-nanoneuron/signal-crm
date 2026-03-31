from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/signal_crm"
    JWT_SECRET: str = "SignalCRM2026SecretKeyChangeInProd"
    JWT_ALGORITHM: str = "HS256"
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "https://nanoneuron.ai", "https://www.nanoneuron.ai"]
    EXTRA_CORS_ORIGINS: str = ""
    ANTHROPIC_API_KEY: str = ""
    RAZORPAY_KEY_ID: str = ""
    RAZORPAY_KEY_SECRET: str = ""
    BANK_NAME: str = "Axis Bank Ltd"
    BANK_ACCOUNT_NUMBER: str = "922020067340454"
    BANK_ACCOUNT_HOLDER: str = "Nanoneuron Services"
    BANK_IFSC: str = "UTIB0005124"
    UPI_ID: str = ""

    def get_async_db_url(self) -> str:
        """Convert to psycopg3 async driver with correct sslmode for Railway"""
        url = self.DATABASE_URL
        # Strip any existing driver prefix
        for prefix in ["postgres://", "postgresql://", "postgresql+asyncpg://", "postgresql+psycopg://"]:
            if url.startswith(prefix):
                url = "postgresql://" + url[len(prefix):]
                break
        # Strip existing sslmode query param if any
        if "?" in url:
            base, query = url.split("?", 1)
            params = [p for p in query.split("&") if not p.startswith("sslmode")]
            url = base + ("?" + "&".join(params) if params else "")
        # Add correct sslmode based on host type
        is_local = any(x in url for x in ["localhost", "127.0.0.1", "railway.internal"])
        sslmode = "disable" if is_local else "require"
        sep = "&" if "?" in url else "?"
        url = f"{url}{sep}sslmode={sslmode}"
        # Use psycopg3 async driver
        url = url.replace("postgresql://", "postgresql+psycopg://", 1)
        return url

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache()
def get_settings():
    return Settings()
