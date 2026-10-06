"""Push — write the seller's products to Shopify, and Go live (ADR 0023).

The route parses the body, finds the connection, keeps the seller's own products and
builds the transport. This checks listing copy and, for a storefront write, the price;
then per product reads Shopify, writes, sets available stock on a first landing on the
Online Store, registers the product with Inventory and stores the sync fields. Callers
map the result to HTTP.
"""

from __future__ import annotations

import logging
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Literal

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.models import Image
from app.schemas.image import PushResult
from app.services import images as store
from app.services.listing_copy_refresh import listing_copy_from_image
from app.services.product_facts import listing_copy_present
from app.services.shopify import (
    ShopifyGraphQL,
    list_shopify_publications,
    online_store_publication_id,
    price_greater_than_zero,
    product_publishing,
    push_product_to_shopify,
    set_storefront_available_stock,
    shopify_product_status,
)

STOREFRONT_PRICE_REQUIRED = "This product needs a price greater than zero."
RECONNECT_FOR_PUBLICATIONS = (
    "Reconnect Shopify in Settings to choose where this product is available."
)

logger = logging.getLogger(__name__)

Refused = Literal["missing_copy", "missing_price", "reconnect"]


@dataclass(frozen=True)
class Pushed:
    success: int = 0
    failed: int = 0
    results: tuple[PushResult, ...] = ()
    stock_not_set: bool = False
    refused: Refused | None = None
    message: str | None = None
    missing_copy_count: int = 0


def _push_status(product_status: str | None, image) -> str:
    return shopify_product_status(
        product_status if product_status is not None else image.shopify_product_status
    )


def _push_publication_ids(publication_ids: list[str] | None, image) -> list[str]:
    if publication_ids is not None:
        return list(publication_ids)
    return list(image.shopify_publication_ids or [])


def _page_quantity(image) -> int:
    raw = getattr(image, "inventory_quantity", None)
    try:
        quantity = int(raw if raw is not None else 0)
    except (TypeError, ValueError):
        return 0
    return max(0, quantity)


def _tracks_quantity(image) -> bool:
    return getattr(image, "track_quantity", None) != "false"


def _is_storefront_write(status: str, publication_ids: list[str], online_store: str | None) -> bool:
    return status == "ACTIVE" and online_store is not None and online_store in publication_ids


def _missing_storefront_price(
    product_status: str | None, publication_ids: list[str] | None, images, listed
) -> bool:
    """A storefront write needs a price greater than zero."""
    active = [image for image in images if _push_status(product_status, image) == "ACTIVE"]
    if not active:
        return False
    online_store = online_store_publication_id(listed)
    if online_store is None:
        return False
    return any(
        online_store in _push_publication_ids(publication_ids, image)
        and not price_greater_than_zero(image.price)
        for image in active
    )


async def _previously_on_online_store(image, graphql, online_store: str) -> bool | None:
    """Whether Shopify already has this product Active on the Online Store.

    None means the read failed, so stock must not be written over an unknown quantity.
    """
    product_id = getattr(image, "shopify_product_id", None)
    if not isinstance(product_id, str) or not product_id:
        return False
    try:
        status, published = await product_publishing(graphql, product_id)
    except Exception:
        logger.exception("Shopify publishing lookup failed before setting available stock")
        return None
    return shopify_product_status(status) == "ACTIVE" and online_store in published


async def _stock_location(session, graphql, user_id: str) -> str | None:
    from app.services.inventory.service import inventory_location_for_user
    from app.services.inventory.shopify_ops import get_shopify_locations

    chosen = await inventory_location_for_user(session, user_id)
    if chosen:
        return chosen
    locations = await get_shopify_locations(graphql)
    if not locations:
        return None
    location_id = locations[0].get("id")
    return location_id if isinstance(location_id, str) and location_id else None


async def _landing_available_stock(
    session, graphql, user_id, image, variants: list
) -> tuple[bool, int | None]:
    """Set available stock on a first storefront landing.

    Returns whether stock was not set, and the quantity written when it was.
    """
    if not _tracks_quantity(image):
        return False, None
    if len(variants) != 1:
        return True, None
    inventory_item = variants[0].get("inventoryItem") if isinstance(variants[0], dict) else None
    inventory_item_id = (
        (inventory_item or {}).get("id") if isinstance(inventory_item, dict) else None
    )
    if not isinstance(inventory_item_id, str) or not inventory_item_id:
        return True, None
    try:
        location_id = await _stock_location(session, graphql, user_id)
    except Exception:
        logger.exception("Could not choose a location for available stock")
        return True, None
    if not location_id:
        return True, None
    quantity = _page_quantity(image)
    try:
        await set_storefront_available_stock(
            graphql,
            inventory_item_id=inventory_item_id,
            location_id=location_id,
            quantity=quantity,
        )
    except Exception:
        logger.exception("Available stock was not set")
        return True, None
    return False, quantity


