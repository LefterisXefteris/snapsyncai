"""Pure inventory math and Shopify catalog JSONL parsing.

Port of `server/inventory-core.ts`. No DB, no HTTP. Two JS/Python traps live here:

- `??` is null-coalescing; `or` is falsy-coalescing. A safety buffer of 0 must stay 0.
- `Math.trunc` rounds toward zero; Python `//` floors toward -inf.
"""

from __future__ import annotations

import json
import math
from datetime import UTC, datetime
from typing import Any, TypedDict

DEFAULT_SAFETY_BUFFER = 2
DEFAULT_LOW_STOCK_THRESHOLD = 5
INVENTORY_GRACE_DAYS = 7


class ImportedInventoryRecord(TypedDict):
    inventory_item_id: str
    variant_id: str
    product_id: str
    title: str
    variant_title: str | None
    sku: str | None
    tracked: bool
    status: str | None
    quantity: int


def _is_int(value: object) -> bool:
    """Match `Number.isInteger`: reject bools (which are ints in Python)."""
    return isinstance(value, int) and not isinstance(value, bool)


def _trunc(value: float | int) -> int:
    """Match `Math.trunc` — toward zero, not floor."""
    return math.trunc(value)


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def effective_safety_buffer(
    policy: dict[str, Any] | Any,
    default_buffer: int = DEFAULT_SAFETY_BUFFER,
) -> int:
    raw = (
        policy.get("safety_buffer")
        if isinstance(policy, dict)
        else getattr(policy, "safety_buffer", None)
    )
    buffer = default_buffer if raw is None else raw
    return max(0, buffer)


def effective_low_stock_threshold(
    policy: dict[str, Any] | Any,
    default_threshold: int = DEFAULT_LOW_STOCK_THRESHOLD,
) -> int:
    raw = (
        policy.get("low_stock_threshold")
        if isinstance(policy, dict)
        else getattr(policy, "low_stock_threshold", None)
    )
    threshold = default_threshold if raw is None else raw
    return max(0, threshold)


def calculate_sellable_quantity(ledger_quantity: int, safety_buffer: int) -> int:
    return max(0, _trunc(ledger_quantity) - max(0, _trunc(safety_buffer)))


def calculate_adjusted_quantity(current_quantity: int, mode: str, quantity: float | int) -> int:
    next_quantity = quantity if mode == "set" else current_quantity + quantity
    if not _is_int(next_quantity) or next_quantity < 0:
        raise ValueError("Inventory quantity cannot be negative")
    return int(next_quantity)


def is_low_stock(ledger_quantity: int, threshold: int) -> bool:
    return ledger_quantity <= max(0, threshold)


def validate_bundle_recipe(input: dict[str, Any]) -> None:
    bundle_item_id = input["bundle_item_id"]
    components: list[dict[str, Any]] = input["components"]
    if not _is_int(bundle_item_id) or bundle_item_id <= 0:
        raise ValueError("A valid bundle item is required")
    if len(components) == 0 or len(components) > 30:
        raise ValueError("A bundle must contain between 1 and 30 components")

    seen: set[int] = set()
    for component in components:
        item_id = component["item_id"]
        units = component["units"]
        if not _is_int(item_id) or item_id <= 0:
            raise ValueError("Every component must reference a valid inventory item")
        if item_id == bundle_item_id:
            raise ValueError("A bundle cannot contain itself")
        if item_id in seen:
            raise ValueError("A component can appear only once in a bundle")
        if not _is_int(units) or units <= 0:
            raise ValueError("Component quantities must be positive whole numbers")
        if component.get("kind") == "bundle":
            raise ValueError("Nested bundles are not supported")
        seen.add(item_id)


def webhook_adjustment_delta(observed_quantity: float, expected_quantity: float) -> int:
    return _trunc(observed_quantity) - _trunc(expected_quantity)


def should_send_low_stock_email(
    last_emailed_at: datetime | None, now: datetime | None = None
) -> bool:
    if last_emailed_at is None:
        return True
    current = _as_utc(now or datetime.now(UTC))
    return (current - _as_utc(last_emailed_at)).total_seconds() >= 24 * 60 * 60


def parse_shopify_bulk_inventory_jsonl(
    jsonl: str, location_id: str
) -> list[ImportedInventoryRecord]:
    items_by_id: dict[str, dict[str, Any]] = {}
    quantities_by_item_id: dict[str, float] = {}

    for raw_line in jsonl.split("\n"):
        if not raw_line.strip():
            continue
        record = json.loads(raw_line)
        record_id = str(record.get("id") or "")

        if "/InventoryItem/" in record_id:
            variant = record.get("variant") or {}
            product = variant.get("product") or {}
            items_by_id[record_id] = {
                "inventory_item_id": record_id,
                "variant_id": str(variant.get("id") or ""),
                "product_id": str(product.get("id") or ""),
                "title": str(
                    product.get("title") or variant.get("displayName") or "Untitled product"
                ),
                "variant_title": str(variant["title"]) if variant.get("title") else None,
                "sku": str(record["sku"]) if record.get("sku") else None,
                "tracked": record.get("tracked") is not False,
                "status": str(product["status"]) if product.get("status") else None,
            }
            nodes = (record.get("inventoryLevels") or {}).get("nodes")
            if isinstance(nodes, list):
                level = next(
                    (
                        candidate
                        for candidate in nodes
                        if (candidate.get("location") or {}).get("id") == location_id
                    ),
                    None,
                )
                quantity = None
                if level:
                    quantity = next(
                        (
                            candidate.get("quantity")
                            for candidate in (level.get("quantities") or [])
                            if candidate.get("name") == "available"
                        ),
                        None,
                    )
                if isinstance(quantity, (int, float)) and not isinstance(quantity, bool):
                    quantities_by_item_id[record_id] = float(quantity)
            continue

        if (
            "/InventoryLevel/" in record_id
            and (record.get("location") or {}).get("id") == location_id
        ):
            parent_id = str(record.get("__parentId") or "")
            quantity = next(
                (
                    candidate.get("quantity")
                    for candidate in (record.get("quantities") or [])
                    if candidate.get("name") == "available"
                ),
                None,
            )
            if parent_id and isinstance(quantity, (int, float)) and not isinstance(quantity, bool):
                quantities_by_item_id[parent_id] = float(quantity)

    results: list[ImportedInventoryRecord] = []
    for record in items_by_id.values():
        if not record["variant_id"] or not record["product_id"]:
            continue
        quantity = quantities_by_item_id.get(record["inventory_item_id"], 0)
        results.append({**record, "quantity": max(0, _trunc(quantity))})
    return results
