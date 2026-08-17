"""FastAPI application factory.

Routes keep their existing `/api/...` paths verbatim. Locally, Vite proxies every
`/api` request here. After Railway cutover the SPA calls
`https://api.snapsyncai.co.uk` with credentials; until then production Express on
Vercel still serves `/api`.

Served via the factory (`uvicorn app.main:create_app --factory`) rather than a
module-level instance, so importing this module has no side effects and does not
require a complete environment — Alembic and the OpenAPI export both rely on that.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.db import dispose_engine, get_engine
from app.routers import (
    ai,
    billing,
    config,
    connections,
    health,
    images,
    oauth,
    webhooks,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    settings = get_settings()
    get_engine()
    logger.info("API starting (environment=%s)", settings.environment)
    yield
    await dispose_engine()


def create_app() -> FastAPI:
    settings = get_settings()

    if settings.sentry_dsn:
        import sentry_sdk

        sentry_sdk.init(dsn=settings.sentry_dsn, environment=settings.environment)

    app = FastAPI(
        title="SnapSync AI API",
        version="0.1.0",
        lifespan=lifespan,
        # The SPA reads camelCase; never let FastAPI emit field names over aliases.
        separate_input_output_schemas=False,
    )

    # Required once the SPA calls https://api.snapsyncai.co.uk from www.
    if settings.cors_allow_origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.cors_allow_origins,
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

    app.include_router(health.router)
    app.include_router(config.router)
    app.include_router(connections.router)
    app.include_router(oauth.router)
    app.include_router(images.router)
    app.include_router(ai.router)
    app.include_router(billing.router)
    app.include_router(webhooks.router)
    return app
