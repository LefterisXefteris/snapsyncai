"""Workspace catalogue cache — GET /api/images read-through, fail-open."""

from __future__ import annotations

import asyncio

import pytest
from fastapi.testclient import TestClient

from app.auth.clerk import DEV_USER_ID
from app.config import get_settings
from app.db import get_session
from app.main import create_app
from app.models.image import Image
from app.services import catalogue_cache as cache
from app.services import images as store


class FakeRedis:
    """Redis-shaped adapter for tests. Raise ConnectionError when `down` is set."""

    def __init__(self) -> None:
        self.data: dict[str, str] = {}
        self.ttls: dict[str, int] = {}
        self.down = False

    async def get(self, key: str) -> str | None:
        self._raise_if_down()
        return self.data.get(key)

    async def set(self, key: str, value: str, ex: int | None = None) -> None:
        self._raise_if_down()
        self.data[key] = value
        if ex is not None:
            self.ttls[key] = ex

    async def delete(self, key: str) -> None:
        self._raise_if_down()
        self.data.pop(key, None)
        self.ttls.pop(key, None)

    def _raise_if_down(self) -> None:
        if self.down:
            raise ConnectionError("redis down")


@pytest.fixture(autouse=True)
def _reset_cache() -> None:
    cache.reset()
    yield
    cache.reset()


async def test_get_returns_none_when_redis_is_unset() -> None:
    assert await cache.get("user_1") is None


async def test_put_then_get_returns_the_catalogue() -> None:
    redis = FakeRedis()
    cache.use_backend(redis)
    payload = [{"id": 7, "title": "Linen shirt"}]

    await cache.put("user_1", payload)

    assert await cache.get("user_1") == payload
    assert redis.ttls["catalogue:user_1"] == 600


async def test_invalidate_drops_that_sellers_catalogue_only() -> None:
    cache.use_backend(FakeRedis())
    await cache.put("user_1", [{"id": 1}])
    await cache.put("user_2", [{"id": 2}])

    await cache.invalidate("user_1")

    assert await cache.get("user_1") is None
    assert await cache.get("user_2") == [{"id": 2}]


async def test_get_put_invalidate_fail_open_when_redis_is_down() -> None:
    redis = FakeRedis()
    cache.use_backend(redis)
    await cache.put("user_1", [{"id": 1}])
    redis.down = True

    assert await cache.get("user_1") is None
    await cache.put("user_1", [{"id": 9}])
    await cache.invalidate("user_1")


def _list_client(monkeypatch) -> TestClient:
    monkeypatch.setenv("DATABASE_URL", "postgresql://u:p@localhost:5432/db")
    monkeypatch.setenv("CLERK_SECRET_KEY", "sk_test_fake")
    monkeypatch.setenv("DEV_BYPASS_AUTH", "true")
    get_settings.cache_clear()
    app = create_app()

    async def _no_db():
        yield None

    app.dependency_overrides[get_session] = _no_db
    return TestClient(app, raise_server_exceptions=False)


def _row(title: str) -> Image:
    return Image(
        id=1,
        original_name="shirt.jpg",
        mime_type="image/jpeg",
        size=12,
        title=title,
        session_id=DEV_USER_ID,
    )


def test_list_images_serves_cached_catalogue_without_postgres(monkeypatch) -> None:
    cache.use_backend(FakeRedis())

    async def boom(*_args, **_kwargs):
        raise AssertionError("postgres should not be queried on a cache hit")

    monkeypatch.setattr(store, "list_images", boom)
    client = _list_client(monkeypatch)
    try:
        asyncio.run(cache.put(DEV_USER_ID, [{"id": 3, "title": "Cached linen"}]))
        response = client.get("/api/images")
        assert response.status_code == 200
        assert response.json() == [{"id": 3, "title": "Cached linen"}]
    finally:
        get_settings.cache_clear()


def test_list_images_miss_fills_cache_and_invalidate_refreshes(monkeypatch) -> None:
    cache.use_backend(FakeRedis())
    titles = iter(["First", "Fresh"])

    async def fake_list(*_args, **_kwargs):
        return [_row(next(titles))]

    monkeypatch.setattr(store, "list_images", fake_list)
    client = _list_client(monkeypatch)
    try:
        first = client.get("/api/images")
        second = client.get("/api/images")
        assert first.status_code == 200
        assert first.json()[0]["title"] == "First"
        assert second.json()[0]["title"] == "First"

        asyncio.run(cache.invalidate(DEV_USER_ID))
        third = client.get("/api/images")
        assert third.json()[0]["title"] == "Fresh"
    finally:
        get_settings.cache_clear()
