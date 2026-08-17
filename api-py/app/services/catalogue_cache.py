"""Redis cache for the workspace catalogue (`GET /api/images`).

One key per seller. Missing Redis, a down Redis, or any Redis error is a miss —
Postgres remains the source of truth. Tests inject a backend via `use_backend`.
"""

from __future__ import annotations

import json
import logging
from typing import Any, Protocol

logger = logging.getLogger(__name__)

TTL_SECONDS = 600
_KEY_PREFIX = "catalogue:"


class CacheBackend(Protocol):
    async def get(self, key: str) -> str | None: ...

    async def set(self, key: str, value: str, ex: int | None = None) -> None: ...

    async def delete(self, key: str) -> None: ...


_backend: CacheBackend | None = None
_injected = False


def _key(user_id: str) -> str:
    return f"{_KEY_PREFIX}{user_id}"


def use_backend(backend: CacheBackend) -> None:
    """Install a cache backend (tests, or a live Redis client)."""
    global _backend, _injected
    _backend = backend
    _injected = True


def reset() -> None:
    global _backend, _injected
    _backend = None
    _injected = False


async def _resolve() -> CacheBackend | None:
    global _backend
    if _injected:
        return _backend
    if _backend is not None:
        return _backend
    try:
        from app.config import get_settings

        url = get_settings().redis_url
    except Exception:
        return None
    if not url:
        return None
    from redis.asyncio import Redis

    _backend = Redis.from_url(url, decode_responses=True)
    return _backend


async def get(user_id: str) -> list[Any] | None:
    try:
        client = await _resolve()
        if client is None:
            return None
        raw = await client.get(_key(user_id))
        if raw is None:
            return None
        loaded = json.loads(raw)
        if not isinstance(loaded, list):
            return None
        return loaded
    except Exception:
        logger.warning("catalogue cache get failed; falling back to postgres", exc_info=True)
        return None


async def put(user_id: str, payload: list[Any]) -> None:
    try:
        client = await _resolve()
        if client is None:
            return
        await client.set(_key(user_id), json.dumps(payload), ex=TTL_SECONDS)
    except Exception:
        logger.warning("catalogue cache put failed; skipping", exc_info=True)


async def invalidate(user_id: str | None) -> None:
    if not user_id:
        return
    try:
        client = await _resolve()
        if client is None:
            return
        await client.delete(_key(user_id))
    except Exception:
        logger.warning("catalogue cache invalidate failed; skipping", exc_info=True)


async def close() -> None:
    global _backend, _injected
    if _injected:
        return
    client = _backend
    _backend = None
    if client is None:
        return
    aclose = getattr(client, "aclose", None)
    if aclose is not None:
        await aclose()
