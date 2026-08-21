"""Outbox job handlers and the SKIP LOCKED poller.

Claiming uses `SELECT … FOR UPDATE SKIP LOCKED` so a Python poller and a leftover
Node worker cannot double-process the same row.
"""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import timedelta
from typing import Any

from sqlalchemy import asc, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.clerk import _client
from app.config import Settings, get_settings
from app.db import get_session
from app.models import ShopifyConnection
from app.models.inventory import (
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
    calculate_sellable_quantity,
    effective_safety_buffer,
    parse_shopify_bulk_inventory_jsonl,
    webhook_adjustment_delta,
)
from app.services.inventory.errors import InventoryError
from app.services.inventory.service import (
    _log,
    _now,
    _update_subscription_grace,
    app_base_url,
    apply_ledger_adjustment,
    create_inventory_notification,
    enqueue_inventory_job,
    evaluate_stock_alert,
    feature_enabled,
    get_connection_for_shop,
    get_connection_for_user,
    normalize_gid,
    reconcile_inventory_user,
)
from app.services.inventory.shopify_ops import (
    download_bulk_jsonl,
    get_shopify_bulk_operation,
    get_shopify_inventory_quantity,
    set_shopify_inventory_quantity,
    set_shopify_variant_inventory_policies,
    start_shopify_catalog_bulk_import,
)

logger = logging.getLogger(__name__)

CLAIM_SQL = text(
    """
    UPDATE inventory_outbox_jobs
    SET status = 'processing',
        processing_started_at = NOW(),
        attempts = attempts + 1
    WHERE id = (
      SELECT id FROM inventory_outbox_jobs
      WHERE status IN ('pending', 'failed')
        AND available_at <= NOW()
      ORDER BY created_at
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING *
    """
)


