"""Port of tests/inventory-core.test.ts plus JS/Python semantic traps.

Seam: `app.services.inventory.core` — pure functions, no DB or HTTP.
"""

import json
from datetime import UTC, datetime, timedelta

import pytest

from app.services.inventory.core import (
    calculate_adjusted_quantity,
    calculate_sellable_quantity,
    effective_low_stock_threshold,
    effective_safety_buffer,
    is_low_stock,
    parse_shopify_bulk_inventory_jsonl,
    should_send_low_stock_email,
    validate_bundle_recipe,
    webhook_adjustment_delta,
)


def test_sellable_inventory_applies_the_safety_buffer_and_never_becomes_negative() -> None:
    assert calculate_sellable_quantity(10, 2) == 8
    assert calculate_sellable_quantity(1, 2) == 0
    assert calculate_sellable_quantity(0, 2) == 0


def test_inventory_policies_use_defaults_unless_an_item_override_is_present() -> None:
    assert effective_safety_buffer({"safety_buffer": None}) == 2
    assert effective_safety_buffer({"safety_buffer": 7}) == 7
    assert effective_low_stock_threshold({"low_stock_threshold": None}) == 5
    assert effective_low_stock_threshold({"low_stock_threshold": 1}) == 1


def test_safety_buffer_zero_is_a_deliberate_holdback_not_a_missing_value() -> None:
    """JS `??` keeps 0; Python `or` would silently restore the default of 2."""
    assert effective_safety_buffer({"safety_buffer": 0}) == 0
    assert effective_low_stock_threshold({"low_stock_threshold": 0}) == 0
    # Shop-level default of 0 must survive the same coalesce (not `value or 2`).
    assert effective_safety_buffer({"safety_buffer": 0}, default_buffer=2) == 0
    assert effective_safety_buffer({"safety_buffer": None}, default_buffer=0) == 0


def test_set_and_delta_adjustments_preserve_a_non_negative_integer_ledger() -> None:
    assert calculate_adjusted_quantity(8, "set", 12) == 12
    assert calculate_adjusted_quantity(8, "delta", -3) == 5
    with pytest.raises(ValueError, match="cannot be negative"):
        calculate_adjusted_quantity(1, "delta", -2)
    with pytest.raises(ValueError, match="cannot be negative"):
        calculate_adjusted_quantity(1, "set", 1.5)


def test_boolean_is_not_an_integer_quantity() -> None:
    """Number.isInteger(true) is false; isinstance(True, int) is true in Python."""
    with pytest.raises(ValueError, match="cannot be negative"):
        calculate_adjusted_quantity(1, "set", True)


def test_low_stock_transitions_and_webhook_deltas_are_deterministic() -> None:
    assert is_low_stock(5, 5) is True
    assert is_low_stock(6, 5) is False
    assert webhook_adjustment_delta(7, 10) == -3
    assert webhook_adjustment_delta(10, 10) == 0


def test_webhook_delta_truncates_toward_zero_like_math_trunc() -> None:
    """`//` floors toward -inf (-8); Math.trunc(-7.5) is -7."""
    assert webhook_adjustment_delta(-7.5, 0) == -7
    assert webhook_adjustment_delta(7.9, 0) == 7


def test_bundle_recipes_reject_cycles_duplicates_nested_bundles_and_invalid_units() -> None:
    validate_bundle_recipe(
        {
            "bundle_item_id": 10,
            "components": [{"item_id": 11, "units": 2}, {"item_id": 12, "units": 1}],
        }
    )
    with pytest.raises(ValueError, match="cannot contain itself"):
        validate_bundle_recipe(
            {"bundle_item_id": 10, "components": [{"item_id": 10, "units": 1}]}
        )
    with pytest.raises(ValueError, match="only once"):
        validate_bundle_recipe(
            {
                "bundle_item_id": 10,
                "components": [{"item_id": 11, "units": 1}, {"item_id": 11, "units": 2}],
            }
        )
    with pytest.raises(ValueError, match="Nested bundles"):
        validate_bundle_recipe(
            {
                "bundle_item_id": 10,
                "components": [{"item_id": 11, "units": 1, "kind": "bundle"}],
            }
        )
    with pytest.raises(ValueError, match="positive whole numbers"):
        validate_bundle_recipe(
            {"bundle_item_id": 10, "components": [{"item_id": 11, "units": 0}]}
        )


