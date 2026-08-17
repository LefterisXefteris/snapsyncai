"""Image persistence — port of the image half of `server/storage.ts`."""

from __future__ import annotations

import base64
from decimal import Decimal, InvalidOperation

import httpx
from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.image import Image

LIST_COLUMNS = (
    Image.id,
    Image.original_name,
    Image.mime_type,
    Image.size,
    Image.storage_url,
    Image.title,
    Image.description,
    Image.price,
    Image.category,
    Image.main_category,
    Image.product_type,
    Image.tags,
    Image.seo_title,
    Image.seo_description,
    Image.alt_text,
    Image.aeo_snippet,
    Image.variants,
    Image.compare_at_price,
    Image.cost_per_item,
    Image.sku,
    Image.barcode,
    Image.track_quantity,
    Image.inventory_quantity,
    Image.media_gallery,
    Image.collections,
    Image.shopify_product_id,
    Image.shopify_status,
    Image.payment_status,
    Image.product_facts,
    Image.product_group_id,
    Image.session_id,
    Image.created_at,
)


def _require_session(session_id: str) -> None:
    if not session_id:
        raise ValueError("image lookup called without a sessionId — would return all users' data")


def _as_decimal(value: str | None) -> Decimal | None:
    if value is None:
        return None
    try:
        return Decimal(value)
    except (InvalidOperation, TypeError) as exc:
        raise ValueError(f"invalid decimal: {value}") from exc


def media_gallery_order(group: list[Image], preferred_image_id: int | None = None) -> list[int]:
    preferred = next((img for img in group if img.id == preferred_image_id), None)
    source = None
    for img in ([preferred] if preferred else []) + group:
        if img and img.media_gallery:
            source = img
            break
    if source is None or not source.media_gallery:
        return []
    group_ids = {img.id for img in group if img.id is not None}
    ordered: list[int] = []
    for raw in source.media_gallery:
        try:
            image_id = int(raw)
        except (TypeError, ValueError):
            continue
        if image_id in group_ids:
            ordered.append(image_id)
    return ordered


async def list_images(session: AsyncSession, session_id: str) -> list[Image]:
    _require_session(session_id)
    result = await session.execute(
        select(*LIST_COLUMNS)
        .where(Image.session_id == session_id)
        .order_by(Image.created_at.desc())
    )
    return [Image(**row._mapping) for row in result]


async def get_image(session: AsyncSession, image_id: int) -> Image | None:
    return await session.get(Image, image_id)


async def get_images_by_ids(session: AsyncSession, ids: list[int]) -> list[Image]:
    if not ids:
        return []
    result = await session.execute(select(Image).where(Image.id.in_(ids)))
    return list(result.scalars().all())


async def get_image_group(session: AsyncSession, image_id: int, session_id: str) -> list[Image]:
    _require_session(session_id)
    result = await session.execute(
        select(Image.id, Image.product_group_id, Image.session_id).where(
            Image.id == image_id, Image.session_id == session_id
        )
    )
    row = result.one_or_none()
    if row is None:
        return []
    if not row.product_group_id:
        listed = await session.execute(
            select(*LIST_COLUMNS).where(Image.id == image_id, Image.session_id == session_id)
        )
        return [Image(**r._mapping) for r in listed]

    listed = await session.execute(
        select(*LIST_COLUMNS)
        .where(Image.product_group_id == row.product_group_id, Image.session_id == session_id)
        .order_by(Image.id)
    )
    group = [Image(**r._mapping) for r in listed]
    ordered_ids = media_gallery_order(group, image_id)
    if not ordered_ids:
        return group
    rank = {image_id: index for index, image_id in enumerate(ordered_ids)}
    return sorted(
        group,
        key=lambda img: (rank.get(img.id, 10**9), img.id or 0),
    )


async def update_images_by_group_id(session: AsyncSession, group_id: str, updates: dict) -> None:
    await session.execute(update(Image).where(Image.product_group_id == group_id).values(**updates))


async def persist_product_facts(
    session: AsyncSession, image: Image, facts_record: dict
) -> Image | None:
    """Write one facts record onto the product (all grouped photos, or this standalone)."""
    if image.product_group_id:
        await update_images_by_group_id(
            session, image.product_group_id, {"product_facts": facts_record}
        )
        await session.flush()
        return await get_image(session, image.id) if image.id is not None else image
    if image.id is None:
        return image
    return await update_image(session, image.id, {"product_facts": facts_record})


async def update_image(session: AsyncSession, image_id: int, updates: dict) -> Image | None:
    payload = dict(updates)
    for key in ("price", "compare_at_price", "cost_per_item"):
        if key in payload and isinstance(payload[key], str):
            payload[key] = _as_decimal(payload[key])
    if not payload:
        return await get_image(session, image_id)
    await session.execute(update(Image).where(Image.id == image_id).values(**payload))
    await session.flush()
    return await get_image(session, image_id)


async def delete_image(session: AsyncSession, image_id: int) -> None:
    await session.execute(delete(Image).where(Image.id == image_id))


async def delete_images_by_group_id(session: AsyncSession, group_id: str, session_id: str) -> int:
    result = await session.execute(
        delete(Image)
        .where(Image.product_group_id == group_id, Image.session_id == session_id)
        .returning(Image.id)
    )
    return len(result.all())


async def create_image(session: AsyncSession, values: dict) -> Image:
    image = Image(**values)
    session.add(image)
    await session.flush()
    await session.refresh(image)
    return image


async def load_image_bytes(image: Image) -> bytes | None:
    from app.services.image_buffers import get_image_buffer, set_image_buffer

    if image.id is not None:
        cached = get_image_buffer(image.id)
        if cached:
            return cached
    if image.image_data:
        return base64.b64decode(image.image_data)
    if image.storage_url:
        try:
            async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
                response = await client.get(image.storage_url)
                if response.is_success:
                    if image.id is not None:
                        set_image_buffer(image.id, response.content)
                    return response.content
        except httpx.HTTPError:
            return None
    return None
