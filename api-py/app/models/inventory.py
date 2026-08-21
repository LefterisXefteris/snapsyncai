"""Inventory Autopilot tables — restored from `migrations/0001_inventory_autopilot.sql`.

Dropped in 0003 as non-core during the Express cutover; this is the Python-side
source of truth for bringing them back.
"""

from datetime import datetime
from typing import Any

from sqlalchemy import CheckConstraint, Index, UniqueConstraint
from sqlalchemy import text as sa_text
from sqlmodel import Field, SQLModel

from app.models.base import boolean, integer, jsonb, timestamp, txt


class InventorySettings(SQLModel, table=True):
    __tablename__ = "inventory_settings"
    __table_args__ = (Index("idx_inventory_settings_enabled", "enabled"),)

    id: int | None = Field(default=None, primary_key=True)
    user_id: str = Field(sa_column=txt(nullable=False, unique=True))
    shop_domain: str = Field(sa_column=txt(nullable=False))
    location_id: str = Field(sa_column=txt(nullable=False))
    location_name: str = Field(sa_column=txt(nullable=False))
    status: str = Field(sa_column=txt(nullable=False, server_default="setup"))
    enabled: bool = Field(sa_column=boolean(nullable=False, default=False))
    default_safety_buffer: int = Field(sa_column=integer(nullable=False, default=2))
    default_low_stock_threshold: int = Field(sa_column=integer(nullable=False, default=5))
    grace_ends_at: datetime | None = Field(default=None, sa_column=timestamp())
    last_reconciled_at: datetime | None = Field(default=None, sa_column=timestamp())
    created_at: datetime | None = Field(default=None, sa_column=timestamp(now=True))
    updated_at: datetime | None = Field(default=None, sa_column=timestamp(now=True))


class InventoryItem(SQLModel, table=True):
    __tablename__ = "inventory_items"
    __table_args__ = (
        Index("idx_inventory_items_user", "user_id"),
        Index("idx_inventory_items_user_state", "user_id", "state"),
        Index("idx_inventory_items_user_sku", "user_id", "sku"),
    )

    id: int | None = Field(default=None, primary_key=True)
    user_id: str = Field(sa_column=txt(nullable=False))
    title: str = Field(sa_column=txt(nullable=False))
    variant_title: str | None = Field(default=None, sa_column=txt())
    sku: str | None = Field(default=None, sa_column=txt())
    kind: str = Field(sa_column=txt(nullable=False, server_default="standalone"))
    ledger_quantity: int = Field(sa_column=integer(nullable=False, default=0))
    safety_buffer: int | None = Field(default=None, sa_column=integer())
    low_stock_threshold: int | None = Field(default=None, sa_column=integer())
    tracking_enabled: bool = Field(sa_column=boolean(nullable=False, default=True))
    state: str = Field(sa_column=txt(nullable=False, server_default="draft"))
    version: int = Field(sa_column=integer(nullable=False, default=0))
    last_synced_at: datetime | None = Field(default=None, sa_column=timestamp())
    created_at: datetime | None = Field(default=None, sa_column=timestamp(now=True))
    updated_at: datetime | None = Field(default=None, sa_column=timestamp(now=True))


class InventoryChannelLink(SQLModel, table=True):
    __tablename__ = "inventory_channel_links"
    __table_args__ = (
        UniqueConstraint(
            "inventory_item_id", "channel", name="inventory_channel_links_item_channel_key"
        ),
        UniqueConstraint(
            "channel",
            "external_inventory_item_id",
            "external_location_id",
            name="inventory_channel_links_external_key",
        ),
        Index("idx_inventory_channel_user", "user_id"),
    )

    id: int | None = Field(default=None, primary_key=True)
    user_id: str = Field(sa_column=txt(nullable=False))
    inventory_item_id: int = Field(foreign_key="inventory_items.id")
    channel: str = Field(sa_column=txt(nullable=False, server_default="shopify"))
    external_product_id: str = Field(sa_column=txt(nullable=False))
    external_variant_id: str = Field(sa_column=txt(nullable=False))
    external_inventory_item_id: str = Field(sa_column=txt(nullable=False))
    external_location_id: str = Field(sa_column=txt(nullable=False))
    observed_quantity: int = Field(sa_column=integer(nullable=False, default=0))
    pushed_quantity: int | None = Field(default=None, sa_column=integer())
    pending_quantity: int | None = Field(default=None, sa_column=integer())
    external_status: str | None = Field(default=None, sa_column=txt())
    sync_state: str = Field(sa_column=txt(nullable=False, server_default="draft"))
    last_error: str | None = Field(default=None, sa_column=txt())
    last_observed_at: datetime | None = Field(default=None, sa_column=timestamp())
    last_pushed_at: datetime | None = Field(default=None, sa_column=timestamp())
    created_at: datetime | None = Field(default=None, sa_column=timestamp(now=True))
    updated_at: datetime | None = Field(default=None, sa_column=timestamp(now=True))


class InventoryLedgerEntry(SQLModel, table=True):
    __tablename__ = "inventory_ledger_entries"
    __table_args__ = (
        Index("idx_inventory_ledger_item_created", "inventory_item_id", sa_text("created_at DESC")),
        Index("idx_inventory_ledger_user_created", "user_id", sa_text("created_at DESC")),
    )

    id: int | None = Field(default=None, primary_key=True)
    user_id: str = Field(sa_column=txt(nullable=False))
    inventory_item_id: int = Field(foreign_key="inventory_items.id")
    delta: int = Field(sa_column=integer(nullable=False))
    quantity_after: int = Field(sa_column=integer(nullable=False))
    reason: str = Field(sa_column=txt(nullable=False))
    source: str = Field(sa_column=txt(nullable=False))
    idempotency_key: str = Field(sa_column=txt(nullable=False, unique=True))
    external_reference: str | None = Field(default=None, sa_column=txt())
    metadata_json: Any | None = Field(default=None, sa_column=jsonb(name="metadata"))
    created_at: datetime | None = Field(default=None, sa_column=timestamp(now=True))