async def finish_catalog_import(
    session: AsyncSession, settings: Settings, import_job_id: int
) -> None:
    job = (
        await session.execute(
            select(InventoryImportJob).where(InventoryImportJob.id == import_job_id)
        )
    ).scalar_one_or_none()
    if not job or not job.external_operation_id:
        raise InventoryError("Inventory import job was not found", 404)
    if job.status in {"preview_ready", "enabled"}:
        return

    connection = await get_connection_for_user(session, job.user_id)
    inventory_settings = (
        await session.execute(
            select(InventorySettings).where(InventorySettings.user_id == job.user_id)
        )
    ).scalar_one_or_none()
    if not inventory_settings:
        raise InventoryError("Inventory settings were not found", 404)

    operation = await get_shopify_bulk_operation(connection, settings, job.external_operation_id)
    if operation.get("status") != "COMPLETED":
        if operation.get("status") in {"FAILED", "CANCELED", "EXPIRED"}:
            raise InventoryError(
                f"Shopify catalog import {str(operation.get('status')).lower()}: "
                f"{operation.get('errorCode') or 'unknown error'}",
                502,
            )
        raise InventoryError(
            "Shopify catalog import is not finished yet", 409, retry_after_seconds=20
        )

    download_url = operation.get("url") or operation.get("partialDataUrl")
    if not download_url:
        raise InventoryError("Shopify catalog import completed without a result file", 502)
    records = parse_shopify_bulk_inventory_jsonl(
        await download_bulk_jsonl(download_url), inventory_settings.location_id
    )
    is_live_refresh = job.provider == "shopify_refresh" and inventory_settings.enabled

    existing_links = (
        await session.execute(
            select(InventoryChannelLink).where(
                InventoryChannelLink.user_id == job.user_id,
                InventoryChannelLink.channel == "shopify",
                InventoryChannelLink.external_location_id == inventory_settings.location_id,
            )
        )
    ).scalars()
    existing_by_external = {link.external_inventory_item_id: link for link in existing_links}

    new_records = []
    existing_records = []
    for record in records:
        existing = existing_by_external.get(record["inventory_item_id"])
        if not existing:
            new_records.append(record)
            continue
        existing_records.append(
            {**record, "item_id": existing.inventory_item_id, "link_id": existing.id}
        )

    now = _now()
    state = "active" if is_live_refresh else "draft"
    sync_state = "pending" if is_live_refresh else "draft"
    for offset in range(0, len(existing_records), 250):
        chunk = existing_records[offset : offset + 250]
        payload = json.dumps(
            [
                {
                    "item_id": record["item_id"],
                    "link_id": record["link_id"],
                    "product_id": record["product_id"],
                    "variant_id": record["variant_id"],
                    "title": record["title"],
                    "variant_title": record["variant_title"],
                    "sku": record["sku"],
                    "tracked": record["tracked"],
                    "status": record["status"],
                    "quantity": record["quantity"],
                }
                for record in chunk
            ]
        )
        await session.execute(
            text(
                """
                WITH imported AS (
                  SELECT * FROM jsonb_to_recordset(:payload::jsonb) AS data(
                    item_id integer,
                    link_id integer,
                    product_id text,
                    variant_id text,
                    title text,
                    variant_title text,
                    sku text,
                    tracked boolean,
                    status text,
                    quantity integer
                  )
                )
                UPDATE inventory_items AS item
                SET title = imported.title,
                    variant_title = imported.variant_title,
                    sku = imported.sku,
                    tracking_enabled = imported.tracked,
                    state = :state,
                    updated_at = NOW()
                FROM imported
                WHERE item.id = imported.item_id
                """
            ),
            {"payload": payload, "state": state},
        )
        await session.execute(
            text(
                """
                WITH imported AS (
                  SELECT * FROM jsonb_to_recordset(:payload::jsonb) AS data(
                    item_id integer,
                    link_id integer,
                    product_id text,
                    variant_id text,
                    title text,
                    variant_title text,
                    sku text,
                    tracked boolean,
                    status text,
                    quantity integer
                  )
                )
                UPDATE inventory_channel_links AS link
                SET external_product_id = imported.product_id,
                    external_variant_id = imported.variant_id,
                    observed_quantity = CASE
                      WHEN :live THEN link.observed_quantity
                      ELSE imported.quantity
                    END,
                    pushed_quantity = CASE
                      WHEN :live THEN link.pushed_quantity
                      ELSE imported.quantity
                    END,
                    pending_quantity = NULL,
                    external_status = imported.status,
                    sync_state = :sync_state,
                    last_observed_at = CASE
                      WHEN :live THEN link.last_observed_at
                      ELSE NOW()
                    END,
                    updated_at = NOW()
                FROM imported
                WHERE link.id = imported.link_id
                """
            ),
            {"payload": payload, "live": is_live_refresh, "sync_state": sync_state},
        )

    for offset in range(0, len(new_records), 250):
        chunk = new_records[offset : offset + 250]
        inserted_ids: list[int] = []
        for record in chunk:
            item = InventoryItem(
                user_id=job.user_id,
                title=record["title"],
                variant_title=record["variant_title"],
                sku=record["sku"],
                ledger_quantity=record["quantity"],
                tracking_enabled=record["tracked"],
                state=state,
            )
            session.add(item)
            await session.flush()
            inserted_ids.append(item.id)
            session.add(
                InventoryLedgerEntry(
                    user_id=job.user_id,
                    inventory_item_id=item.id,
                    delta=record["quantity"],
                    quantity_after=record["quantity"],
                    reason="Initial Shopify catalog import",
                    source="shopify_import",
                    idempotency_key=f"import:{record['inventory_item_id']}",
                    external_reference=job.external_operation_id,
                )
            )
            session.add(
                InventoryChannelLink(
                    user_id=job.user_id,
                    inventory_item_id=item.id,
                    external_product_id=record["product_id"],
                    external_variant_id=record["variant_id"],
                    external_inventory_item_id=record["inventory_item_id"],
                    external_location_id=inventory_settings.location_id,
                    observed_quantity=record["quantity"],
                    pushed_quantity=record["quantity"],
                    external_status=record["status"],
                    sync_state=sync_state,
                    last_observed_at=now,
                )
            )

    buffer_impact = sum(
        min(record["quantity"], inventory_settings.default_safety_buffer) for record in records
    )
    job.status = "enabled" if is_live_refresh else "preview_ready"
    job.total_items = len(records)
    job.imported_items = len(records)
    job.preview = {
        "totalVariants": len(records),
        "trackedVariants": sum(1 for record in records if record["tracked"]),
        "missingSku": sum(1 for record in records if not record["sku"]),
        "unitsReservedByBuffer": buffer_impact,
    }
    job.completed_at = now
    session.add(job)
    inventory_settings.status = "active" if is_live_refresh else "preview"
    inventory_settings.updated_at = now
    session.add(inventory_settings)
    if is_live_refresh:
        await enqueue_inventory_job(
            session, job.user_id, "protect_variants", {"userId": job.user_id, "cursor": 0}
        )


