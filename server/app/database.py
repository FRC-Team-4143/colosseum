from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

from app.config import settings

engine = create_async_engine(
    settings.database_url,
    connect_args={"check_same_thread": False},
    echo=False,
)

AsyncSessionLocal = async_sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        yield session


async def init_db() -> None:
    """Create all tables. No Alembic (matches the sibling apps) — an additive column
    change on an existing table becomes an inspect-guarded `ALTER TABLE`, run here right
    after `create_all`, and is a no-op on a fresh schema that already has the column."""
    from app import models  # noqa: F401 — imported for side-effect (table registration)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
