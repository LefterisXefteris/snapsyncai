"""Persist an imported Channel product as catalogue Image rows."""

from __future__ import annotations

import uuid
from decimal import Decimal, InvalidOperation
from urllib.parse import urlparse

from sqlalchemy.ext.asyncio import AsyncSession

from app.services import images as store
from app.services.import_catalogue import ImportProduct


def _money(value: str | None) -> Decimal | None:
    if value is None or value == "":
        return None
    try:
        return Decimal(value)
    except InvalidOperation:
        return None


def _photo_name(url: str) -> str:
    path = urlparse(url).path
    name = path.rsplit("/", 1)[-1] if path else ""
    return name or "photo.jpg"


def _primary_values(user_id: str, product: ImportProduct) -> dict:
    selling = product.selling
    copy = product.listing_copy
    values: dict = {
        "session_id": user_id,
        "title": copy.title,
        "description": copy.description,
        "tags": list(copy.tags) if copy.tags else None,
        "seo_title": copy.seo_title,
        "seo_description": copy.seo_description,
        "aeo_snippet": None,
        "aeo_faqs": None,
        "product_facts": None,
        "price": _money(selling.price),
        "compare_at_price": _money(selling.compare_at_price),
        "cost_per_item": _money(selling.cost),
        "sku": selling.sku,
        "barcode": selling.barcode,
        "variants": list(product.variants) if product.variants else None,
        "category": product.category,
        "product_type": product.product_type,
        "shopify_product_id": product.channel_product_id,
        "shopify_product_status": product.status,
        "shopify_publication_ids": list(product.publication_ids) or None,
        "shopify_status": "synced",
    }
    if selling.track_quantity is True:
        values["track_quantity"] = "true"
    elif selling.track_quantity is False:
        values["track_quantity"] = "false"
    return values


async def persist_imported_product(
    session: AsyncSession, user_id: str, product: ImportProduct
) -> None:
    async with session.begin_nested():
        urls = product.photo_urls
        group_id = str(uuid.uuid4()) if len(urls) > 1 else None
        primary = _primary_values(user_id, product)
        if not urls:
            await store.create_image(
                session,
                {
                    "original_name": "imported-product",
                    "mime_type": "application/octet-stream",
                    "size": 0,
                    **primary,
                },
            )
            return

        created_ids: list[int] = []
        for index, url in enumerate(urls):
            is_primary = index == 0
            values = {
                "original_name": _photo_name(url),
                "mime_type": "image/jpeg",
                "size": 0,
                "storage_url": url,
                "session_id": user_id,
                "product_group_id": group_id,
            }
            if is_primary:
                values.update(primary)
            image = await store.create_image(session, values)
            if image.id is not None:
                created_ids.append(image.id)
        if group_id and created_ids:
            gallery = [str(image_id) for image_id in created_ids]
            await store.update_images_by_group_id(
                session, group_id, {"media_gallery": gallery}
            )
