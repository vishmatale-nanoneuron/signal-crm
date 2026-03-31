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

    def get_async_db_url(self) -> str:
        """Ensure asyncpg driver — Railway provides plain postgres:// or postgresql://"""
        url = self.DATABASE_URL
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql+asyncpg://", 1)
        elif url.startswith("postgresql://") and "+asyncpg" not in url:
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        return url

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache()
def get_settings():
    return Settings()