async def start_webhook_catalog_refresh(
    session: AsyncSession, settings: Settings, user_id: str
) -> InventoryImportJob:
    running = (
        await session.execute(
            select(InventoryImportJob)
            .where(
                InventoryImportJob.user_id == user_id,
                InventoryImportJob.provider == "shopify_refresh",
                InventoryImportJob.status.in_(["starting", "running", "processing"]),
            )
            .limit(1)
        )
    ).scalar_one_or_none()
    if running:
        return running
    job = InventoryImportJob(user_id=user_id, provider="shopify_refresh", status="starting")
    session.add(job)
    await session.flush()
    try:
        operation = await start_shopify_catalog_bulk_import(
            await get_connection_for_user(session, user_id), settings
        )
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


async def send_alert_email(session: AsyncSession, settings: Settings, notification_id: int) -> None:
    notification = (
        await session.execute(
            select(InventoryNotification).where(InventoryNotification.id == notification_id)
        )
    ).scalar_one_or_none()
    if not notification or notification.resolved_at:
        return
    api_key = settings.resend_api_key
    from_email = settings.inventory_alert_from_email
    if not api_key or not from_email:
        raise InventoryError("Resend inventory alert delivery is not configured", 500)
    if not settings.clerk_secret_key:
        raise InventoryError("The seller does not have an email address", 500)
    user = await _client(settings.clerk_secret_key).users.get_async(user_id=notification.user_id)
    emails = user.email_addresses or []
    primary_id = user.primary_email_address_id
    email = next(
        (entry.email_address for entry in emails if entry.id == primary_id),
        emails[0].email_address if emails else None,
    )
    if not email:
        raise InventoryError("The seller does not have an email address", 500)
    import resend

    resend.api_key = api_key
    result = resend.Emails.send(
        {
            "from": from_email,
            "to": email,
            "subject": notification.title,
            "text": (
                f"{notification.body}\n\n"
                f"Open Inventory Autopilot: {app_base_url(settings)}/inventory"
            ),
        }
    )
    if isinstance(result, dict) and result.get("error"):
        raise InventoryError(str(result["error"]), 502)


