"""Inventory Autopilot service — port of `server/inventoryService.ts`.

Jobs land in `inventory_outbox_jobs`. A poller claims them with
`SELECT … FOR UPDATE SKIP LOCKED` so two workers cannot double-process.
"""

from __future__ import annotations

import logging
import math
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import and_, asc, delete, desc, func, or_, select, text, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.models import ShopifyConnection, Subscription
from app.models.inventory import (
    InventoryBundleComponent,
    InventoryChannelLink,
    InventoryImportJob,
    InventoryItem,
    InventoryLedgerEntry,
    InventoryNotification,
    InventoryOutboxJob,
    InventorySettings,
    InventoryWebhookEvent,
)
from app.services.inventory.core import (
    INVENTORY_GRACE_DAYS,
    calculate_adjusted_quantity,
    calculate_sellable_quantity,
    effective_low_stock_threshold,
    effective_safety_buffer,
    is_low_stock,
    should_send_low_stock_email,
    validate_bundle_recipe,
)
from app.services.inventory.errors import InventoryError
from app.services.inventory.shopify_ops import (
    get_shopify_locations,
    register_inventory_webhooks,
    replace_shopify_bundle_components,
    start_shopify_catalog_bulk_import,
    unregister_inventory_webhooks,
)
from app.services.shopify_crypto import encrypt_shopify_token
from app.services.subscriptions import ACTIVE_STATUSES

logger = logging.getLogger(__name__)


def _now() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def _log(level: str, event: str, **fields: Any) -> None:
    message = {"service": "inventory_autopilot", "event": event, **fields}
    getattr(logger, level, logger.info)("%s", message)


def feature_enabled(settings: Settings) -> bool:
    return settings.inventory_autopilot_enabled


def app_base_url(settings: Settings) -> str:
    return settings.app_base_url.rstrip("/") or "https://snapsyncai.co.uk"


def webhook_callback_url(settings: Settings) -> str:
    return f"{app_base_url(settings)}/api/shopify/webhooks"


def normalize_gid(resource: str, value: object) -> str:
    text_value = str(value or "")
    return (
        text_value if text_value.startswith("gid://") else f"gid://shopify/{resource}/{text_value}"
    )


async def _update_subscription_grace(
    session: AsyncSession, user_id: str, settings: Settings
) -> dict[str, bool]:
    subscription = (
        await session.execute(select(Subscription).where(Subscription.user_id == user_id))
    ).scalar_one_or_none()
    inventory_settings = (
        await session.execute(select(InventorySettings).where(InventorySettings.user_id == user_id))
    ).scalar_one_or_none()
    active = bool(subscription and subscription.status in ACTIVE_STATUSES)
    if active:
        if inventory_settings and (
            inventory_settings.grace_ends_at or inventory_settings.status == "grace"
        ):
            inventory_settings.grace_ends_at = None
            inventory_settings.status = (
                "active" if inventory_settings.enabled else inventory_settings.status
            )
            inventory_settings.updated_at = _now()
            session.add(inventory_settings)
        return {"active": True, "grace": False, "expired": False}
    if not inventory_settings or not inventory_settings.enabled:
        return {"active": False, "grace": False, "expired": True}

    now = _now()
    period_end = subscription.current_period_end if subscription else None
    expiry_anchor = period_end if period_end and period_end < now else now
    grace_ends_at = inventory_settings.grace_ends_at or (
        expiry_anchor + timedelta(days=INVENTORY_GRACE_DAYS)
    )
    if grace_ends_at > now:
        if not inventory_settings.grace_ends_at or inventory_settings.status != "grace":
            inventory_settings.grace_ends_at = grace_ends_at
            inventory_settings.status = "grace"
            inventory_settings.updated_at = now
            session.add(inventory_settings)
        return {"active": False, "grace": True, "expired": False}

    inventory_settings.enabled = False
    inventory_settings.status = "expired"
    inventory_settings.updated_at = now
    session.add(inventory_settings)
    try:
        connection = await get_connection_for_user(session, user_id)
        await unregister_inventory_webhooks(connection, settings, webhook_callback_url(settings))
    except Exception as exc:
        logger.warning("Could not unregister expired inventory webhooks: %s", exc)
    return {"active": False, "grace": False, "expired": True}


