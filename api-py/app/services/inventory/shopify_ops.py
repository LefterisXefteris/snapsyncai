"""Shopify Admin GraphQL used by Inventory Autopilot.

Port of the inventory half of `server/shopifyAdmin.ts`. Product-create lives in
`app.services.shopify`; identity lives in `app.services.shopify_admin`.
"""

from __future__ import annotations

import re
from typing import Any

import httpx

from app.config import Settings
from app.models import ShopifyConnection
from app.services.inventory.errors import InventoryError
from app.services.shopify import shopify_graphql

_WEBHOOK_TOPICS = (
    "INVENTORY_LEVELS_UPDATE",
    "PRODUCTS_CREATE",
    "PRODUCTS_UPDATE",
    "PRODUCTS_DELETE",
    "LOCATIONS_DELETE",
    "BULK_OPERATIONS_FINISH",
    "APP_UNINSTALLED",
)


async def get_shopify_locations(
    connection: ShopifyConnection, settings: Settings
) -> list[dict[str, Any]]:
    data = await shopify_graphql(
        connection,
        settings,
        """
        query InventoryLocations {
          locations(first: 100, query: "active:true") {
            nodes { id name isActive }
          }
        }
        """,
    )
    nodes = ((data.get("locations") or {}).get("nodes")) or []
    return [location for location in nodes if location.get("isActive")]


async def start_shopify_catalog_bulk_import(
    connection: ShopifyConnection, settings: Settings
) -> dict[str, Any]:
    bulk_query = """{
    inventoryItems {
      id
      sku
      tracked
      variant {
        id
        title
        inventoryPolicy
        product { id title status }
      }
      inventoryLevels {
        id
        location { id name }
        quantities(names: ["available"]) { name quantity }
      }
    }
  }"""
    data = await shopify_graphql(
        connection,
        settings,
        """
        mutation StartInventoryCatalogImport($query: String!) {
          bulkOperationRunQuery(query: $query) {
            bulkOperation { id status }
            userErrors { field message }
          }
        }
        """,
        {"query": bulk_query},
    )
    result = data["bulkOperationRunQuery"]
    errors = result.get("userErrors") or []
    if errors or not result.get("bulkOperation"):
        raise InventoryError(
            "; ".join(error.get("message", "") for error in errors)
            or "Shopify did not start the catalog import",
            502,
        )
    return result["bulkOperation"]


async def get_shopify_bulk_operation(
    connection: ShopifyConnection, settings: Settings, operation_id: str
) -> dict[str, Any]:
    data = await shopify_graphql(
        connection,
        settings,
        """
        query InventoryBulkOperation($id: ID!) {
          node(id: $id) {
            ... on BulkOperation {
              id status objectCount url partialDataUrl errorCode
            }
          }
        }
        """,
        {"id": operation_id},
    )
    node = data.get("node")
    if not node:
        raise InventoryError("Shopify catalog import no longer exists", 404)
    return node


async def download_bulk_jsonl(url: str) -> str:
    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.get(url)
        if not response.is_success:
            raise InventoryError(
                f"Could not download Shopify catalog import ({response.status_code})",
                502,
            )
        return response.text


async def get_shopify_inventory_quantity(
    connection: ShopifyConnection,
    settings: Settings,
    inventory_item_id: str,
    location_id: str,
) -> int:
    data = await shopify_graphql(
        connection,
        settings,
        """
        query CurrentInventoryQuantity($inventoryItemId: ID!, $locationId: ID!) {
          inventoryItem(id: $inventoryItemId) {
            inventoryLevel(locationId: $locationId) {
              quantities(names: ["available"]) { name quantity }
            }
          }
        }
        """,
        {"inventoryItemId": inventory_item_id, "locationId": location_id},
    )
    level = ((data.get("inventoryItem") or {}).get("inventoryLevel")) or {}
    quantity = next(
        (
            item.get("quantity")
            for item in (level.get("quantities") or [])
            if item.get("name") == "available"
        ),
        None,
    )
    if quantity is None:
        raise InventoryError("Shopify inventory level was not found", 404)
    return int(quantity)


async def set_shopify_inventory_quantity(
    connection: ShopifyConnection,
    settings: Settings,
    *,
    inventory_item_id: str,
    location_id: str,
    quantity: int,
    compare_quantity: int,
    idempotency_key: str,
) -> dict[str, Any] | None:
    data = await shopify_graphql(
        connection,
        settings,
        """
        mutation SetInventoryQuantity(
          $input: InventorySetQuantitiesInput!, $idempotencyKey: String!
        ) {
          inventorySetQuantities(input: $input) @idempotent(key: $idempotencyKey) {
            inventoryAdjustmentGroup {
              changes { name delta quantityAfterChange }
            }
            userErrors { code field message }
          }
        }
        """,
        {
            "idempotencyKey": idempotency_key,
            "input": {
                "name": "available",
                "reason": "correction",
                "referenceDocumentUri": f"snapsync://inventory/{idempotency_key}",
                "quantities": [
                    {
                        "inventoryItemId": inventory_item_id,
                        "locationId": location_id,
                        "quantity": quantity,
                        "changeFromQuantity": compare_quantity,
                    }
                ],
            },
        },
    )
    result = data["inventorySetQuantities"]
    errors = result.get("userErrors") or []
    if errors:
        mismatch = any(
            error.get("code") in {"CHANGE_FROM_QUANTITY_STALE", "COMPARE_QUANTITY_STALE"}
            for error in errors
        )
        raise InventoryError(
            "; ".join(error.get("message", "") for error in errors),
            409,
            compare_mismatch=mismatch,
        )
    return result.get("inventoryAdjustmentGroup")


