"""Marketplace connection persistence — port of the `*Connection` half of
`server/storage.ts`.

Upserts use `INSERT ... ON CONFLICT (session_id) DO UPDATE` rather than the
read-then-write pattern in `server/storage.ts:150-227`, which is a documented race
(`.planning/codebase/CONCERNS.md`): two concurrent OAuth callbacks can both miss the
SELECT and then one write is lost. The UNIQUE constraint on `session_id` already exists,
so this is a strictly safer path to the same result.
"""

from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import SQLModel

from app.models import ShopifyConnection


async def _get[T: SQLModel](
    session: AsyncSession, model: type[T], user_id: str
) -> T | None:
    if not user_id:
        # Mirrors the guard in server/storage.ts — a falsy tenancy key is a
        # programming error, not an empty result.
        raise ValueError(f"{model.__name__} lookup called without a user id")
    result = await session.execute(select(model).where(model.session_id == user_id))
    return result.scalar_one_or_none()


async def _upsert[T: SQLModel](
    session: AsyncSession, model: type[T], values: dict
) -> T:
    table = model.__table__
    updatable = {k: v for k, v in values.items() if k != "session_id"}
    statement = (
        insert(table)
        .values(**values)
        .on_conflict_do_update(index_elements=["session_id"], set_=updatable)
        .returning(table)
    )
    row = (await session.execute(statement)).one()
    return model(**row._mapping)


async def _delete[T: SQLModel](session: AsyncSession, model: type[T], user_id: str) -> None:
    await session.execute(delete(model).where(model.session_id == user_id))


async def get_shopify(session: AsyncSession, user_id: str) -> ShopifyConnection | None:
    return await _get(session, ShopifyConnection, user_id)


async def upsert_shopify(session: AsyncSession, **values) -> ShopifyConnection:
    return await _upsert(session, ShopifyConnection, values)


async def delete_shopify(session: AsyncSession, user_id: str) -> None:
    await _delete(session, ShopifyConnection, user_id)
