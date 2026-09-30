"""`db`: a real Postgres session on the local `supabase start` server.

Never the dev `DATABASE_URL`: a separate `snapsync_test` database, migrated to head once
per run, and every test rolls back. Tests that take `db` skip when Postgres is down.
"""

import asyncio
import os
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlparse, urlunparse

import asyncpg
import httpx
import pytest
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.pool import NullPool

from app.auth.clerk import current_user_id
from app.config import Settings, get_settings
from app.db import build_engine_url, get_session
from app.main import create_app
from app.services import catalogue_cache, connections
from app.services import images as store
from app.services.push import Pushed, push_products
from app.services.shopify import get_shopify_graphql_for
from tests.seed import SELLER
from tests.shopify_shop import ShopifyShop

TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL", "postgresql://postgres:postgres@127.0.0.1:54322/snapsync_test"
)
_API_ROOT = Path(__file__).resolve().parent.parent


class _NoCache:
    async def get(self, key: str) -> str | None:
        return None

    async def set(self, key: str, value: str, ex: int | None = None) -> None:
        return None

    async def delete(self, key: str) -> None:
        return None


async def _ensure_database(url: str) -> None:
    parsed = urlparse(url)
    name = parsed.path.lstrip("/")
    server = await asyncpg.connect(urlunparse(parsed._replace(path="/postgres")), timeout=3)
    try:
        if not await server.fetchval("select 1 from pg_database where datname = $1", name):
            await server.execute(f'create database "{name}"')
    finally:
        await server.close()


@pytest.fixture(scope="session")
def test_database_url() -> str:
    if not urlparse(TEST_DATABASE_URL).path.endswith("_test"):
        pytest.fail("TEST_DATABASE_URL must name a *_test database")
    try:
        asyncio.run(_ensure_database(TEST_DATABASE_URL))
    except (OSError, asyncpg.PostgresError) as exc:
        pytest.skip(f"Local Postgres is down; run `supabase start` ({exc})")
    subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=_API_ROOT,
        env={**os.environ, "DATABASE_URL": TEST_DATABASE_URL},
        check=True,
        capture_output=True,
    )
    return TEST_DATABASE_URL


@pytest.fixture
async def db(test_database_url: str):
    catalogue_cache.use_backend(_NoCache())
    engine = create_async_engine(build_engine_url(test_database_url), poolclass=NullPool)
    try:
        async with engine.connect() as connection:
            outer = await connection.begin()
            session = AsyncSession(
                bind=connection,
                expire_on_commit=False,
                join_transaction_mode="create_savepoint",
            )
            try:
                yield session
            finally:
                await session.close()
                await outer.rollback()
    finally:
        await engine.dispose()
        catalogue_cache.reset()


@pytest.fixture
def db_settings(test_database_url: str) -> Settings:
    """Settings with no `.env` read: no Clerk, Langfuse, Stripe, or auth bypass."""
    return Settings.model_construct(database_url=test_database_url, environment="test")


@pytest.fixture
def push(db, db_settings):
    """The Push module as the seed seller, on `db`, against a given shop."""

    async def run(
        shop: ShopifyShop,
        ids: list[int],
        *,
        settings: Settings = db_settings,
        product_status: str | None = None,
        publication_ids: list[str] | None = None,
    ) -> Pushed:
        connection = await connections.get_shopify(db, SELLER)
        return await push_products(
            db,
            settings,
            shop,
            SELLER,
            await store.get_images_by_ids(db, ids, SELLER),
            granted_scopes=connection.granted_scopes or [],
            product_status=product_status,
            publication_ids=publication_ids,
        )

    return run


@pytest.fixture
def seller_app(db, db_settings, monkeypatch):
    """The app as the seed seller, on `db`."""
    monkeypatch.setenv("DATABASE_URL", db_settings.database_url)
    get_settings.cache_clear()
    app = create_app()
    get_settings.cache_clear()

    async def _db():
        yield db

    app.dependency_overrides[get_session] = _db
    app.dependency_overrides[current_user_id] = lambda: SELLER
    return app


async def _post(app, path: str, body: dict | None) -> httpx.Response:
    transport = httpx.ASGITransport(app=app, raise_app_exceptions=False)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        return await client.post(path, json=body)


@pytest.fixture
def api(seller_app, db_settings):
    """POST to the app as the seed seller, on `db`."""

    async def post(
        path: str, body: dict | None = None, *, settings: Settings = db_settings
    ) -> httpx.Response:
        seller_app.dependency_overrides[get_settings] = lambda: settings
        return await _post(seller_app, path, body)

    return post


@pytest.fixture
def push_route(seller_app, db_settings):
    """POST /api/images/push-to-shopify as the seed seller, on `db`, against a given shop."""

    async def post(
        shop: ShopifyShop, body: dict, *, settings: Settings = db_settings
    ) -> httpx.Response:
        seller_app.dependency_overrides[get_settings] = lambda: settings
        seller_app.dependency_overrides[get_shopify_graphql_for] = (
            lambda: lambda _connection: shop
        )
        return await _post(seller_app, "/api/images/push-to-shopify", body)

    return post