async def sync_inventory_item_unlocked(
    session: AsyncSession, settings: Settings, item_id: int
) -> None:
    row = (
        await session.execute(
            select(InventoryItem, InventoryChannelLink, InventorySettings, ShopifyConnection)
            .join(InventoryChannelLink, InventoryChannelLink.inventory_item_id == InventoryItem.id)
            .join(InventorySettings, InventorySettings.user_id == InventoryItem.user_id)
            .join(ShopifyConnection, ShopifyConnection.session_id == InventoryItem.user_id)
            .where(InventoryItem.id == item_id)
        )
    ).first()
    if not row:
        return
    item, link, inventory_settings, connection = row
    if not inventory_settings.enabled or not item.tracking_enabled or item.kind == "bundle":
        return

    current_item = item
    target = calculate_sellable_quantity(
        current_item.ledger_quantity,
        effective_safety_buffer(current_item, inventory_settings.default_safety_buffer),
    )
    item_version = current_item.version
    if link.observed_quantity == target and link.pending_quantity is None:
        link.pushed_quantity = target
        link.sync_state = "synced"
        link.last_error = None
        link.updated_at = _now()
        session.add(link)
        return

    link.pending_quantity = target
    link.sync_state = "syncing"
    link.updated_at = _now()
    session.add(link)
    compare_quantity = link.observed_quantity
    for attempt in range(3):
        try:
            await set_shopify_inventory_quantity(
                connection,
                settings,
                inventory_item_id=link.external_inventory_item_id,
                location_id=link.external_location_id,
                quantity=target,
                compare_quantity=compare_quantity,
                idempotency_key=f"inventory-{item.id}-{item_version}-{target}-{compare_quantity}",
            )
            now = _now()
            link.observed_quantity = target
            link.pushed_quantity = target
            link.pending_quantity = None
            link.sync_state = "synced"
            link.last_error = None
            link.last_observed_at = now
            link.last_pushed_at = now
            link.updated_at = now
            current_item.state = "sold_out" if target == 0 else "active"
            current_item.last_synced_at = now
            current_item.updated_at = now
            session.add(link)
            session.add(current_item)
            await session.execute(
                update(InventoryNotification)
                .where(
                    InventoryNotification.user_id == current_item.user_id,
                    InventoryNotification.dedupe_key == f"sync-failure:{current_item.id}",
                    InventoryNotification.resolved_at.is_(None),
                )
                .values(resolved_at=now)
            )
            await evaluate_stock_alert(session, settings, current_item)
            _log("info", "shopify_quantity_synced", itemId=current_item.id, target=target)
            return
        except InventoryError as exc:
            if not exc.compare_mismatch or attempt == 2:
                message = str(exc)
                link.pending_quantity = None
                link.sync_state = "conflict"
                link.last_error = message
                link.updated_at = _now()
                current_item.state = "conflict"
                current_item.updated_at = _now()
                session.add(link)
                session.add(current_item)
                await create_inventory_notification(
                    session,
                    settings,
                    user_id=current_item.user_id,
                    inventory_item_id=current_item.id,
                    type="sync_failure",
                    severity="critical",
                    title=f"Inventory sync failed for {current_item.title}",
                    body=message,
                    dedupe_key=f"sync-failure:{current_item.id}",
                    email=True,
                )
                _log(
                    "error",
                    "shopify_sync_conflict",
                    itemId=current_item.id,
                    attempts=attempt + 1,
                    error=message,
                )
                raise
            latest_quantity = await get_shopify_inventory_quantity(
                connection,
                settings,
                link.external_inventory_item_id,
                link.external_location_id,
            )
            external_delta = latest_quantity - compare_quantity
            if external_delta != 0:
                _log(
                    "warning",
                    "reconciliation_drift",
                    itemId=current_item.id,
                    expectedQuantity=compare_quantity,
                    observedQuantity=latest_quantity,
                    delta=external_delta,
                )
                adjusted = await apply_ledger_adjustment(
                    session,
                    user_id=current_item.user_id,
                    item_id=current_item.id,
                    mode="delta",
                    quantity=external_delta,
                    reason="Shopify reconciliation adjustment",
                    source="shopify_reconciliation",
                    idempotency_key=(
                        f"reconcile:{current_item.id}:{item_version}:{compare_quantity}:{latest_quantity}"
                    ),
                )
                target = calculate_sellable_quantity(
                    adjusted.ledger_quantity,
                    effective_safety_buffer(adjusted, inventory_settings.default_safety_buffer),
                )
                current_item = adjusted
                item_version = adjusted.version
                await evaluate_stock_alert(session, settings, adjusted)
                link.pending_quantity = target
                session.add(link)
            compare_quantity = latest_quantity
            link.observed_quantity = compare_quantity
            link.last_observed_at = _now()
            session.add(link)


async def sync_inventory_item(session: AsyncSession, settings: Settings, item_id: int) -> None:
    await session.execute(text("SELECT pg_advisory_lock(:k)"), {"k": item_id})
    try:
        await sync_inventory_item_unlocked(session, settings, item_id)
    finally:
        await session.execute(text("SELECT pg_advisory_unlock(:k)"), {"k": item_id})


