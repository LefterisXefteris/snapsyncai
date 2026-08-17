"""Alembic environment.

The connection URL comes from `app.config`/`app.db`, not `alembic.ini`, so the
Supabase pooler parsing in `build_engine_url` applies to migrations too.

Adoption note: production already has all 19 tables, created by Drizzle and by
`script/migrate.ts`. The first revision describes that existing schema and is applied
with `alembic stamp head` — never run `--autogenerate` against production before
stamping, or Alembic will try to recreate everything.
"""

import asyncio
from logging.config import fileConfig

from sqlalchemy.ext.asyncio import AsyncEngine
from sqlmodel import SQLModel

# Importing the models package registers every table on SQLModel.metadata.
import app.models  # noqa: F401
from alembic import context
from app.db import create_engine

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = SQLModel.metadata


def run_migrations_offline() -> None:
    from app.config import get_settings

    context.configure(
        url=get_settings().database_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    engine: AsyncEngine = create_engine()
    async with engine.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await engine.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
