from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.config import get_settings

settings = get_settings()
db_url = settings.get_async_db_url()

# Railway internal DB URLs (postgres.railway.internal) don't need SSL.
# External URLs (e.g. public Railway proxy) do. Localhost never does.
_no_ssl = any(x in db_url for x in ["railway.internal", "localhost", "127.0.0.1"])
connect_args = {"ssl": False} if _no_ssl else {"ssl": "prefer"}

engine = create_async_engine(
    db_url,
    echo=False,
    pool_pre_ping=True,
    pool_size=3,
    max_overflow=7,
    pool_recycle=300,
    connect_args=connect_args,
)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