async def process_inventory_webhook(
    session: AsyncSession, settings: Settings, event_id: int
) -> None:
    event = (
        await session.execute(
            select(InventoryWebhookEvent).where(InventoryWebhookEvent.id == event_id)
        )
    ).scalar_one_or_none()
    if not event or event.status == "processed":
        return
    connection = await get_connection_for_shop(session, event.shop_domain)
    if not connection:
        event.status = "processed"
        event.processed_at = _now()
        event.attempts = event.attempts + 1
        session.add(event)
        return
    user_id = connection.session_id
    payload = event.payload if isinstance(event.payload, dict) else {}

    if event.topic == "inventory_levels/update":
        inventory_item_id = normalize_gid("InventoryItem", payload.get("inventory_item_id"))
        location_id = normalize_gid("Location", payload.get("location_id"))
        observed = max(0, int(payload.get("available") or 0))
        row = (
            await session.execute(
                select(InventoryChannelLink, InventoryItem, InventorySettings)
                .join(InventoryItem, InventoryItem.id == InventoryChannelLink.inventory_item_id)
                .join(InventorySettings, InventorySettings.user_id == InventoryChannelLink.user_id)
                .where(
                    InventoryChannelLink.external_inventory_item_id == inventory_item_id,
                    InventoryChannelLink.external_location_id == location_id,
                )
            )
        ).first()
        event_time = None
        if payload.get("updated_at"):
            try:
                event_time = datetime_from_iso(str(payload["updated_at"]))
            except ValueError:
                event_time = None
        is_out_of_order = bool(
            event_time and row and row[0].last_observed_at and event_time <= row[0].last_observed_at
        )
        if row and row[2].enabled and not is_out_of_order:
            link, item, inventory_settings = row
            expected = (
                link.pending_quantity
                if link.pending_quantity is not None
                else link.pushed_quantity
                if link.pushed_quantity is not None
                else calculate_sellable_quantity(
                    item.ledger_quantity,
                    effective_safety_buffer(item, inventory_settings.default_safety_buffer),
                )
            )
            delta = webhook_adjustment_delta(observed, expected)
            if delta != 0 and item.kind != "bundle":
                adjusted = await apply_ledger_adjustment(
                    session,
                    user_id=user_id,
                    item_id=item.id,
                    mode="delta",
                    quantity=delta,
                    reason="Shopify inventory adjustment",
                    source="shopify",
                    idempotency_key=f"webhook:{event.external_event_id}:{item.id}",
                    external_reference=event.external_event_id,
                )
                await evaluate_stock_alert(session, settings, adjusted)
            link.observed_quantity = observed
            link.pushed_quantity = observed if observed == expected else link.pushed_quantity
            link.pending_quantity = None if observed == expected else link.pending_quantity
            link.sync_state = "synced" if observed == expected else "pending"
            link.last_observed_at = _now()
            link.updated_at = _now()
            session.add(link)
            if delta != 0 and item.kind != "bundle":
                await enqueue_inventory_job(session, user_id, "sync_item", {"itemId": item.id})
    elif event.topic == "bulk_operations/finish":
        operation_id = str(payload.get("admin_graphql_api_id") or payload.get("id") or "")
        job = (
            await session.execute(
                select(InventoryImportJob).where(
                    InventoryImportJob.external_operation_id == operation_id
                )
            )
        ).scalar_one_or_none()
        if job:
            await enqueue_inventory_job(
                session, job.user_id, "finish_import", {"importJobId": job.id}
            )
    elif event.topic == "app/uninstalled":
        await session.execute(
            update(InventorySettings)
            .where(InventorySettings.user_id == user_id)
            .values(enabled=False, status="disconnected", updated_at=_now())
        )
        await session.delete(connection)
    elif event.topic == "locations/delete":
        deleted_location = normalize_gid("Location", payload.get("id"))
        inventory_settings = (
            await session.execute(
                select(InventorySettings).where(InventorySettings.user_id == user_id)
            )
        ).scalar_one_or_none()
        if inventory_settings and inventory_settings.location_id == deleted_location:
            inventory_settings.enabled = False
            inventory_settings.status = "location_missing"
            inventory_settings.updated_at = _now()
            session.add(inventory_settings)
            await create_inventory_notification(
                session,
                settings,
                user_id=user_id,
                type="connection",
                severity="critical",
                title="Inventory location was removed",
                body=(
                    "Choose a new Shopify fulfilment location before inventory "
                    "syncing can continue."
                ),
                dedupe_key="location-missing",
                email=True,
            )
    elif event.topic == "products/delete":
        product_id = str(
            payload.get("admin_graphql_api_id") or normalize_gid("Product", payload.get("id"))
        )
        links = list(
            (
                await session.execute(
                    select(InventoryChannelLink).where(
                        InventoryChannelLink.user_id == user_id,
                        InventoryChannelLink.external_product_id == product_id,
                    )
                )
            ).scalars()
        )
        if links:
            item_ids = [link.inventory_item_id for link in links]
            await session.execute(
                update(InventoryItem)
                .where(InventoryItem.id.in_(item_ids))
                .values(state="archived", tracking_enabled=False, updated_at=_now())
            )
            await session.execute(
                update(InventoryChannelLink)
                .where(
                    InventoryChannelLink.user_id == user_id,
                    InventoryChannelLink.external_product_id == product_id,
                )
                .values(
                    sync_state="disconnected",
                    external_status="DELETED",
                    pending_quantity=None,
                    updated_at=_now(),
                )
            )
    elif event.topic in {"products/create", "products/update"}:
        inventory_settings = (
            await session.execute(
                select(InventorySettings).where(InventorySettings.user_id == user_id)
            )
        ).scalar_one_or_none()
        if inventory_settings and inventory_settings.enabled:
            await start_webhook_catalog_refresh(session, settings, user_id)
    else:
        await enqueue_inventory_job(session, user_id, "reconcile_user", {"userId": user_id})

    event.status = "processed"
    event.processed_at = _now()
    event.attempts = event.attempts + 1
    event.last_error = None
    session.add(event)


