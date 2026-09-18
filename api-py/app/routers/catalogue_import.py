"""Import HTTP — Start and poll. Rules live in the Import module."""

from __future__ import annotations

import logging

import httpx
from fastapi import APIRouter, HTTPException, status

from app.auth.clerk import CurrentUser
from app.config import SettingsDep
from app.db import SessionDep
from app.schemas.base import CamelModel
from app.services import connections
from app.services import images as store
from app.services.import_catalogue import (
    RUNS,
    ImportResult,
    start_blocked_reason,
    start_import,
)
from app.services.import_persist import persist_imported_product
from app.services.shopify_import import list_shopify_channel_products

logger = logging.getLogger(__name__)

router = APIRouter(tags=["import"])


class ImportFailureOut(CamelModel):
    channel_product_id: str
    reason: str


class ImportStatusResponse(CamelModel):
    shop_connected: bool
    start_blocked_reason: str | None = None
    in_progress: bool = False
    completed: bool = False
    created: int = 0
    skipped: int = 0
    failed: int = 0
    failures: list[ImportFailureOut] = []


def _status(
    shop_connected: bool, result: ImportResult | None, in_progress: bool
) -> ImportStatusResponse:
    blocked = start_blocked_reason(
        shopify_connected=shop_connected, run_in_progress=in_progress
    )
    last = result
    return ImportStatusResponse(
        shop_connected=shop_connected,
        start_blocked_reason=blocked,
        in_progress=in_progress,
        completed=last is not None,
        created=last.created if last else 0,
        skipped=last.skipped if last else 0,
        failed=last.failed if last else 0,
        failures=[
            ImportFailureOut(channel_product_id=item.channel_product_id, reason=item.reason)
            for item in (last.failures if last else ())
        ],
    )


async def load_channel_photo(url: str) -> str | None:
    try:
        async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
            response = await client.get(url)
        if response.is_success:
            return url
    except httpx.HTTPError:
        logger.info("Import media URL failed: %s", url)
    return None


@router.get("/api/import", response_model=ImportStatusResponse)
async def import_status(user_id: CurrentUser, session: SessionDep) -> ImportStatusResponse:
    connection = await connections.get_shopify(session, user_id)
    lock = RUNS.for_user(user_id)
    return _status(connection is not None, lock.last, lock.in_progress())


@router.post("/api/import/start", response_model=ImportStatusResponse)
async def import_start(
    user_id: CurrentUser, session: SessionDep, settings: SettingsDep
) -> ImportStatusResponse:
    connection = await connections.get_shopify(session, user_id)
    lock = RUNS.for_user(user_id)
    connected = connection is not None
    blocked = start_blocked_reason(
        shopify_connected=connected, run_in_progress=lock.in_progress()
    )
    if blocked:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=blocked)
    assert connection is not None

    async def existing_ids() -> list[str]:
        images = await store.list_images(session, user_id)
        return [image.shopify_product_id for image in images if image.shopify_product_id]

    async def channel_products() -> list:
        try:
            return await list_shopify_channel_products(connection, settings)
        except Exception as exc:
            logger.exception("Import could not list Channel products")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Could not list Channel products",
            ) from exc

    async def persist(product) -> None:
        await persist_imported_product(session, user_id, product)

    result = await start_import(
        shopify_connected=True,
        existing_channel_ids=existing_ids,
        channel_products=channel_products,
        persist=persist,
        load_photo=load_channel_photo,
        run_lock=lock,
    )
    if result.blocked_reason:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=result.blocked_reason
        )
    return _status(True, result, lock.in_progress())
