from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/signal_crm"
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
    SWIFT_CODE: str = "AXISINBB"
    BANK_SWIFT_ADDRESS: str = "Axis Bank Ltd, Tilekar Road Branch, Pune, Maharashtra, India"
    BANK_USD_ACCOUNT: str = ""
    BANK_EUR_ACCOUNT: str = ""

    def get_async_db_url(self) -> str:
        """Ensure postgresql+asyncpg:// driver prefix for SQLAlchemy async engine"""
        url = self.DATABASE_URL
        if url.startswith("postgres://"):
            url = "postgresql+asyncpg://" + url[len("postgres://"):]
        elif url.startswith("postgresql://") and "+asyncpg" not in url:
            url = "postgresql+asyncpg://" + url[len("postgresql://"):]
        return url

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache()
def get_settings():
    return Settings()