def datetime_from_iso(value: str):
    from datetime import datetime

    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return parsed.replace(tzinfo=None) if parsed.tzinfo else parsed


async def sync_all(session: AsyncSession, user_id: str, cursor: int) -> None:
    items = list(
        (
            await session.execute(
                select(InventoryItem.id)
                .where(InventoryItem.user_id == user_id, InventoryItem.id > cursor)
                .order_by(asc(InventoryItem.id))
                .limit(100)
            )
        ).scalars()
    )
    for item_id in items:
        await enqueue_inventory_job(session, user_id, "sync_item", {"itemId": item_id})
    if len(items) == 100:
        await enqueue_inventory_job(
            session, user_id, "sync_all", {"userId": user_id, "cursor": items[-1]}
        )


async def protect_variant_policies(
    session: AsyncSession, settings: Settings, user_id: str, cursor: int
) -> None:
    links = list(
        (
            await session.execute(
                select(InventoryChannelLink)
                .where(
                    InventoryChannelLink.user_id == user_id,
                    InventoryChannelLink.id > cursor,
                )
                .order_by(asc(InventoryChannelLink.id))
                .limit(100)
            )
        ).scalars()
    )
    by_product: dict[str, list[str]] = {}
    for link in links:
        by_product.setdefault(link.external_product_id, []).append(link.external_variant_id)
    connection = await get_connection_for_user(session, user_id)
    for product_id, variant_ids in by_product.items():
        await set_shopify_variant_inventory_policies(
            connection, settings, product_id=product_id, variant_ids=variant_ids
        )
    if len(links) == 100:
        await enqueue_inventory_job(
            session, user_id, "protect_variants", {"userId": user_id, "cursor": links[-1].id}
        )
    else:
        await enqueue_inventory_job(session, user_id, "sync_all", {"userId": user_id, "cursor": 0})


async def process_inventory_queue_message(
    session: AsyncSession, settings: Settings, job_id: int
) -> InventoryOutboxJob | None:
    result = await session.execute(
        update(InventoryOutboxJob)
        .where(
            InventoryOutboxJob.id == job_id,
            InventoryOutboxJob.status.in_(["pending", "failed"]),
        )
        .values(
            status="processing",
            processing_started_at=_now(),
            attempts=InventoryOutboxJob.attempts + 1,
        )
        .returning(InventoryOutboxJob)
    )
    job = result.scalar_one_or_none()
    if not job:
        return None
    await _run_job(session, settings, job)
    return job


async def claim_next_job(session: AsyncSession) -> InventoryOutboxJob | None:
    row = (await session.execute(CLAIM_SQL)).mappings().first()
    if not row:
        return None
    return (
        await session.execute(select(InventoryOutboxJob).where(InventoryOutboxJob.id == row["id"]))
    ).scalar_one()


