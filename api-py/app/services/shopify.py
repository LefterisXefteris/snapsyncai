"""Shopify Admin GraphQL — port of `server/shopifyAdmin.ts`."""

from __future__ import annotations

import asyncio
import logging
from typing import Any

import httpx

from app.config import Settings
from app.models import ShopifyConnection
from app.services.crypto import decrypt_shopify_token
from app.services.supabase_storage import media_original_source

logger = logging.getLogger(__name__)

SHOPIFY_API_VERSION = "2026-07"


def _token(connection: ShopifyConnection, settings: Settings) -> str:
    secret = settings.connection_encryption_key
    if not secret:
        if connection.access_token.startswith("enc:v1:"):
            raise RuntimeError(
                "CONNECTION_ENCRYPTION_KEY is required to decrypt Shopify credentials"
            )
        return connection.access_token
    return decrypt_shopify_token(connection.access_token, secret)


async def shopify_graphql(
    connection: ShopifyConnection,
    settings: Settings,
    query: str,
    variables: dict[str, Any] | None = None,
) -> dict[str, Any]:
    token = _token(connection, settings)
    endpoint = f"https://{connection.shop_domain}/admin/api/{SHOPIFY_API_VERSION}/graphql.json"
    payload = {"query": query, "variables": variables or {}}

    async with httpx.AsyncClient(timeout=60.0) as client:
        for attempt in range(3):
            response = await client.post(
                endpoint,
                headers={
                    "Content-Type": "application/json",
                    "X-Shopify-Access-Token": token,
                },
                json=payload,
            )
            if response.status_code == 429 or response.status_code >= 500:
                if attempt == 2:
                    raise RuntimeError(
                        f"Shopify GraphQL request failed with {response.status_code}"
                    )
                retry_after = float(response.headers.get("retry-after") or 0)
                await asyncio.sleep(retry_after if retry_after > 0 else 0.25 * (2**attempt))
                continue

            body = response.json()
            errors = body.get("errors") or []
            if not response.is_success or errors:
                message = "; ".join(e.get("message", "") for e in errors if e.get("message"))
                raise RuntimeError(
                    message or f"Shopify GraphQL request failed with {response.status_code}"
                )
            data = body.get("data")
            if not data:
                raise RuntimeError("Shopify returned an empty GraphQL response")
            return data

    raise RuntimeError("Shopify GraphQL request exhausted retries")


async def list_shopify_product_image_urls(
    connection: ShopifyConnection,
    settings: Settings,
    product_id: str,
) -> tuple[str, ...]:
    data = await shopify_graphql(
        connection,
        settings,
        """
        query SnapSyncProductMedia($id: ID!) {
          product(id: $id) {
            media(first: 50) {
              nodes {
                ... on MediaImage {
                  image { url }
                }
              }
            }
          }
        }
        """,
        {"id": product_id},
    )
    product = data.get("product") or {}
    nodes = ((product.get("media") or {}).get("nodes")) or []
    urls: list[str] = []
    for node in nodes:
        image = node.get("image") if isinstance(node, dict) else None
        url = image.get("url") if isinstance(image, dict) else None
        if isinstance(url, str) and url.startswith("https://") and url not in urls:
            urls.append(url)
    return tuple(urls)


def _price(value: Any) -> float:
    if value is None:
        return 0.0
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def shopify_product_status(value: str | None) -> str:
    if (value or "").strip().upper() == "ACTIVE":
        return "ACTIVE"
    return "DRAFT"


def publication_changes(
    desired: set[str], current: set[str]
) -> tuple[list[str], list[str]]:
    return sorted(desired - current), sorted(current - desired)


def publication_label(node: dict[str, Any]) -> str:
    catalog = node.get("catalog") if isinstance(node.get("catalog"), dict) else {}
    title = catalog.get("title") if isinstance(catalog, dict) else None
    name = node.get("name")
    if isinstance(title, str) and title.strip():
        return title
    if isinstance(name, str) and name.strip():
        return name
    return "Publication"


