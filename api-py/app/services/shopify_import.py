"""Channel product list for Import — Shopify Admin GraphQL, not Inventory Autopilot JSONL."""

from __future__ import annotations

from typing import Any

from app.config import Settings
from app.models import ShopifyConnection
from app.services.import_catalogue import ChannelProduct
from app.services.shopify import shopify_graphql

_PRODUCTS_QUERY = """
query SnapSyncImportProducts($cursor: String) {
  products(first: 50, after: $cursor) {
    pageInfo { hasNextPage endCursor }
    nodes {
      id
      title
      descriptionHtml
      tags
      status
      productType
      category { fullName }
      seo { title description }
      options {
        name
        optionValues { name }
      }
      media(first: 50) {
        nodes {
          ... on MediaImage {
            image { url }
          }
        }
      }
      variants(first: 1) {
        nodes {
          price
          compareAtPrice
          sku
          barcode
          inventoryItem {
            tracked
            unitCost { amount }
          }
        }
      }
      resourcePublicationsV2(first: 50) {
        nodes {
          isPublished
          publication { id }
        }
      }
    }
  }
}
"""


def _text(value: Any) -> str | None:
    if isinstance(value, str) and value.strip():
        return value
    return None


def _money(value: Any) -> str | None:
    if value is None or value == "":
        return None
    return str(value)


def _options(node: dict[str, Any]) -> tuple[tuple[str, tuple[str, ...]], ...]:
    options: list[tuple[str, tuple[str, ...]]] = []
    for option in node.get("options") or []:
        if not isinstance(option, dict):
            continue
        name = _text(option.get("name"))
        if not name:
            continue
        values: list[str] = []
        for entry in option.get("optionValues") or []:
            if isinstance(entry, dict) and _text(entry.get("name")):
                values.append(entry["name"])
        if not values:
            raw = option.get("values") or []
            values = [item for item in raw if isinstance(item, str) and item.strip()]
        if values:
            if name == "Title" and values == ["Default Title"]:
                continue
            options.append((name, tuple(values)))
    return tuple(options)


def _media_urls(node: dict[str, Any]) -> tuple[str, ...]:
    urls: list[str] = []
    for media in (node.get("media") or {}).get("nodes") or []:
        if not isinstance(media, dict):
            continue
        image = media.get("image") if isinstance(media.get("image"), dict) else {}
        url = _text(image.get("url"))
        if url:
            urls.append(url)
    return tuple(urls)


def _publication_ids(node: dict[str, Any]) -> tuple[str, ...]:
    ids: list[str] = []
    for entry in (node.get("resourcePublicationsV2") or {}).get("nodes") or []:
        if not isinstance(entry, dict) or not entry.get("isPublished"):
            continue
        publication = entry.get("publication") if isinstance(entry.get("publication"), dict) else {}
        publication_id = _text(publication.get("id"))
        if publication_id:
            ids.append(publication_id)
    return tuple(ids)


def _selling(node: dict[str, Any]) -> dict[str, Any]:
    variants = (node.get("variants") or {}).get("nodes") or []
    first = variants[0] if variants and isinstance(variants[0], dict) else {}
    item = first.get("inventoryItem") if isinstance(first.get("inventoryItem"), dict) else {}
    cost = item.get("unitCost") if isinstance(item.get("unitCost"), dict) else {}
    tracked = item.get("tracked")
    return {
        "price": _money(first.get("price")),
        "compare_at_price": _money(first.get("compareAtPrice")),
        "cost": _money(cost.get("amount")),
        "sku": _text(first.get("sku")),
        "barcode": _text(first.get("barcode")),
        "track_quantity": tracked if isinstance(tracked, bool) else None,
    }


def channel_product_from_shopify(node: dict[str, Any]) -> ChannelProduct | None:
    channel_id = _text(node.get("id"))
    if not channel_id:
        return None
    seo = node.get("seo") if isinstance(node.get("seo"), dict) else {}
    category = node.get("category") if isinstance(node.get("category"), dict) else {}
    selling = _selling(node)
    tags = node.get("tags") or []
    return ChannelProduct(
        channel_product_id=channel_id,
        title=_text(node.get("title")),
        description=node.get("descriptionHtml")
        if isinstance(node.get("descriptionHtml"), str)
        else None,
        tags=tuple(tag for tag in tags if isinstance(tag, str) and tag.strip()),
        seo_title=_text(seo.get("title")),
        seo_description=_text(seo.get("description")),
        category=_text(category.get("fullName")),
        product_type=_text(node.get("productType")),
        price=selling["price"],
        compare_at_price=selling["compare_at_price"],
        cost=selling["cost"],
        sku=selling["sku"],
        barcode=selling["barcode"],
        track_quantity=selling["track_quantity"],
        options=_options(node),
        media_urls=_media_urls(node),
        status="ACTIVE" if _text(node.get("status")) == "ACTIVE" else "DRAFT",
        publication_ids=_publication_ids(node),
    )


async def list_shopify_channel_products(
    connection: ShopifyConnection, settings: Settings
) -> list[ChannelProduct]:
    products: list[ChannelProduct] = []
    cursor: str | None = None
    while True:
        data = await shopify_graphql(
            connection, settings, _PRODUCTS_QUERY, {"cursor": cursor}
        )
        connection_data = data.get("products") or {}
        for node in connection_data.get("nodes") or []:
            if not isinstance(node, dict):
                continue
            product = channel_product_from_shopify(node)
            if product is not None:
                products.append(product)
        page = connection_data.get("pageInfo") or {}
        if not page.get("hasNextPage"):
            break
        cursor = page.get("endCursor")
        if not cursor:
            break
    return products
