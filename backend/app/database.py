from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.config import get_settings

settings = get_settings()
db_url = settings.get_async_db_url()

engine = create_async_engine(
    db_url,
    echo=False,
    pool_pre_ping=True,
    pool_size=3,
    max_overflow=7,
    pool_recycle=300,
    pool_timeout=30,
    connect_args={"ssl": False, "command_timeout": 30},
)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
