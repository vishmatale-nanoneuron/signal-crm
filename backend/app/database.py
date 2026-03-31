import os
import ssl
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.config import get_settings

settings = get_settings()
db_url = settings.get_async_db_url()

# Use SSL only for public proxy (rlwy.net); internal Railway URL needs no SSL
_raw_url = os.environ.get("DATABASE_URL", settings.DATABASE_URL)
if "rlwy.net" in _raw_url or "railway.app" in _raw_url:
    _ssl_ctx = ssl.create_default_context()
    _ssl_ctx.check_hostname = False
    _ssl_ctx.verify_mode = ssl.CERT_NONE
    _ssl = _ssl_ctx
else:
    _ssl = False  # railway.internal — plain connection, no SSL overhead

engine = create_async_engine(
    db_url,
    echo=False,
    pool_pre_ping=True,
    pool_size=3,
    max_overflow=7,
    pool_recycle=300,
    pool_timeout=30,
    connect_args={"ssl": _ssl, "command_timeout": 30},
)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
