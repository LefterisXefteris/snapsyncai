"""Where a shop's thread is kept. One row per seller and shop, including shown proposals."""

from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.chat import ChatThread
from app.services.chat_listing import Shown, pack_thread, unpack_thread


def _key(user_id: str, shop_domain: str | None) -> tuple[str, str]:
    return (user_id, shop_domain or "")


def _domain(shop_domain: str | None) -> str:
    return shop_domain or ""


class MemoryThreadStore:
    def __init__(self) -> None:
        self._threads: dict[tuple[str, str], tuple[tuple[str, str], ...]] = {}
        self._shown: dict[tuple[str, str], tuple[Shown, ...]] = {}
        self._locks: dict[tuple[str, str], asyncio.Lock] = {}
        self._guard = asyncio.Lock()

    @asynccontextmanager
    async def exclusive(self, user_id: str, shop_domain: str | None):
        key = _key(user_id, shop_domain)
        async with self._guard:
            lock = self._locks.get(key)
            if lock is None:
                lock = asyncio.Lock()
                self._locks[key] = lock
        async with lock:
            yield

    async def load(
        self, user_id: str, shop_domain: str | None
    ) -> tuple[tuple[str, str], ...]:
        return self._threads.get(_key(user_id, shop_domain), ())

    async def shown(self, user_id: str, shop_domain: str | None) -> tuple[Shown, ...]:
        return self._shown.get(_key(user_id, shop_domain), ())

    async def save(
        self,
        user_id: str,
        shop_domain: str | None,
        thread: tuple[tuple[str, str], ...],
        shown: tuple[Shown, ...] = (),
    ) -> None:
        key = _key(user_id, shop_domain)
        self._threads[key] = thread
        self._shown[key] = shown


class SqlThreadStore:
    """The thread SnapSync stores, so any API instance can take the next turn."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    @asynccontextmanager
    async def exclusive(self, user_id: str, shop_domain: str | None):
        key = f"{user_id}\n{_domain(shop_domain)}"
        await self._session.execute(
            text("SELECT pg_advisory_xact_lock(hashtext(:key)::bigint)"),
            {"key": key},
        )
        yield

    async def load(
        self, user_id: str, shop_domain: str | None
    ) -> tuple[tuple[str, str], ...]:
        row = await self._row(user_id, shop_domain)
        if row is None:
            return ()
        turns, _shown = unpack_thread(row.thread)
        return turns

    async def shown(self, user_id: str, shop_domain: str | None) -> tuple[Shown, ...]:
        row = await self._row(user_id, shop_domain)
        if row is None:
            return ()
        _turns, shown = unpack_thread(row.thread)
        return shown

    async def save(
        self,
        user_id: str,
        shop_domain: str | None,
        thread: tuple[tuple[str, str], ...],
        shown: tuple[Shown, ...] = (),
    ) -> None:
        payload = pack_thread(thread, shown)
        row = await self._row(user_id, shop_domain)
        if row is None:
            self._session.add(
                ChatThread(
                    session_id=user_id,
                    shop_domain=_domain(shop_domain),
                    thread=payload,
                )
            )
        else:
            row.thread = payload
            self._session.add(row)
        await self._session.flush()

    async def _row(self, user_id: str, shop_domain: str | None) -> ChatThread | None:
        result = await self._session.execute(
            select(ChatThread).where(
                ChatThread.session_id == user_id,
                ChatThread.shop_domain == _domain(shop_domain),
            )
        )
        return result.scalar_one_or_none()
