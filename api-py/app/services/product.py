"""Product — the sellable thing across its photos, loaded and written as one.

Generate, confirm, accept, propose, grouping, and the Shop GPSR save all load a product
here. The rules stay in `product_facts`; this module owns the reads and writes around them.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Any, Literal

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Image
from app.services import connections
from app.services import images as store
from app.services.product_facts import (
    ProductFacts,
    confirm_facts,
    merge_product_facts,
    stale_for_shop_gpsr_save,
    stored_from_facts,
)

Refused = Literal["not_found", "invalid"]

PHOTO_NOT_FOUND = "Image not found"


@dataclass(frozen=True)
class Product:
    photo: Image
    photos: tuple[Image, ...]
    facts: ProductFacts
    shop_gpsr: dict | None
    listing_copy: dict


@dataclass(frozen=True)
class Confirmed:
    product: Image | None = None
    shop_gpsr: dict | None = None
    refused: Refused | None = None
    message: str | None = None


async def shop_gpsr(session: AsyncSession, user_id: str) -> dict | None:
    """The Shop GPSR identity of the seller's Shopify shop, if they saved one."""
    connection = await connections.get_shopify(session, user_id)
    identity = connection.gpsr_identity if connection is not None else None
    return identity if isinstance(identity, dict) else None


async def load(session: AsyncSession, user_id: str, product_id: int) -> Product | None:
    """This seller's product opened from `product_id`. None: not theirs, or gone."""
    photo = await store.get_image(session, product_id, user_id)
    if photo is None:
        return None
    photos = tuple(await store.get_image_group(session, product_id, user_id)) or (photo,)
    return Product(
        photo=photo,
        photos=photos,
        facts=merge_product_facts([img.product_facts for img in photos]),
        shop_gpsr=await shop_gpsr(session, user_id),
        listing_copy=store.listing_copy_from_images([photo, *photos]),
    )


async def confirm(
    session: AsyncSession,
    user_id: str,
    product_id: int,
    *,
    is_textile: bool | None = None,
    product_kind: str | None = None,
    composition: Sequence[Mapping[str, Any]] | None = None,
    gpsr_choice: str | None = None,
    gpsr_identity: Mapping[str, Any] | None = None,
    care_choice: str | None = None,
    care: Mapping[str, Any] | None = None,
    coffee_form: str | None = None,
    roast_level: str | None = None,
    net_weight: str | None = None,
    variant_net_weights: Sequence[Mapping[str, Any]] | None = None,
    coffee_origin_choice: str | None = None,
    coffee_origin: str | None = None,
    ingredients_list: str | None = None,
    allergen_statement: str | None = None,
) -> Confirmed:
    """The seller confirms product facts; they land on every photo of the product."""
    loaded = await load(session, user_id, product_id)
    if loaded is None:
        return Confirmed(refused="not_found", message=PHOTO_NOT_FOUND)
    result = confirm_facts(
        loaded.facts,
        is_textile=is_textile,
        product_kind=product_kind,
        composition=composition,
        gpsr_choice=gpsr_choice,
        gpsr_identity=gpsr_identity,
        shop_gpsr=loaded.shop_gpsr,
        care_choice=care_choice,
        care=care,
        coffee_form=coffee_form,
        roast_level=roast_level,
        net_weight=net_weight,
        variant_net_weights=variant_net_weights,
        coffee_origin_choice=coffee_origin_choice,
        coffee_origin=coffee_origin,
        ingredients_list=ingredients_list,
        allergen_statement=allergen_statement,
        listing_copy=loaded.listing_copy,
    )
    if not result.ok:
        return Confirmed(refused="invalid", message=result.error)
    updated = await store.persist_product_facts(
        session, loaded.photo, stored_from_facts(result.facts)
    )
    if updated is None:
        return Confirmed(refused="not_found", message=PHOTO_NOT_FOUND)
    return Confirmed(product=updated, shop_gpsr=loaded.shop_gpsr)


async def sync_facts_after_grouping(session: AsyncSession, user_id: str, product_id: int) -> None:
    """Photos just grouped share one facts record: the product's, merged across them."""
    loaded = await load(session, user_id, product_id)
    if loaded is None:
        return
    await store.persist_product_facts(session, loaded.photo, stored_from_facts(loaded.facts))


async def stale_shop_default_products(session: AsyncSession, user_id: str) -> None:
    """After Shop GPSR identity is saved: stale listing copy that used the shop default."""
    rows = await store.list_images(session, user_id)
    seen: set[str | int] = set()
    for image in rows:
        key: str | int | None = image.product_group_id or image.id
        if key is None or key in seen:
            continue
        seen.add(key)
        group = (
            [img for img in rows if img.product_group_id == image.product_group_id]
            if image.product_group_id
            else [image]
        )
        facts = merge_product_facts([img.product_facts for img in group])
        staled = stale_for_shop_gpsr_save(facts, store.listing_copy_from_images(group))
        if staled.listing_copy_stale != facts.listing_copy_stale:
            await store.persist_product_facts(session, image, stored_from_facts(staled))