def _sort_group_by_media_gallery(group: list) -> None:
    source = next(
        (item for item in group if isinstance(item.media_gallery, list) and item.media_gallery),
        None,
    )
    ordered_ids = []
    if source is not None:
        for raw in source.media_gallery:
            try:
                ordered_ids.append(int(raw))
            except (TypeError, ValueError):
                continue
    rank = {image_id: index for index, image_id in enumerate(ordered_ids)}

    def key(item):
        item_rank = rank.get(item.id)
        if item_rank is not None or rank:
            return (item_rank if item_rank is not None else 10**9, item.id or 0)
        return (0 if item.description else 1, item.id or 0)

    group.sort(key=key)


async def push_products(
    session: AsyncSession,
    settings: Settings,
    graphql: ShopifyGraphQL,
    user_id: str,
    images: Sequence[Image],
    *,
    granted_scopes: list[str],
    product_status: str | None = None,
    publication_ids: list[str] | None = None,
) -> Pushed:
    """Push the seller's own `images`; status and publications default to each one's stored ones."""
    missing_copy = [
        img for img in images if not listing_copy_present(listing_copy_from_image(img))
    ]
    if missing_copy:
        return Pushed(
            refused="missing_copy",
            message=f"{len(missing_copy)} product(s) still need listing copy.",
            missing_copy_count=len(missing_copy),
        )

    listed = None
    if any(_push_status(product_status, image) == "ACTIVE" for image in images):
        try:
            listed = await list_shopify_publications(graphql)
        except Exception:
            logger.exception("Shopify publications lookup failed before push")
            return Pushed(refused="reconnect", message=RECONNECT_FOR_PUBLICATIONS)
        if _missing_storefront_price(product_status, publication_ids, images, listed):
            return Pushed(refused="missing_price", message=STOREFRONT_PRICE_REQUIRED)
    online_store = online_store_publication_id(listed or [])

    all_user_images = await store.list_images(session, user_id)
    group_map: dict[str, list] = {}
    for img in all_user_images:
        if img.product_group_id:
            group_map.setdefault(img.product_group_id, []).append(img)
    for group in group_map.values():
        _sort_group_by_media_gallery(group)

    processed_groups: set[str] = set()
    products: list[tuple] = []
    for img in images:
        if img.product_group_id:
            if img.product_group_id in processed_groups:
                continue
            processed_groups.add(img.product_group_id)
            group = group_map.get(img.product_group_id) or [img]
            products.append((group[0], group[1:]))
        else:
            products.append((img, []))

    full_map = {img.id: img for img in images}
    success = 0
    failed = 0
    stock_not_set = False
    results: list[PushResult] = []
    for primary, views in products:
        needed = [primary.id, *[view.id for view in views]]
        missing = [image_id for image_id in needed if image_id not in full_map]
        if missing:
            for img in await store.get_images_by_ids(session, missing, user_id):
                full_map[img.id] = img
        full_primary = full_map.get(primary.id) or primary
        view_images = [full_map.get(view.id) or view for view in views]
        desired_ids = _push_publication_ids(publication_ids, full_primary)
        desired_status = _push_status(product_status, full_primary)
        stored_id = getattr(full_primary, "shopify_product_id", None)
        # Read Shopify before the write. Afterwards the product is already on the store.
        previous = None
        landing = bool(
            online_store and _is_storefront_write(desired_status, desired_ids, online_store)
        )
        if landing and online_store:
            previous = await _previously_on_online_store(full_primary, graphql, online_store)
        result = await push_product_to_shopify(
            full_primary,
            graphql,
            settings,
            view_images,
            granted_scopes=granted_scopes,
            publication_ids=publication_ids,
            product_status=product_status,
        )
        if result.get("shopify_product_id"):
            from app.services.inventory.service import (
                drop_shopify_product_links,
                register_published_shopify_product,
            )

            if (
                isinstance(stored_id, str)
                and stored_id
                and stored_id != result["shopify_product_id"]
            ):
                await drop_shopify_product_links(session, user_id, stored_id)

            error = result.get("error")
            written: int | None = None
            if landing and not error:
                if previous is None:
                    stock_not_set = True
                elif previous is False:
                    missed, written = await _landing_available_stock(
                        session,
                        graphql,
                        user_id,
                        full_primary,
                        result.get("variants") or [],
                    )
                    stock_not_set = stock_not_set or missed

            await register_published_shopify_product(
                session,
                settings,
                user_id=user_id,
                image=full_primary,
                product_id=result["shopify_product_id"],
                variants=result.get("variants") or [],
                available_stock=written,
                queue_sync=False,
            )
            updates = {
                "shopify_product_id": result["shopify_product_id"],
                "shopify_status": "failed" if error else "synced",
                "shopify_product_status": desired_status,
            }
            if not error:
                updates["shopify_publication_ids"] = desired_ids
            if primary.product_group_id:
                await store.update_images_by_group_id(session, primary.product_group_id, updates)
            else:
                await store.update_image(session, primary.id, updates, user_id)
            if error:
                failed += 1
            else:
                success += 1
            results.append(
                PushResult(
                    id=primary.id, shopify_product_id=result["shopify_product_id"], error=error
                )
            )
        else:
            await store.update_image(session, primary.id, {"shopify_status": "failed"}, user_id)
            failed += 1
            results.append(PushResult(id=primary.id, error=result.get("error")))
    return Pushed(
        success=success, failed=failed, results=tuple(results), stock_not_set=stock_not_set
    )