async def assert_inventory_access(
    session: AsyncSession,
    settings: Settings,
    user_id: str,
    *,
    write: bool = False,
) -> None:
    if not feature_enabled(settings):
        raise InventoryError("Inventory Autopilot is not enabled for this deployment", 404)
    if settings.dev_bypass_auth:
        return
    entitlement = await _update_subscription_grace(session, user_id, settings)
    if entitlement["active"] or (entitlement["grace"] and not write):
        return
    raise InventoryError("Inventory Autopilot requires an active SnapSync AI Pro subscription", 402)


async def get_connection_for_user(session: AsyncSession, user_id: str) -> ShopifyConnection:
    connection = (
        await session.execute(
            select(ShopifyConnection).where(ShopifyConnection.session_id == user_id)
        )
    ).scalar_one_or_none()
    if not connection:
        raise InventoryError("Connect Shopify before setting up Inventory Autopilot", 400)
    return connection


async def get_connection_for_shop(
    session: AsyncSession, shop_domain: str
) -> ShopifyConnection | None:
    return (
        await session.execute(
            select(ShopifyConnection).where(ShopifyConnection.shop_domain == shop_domain)
        )
    ).scalar_one_or_none()


async def list_inventory_locations(
    session: AsyncSession, settings: Settings, user_id: str
) -> list[dict[str, Any]]:
    await assert_inventory_access(session, settings, user_id)
    return await get_shopify_locations(await get_connection_for_user(session, user_id), settings)


async def enqueue_inventory_job(
    session: AsyncSession,
    user_id: str | None,
    job_type: str,
    payload: dict[str, Any],
) -> InventoryOutboxJob:
    job = InventoryOutboxJob(user_id=user_id, type=job_type, payload=payload)
    session.add(job)
    await session.flush()
    return job


async def start_inventory_setup(
    session: AsyncSession,
    settings: Settings,
    *,
    user_id: str,
    location_id: str,
    default_safety_buffer: int,
    default_low_stock_threshold: int,
) -> InventoryImportJob:
    await assert_inventory_access(session, settings, user_id, write=True)
    connection = await get_connection_for_user(session, user_id)
    locations = await get_shopify_locations(connection, settings)
    location = next(
        (candidate for candidate in locations if candidate.get("id") == location_id), None
    )
    if not location:
        raise InventoryError("The selected Shopify location is not active", 400)

    if settings.connection_encryption_key:
        encrypted = encrypt_shopify_token(
            connection.access_token, settings.connection_encryption_key
        )
        if encrypted != connection.access_token:
            connection.access_token = encrypted
            session.add(connection)

    await register_inventory_webhooks(connection, settings, webhook_callback_url(settings))
    connection.webhooks_registered_at = _now()
    session.add(connection)

    await session.execute(
        update(InventoryNotification)
        .where(
            InventoryNotification.user_id == user_id,
            InventoryNotification.type.in_(["connection", "sync_failure"]),
            InventoryNotification.resolved_at.is_(None),
        )
        .values(resolved_at=_now())
    )

    now = _now()
    values = {
        "user_id": user_id,
        "shop_domain": connection.shop_domain,
        "location_id": location["id"],
        "location_name": location["name"],
        "status": "importing",
        "enabled": False,
        "default_safety_buffer": default_safety_buffer,
        "default_low_stock_threshold": default_low_stock_threshold,
        "updated_at": now,
    }
    await session.execute(
        insert(InventorySettings)
        .values(**values)
        .on_conflict_do_update(index_elements=["user_id"], set_=values)
    )

    job = InventoryImportJob(user_id=user_id, status="starting")
    session.add(job)
    await session.flush()
    try:
        operation = await start_shopify_catalog_bulk_import(connection, settings)
        job.external_operation_id = operation["id"]
        job.status = "processing" if operation.get("status") == "COMPLETED" else "running"
        session.add(job)
        if operation.get("status") == "COMPLETED":
            await enqueue_inventory_job(session, user_id, "finish_import", {"importJobId": job.id})
        return job
    except Exception as exc:
        job.status = "failed"
        job.error = str(exc)
        job.completed_at = _now()
        session.add(job)
        raise


