"""Async database engine.

`server/db.ts` parses `DATABASE_URL` by hand because node-postgres misreads Supabase
Transaction Pooler credentials — the username contains a dot (`postgres.ubgdf...`) and
pg treats the dotted username as a hostname, giving ENOTFOUND. We parse explicitly here
too, for a different reason: the password routinely contains characters that must be
percent-encoded, and handing SQLAlchemy a raw URL makes that a silent connection failure
rather than an obvious one.
"""

from collections.abc import AsyncGenerator
from typing import Annotated
from urllib.parse import unquote, urlparse

from fastapi import Depends
from sqlalchemy.engine import URL
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.config import Settings, get_settings


def build_engine_url(database_url: str) -> URL:
    """Split a libpq-style URL into discrete fields SQLAlchemy can't misparse."""
    parsed = urlparse(database_url)
    if not parsed.hostname:
        raise ValueError("DATABASE_URL has no host component")

    return URL.create(
        drivername="postgresql+asyncpg",
        username=unquote(parsed.username) if parsed.username else None,
        password=unquote(parsed.password) if parsed.password else None,
        host=parsed.hostname,
        port=parsed.port or 5432,
        database=parsed.path.lstrip("/") or None,
    )


def create_engine(settings: Settings | None = None) -> AsyncEngine:
    settings = settings or get_settings()
    url = build_engine_url(settings.database_url)

    connect_args: dict = {
        # Supabase's pooler terminates TLS but presents a cert that doesn't verify
        # against the system store — `server/db.ts` uses rejectUnauthorized:false.
        "ssl": "require" if "supabase" in settings.database_url else None,
        # PgBouncer in transaction mode cannot support prepared statements.
        "statement_cache_size": 0,
        "server_settings": {"application_name": "snapsyncai-api"},
    }
    connect_args = {k: v for k, v in connect_args.items() if v is not None}

    return create_async_engine(
        url,
        pool_size=settings.database_pool_max,
        max_overflow=0,
        pool_pre_ping=True,
        pool_recycle=1800,
        connect_args=connect_args,
    )


_engine: AsyncEngine | None = None
_sessionmaker: async_sessionmaker[AsyncSession] | None = None


def get_engine() -> AsyncEngine:
    global _engine, _sessionmaker
    if _engine is None:
        _engine = create_engine()
        _sessionmaker = async_sessionmaker(_engine, expire_on_commit=False)
    return _engine


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency yielding a session that commits on success."""
    get_engine()
    assert _sessionmaker is not None
    async with _sessionmaker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def dispose_engine() -> None:
    global _engine, _sessionmaker
    if _engine is not None:
        await _engine.dispose()
        _engine = None
        _sessionmaker = None


SessionDep = Annotated[AsyncSession, Depends(get_session)]
