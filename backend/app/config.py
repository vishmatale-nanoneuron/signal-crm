from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Supabase
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_SERVICE_KEY: str = ""

    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "https://signal-crm.pages.dev"]
    EXTRA_CORS_ORIGINS: str = ""

    # Anthropic (optional AI features)
    ANTHROPIC_API_KEY: str = ""

    # Razorpay — client payments
    RAZORPAY_KEY_ID: str = "rzp_test_SXSbotImCIeKSM"
    RAZORPAY_KEY_SECRET: str = "K7mIRyHhIqL2eDCTrcLjP2i5"

    # Bank — Axis Bank India
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