async def enable_inventory_import(
    session: AsyncSession, settings: Settings, user_id: str, import_job_id: int
) -> dict[str, bool]:
    await assert_inventory_access(session, settings, user_id, write=True)
    job = (
        await session.execute(
            select(InventoryImportJob).where(
                InventoryImportJob.id == import_job_id,
                InventoryImportJob.user_id == user_id,
            )
        )
    ).scalar_one_or_none()
    if not job or job.status != "preview_ready":
        raise InventoryError("The catalog preview is not ready to enable", 409)

    now = _now()
    await session.execute(
        update(InventorySettings)
        .where(InventorySettings.user_id == user_id)
        .values(status="active", enabled=True, updated_at=now)
    )
    await session.execute(
        update(InventoryItem)
        .where(InventoryItem.user_id == user_id)
        .values(state="active", updated_at=now)
    )
    await session.execute(
        update(InventoryChannelLink)
        .where(InventoryChannelLink.user_id == user_id)
        .values(sync_state="pending", updated_at=now)
    )
    job.status = "enabled"
    session.add(job)
    await enqueue_inventory_job(
        session, user_id, "protect_variants", {"userId": user_id, "cursor": 0}
    )
    return {"enabled": True}


async def get_inventory_import(
    session: AsyncSession, user_id: str, import_job_id: int
) -> InventoryImportJob | None:
    return (
        await session.execute(
            select(InventoryImportJob).where(
                InventoryImportJob.id == import_job_id,
                InventoryImportJob.user_id == user_id,
            )
        )
    ).scalar_one_or_none()


async def get_inventory_overview(session: AsyncSession, user_id: str) -> dict[str, Any]:
    settings_row = (
        await session.execute(select(InventorySettings).where(InventorySettings.user_id == user_id))
    ).scalar_one_or_none()
    default_threshold = settings_row.default_low_stock_threshold if settings_row else 5
    default_buffer = settings_row.default_safety_buffer if settings_row else 2
    totals = (
        await session.execute(
            select(
                func.count().label("total_items"),
                func.coalesce(func.sum(InventoryItem.ledger_quantity), 0).label("total_units"),
                func.count()
                .filter(
                    InventoryItem.ledger_quantity
                    <= func.coalesce(InventoryItem.low_stock_threshold, default_threshold)
                )
                .label("low_stock_items"),
                func.count()
                .filter(
                    func.greatest(
                        0,
                        InventoryItem.ledger_quantity
                        - func.coalesce(InventoryItem.safety_buffer, default_buffer),
                    )
                    == 0
                )
                .label("sold_out_items"),
                func.count().filter(InventoryItem.state == "conflict").label("sync_failures"),
            ).where(InventoryItem.user_id == user_id)
        )
    ).one()
    unread = (
        await session.execute(
            select(func.count()).where(
                InventoryNotification.user_id == user_id,
                InventoryNotification.read_at.is_(None),
                InventoryNotification.resolved_at.is_(None),
            )
        )
    ).scalar_one()
    latest_import = (
        await session.execute(
            select(InventoryImportJob)
            .where(InventoryImportJob.user_id == user_id)
            .order_by(desc(InventoryImportJob.created_at))
            .limit(1)
        )
    ).scalar_one_or_none()
    return {
        "settings": settings_row,
        "latest_import": latest_import,
        "total_items": int(totals.total_items or 0),
        "total_units": int(totals.total_units or 0),
        "low_stock_items": int(totals.low_stock_items or 0),
        "sold_out_items": int(totals.sold_out_items or 0),
        "sync_failures": int(totals.sync_failures or 0),
        "unread_alerts": int(unread or 0),
    }


