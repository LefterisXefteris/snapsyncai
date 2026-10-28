"""Import from Chat. It is the page's Import. The turn ends once it has started."""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Awaitable
from dataclasses import dataclass
from typing import Protocol

from app.services.import_catalogue import ImportResult

IMPORT = "import"
RUNNING = "Import is in progress."

logger = logging.getLogger(__name__)
_tasks: set[asyncio.Task[None]] = set()


@dataclass(frozen=True)
class ImportBegun:
    """Import has started. `done` resolves with the page's result."""

    done: Awaitable[ImportResult]


class ImportJob(Protocol):
    """The page's Start. A blocked result did not start."""

    async def start(self) -> ImportResult | ImportBegun: ...


@dataclass(frozen=True)
class ImportReply:
    text: str
    done: Awaitable[ImportResult] | None = None


def result_text(result: ImportResult) -> str:
    """The counts the Import page shows when a run finishes."""
    line = f"Created {result.created} · skipped {result.skipped} · failed {result.failed}"
    failures = [
        f"{item.channel_product_id}: {item.reason}" for item in result.failures
    ]
    if not failures:
        return line
    return f"{line}\n" + "\n".join(failures)


async def import_act(*, act: str | None, importer: ImportJob | None) -> ImportReply | None:
    """Run Import. None means this step is not Import."""
    if act != IMPORT:
        return None
    if importer is None:
        from app.services.chat import UNAVAILABLE

        return ImportReply(UNAVAILABLE)
    started = await importer.start()
    if isinstance(started, ImportResult):
        from app.services.chat import UNAVAILABLE

        return ImportReply(started.blocked_reason or UNAVAILABLE)
    return ImportReply(RUNNING, started.done)


async def _append(store, user_id: str, shop_domain: str | None, text: str) -> None:
    async with store.exclusive(user_id, shop_domain):
        thread = tuple(await store.load(user_id, shop_domain)) + (("chat", text),)
        shown = await store.shown(user_id, shop_domain)
        await store.save(user_id, shop_domain, thread, shown)


async def record_import(
    store,
    user_id: str,
    shop_domain: str | None,
    done: Awaitable[ImportResult],
) -> None:
    """Append the page's result once Import completes. The turn has already ended."""
    try:
        result = await done
    except Exception:
        logger.exception("Import did not complete")
        return
    await _append(store, user_id, shop_domain, result.blocked_reason or result_text(result))


def _abort_unless_finished(session, lock):
    """A rollback before the run starts must not leave the page's lock held."""
    from sqlalchemy import event

    sync = session.sync_session

    def abort_lock(_session) -> None:
        if lock.in_progress():
            lock.abort()

    event.listen(sync, "after_rollback", abort_lock)

    def disarm() -> None:
        if event.contains(sync, "after_rollback", abort_lock):
            event.remove(sync, "after_rollback", abort_lock)

    return disarm


def watch_import(
    store,
    user_id: str,
    shop_domain: str | None,
    done: Awaitable[ImportResult],
) -> None:
    """Remember the result after the turn. A request session records it after commit."""
    if getattr(store, "_session", None) is not None:
        return
    task = asyncio.create_task(record_import(store, user_id, shop_domain, done))
    _tasks.add(task)
    task.add_done_callback(_tasks.discard)


class ShopifyImport:
    """The page's Import. The run continues after the turn's reply is stored."""

    def __init__(self, session, user_id: str, shop_domain: str | None, graphql_for) -> None:
        self._session = session
        self._user_id = user_id
        self._shop_domain = shop_domain
        self._graphql_for = graphql_for

    async def start(self) -> ImportResult | ImportBegun:
        from app.db import after_commit
        from app.routers.catalogue_import import run_connected_import
        from app.services.connections import get_shopify
        from app.services.import_catalogue import (
            IN_PROGRESS,
            NOT_CONNECTED,
            RUNS,
            start_blocked_reason,
        )

        connection = await get_shopify(self._session, self._user_id)
        lock = RUNS.for_user(self._user_id)
        blocked = start_blocked_reason(
            shopify_connected=connection is not None,
            run_in_progress=lock.in_progress(),
        )
        if blocked or connection is None:
            return ImportResult(blocked_reason=blocked or NOT_CONNECTED)
        if not lock.begin():
            return ImportResult(blocked_reason=IN_PROGRESS)
        disarm = _abort_unless_finished(self._session, lock)
        graphql = self._graphql_for(connection)
        user_id = self._user_id
        shop_domain = self._shop_domain
        done: asyncio.Future[ImportResult] = asyncio.get_running_loop().create_future()

        async def finish(session) -> None:
            from app.services.chat_store import SqlThreadStore

            disarm()
            try:
                result = await run_connected_import(
                    session, user_id, graphql, lock, already_holding=True
                )
            except Exception as exc:
                logger.exception("Import could not list Channel products")
                detail = getattr(exc, "detail", None)
                reason = detail if isinstance(detail, str) else "Could not list Channel products"
                result = ImportResult(blocked_reason=reason)
            await _append(
                SqlThreadStore(session),
                user_id,
                shop_domain,
                result.blocked_reason or result_text(result),
            )
            if not done.done():
                done.set_result(result)

        try:
            after_commit(self._session, f"chat-import:{user_id}", finish)
        except Exception:
            disarm()
            lock.abort()
            raise
        return ImportBegun(done)