async def register_inventory_webhooks(
    connection: ShopifyConnection, settings: Settings, callback_url: str
) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    for topic in _WEBHOOK_TOPICS:
        data = await shopify_graphql(
            connection,
            settings,
            """
            mutation RegisterInventoryWebhook(
              $topic: WebhookSubscriptionTopic!,
              $subscription: WebhookSubscriptionInput!
            ) {
              webhookSubscriptionCreate(topic: $topic, webhookSubscription: $subscription) {
                webhookSubscription { id topic }
                userErrors { message }
              }
            }
            """,
            {"topic": topic, "subscription": {"uri": callback_url, "format": "JSON"}},
        )
        created = data["webhookSubscriptionCreate"]
        errors = created.get("userErrors") or []
        if errors:
            already = all(
                re.search(r"already|taken", error.get("message", ""), re.I) for error in errors
            )
            if not already:
                raise InventoryError("; ".join(error.get("message", "") for error in errors), 502)
        subscription = created.get("webhookSubscription") or {}
        results.append({"topic": topic, "id": subscription.get("id")})
    return results


async def unregister_inventory_webhooks(
    connection: ShopifyConnection, settings: Settings, callback_url: str
) -> list[str]:
    data = await shopify_graphql(
        connection,
        settings,
        """
        query InventoryWebhookSubscriptions($uri: String!) {
          webhookSubscriptions(first: 100, uri: $uri) {
            nodes { id uri }
          }
        }
        """,
        {"uri": callback_url},
    )
    deleted: list[str] = []
    for subscription in ((data.get("webhookSubscriptions") or {}).get("nodes")) or []:
        result = await shopify_graphql(
            connection,
            settings,
            """
            mutation DeleteInventoryWebhook($id: ID!) {
              webhookSubscriptionDelete(id: $id) {
                deletedWebhookSubscriptionId
                userErrors { field message }
              }
            }
            """,
            {"id": subscription["id"]},
        )
        payload = result["webhookSubscriptionDelete"]
        errors = payload.get("userErrors") or []
        if errors:
            raise InventoryError("; ".join(error.get("message", "") for error in errors), 502)
        deleted_id = payload.get("deletedWebhookSubscriptionId")
        if deleted_id:
            deleted.append(deleted_id)
    return deleted


async def replace_shopify_bundle_components(
    connection: ShopifyConnection,
    settings: Settings,
    *,
    parent_variant_id: str,
    components: list[dict[str, Any]],
) -> None:
    mutation = """
        mutation UpdateInventoryBundle($input: [ProductVariantRelationshipUpdateInput!]!) {
          productVariantRelationshipBulkUpdate(input: $input) {
            parentProductVariants { id requiresComponents }
            userErrors { code field message }
          }
        }
    """
    remove_data = await shopify_graphql(
        connection,
        settings,
        mutation,
        {
            "input": [
                {
                    "parentProductVariantId": parent_variant_id,
                    "removeAllProductVariantRelationships": True,
                }
            ]
        },
    )
    remove_errors = remove_data["productVariantRelationshipBulkUpdate"].get("userErrors") or []
    if remove_errors:
        raise InventoryError("; ".join(error.get("message", "") for error in remove_errors), 502)
    if not components:
        return
    create_data = await shopify_graphql(
        connection,
        settings,
        mutation,
        {
            "input": [
                {
                    "parentProductVariantId": parent_variant_id,
                    "productVariantRelationshipsToCreate": [
                        {"id": component["variant_id"], "quantity": component["units"]}
                        for component in components
                    ],
                }
            ]
        },
    )
    errors = create_data["productVariantRelationshipBulkUpdate"].get("userErrors") or []
    if errors:
        raise InventoryError("; ".join(error.get("message", "") for error in errors), 502)


async def set_shopify_variant_inventory_policies(
    connection: ShopifyConnection,
    settings: Settings,
    *,
    product_id: str,
    variant_ids: list[str],
) -> None:
    if not variant_ids:
        return
    data = await shopify_graphql(
        connection,
        settings,
        """
        mutation ProtectInventoryVariants(
          $productId: ID!, $variants: [ProductVariantsBulkInput!]!
        ) {
          productVariantsBulkUpdate(productId: $productId, variants: $variants) {
            userErrors { field message }
          }
        }
        """,
        {
            "productId": product_id,
            "variants": [
                {"id": variant_id, "inventoryPolicy": "DENY"} for variant_id in variant_ids
            ],
        },
    )
    errors = data["productVariantsBulkUpdate"].get("userErrors") or []
    if errors:
        raise InventoryError("; ".join(error.get("message", "") for error in errors), 502)