async def list_inventory_items(
    session: AsyncSession,
    user_id: str,
    *,
    cursor: int | None = None,
    limit: int | None = None,
    search: str | None = None,
    state: str | None = None,
) -> dict[str, Any]:
    settings_row = (
        await session.execute(
            select(InventorySettings.default_safety_buffer).where(
                InventorySettings.user_id == user_id
            )
        )
    ).scalar_one_or_none()
    default_buffer = settings_row if settings_row is not None else 2
    page_size = min(max(limit or 50, 1), 100)
    conditions = [InventoryItem.user_id == user_id]
    if cursor:
        conditions.append(InventoryItem.id > cursor)
    if state and state != "all":
        conditions.append(InventoryItem.state == state)
    if search:
        pattern = f"%{search}%"
        conditions.append(
            or_(
                InventoryItem.title.ilike(pattern),
                InventoryItem.variant_title.ilike(pattern),
                InventoryItem.sku.ilike(pattern),
            )
        )
    rows = (
        await session.execute(
            select(InventoryItem, InventoryChannelLink)
            .outerjoin(
                InventoryChannelLink,
                InventoryChannelLink.inventory_item_id == InventoryItem.id,
            )
            .where(and_(*conditions))
            .order_by(asc(InventoryItem.id))
            .limit(page_size + 1)
        )
    ).all()
    has_more = len(rows) > page_size
    page = rows[:page_size]
    items = []
    for item, link in page:
        items.append(
            {
                "item": item,
                "sellable_quantity": calculate_sellable_quantity(
                    item.ledger_quantity,
                    item.safety_buffer if item.safety_buffer is not None else default_buffer,
                ),
                "channel_link": link,
            }
        )
    return {
        "items": items,
        "next_cursor": page[-1][0].id if has_more and page else None,
    }


async def apply_ledger_adjustment(
    session: AsyncSession,
    *,
    user_id: str,
    item_id: int,
    mode: str,
    quantity: int,
    reason: str,
    source: str,
    idempotency_key: str,
    external_reference: str | None = None,
) -> InventoryItem:
    async with session.begin_nested():
        locked = (
            (
                await session.execute(
                    text(
                        """
                    SELECT * FROM inventory_items
                    WHERE id = :item_id AND user_id = :user_id
                    FOR UPDATE
                    """
                    ),
                    {"item_id": item_id, "user_id": user_id},
                )
            )
            .mappings()
            .first()
        )
        if not locked:
            raise InventoryError("Inventory item was not found", 404)
        existing = (
            await session.execute(
                select(InventoryLedgerEntry.id).where(
                    InventoryLedgerEntry.idempotency_key == idempotency_key
                )
            )
        ).scalar_one_or_none()
        if existing:
            return (
                await session.execute(select(InventoryItem).where(InventoryItem.id == item_id))
            ).scalar_one()
        current = int(locked["ledger_quantity"])
        nxt = calculate_adjusted_quantity(current, mode, quantity)
        await session.execute(
            update(InventoryItem)
            .where(InventoryItem.id == item_id)
            .values(ledger_quantity=nxt, version=int(locked["version"]) + 1, updated_at=_now())
        )
        session.add(
            InventoryLedgerEntry(
                user_id=user_id,
                inventory_item_id=item_id,
                delta=nxt - current,
                quantity_after=nxt,
                reason=reason,
                source=source,
                idempotency_key=idempotency_key,
                external_reference=external_reference,
            )
        )
        await session.flush()
        return (
            await session.execute(select(InventoryItem).where(InventoryItem.id == item_id))
        ).scalar_one()