def _publication_nodes(data: dict[str, Any]) -> list[dict[str, Any]]:
    publications = data.get("publications") or {}
    nodes = publications.get("nodes")
    if isinstance(nodes, list):
        return [node for node in nodes if isinstance(node, dict) and node.get("id")]
    return []


async def list_shopify_publications(
    connection: ShopifyConnection, settings: Settings
) -> list[dict[str, str]]:
    data = await shopify_graphql(
        connection,
        settings,
        """
        query SnapSyncPublications {
          publications(first: 50) {
            nodes {
              id
              name
              catalog { title }
            }
          }
        }
        """,
    )
    return [
        {"id": node["id"], "name": publication_label(node)}
        for node in _publication_nodes(data)
    ]


async def product_publishing(
    connection: ShopifyConnection, settings: Settings, product_id: str
) -> tuple[str, set[str]]:
    data = await shopify_graphql(
        connection,
        settings,
        """
        query SnapSyncProductPublishing($id: ID!) {
          product(id: $id) {
            status
            resourcePublicationsV2(first: 50) {
              nodes {
                isPublished
                publication { id }
              }
            }
          }
        }
        """,
        {"id": product_id},
    )
    product = data.get("product") or {}
    status = shopify_product_status(product.get("status"))
    published: set[str] = set()
    for node in (product.get("resourcePublicationsV2") or {}).get("nodes") or []:
        if not isinstance(node, dict) or not node.get("isPublished"):
            continue
        publication = node.get("publication") or {}
        publication_id = publication.get("id")
        if isinstance(publication_id, str) and publication_id:
            published.add(publication_id)
    return status, published


async def apply_shopify_publications(
    connection: ShopifyConnection,
    settings: Settings,
    product_id: str,
    desired_ids: list[str],
) -> None:
    _status, current = await product_publishing(connection, settings, product_id)
    to_publish, to_unpublish = publication_changes(set(desired_ids), current)
    if to_publish:
        data = await shopify_graphql(
            connection,
            settings,
            """
            mutation SnapSyncPublish($id: ID!, $input: [PublicationInput!]!) {
              publishablePublish(id: $id, input: $input) {
                userErrors { field message }
              }
            }
            """,
            {
                "id": product_id,
                "input": [{"publicationId": publication_id} for publication_id in to_publish],
            },
        )
        errors = (data.get("publishablePublish") or {}).get("userErrors") or []
        if errors:
            raise RuntimeError("; ".join(e.get("message") or "" for e in errors))
    if to_unpublish:
        data = await shopify_graphql(
            connection,
            settings,
            """
            mutation SnapSyncUnpublish($id: ID!, $input: [PublicationInput!]!) {
              publishableUnpublish(id: $id, input: $input) {
                userErrors { field message }
              }
            }
            """,
            {
                "id": product_id,
                "input": [{"publicationId": publication_id} for publication_id in to_unpublish],
            },
        )
        errors = (data.get("publishableUnpublish") or {}).get("userErrors") or []
        if errors:
            raise RuntimeError("; ".join(e.get("message") or "" for e in errors))



