from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/signal_crm"
    JWT_SECRET: str = "SignalCRM2026SecretKeyChangeInProd"
    JWT_ALGORITHM: str = "HS256"
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "https://signal-crm.pages.dev"]
    EXTRA_CORS_ORIGINS: str = ""
    ANTHROPIC_API_KEY: str = ""
    RAZORPAY_KEY_ID: str = "rzp_test_SXSbotImCIeKSM"
    RAZORPAY_KEY_SECRET: str = "K7mIRyHhIqL2eDCTrcLjP2i5"
    BANK_NAME: str = "Axis Bank Ltd"
    BANK_ACCOUNT_NUMBER: str = "922020067340454"
    BANK_ACCOUNT_HOLDER: str = "Nanoneuron Services"
    BANK_IFSC: str = "UTIB0005124"
    UPI_ID: str = ""

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache()
def get_settings():
    return Settings()