async def _run_job(session: AsyncSession, settings: Settings, job: InventoryOutboxJob) -> None:
    payload = job.payload if isinstance(job.payload, dict) else {}
    try:
        if job.type == "finish_import":
            await finish_catalog_import(session, settings, int(payload["importJobId"]))
        elif job.type == "sync_item":
            await sync_inventory_item(session, settings, int(payload["itemId"]))
        elif job.type == "sync_all":
            await sync_all(session, str(payload["userId"]), int(payload.get("cursor") or 0))
        elif job.type == "protect_variants":
            await protect_variant_policies(
                session, settings, str(payload["userId"]), int(payload.get("cursor") or 0)
            )
        elif job.type == "process_webhook":
            await process_inventory_webhook(session, settings, int(payload["eventId"]))
        elif job.type == "send_alert_email":
            await send_alert_email(session, settings, int(payload["notificationId"]))
        elif job.type == "reconcile_user":
            await reconcile_inventory_user(session, settings, str(payload["userId"]))
        else:
            raise InventoryError(f"Unknown inventory job type: {job.type}", 500)
        job.status = "processed"
        job.processed_at = _now()
        job.last_error = None
        session.add(job)
    except Exception as exc:
        retry_after = getattr(exc, "retry_after_seconds", None) or min(
            300, 2 ** min(job.attempts, 8)
        )
        job.status = "failed"
        job.available_at = _now() + timedelta(seconds=retry_after)
        job.last_error = str(exc)
        session.add(job)
        _log(
            "error",
            "outbox_job_failed",
            jobId=job.id,
            type=job.type,
            attempts=job.attempts,
            retryAfterSeconds=retry_after,
            error=str(exc),
        )


async def recover_inventory_jobs(session: AsyncSession, settings: Settings) -> dict[str, Any]:
    if not feature_enabled(settings):
        return {"recoveredJobs": 0, "reconciliations": 0, "disabled": True}
    cutoff = _now() - timedelta(minutes=10)
    await session.execute(
        update(InventoryOutboxJob)
        .where(
            InventoryOutboxJob.status == "processing",
            InventoryOutboxJob.processing_started_at <= cutoff,
            InventoryOutboxJob.processed_at.is_(None),
        )
        .values(
            status="failed",
            available_at=_now(),
            last_error="Recovered after worker visibility timeout",
        )
    )
    stale = list(
        (
            await session.execute(
                select(InventoryOutboxJob)
                .where(
                    InventoryOutboxJob.status.in_(["pending", "failed"]),
                    InventoryOutboxJob.available_at <= _now(),
                )
                .order_by(asc(InventoryOutboxJob.created_at))
                .limit(100)
            )
        ).scalars()
    )
    if stale:
        oldest = stale[0].created_at or _now()
        _log(
            "warning",
            "outbox_recovery",
            jobCount=len(stale),
            oldestAgeSeconds=max(0, round((_now() - oldest).total_seconds())),
        )
    for job in stale:
        try:
            await process_inventory_queue_message(session, settings, job.id)
        except Exception:
            continue

    enabled = list(
        (
            await session.execute(
                select(InventorySettings).where(InventorySettings.enabled.is_(True))
            )
        ).scalars()
    )
    entitled = 0
    for setting in enabled:
        entitlement = await _update_subscription_grace(session, setting.user_id, settings)
        if not entitlement["expired"]:
            entitled += 1
            await enqueue_inventory_job(
                session, setting.user_id, "reconcile_user", {"userId": setting.user_id}
            )
    return {"recoveredJobs": len(stale), "reconciliations": entitled}


async def run_inventory_worker(stop: asyncio.Event) -> None:
    settings = get_settings()
    if not settings.inventory_autopilot_enabled:
        logger.info("Inventory Autopilot is disabled; worker not polling")
        await stop.wait()
        return
    while not stop.is_set():
        claimed = False
        try:
            async for session in get_session():
                job = await claim_next_job(session)
                if job:
                    claimed = True
                    await _run_job(session, settings, job)
                break
        except Exception:
            logger.exception("inventory worker loop failed")
        if not claimed:
            try:
                await asyncio.wait_for(stop.wait(), timeout=2.0)
            except TimeoutError:
                pass