async def create_shopify_product(
    connection: ShopifyConnection,
    settings: Settings,
    image: Any,
    view_images: list[Any] | None = None,
    *,
    publication_ids: list[str] | None = None,
    product_status: str | None = None,
) -> dict[str, Any]:
    image_variants = image.variants if isinstance(getattr(image, "variants", None), list) else []
    combinations: list[list[str]] = [[]]
    if image_variants:
        combinations = []
        for option in image_variants:
            values = (
                option.get("values") if isinstance(option, dict) else getattr(option, "values", [])
            )
            if not combinations:
                combinations = [[value] for value in values]
            else:
                combinations = [combo + [value] for combo in combinations for value in values]
    if len(combinations) > 2048:
        raise RuntimeError("Shopify supports at most 2048 variants per product")

    base_sku = str(getattr(image, "sku", None) or f"SS-{image.id}")
    product_set: dict[str, Any] = {}
    existing_id = getattr(image, "shopify_product_id", None)
    if isinstance(existing_id, str) and existing_id:
        product_set["id"] = existing_id
    product_set.update({
        "title": image.title or image.original_name or "Untitled product",
        "descriptionHtml": image.description or "",
        "productType": image.product_type or image.category or "Other",
        "tags": image.tags if isinstance(image.tags, list) else [],
        "status": shopify_product_status(
            product_status if product_status is not None else getattr(image, "shopify_product_status", None)
        ),
        "seo": {
            "title": image.seo_title or image.title or "",
            "description": image.seo_description or "",
        },
        "productOptions": [
            {
                "name": option.get("name") if isinstance(option, dict) else option.name,
                "position": index + 1,
                "values": [
                    {"name": value}
                    for value in (
                        option.get("values") if isinstance(option, dict) else option.values
                    )
                ],
            }
            for index, option in enumerate(image_variants)
        ],
        "variants": [
            {
                "optionValues": [
                    {
                        "optionName": (
                            image_variants[option_index].get("name")
                            if isinstance(image_variants[option_index], dict)
                            else image_variants[option_index].name
                        ),
                        "name": value,
                    }
                    for option_index, value in enumerate(combination)
                ],
                "price": _price(image.price),
                "compareAtPrice": _price(image.compare_at_price) or None,
                "barcode": image.barcode or None,
                "inventoryPolicy": "DENY",
                "inventoryItem": {
                    "sku": base_sku
                    if len(combinations) == 1
                    else f"{base_sku}-{variant_index + 1}",
                    "tracked": image.track_quantity != "false",
                    "cost": _price(image.cost_per_item) or None,
                },
            }
            for variant_index, combination in enumerate(combinations)
        ],
    })

    data = await shopify_graphql(
        connection,
        settings,
        """
        mutation CreateSnapSyncProduct($productSet: ProductSetInput!) {
          productSet(synchronous: true, input: $productSet) {
            product {
              id
              variants(first: 2048) {
                nodes { id sku inventoryItem { id tracked } }
              }
            }
            userErrors { field message }
          }
        }
        """,
        {"productSet": product_set},
    )
    errors = data["productSet"]["userErrors"]
    product = data["productSet"].get("product")
    if errors or not product:
        raise RuntimeError(
            "; ".join(e["message"] for e in errors) or "Shopify did not create the product"
        )

    media_sources = [image, *(view_images or [])]
    media = []
    for item in media_sources:
        source = media_original_source(getattr(item, "storage_url", None), settings)
        if source:
            media.append(
                {
                    "originalSource": source,
                    "alt": item.alt_text or item.title or item.original_name or "",
                    "mediaContentType": "IMAGE",
                }
            )
    if media:
        media_data = await shopify_graphql(
            connection,
            settings,
            """
            mutation AddSnapSyncProductMedia($productId: ID!, $media: [CreateMediaInput!]!) {
              productCreateMedia(productId: $productId, media: $media) {
                mediaUserErrors { field message }
              }
            }
            """,
            {"productId": product["id"], "media": media},
        )
        media_errors = media_data["productCreateMedia"]["mediaUserErrors"]
        if media_errors:
            logger.warning(
                "Shopify product created but media attachment failed: %s",
                "; ".join(e["message"] for e in media_errors),
            )
    desired_ids = (
        publication_ids
        if publication_ids is not None
        else list(getattr(image, "shopify_publication_ids", None) or [])
    )
    granted = connection.granted_scopes or []
    if all(scope in granted for scope in ("read_publications", "write_publications")):
        await apply_shopify_publications(connection, settings, product["id"], desired_ids)
    return product


async def push_product_to_shopify(
    image: Any,
    connection: ShopifyConnection,
    settings: Settings,
    view_images: list[Any] | None = None,
    *,
    publication_ids: list[str] | None = None,
    product_status: str | None = None,
) -> dict[str, Any]:
    try:
        product = await create_shopify_product(
            connection,
            settings,
            image,
            view_images,
            publication_ids=publication_ids,
            product_status=product_status,
        )
        return {
            "shopify_product_id": product["id"],
            "variants": product["variants"]["nodes"],
        }
    except Exception as exc:
        logger.exception("Shopify push error")
        return {"error": str(exc) or "Failed to push to Shopify"}