def test_low_stock_email_suppression_lasts_exactly_24_hours() -> None:
    now = datetime(2026, 7, 26, 12, 0, 0, tzinfo=UTC)
    assert should_send_low_stock_email(None, now) is True
    assert should_send_low_stock_email(datetime(2026, 7, 25, 12, 0, 1, tzinfo=UTC), now) is False
    assert should_send_low_stock_email(datetime(2026, 7, 25, 12, 0, 0, tzinfo=UTC), now) is True


def test_low_stock_email_accepts_naive_datetimes_as_utc() -> None:
    now = datetime(2026, 7, 26, 12, 0, 0, tzinfo=UTC)
    naive = datetime(2026, 7, 25, 12, 0, 0)
    assert should_send_low_stock_email(naive, now) is True
    assert should_send_low_stock_email(naive + timedelta(seconds=1), now) is False


def test_shopify_bulk_jsonl_imports_10000_variants_at_the_selected_location() -> None:
    location_id = "gid://shopify/Location/44"
    lines: list[str] = []
    for index in range(1, 10_001):
        inventory_item_id = f"gid://shopify/InventoryItem/{index}"
        lines.append(
            json.dumps(
                {
                    "id": inventory_item_id,
                    "sku": f"SKU-{index}",
                    "tracked": True,
                    "variant": {
                        "id": f"gid://shopify/ProductVariant/{index}",
                        "title": f"Variant {index}",
                        "product": {
                            "id": f"gid://shopify/Product/{((index + 4) // 5)}",
                            "title": f"Product {((index + 4) // 5)}",
                            "status": "ACTIVE",
                        },
                    },
                }
            )
        )
        lines.append(
            json.dumps(
                {
                    "id": f"gid://shopify/InventoryLevel/{index}",
                    "__parentId": inventory_item_id,
                    "location": {"id": location_id},
                    "quantities": [{"name": "available", "quantity": index % 17}],
                }
            )
        )

    records = parse_shopify_bulk_inventory_jsonl("\n".join(lines), location_id)
    assert len(records) == 10_000
    assert records[0]["quantity"] == 1
    assert records[9_999]["sku"] == "SKU-10000"
    assert records[9_999]["quantity"] == 10_000 % 17


def test_shopify_bulk_jsonl_reads_inline_levels_and_ignores_other_locations() -> None:
    location_id = "gid://shopify/Location/1"
    other = "gid://shopify/Location/2"
    lines = [
        json.dumps(
            {
                "id": "gid://shopify/InventoryItem/9",
                "sku": "INLINE",
                "tracked": True,
                "variant": {
                    "id": "gid://shopify/ProductVariant/9",
                    "title": "Default",
                    "product": {
                        "id": "gid://shopify/Product/9",
                        "title": "Hat",
                        "status": "ACTIVE",
                    },
                },
                "inventoryLevels": {
                    "nodes": [
                        {
                            "location": {"id": other},
                            "quantities": [{"name": "available", "quantity": 99}],
                        },
                        {
                            "location": {"id": location_id},
                            "quantities": [{"name": "available", "quantity": 4}],
                        },
                    ]
                },
            }
        ),
        json.dumps(
            {
                "id": "gid://shopify/InventoryLevel/other",
                "__parentId": "gid://shopify/InventoryItem/9",
                "location": {"id": other},
                "quantities": [{"name": "available", "quantity": 50}],
            }
        ),
    ]
    records = parse_shopify_bulk_inventory_jsonl("\n".join(lines), location_id)
    assert len(records) == 1
    assert records[0]["quantity"] == 4


def test_missing_quantity_floors_at_zero_and_negative_observed_is_clamped() -> None:
    location_id = "gid://shopify/Location/1"
    lines = [
        json.dumps(
            {
                "id": "gid://shopify/InventoryItem/1",
                "sku": "NONE",
                "variant": {
                    "id": "gid://shopify/ProductVariant/1",
                    "product": {"id": "gid://shopify/Product/1", "title": "X"},
                },
            }
        ),
        json.dumps(
            {
                "id": "gid://shopify/InventoryLevel/1",
                "__parentId": "gid://shopify/InventoryItem/1",
                "location": {"id": location_id},
                "quantities": [{"name": "available", "quantity": -3}],
            }
        ),
    ]
    records = parse_shopify_bulk_inventory_jsonl("\n".join(lines), location_id)
    assert records[0]["quantity"] == 0
