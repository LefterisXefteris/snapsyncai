"""Inventory Autopilot DTOs — camelCase for `client/src/hooks/use-inventory.ts`."""

from datetime import datetime
from typing import Any

from pydantic import Field

from app.schemas.base import CamelModel


class SetupBody(CamelModel):
    location_id: str
    default_safety_buffer: int = 2
    default_low_stock_threshold: int = 5


class AdjustmentBody(CamelModel):
    mode: str
    quantity: int
    reason: str = Field(min_length=3, max_length=250)


class PolicyBody(CamelModel):
    safety_buffer: int | None = None
    low_stock_threshold: int | None = None
    tracking_enabled: bool


class BundleComponentBody(CamelModel):
    item_id: int
    units: int


class BundleBody(CamelModel):
    bundle_item_id: int | None = None
    components: list[BundleComponentBody] = Field(min_length=1, max_length=30)


class InventorySettingsDto(CamelModel):
    status: str
    enabled: bool
    location_id: str
    location_name: str
    default_safety_buffer: int
    default_low_stock_threshold: int
    grace_ends_at: datetime | None = None
    last_reconciled_at: datetime | None = None


class InventoryImportDto(CamelModel):
    id: int
    status: str
    preview: dict[str, Any] | None = None
    error: str | None = None


class InventoryOverviewResponse(CamelModel):
    settings: InventorySettingsDto | None = None
    latest_import: InventoryImportDto | None = None
    total_items: int
    total_units: int
    low_stock_items: int
    sold_out_items: int
    sync_failures: int
    unread_alerts: int


class InventoryChannelLinkDto(CamelModel):
    sync_state: str
    last_error: str | None = None
    external_variant_id: str


class InventoryItemDto(CamelModel):
    id: int
    title: str
    variant_title: str | None = None
    sku: str | None = None
    kind: str
    ledger_quantity: int
    sellable_quantity: int
    safety_buffer: int | None = None
    low_stock_threshold: int | None = None
    tracking_enabled: bool
    state: str
    channel_link: InventoryChannelLinkDto | None = None


class InventoryItemsResponse(CamelModel):
    items: list[InventoryItemDto]
    next_cursor: int | None = None


class InventoryBundleComponentDto(CamelModel):
    id: int
    item_id: int
    units: int
    title: str
    sku: str | None = None
    quantity: int
    safety_buffer: int | None = None


class InventoryBundleDetail(CamelModel):
    bundle_item_id: int
    components: list[InventoryBundleComponentDto]
    computed_availability: int


class InventoryBundleListItem(CamelModel):
    id: int
    title: str
    sku: str | None = None
    kind: str
    components: list[InventoryBundleComponentDto]
    computed_availability: int


class InventoryLedgerEntryDto(CamelModel):
    id: int
    delta: int
    quantity_after: int
    reason: str
    source: str
    created_at: datetime | None = None


class InventoryNotificationDto(CamelModel):
    id: int
    type: str
    severity: str
    title: str
    body: str
    read_at: datetime | None = None
    resolved_at: datetime | None = None
    created_at: datetime | None = None
