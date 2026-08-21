"""Inventory Autopilot HTTP routes — port of `server/inventoryRoutes.ts`.

Error bodies stay `{message}` so the restored SPA hook can read them. Auth 401s
still use FastAPI `{detail}` from Clerk.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, Response

from app.auth.clerk import CurrentUser
from app.config import SettingsDep
from app.db import SessionDep
from app.schemas.inventory import (
    AdjustmentBody,
    BundleBody,
    InventoryBundleDetail,
    InventoryBundleListItem,
    InventoryImportDto,
    InventoryItemDto,
    InventoryItemsResponse,
    InventoryLedgerEntryDto,
    InventoryNotificationDto,
    InventoryOverviewResponse,
    InventorySettingsDto,
    PolicyBody,
    SetupBody,
)
from app.services.crypto import verify_shopify_webhook_hmac
from app.services.inventory.core import (
    calculate_sellable_quantity,
    effective_safety_buffer,
)
from app.services.inventory.errors import InventoryError
from app.services.inventory.jobs import recover_inventory_jobs
from app.services.inventory.service import (
    adjust_inventory_item,
    assert_inventory_access,
    delete_inventory_bundle,
    enable_inventory_import,
    get_inventory_import,
    get_inventory_ledger,
    get_inventory_overview,
    ingest_shopify_webhook,
    list_inventory_bundles,
    list_inventory_items,
    list_inventory_locations,
    list_inventory_notifications,
    mark_inventory_notification_read,
    reconcile_inventory_user,
    start_inventory_setup,
    update_inventory_policy,
    upsert_inventory_bundle,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["inventory"])


def _error(exc: Exception) -> JSONResponse:
    if isinstance(exc, InventoryError):
        return JSONResponse({"message": str(exc)}, status_code=exc.status)
    if isinstance(exc, ValueError):
        return JSONResponse({"message": str(exc)}, status_code=400)
    logger.exception("Inventory route error")
    return JSONResponse(
        {"message": str(exc) or "Inventory request failed"},
        status_code=500,
    )


def _overview(payload: dict) -> InventoryOverviewResponse:
    settings = payload.get("settings")
    latest = payload.get("latest_import")
    return InventoryOverviewResponse(
        settings=InventorySettingsDto.model_validate(settings) if settings else None,
        latest_import=InventoryImportDto.model_validate(latest) if latest else None,
        total_items=payload["total_items"],
        total_units=payload["total_units"],
        low_stock_items=payload["low_stock_items"],
        sold_out_items=payload["sold_out_items"],
        sync_failures=payload["sync_failures"],
        unread_alerts=payload["unread_alerts"],
    )


def _item_dto(row: dict) -> InventoryItemDto:
    item = row["item"]
    link = row.get("channel_link")
    return InventoryItemDto(
        id=item.id,
        title=item.title,
        variant_title=item.variant_title,
        sku=item.sku,
        kind=item.kind,
        ledger_quantity=item.ledger_quantity,
        sellable_quantity=row["sellable_quantity"],
        safety_buffer=item.safety_buffer,
        low_stock_threshold=item.low_stock_threshold,
        tracking_enabled=item.tracking_enabled,
        state=item.state,
        channel_link=link,
    )


def _item_model_dto(item) -> InventoryItemDto:
    return InventoryItemDto(
        id=item.id,
        title=item.title,
        variant_title=item.variant_title,
        sku=item.sku,
        kind=item.kind,
        ledger_quantity=item.ledger_quantity,
        sellable_quantity=calculate_sellable_quantity(
            item.ledger_quantity, effective_safety_buffer(item)
        ),
        safety_buffer=item.safety_buffer,
        low_stock_threshold=item.low_stock_threshold,
        tracking_enabled=item.tracking_enabled,
        state=item.state,
        channel_link=None,
    )


@router.post("/api/shopify/webhooks")
async def shopify_webhooks(
    request: Request, session: SessionDep, settings: SettingsDep
) -> JSONResponse:
    raw = await request.body()
    signature = request.headers.get("x-shopify-hmac-sha256")
    secret = settings.shopify_client_secret_resolved
    if not verify_shopify_webhook_hmac(raw, signature, secret):
        logger.warning(
            '{"service": "inventory_autopilot", "event": "webhook_rejected", "shopDomain": "%s"}',
            request.headers.get("x-shopify-shop-domain") or "unknown",
        )
        return JSONResponse({"message": "Invalid Shopify webhook signature"}, status_code=401)
    external_event_id = request.headers.get("x-shopify-webhook-id")
    topic = request.headers.get("x-shopify-topic")
    shop_domain = request.headers.get("x-shopify-shop-domain")
    if not external_event_id or not topic or not shop_domain:
        return JSONResponse({"message": "Missing Shopify webhook headers"}, status_code=400)
    try:
        import json as json_lib

        payload = json_lib.loads(raw.decode("utf-8") or "{}") if raw else {}
        if not isinstance(payload, dict):
            payload = {}
        await ingest_shopify_webhook(
            session,
            settings,
            external_event_id=external_event_id,
            topic=topic,
            shop_domain=shop_domain,
            payload=payload,
        )
        return JSONResponse({"received": True}, status_code=200)
    except Exception as exc:
        return _error(exc)


@router.get("/api/inventory/locations")
async def inventory_locations(user_id: CurrentUser, session: SessionDep, settings: SettingsDep):
    try:
        return await list_inventory_locations(session, settings, user_id)
    except Exception as exc:
        return _error(exc)


@router.post("/api/inventory/setup", status_code=202)
async def inventory_setup(
    body: SetupBody, user_id: CurrentUser, session: SessionDep, settings: SettingsDep
):
    try:
        job = await start_inventory_setup(
            session,
            settings,
            user_id=user_id,
            location_id=body.location_id,
            default_safety_buffer=body.default_safety_buffer,
            default_low_stock_threshold=body.default_low_stock_threshold,
        )
        return {"id": job.id, "status": job.status}
    except Exception as exc:
        return _error(exc)


@router.post("/api/inventory/setup/{import_id}/enable")
async def inventory_enable(
    import_id: int, user_id: CurrentUser, session: SessionDep, settings: SettingsDep
):
    try:
        return await enable_inventory_import(session, settings, user_id, import_id)
    except Exception as exc:
        return _error(exc)


@router.get("/api/inventory/imports/{import_id}", response_model=InventoryImportDto)
async def inventory_import(
    import_id: int, user_id: CurrentUser, session: SessionDep, settings: SettingsDep
):
    try:
        await assert_inventory_access(session, settings, user_id)
        job = await get_inventory_import(session, user_id, import_id)
        if not job:
            return JSONResponse({"message": "Inventory import was not found"}, status_code=404)
        return InventoryImportDto.model_validate(job)
    except Exception as exc:
        return _error(exc)


@router.get("/api/inventory/overview", response_model=InventoryOverviewResponse)
async def inventory_overview(user_id: CurrentUser, session: SessionDep, settings: SettingsDep):
    try:
        await assert_inventory_access(session, settings, user_id)
        return _overview(await get_inventory_overview(session, user_id))
    except Exception as exc:
        return _error(exc)


@router.get("/api/inventory/items", response_model=InventoryItemsResponse)
async def inventory_items(
    user_id: CurrentUser,
    session: SessionDep,
    settings: SettingsDep,
    cursor: int | None = None,
    limit: int | None = None,
    search: str | None = None,
    state: str | None = None,
):
    try:
        await assert_inventory_access(session, settings, user_id)
        payload = await list_inventory_items(
            session, user_id, cursor=cursor, limit=limit, search=search, state=state
        )
        return InventoryItemsResponse(
            items=[_item_dto(row) for row in payload["items"]],
            next_cursor=payload["next_cursor"],
        )
    except Exception as exc:
        return _error(exc)


@router.post("/api/inventory/items/{item_id}/adjustments", response_model=InventoryItemDto)
async def inventory_adjust(
    item_id: int,
    body: AdjustmentBody,
    user_id: CurrentUser,
    session: SessionDep,
    settings: SettingsDep,
):
    try:
        if body.mode not in {"set", "delta"}:
            return JSONResponse({"message": "mode must be set or delta"}, status_code=400)
        item = await adjust_inventory_item(
            session,
            settings,
            user_id=user_id,
            item_id=item_id,
            mode=body.mode,
            quantity=body.quantity,
            reason=body.reason,
        )
        return _item_model_dto(item)
    except Exception as exc:
        return _error(exc)


@router.patch("/api/inventory/items/{item_id}/policy", response_model=InventoryItemDto)
async def inventory_policy(
    item_id: int,
    body: PolicyBody,
    user_id: CurrentUser,
    session: SessionDep,
    settings: SettingsDep,
):
    try:
        item = await update_inventory_policy(
            session,
            settings,
            user_id=user_id,
            item_id=item_id,
            safety_buffer=body.safety_buffer,
            low_stock_threshold=body.low_stock_threshold,
            tracking_enabled=body.tracking_enabled,
        )
        return _item_model_dto(item)
    except Exception as exc:
        return _error(exc)


@router.get("/api/inventory/items/{item_id}/ledger")
async def inventory_ledger(
    item_id: int, user_id: CurrentUser, session: SessionDep, settings: SettingsDep
):
    try:
        await assert_inventory_access(session, settings, user_id)
        ledger = await get_inventory_ledger(session, user_id, item_id)
        if ledger is None:
            return JSONResponse({"message": "Inventory item was not found"}, status_code=404)
        return [InventoryLedgerEntryDto.model_validate(row) for row in ledger]
    except Exception as exc:
        return _error(exc)


@router.get("/api/inventory/bundles", response_model=list[InventoryBundleListItem])
async def inventory_bundles(user_id: CurrentUser, session: SessionDep, settings: SettingsDep):
    try:
        await assert_inventory_access(session, settings, user_id)
        rows = await list_inventory_bundles(session, user_id)
        return [InventoryBundleListItem.model_validate(row) for row in rows]
    except Exception as exc:
        return _error(exc)


async def _bundle_upsert(
    user_id: str,
    session,
    settings,
    body: BundleBody,
    route_bundle_item_id: int | None,
):
    bundle_item_id = route_bundle_item_id or body.bundle_item_id
    if not bundle_item_id:
        return JSONResponse({"message": "A bundle item is required"}, status_code=400)
    detail = await upsert_inventory_bundle(
        session,
        settings,
        user_id=user_id,
        bundle_item_id=bundle_item_id,
        components=[{"item_id": c.item_id, "units": c.units} for c in body.components],
    )
    return InventoryBundleDetail.model_validate(detail)


@router.post("/api/inventory/bundles", response_model=InventoryBundleDetail)
async def inventory_create_bundle(
    body: BundleBody, user_id: CurrentUser, session: SessionDep, settings: SettingsDep
):
    try:
        return await _bundle_upsert(user_id, session, settings, body, None)
    except Exception as exc:
        return _error(exc)


@router.put("/api/inventory/bundles/{bundle_item_id}", response_model=InventoryBundleDetail)
async def inventory_update_bundle(
    bundle_item_id: int,
    body: BundleBody,
    user_id: CurrentUser,
    session: SessionDep,
    settings: SettingsDep,
):
    try:
        return await _bundle_upsert(user_id, session, settings, body, bundle_item_id)
    except Exception as exc:
        return _error(exc)


@router.delete("/api/inventory/bundles/{bundle_item_id}")
async def inventory_delete_bundle(
    bundle_item_id: int, user_id: CurrentUser, session: SessionDep, settings: SettingsDep
):
    try:
        removed = await delete_inventory_bundle(session, settings, user_id, bundle_item_id)
        if not removed:
            return JSONResponse({"message": "Bundle was not found"}, status_code=404)
        return Response(status_code=204)
    except Exception as exc:
        return _error(exc)


@router.get("/api/inventory/notifications")
async def inventory_notifications(user_id: CurrentUser, session: SessionDep, settings: SettingsDep):
    try:
        await assert_inventory_access(session, settings, user_id)
        rows = await list_inventory_notifications(session, user_id)
        return [InventoryNotificationDto.model_validate(row) for row in rows]
    except Exception as exc:
        return _error(exc)


@router.post("/api/inventory/notifications/{notification_id}/read")
async def inventory_notification_read(
    notification_id: int, user_id: CurrentUser, session: SessionDep, settings: SettingsDep
):
    try:
        notification = await mark_inventory_notification_read(session, user_id, notification_id)
        if not notification:
            return JSONResponse({"message": "Notification was not found"}, status_code=404)
        return InventoryNotificationDto.model_validate(notification)
    except Exception as exc:
        return _error(exc)


@router.post("/api/inventory/reconcile", status_code=202)
async def inventory_reconcile(user_id: CurrentUser, session: SessionDep, settings: SettingsDep):
    try:
        await assert_inventory_access(session, settings, user_id)
        return await reconcile_inventory_user(session, settings, user_id)
    except Exception as exc:
        return _error(exc)


@router.get("/api/inventory/cron")
async def inventory_cron(request: Request, session: SessionDep, settings: SettingsDep):
    authorization = request.headers.get("authorization")
    if not settings.cron_secret or authorization != f"Bearer {settings.cron_secret}":
        return JSONResponse({"message": "Unauthorized"}, status_code=401)
    try:
        return await recover_inventory_jobs(session, settings)
    except Exception as exc:
        return _error(exc)