async def adjust_inventory_item(
    session: AsyncSession,
    settings: Settings,
    *,
    user_id: str,
    item_id: int,
    mode: str,
    quantity: int,
    reason: str,
) -> InventoryItem:
    await assert_inventory_access(session, settings, user_id, write=True)
    item = await apply_ledger_adjustment(
        session,
        user_id=user_id,
        item_id=item_id,
        mode=mode,
        quantity=quantity,
        reason=reason,
        source="snapsync",
        idempotency_key=f"manual:{user_id}:{uuid.uuid4()}",
    )
    await enqueue_inventory_job(session, user_id, "sync_item", {"itemId": item.id})
    await evaluate_stock_alert(session, settings, item)
    return item


async def update_inventory_policy(
    session: AsyncSession,
    settings: Settings,
    *,
    user_id: str,
    item_id: int,
    safety_buffer: int | None,
    low_stock_threshold: int | None,
    tracking_enabled: bool,
) -> InventoryItem:
    await assert_inventory_access(session, settings, user_id, write=True)
    result = await session.execute(
        update(InventoryItem)
        .where(InventoryItem.id == item_id, InventoryItem.user_id == user_id)
        .values(
            safety_buffer=safety_buffer,
            low_stock_threshold=low_stock_threshold,
            tracking_enabled=tracking_enabled,
            updated_at=_now(),
        )
        .returning(InventoryItem)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise InventoryError("Inventory item was not found", 404)
    await enqueue_inventory_job(session, user_id, "sync_item", {"itemId": item.id})
    await evaluate_stock_alert(session, settings, item)
    return item


async def get_inventory_ledger(
    session: AsyncSession, user_id: str, item_id: int
) -> list[InventoryLedgerEntry] | None:
    item = (
        await session.execute(
            select(InventoryItem.id).where(
                InventoryItem.id == item_id, InventoryItem.user_id == user_id
            )
        )
    ).scalar_one_or_none()
    if item is None:
        return None
    return list(
        (
            await session.execute(
                select(InventoryLedgerEntry)
                .where(InventoryLedgerEntry.inventory_item_id == item_id)
                .order_by(desc(InventoryLedgerEntry.created_at))
                .limit(100)
            )
        ).scalars()
    )


async def get_inventory_bundle(
    session: AsyncSession, user_id: str, bundle_item_id: int
) -> dict[str, Any]:
    default_buffer = effective_safety_buffer(
        {"safety_buffer": (
            await session.execute(
                select(InventorySettings.default_safety_buffer).where(
                    InventorySettings.user_id == user_id
                )
            )
        ).scalar_one_or_none()}
    )
    components = (
        await session.execute(
            select(InventoryBundleComponent, InventoryItem)
            .join(InventoryItem, InventoryItem.id == InventoryBundleComponent.component_item_id)
            .where(
                InventoryBundleComponent.user_id == user_id,
                InventoryBundleComponent.bundle_item_id == bundle_item_id,
            )
        )
    ).all()
    mapped = []
    availability: list[int] = []
    for component, item in components:
        mapped.append(
            {
                "id": component.id,
                "item_id": component.component_item_id,
                "units": component.units,
                "title": item.title,
                "sku": item.sku,
                "quantity": item.ledger_quantity,
                "safety_buffer": item.safety_buffer,
            }
        )
        sellable = calculate_sellable_quantity(
            item.ledger_quantity,
            item.safety_buffer if item.safety_buffer is not None else default_buffer,
        )
        availability.append(math.floor(sellable / component.units))
    return {
        "bundle_item_id": bundle_item_id,
        "components": mapped,
        "computed_availability": min(availability) if availability else 0,
    }


async def list_inventory_bundles(session: AsyncSession, user_id: str) -> list[dict[str, Any]]:
    bundles = (
        await session.execute(
            select(InventoryItem)
            .where(InventoryItem.user_id == user_id, InventoryItem.kind == "bundle")
            .order_by(asc(InventoryItem.title))
        )
    ).scalars()
    result = []
    for bundle in bundles:
        detail = await get_inventory_bundle(session, user_id, bundle.id)
        result.append(
            {
                "id": bundle.id,
                "title": bundle.title,
                "sku": bundle.sku,
                "kind": bundle.kind,
                "components": detail["components"],
                "computed_availability": detail["computed_availability"],
            }
        )
    return result


async def upsert_inventory_bundle(
    session: AsyncSession,
    settings: Settings,
    *,
    user_id: str,
    bundle_item_id: int,
    components: list[dict[str, Any]],
) -> dict[str, Any]:
    await assert_inventory_access(session, settings, user_id, write=True)
    ids = [bundle_item_id, *[component["item_id"] for component in components]]
    rows = (
        await session.execute(
            select(InventoryItem, InventoryChannelLink)
            .join(InventoryChannelLink, InventoryChannelLink.inventory_item_id == InventoryItem.id)
            .where(InventoryItem.user_id == user_id, InventoryItem.id.in_(ids))
        )
    ).all()
    by_id = {item.id: (item, link) for item, link in rows}
    validate_bundle_recipe(
        {
            "bundle_item_id": bundle_item_id,
            "components": [
                {
                    **component,
                    "kind": by_id.get(component["item_id"], (None, None))[0].kind
                    if by_id.get(component["item_id"])
                    else None,
                }
                for component in components
            ],
        }
    )
    if len(by_id) != len(ids):
        raise InventoryError("One or more bundle items were not found", 404)
    parent = by_id[bundle_item_id]
    connection = await get_connection_for_user(session, user_id)
    await replace_shopify_bundle_components(
        connection,
        settings,
        parent_variant_id=parent[1].external_variant_id,
        components=[
            {
                "variant_id": by_id[component["item_id"]][1].external_variant_id,
                "units": component["units"],
            }
            for component in components
        ],
    )
    await session.execute(
        delete(InventoryBundleComponent).where(
            InventoryBundleComponent.bundle_item_id == bundle_item_id
        )
    )
    for component in components:
        session.add(
            InventoryBundleComponent(
                user_id=user_id,
                bundle_item_id=bundle_item_id,
                component_item_id=component["item_id"],
                units=component["units"],
            )
        )
    parent[0].kind = "bundle"
    parent[0].updated_at = _now()
    session.add(parent[0])
    await session.flush()
    return await get_inventory_bundle(session, user_id, bundle_item_id)


async def delete_inventory_bundle(
    session: AsyncSession, settings: Settings, user_id: str, bundle_item_id: int
) -> bool:
    await assert_inventory_access(session, settings, user_id, write=True)
    row = (
        await session.execute(
            select(InventoryItem, InventoryChannelLink)
            .join(InventoryChannelLink, InventoryChannelLink.inventory_item_id == InventoryItem.id)
            .where(InventoryItem.id == bundle_item_id, InventoryItem.user_id == user_id)
        )
    ).first()
    if not row:
        return False
    item, link = row
    await replace_shopify_bundle_components(
        await get_connection_for_user(session, user_id),
        settings,
        parent_variant_id=link.external_variant_id,
        components=[],
    )
    await session.execute(
        delete(InventoryBundleComponent).where(
            InventoryBundleComponent.bundle_item_id == bundle_item_id
        )
    )
    item.kind = "standalone"
    item.updated_at = _now()
    session.add(item)
    return True


async def list_inventory_notifications(
    session: AsyncSession, user_id: str
) -> list[InventoryNotification]:
    return list(
        (
            await session.execute(
                select(InventoryNotification)
                .where(InventoryNotification.user_id == user_id)
                .order_by(desc(InventoryNotification.created_at))
                .limit(100)
            )
        ).scalars()
    )


async def mark_inventory_notification_read(
    session: AsyncSession, user_id: str, notification_id: int
) -> InventoryNotification | None:
    result = await session.execute(
        update(InventoryNotification)
        .where(
            InventoryNotification.id == notification_id,
            InventoryNotification.user_id == user_id,
        )
        .values(read_at=_now())
        .returning(InventoryNotification)
    )
    return result.scalar_one_or_none()


async def create_inventory_notification(
    session: AsyncSession,
    settings: Settings,
    *,
    user_id: str,
    inventory_item_id: int | None = None,
    type: str,
    severity: str,
    title: str,
    body: str,
    dedupe_key: str,
    email: bool = False,
) -> InventoryNotification:
    existing = (
        await session.execute(
            select(InventoryNotification)
            .where(
                InventoryNotification.user_id == user_id,
                InventoryNotification.dedupe_key == dedupe_key,
                InventoryNotification.resolved_at.is_(None),
            )
            .order_by(desc(InventoryNotification.created_at))
            .limit(1)
        )
    ).scalar_one_or_none()
    if existing:
        notification = existing
    else:
        notification = InventoryNotification(
            user_id=user_id,
            inventory_item_id=inventory_item_id,
            type=type,
            severity=severity,
            title=title,
            body=body,
            dedupe_key=dedupe_key,
        )
        session.add(notification)
        await session.flush()

    if email:
        last_email = (
            await session.execute(
                select(InventoryNotification.emailed_at)
                .where(
                    InventoryNotification.user_id == user_id,
                    InventoryNotification.dedupe_key == dedupe_key,
                    InventoryNotification.emailed_at.is_not(None),
                )
                .order_by(desc(InventoryNotification.emailed_at))
                .limit(1)
            )
        ).scalar_one_or_none()
        if should_send_low_stock_email(last_email):
            cutoff = _now() - timedelta(hours=24)
            reserved = (
                await session.execute(
                    update(InventoryNotification)
                    .where(
                        InventoryNotification.id == notification.id,
                        or_(
                            InventoryNotification.emailed_at.is_(None),
                            InventoryNotification.emailed_at <= cutoff,
                        ),
                    )
                    .values(emailed_at=_now())
                    .returning(InventoryNotification.id)
                )
            ).scalar_one_or_none()
            if reserved:
                await enqueue_inventory_job(
                    session, user_id, "send_alert_email", {"notificationId": notification.id}
                )
    return notification


async def evaluate_stock_alert(
    session: AsyncSession, settings: Settings, item: InventoryItem
) -> None:
    inventory_settings = (
        await session.execute(
            select(InventorySettings).where(InventorySettings.user_id == item.user_id)
        )
    ).scalar_one_or_none()
    if not inventory_settings:
        return
    threshold = effective_low_stock_threshold(item, inventory_settings.default_low_stock_threshold)
    dedupe_key = f"low-stock:{item.id}"
    if is_low_stock(item.ledger_quantity, threshold):
        await create_inventory_notification(
            session,
            settings,
            user_id=item.user_id,
            inventory_item_id=item.id,
            type="low_stock",
            severity="critical" if item.ledger_quantity == 0 else "warning",
            title=(
                f"{item.title} is out of stock"
                if item.ledger_quantity == 0
                else f"{item.title} is running low"
            ),
            body=f"{item.sku or 'This item'} has {item.ledger_quantity} units remaining.",
            dedupe_key=dedupe_key,
            email=True,
        )
    else:
        await session.execute(
            update(InventoryNotification)
            .where(
                InventoryNotification.user_id == item.user_id,
                InventoryNotification.dedupe_key == dedupe_key,
                InventoryNotification.resolved_at.is_(None),
            )
            .values(resolved_at=_now())
        )


async def ingest_shopify_webhook(
    session: AsyncSession,
    settings: Settings,
    *,
    external_event_id: str,
    topic: str,
    shop_domain: str,
    payload: dict[str, Any],
) -> dict[str, Any]:
    if not feature_enabled(settings):
        return {"duplicate": False, "disabled": True}
    connection = await get_connection_for_shop(session, shop_domain)
    result = await session.execute(
        insert(InventoryWebhookEvent)
        .values(
            external_event_id=external_event_id,
            user_id=connection.session_id if connection else None,
            topic=topic,
            shop_domain=shop_domain,
            payload=payload,
        )
        .on_conflict_do_nothing(index_elements=["external_event_id"])
        .returning(InventoryWebhookEvent)
    )
    event = result.scalar_one_or_none()
    if not event:
        _log(
            "info",
            "duplicate_webhook",
            webhookId=external_event_id,
            topic=topic,
            shopDomain=shop_domain,
        )
        return {"duplicate": True}
    await enqueue_inventory_job(
        session,
        connection.session_id if connection else None,
        "process_webhook",
        {"eventId": event.id},
    )
    return {"duplicate": False}


async def reconcile_inventory_user(
    session: AsyncSession, settings: Settings, user_id: str
) -> dict[str, int]:
    inventory_settings = (
        await session.execute(select(InventorySettings).where(InventorySettings.user_id == user_id))
    ).scalar_one_or_none()
    if not inventory_settings or not inventory_settings.enabled:
        return {"queued": 0}
    links = (
        await session.execute(
            select(InventoryChannelLink.inventory_item_id).where(
                InventoryChannelLink.user_id == user_id
            )
        )
    ).scalars()
    count = 0
    for item_id in links:
        await enqueue_inventory_job(session, user_id, "sync_item", {"itemId": item_id})
        count += 1
    inventory_settings.last_reconciled_at = _now()
    inventory_settings.updated_at = _now()
    session.add(inventory_settings)
    return {"queued": count}


async def disable_inventory_for_user(
    session: AsyncSession, settings: Settings, user_id: str
) -> None:
    if not feature_enabled(settings):
        return
    try:
        connection = await get_connection_for_user(session, user_id)
        await unregister_inventory_webhooks(connection, settings, webhook_callback_url(settings))
    except Exception as exc:
        logger.warning("Could not unregister inventory webhooks during disconnect: %s", exc)
    await session.execute(
        update(InventorySettings)
        .where(InventorySettings.user_id == user_id)
        .values(enabled=False, status="disconnected", updated_at=_now())
    )


async def register_published_shopify_product(
    session: AsyncSession,
    settings: Settings,
    *,
    user_id: str,
    image: Any,
    product_id: str,
    variants: list[dict[str, Any]],
) -> None:
    if not feature_enabled(settings):
        return
    inventory_settings = (
        await session.execute(
            select(InventorySettings).where(
                InventorySettings.user_id == user_id, InventorySettings.enabled.is_(True)
            )
        )
    ).scalar_one_or_none()
    if not inventory_settings:
        return
    for index, variant in enumerate(variants):
        item = InventoryItem(
            user_id=user_id,
            title=getattr(image, "title", None)
            or getattr(image, "original_name", None)
            or "Untitled product",
            variant_title=f"Variant {index + 1}" if len(variants) > 1 else None,
            sku=variant.get("sku"),
            ledger_quantity=max(0, int(getattr(image, "inventory_quantity", 0) or 0)),
            tracking_enabled=bool((variant.get("inventoryItem") or {}).get("tracked", True)),
            state="active",
        )
        session.add(item)
        await session.flush()
        session.add(
            InventoryChannelLink(
                user_id=user_id,
                inventory_item_id=item.id,
                external_product_id=product_id,
                external_variant_id=variant["id"],
                external_inventory_item_id=variant["inventoryItem"]["id"],
                external_location_id=inventory_settings.location_id,
                observed_quantity=0,
                pushed_quantity=0,
                sync_state="pending",
                external_status="DRAFT",
                last_observed_at=_now(),
            )
        )
        await enqueue_inventory_job(session, user_id, "sync_item", {"itemId": item.id})