class InventoryBundleComponent(SQLModel, table=True):
    __tablename__ = "inventory_bundle_components"
    __table_args__ = (
        CheckConstraint("bundle_item_id <> component_item_id", name="inventory_bundle_not_self"),
        UniqueConstraint(
            "bundle_item_id", "component_item_id", name="inventory_bundle_components_unique"
        ),
        Index("idx_inventory_bundle_component_item", "component_item_id"),
    )

    id: int | None = Field(default=None, primary_key=True)
    user_id: str = Field(sa_column=txt(nullable=False))
    bundle_item_id: int = Field(foreign_key="inventory_items.id")
    component_item_id: int = Field(foreign_key="inventory_items.id")
    units: int = Field(sa_column=integer(nullable=False))
    created_at: datetime | None = Field(default=None, sa_column=timestamp(now=True))
    updated_at: datetime | None = Field(default=None, sa_column=timestamp(now=True))


class InventoryImportJob(SQLModel, table=True):
    __tablename__ = "inventory_import_jobs"
    __table_args__ = (
        Index("idx_inventory_import_user_created", "user_id", sa_text("created_at DESC")),
    )

    id: int | None = Field(default=None, primary_key=True)
    user_id: str = Field(sa_column=txt(nullable=False))
    provider: str = Field(sa_column=txt(nullable=False, server_default="shopify"))
    external_operation_id: str | None = Field(default=None, sa_column=txt(unique=True))
    status: str = Field(sa_column=txt(nullable=False, server_default="queued"))
    total_items: int = Field(sa_column=integer(nullable=False, default=0))
    imported_items: int = Field(sa_column=integer(nullable=False, default=0))
    preview: Any | None = Field(default=None, sa_column=jsonb())
    error: str | None = Field(default=None, sa_column=txt())
    created_at: datetime | None = Field(default=None, sa_column=timestamp(now=True))
    completed_at: datetime | None = Field(default=None, sa_column=timestamp())


class InventoryWebhookEvent(SQLModel, table=True):
    __tablename__ = "inventory_webhook_events"
    __table_args__ = (
        Index("idx_inventory_webhook_status", "status", "received_at"),
        Index("idx_inventory_webhook_shop", "shop_domain"),
    )

    id: int | None = Field(default=None, primary_key=True)
    provider: str = Field(sa_column=txt(nullable=False, server_default="shopify"))
    external_event_id: str = Field(sa_column=txt(nullable=False, unique=True))
    user_id: str | None = Field(default=None, sa_column=txt())
    topic: str = Field(sa_column=txt(nullable=False))
    shop_domain: str = Field(sa_column=txt(nullable=False))
    payload: Any = Field(sa_column=jsonb(nullable=False))
    status: str = Field(sa_column=txt(nullable=False, server_default="received"))
    attempts: int = Field(sa_column=integer(nullable=False, default=0))
    last_error: str | None = Field(default=None, sa_column=txt())
    received_at: datetime | None = Field(default=None, sa_column=timestamp(now=True))
    processed_at: datetime | None = Field(default=None, sa_column=timestamp())


class InventoryOutboxJob(SQLModel, table=True):
    __tablename__ = "inventory_outbox_jobs"
    __table_args__ = (Index("idx_inventory_outbox_pending", "status", "available_at"),)

    id: int | None = Field(default=None, primary_key=True)
    user_id: str | None = Field(default=None, sa_column=txt())
    type: str = Field(sa_column=txt(nullable=False))
    payload: Any = Field(sa_column=jsonb(nullable=False))
    status: str = Field(sa_column=txt(nullable=False, server_default="pending"))
    attempts: int = Field(sa_column=integer(nullable=False, default=0))
    available_at: datetime | None = Field(default=None, sa_column=timestamp(now=True))
    processing_started_at: datetime | None = Field(default=None, sa_column=timestamp())
    last_error: str | None = Field(default=None, sa_column=txt())
    created_at: datetime | None = Field(default=None, sa_column=timestamp(now=True))
    processed_at: datetime | None = Field(default=None, sa_column=timestamp())


class InventoryNotification(SQLModel, table=True):
    __tablename__ = "inventory_notifications"
    __table_args__ = (
        Index("idx_inventory_notification_user_created", "user_id", sa_text("created_at DESC")),
        Index(
            "idx_inventory_notification_dedupe",
            "user_id",
            "dedupe_key",
            unique=True,
            postgresql_where=sa_text("resolved_at IS NULL"),
        ),
    )

    id: int | None = Field(default=None, primary_key=True)
    user_id: str = Field(sa_column=txt(nullable=False))
    inventory_item_id: int | None = Field(default=None, foreign_key="inventory_items.id")
    type: str = Field(sa_column=txt(nullable=False))
    severity: str = Field(sa_column=txt(nullable=False, server_default="warning"))
    title: str = Field(sa_column=txt(nullable=False))
    body: str = Field(sa_column=txt(nullable=False))
    dedupe_key: str = Field(sa_column=txt(nullable=False))
    read_at: datetime | None = Field(default=None, sa_column=timestamp())
    resolved_at: datetime | None = Field(default=None, sa_column=timestamp())
    emailed_at: datetime | None = Field(default=None, sa_column=timestamp())
    created_at: datetime | None = Field(default=None, sa_column=timestamp(now=True))
