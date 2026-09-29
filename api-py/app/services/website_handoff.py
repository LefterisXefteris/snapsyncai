"""Website prototype → Lovable handoff. No Channel, no Shopify credentials."""

from __future__ import annotations

import json
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, replace
from typing import Any, Literal
from urllib.parse import urlencode

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.services import connections
from app.services import images as store
from app.services.plan import NEED_OVERFLOW_CONFIRM
from app.services.plan_charge import spend_when_landed
from app.services.product_facts import facts_from_stored, listing_copy_present, stored_from_facts
from app.services.shopify import list_shopify_product_image_urls, shopify_graphql_for
from app.services.supabase_storage import channel_photo_url

LOVABLE_BUILD_ORIGIN = "https://lovable.dev/"
PROMPT_CHAR_LIMIT = 50_000

SNAPSHOT_KEYS = frozenset(
    {
        "id",
        "shopifyProductId",
        "title",
        "description",
        "tags",
        "seoTitle",
        "seoDescription",
        "aeoSnippet",
        "aeoFaqs",
        "photoUrls",
        "confirmedFacts",
    }
)


class HandoffError(ValueError):
    """Seller-facing reason the website cannot be handed to Lovable."""


@dataclass(frozen=True)
class WebsitePhoto:
    id: int
    product_group_id: str | None
    shopify_product_id: str | None
    title: str | None
    description: str | None
    tags: tuple[str, ...] | None
    seo_title: str | None
    seo_description: str | None
    aeo_snippet: str | None
    aeo_faqs: Any
    storage_url: str | None
    product_facts: Mapping[str, Any] | None


@dataclass(frozen=True)
class WebsiteProduct:
    id: int
    shopify_product_id: str
    title: str | None
    description: str | None
    tags: tuple[str, ...]
    seo_title: str | None
    seo_description: str | None
    aeo_snippet: str | None
    aeo_faqs: Any
    photo_urls: tuple[str, ...]
    confirmed_facts: Mapping[str, Any] | None


@dataclass(frozen=True)
class WebsiteHandoff:
    lovable_url: str
    product_count: int


def _first_text(photos: Sequence[WebsitePhoto], attr: str) -> str | None:
    for photo in photos:
        value = getattr(photo, attr)
        if isinstance(value, str) and value.strip():
            return value
    return None


def _product_from_group(photos: Sequence[WebsitePhoto]) -> WebsiteProduct | None:
    ranked = sorted(
        photos,
        key=lambda photo: (0 if (photo.description or photo.title) else 1, photo.id),
    )
    shopify_product_id = next((p.shopify_product_id for p in ranked if p.shopify_product_id), None)
    listing = {
        "title": _first_text(ranked, "title"),
        "description": _first_text(ranked, "description"),
        "tags": next((list(p.tags) for p in ranked if p.tags), []),
        "seo_title": _first_text(ranked, "seo_title"),
        "seo_description": _first_text(ranked, "seo_description"),
        "aeo_snippet": _first_text(ranked, "aeo_snippet"),
        "aeo_faqs": next((p.aeo_faqs for p in ranked if p.aeo_faqs), None),
    }
    if not shopify_product_id or not listing_copy_present(listing):
        return None
    urls: list[str] = []
    for photo in ranked:
        url = channel_photo_url(photo.storage_url)
        if url and url not in urls:
            urls.append(url)
    facts_source = next((p.product_facts for p in ranked if p.product_facts), None)
    confirmed = stored_from_facts(facts_from_stored(facts_source)).get("confirmed")
    tags = listing["tags"] if isinstance(listing["tags"], list) else []
    return WebsiteProduct(
        id=ranked[0].id,
        shopify_product_id=shopify_product_id,
        title=listing["title"],
        description=listing["description"],
        tags=tuple(str(tag) for tag in tags),
        seo_title=listing["seo_title"],
        seo_description=listing["seo_description"],
        aeo_snippet=listing["aeo_snippet"],
        aeo_faqs=listing["aeo_faqs"],
        photo_urls=tuple(urls),
        confirmed_facts=confirmed,
    )


def photos_from_images(images: Sequence[Any]) -> list[WebsitePhoto]:
    photos: list[WebsitePhoto] = []
    for image in images:
        tags = getattr(image, "tags", None)
        tag_tuple: tuple[str, ...] | None
        if tags is None:
            tag_tuple = None
        elif isinstance(tags, (list, tuple)):
            tag_tuple = tuple(str(tag) for tag in tags)
        else:
            tag_tuple = None
        photos.append(
            WebsitePhoto(
                id=int(image.id),
                product_group_id=getattr(image, "product_group_id", None),
                shopify_product_id=getattr(image, "shopify_product_id", None),
                title=getattr(image, "title", None),
                description=getattr(image, "description", None),
                tags=tag_tuple,
                seo_title=getattr(image, "seo_title", None),
                seo_description=getattr(image, "seo_description", None),
                aeo_snippet=getattr(image, "aeo_snippet", None),
                aeo_faqs=getattr(image, "aeo_faqs", None),
                storage_url=getattr(image, "storage_url", None),
                product_facts=getattr(image, "product_facts", None),
            )
        )
    return photos


def eligible_products(photos: Sequence[WebsitePhoto]) -> list[WebsiteProduct]:
    groups: dict[str, list[WebsitePhoto]] = {}
    order: list[str] = []
    for photo in photos:
        key = photo.product_group_id or f"solo:{photo.id}"
        if key not in groups:
            groups[key] = []
            order.append(key)
        groups[key].append(photo)
    products: list[WebsiteProduct] = []
    for key in order:
        product = _product_from_group(groups[key])
        if product is not None:
            products.append(product)
    return products


def snapshot_product(product: WebsiteProduct) -> dict[str, Any]:
    snap = {
        "id": product.id,
        "shopifyProductId": product.shopify_product_id,
        "title": product.title,
        "description": product.description,
        "tags": list(product.tags),
        "seoTitle": product.seo_title,
        "seoDescription": product.seo_description,
        "aeoSnippet": product.aeo_snippet,
        "aeoFaqs": product.aeo_faqs,
        "photoUrls": list(product.photo_urls),
        "confirmedFacts": product.confirmed_facts,
    }
    assert set(snap) == SNAPSHOT_KEYS
    return snap


def _prompt(
    *,
    shop_domain: str,
    look: str,
    snapshots: list[dict[str, Any]],
    shop_gpsr: Mapping[str, Any] | None,
) -> str:
    look_line = look.strip() or "No extra look notes. Follow the listing copy voice."
    catalogue = json.dumps(snapshots, ensure_ascii=True, separators=(",", ":"))
    gpsr_line = ""
    if shop_gpsr:
        gpsr_line = (
            "Shop GPSR identity (use when a product uses the shop default; "
            f"do not invent): {json.dumps(shop_gpsr, ensure_ascii=True)}\n"
        )
    return (
        "Build a brand website / lookbook storefront for this textile seller.\n"
        f"Connect the existing Shopify shop at {shop_domain}. "
        "The seller will Install the Lovable Shopify app on that shop in Lovable. "
        "Do not ask them to paste API tokens or access tokens.\n"
        "Use the Shopify product ids below for add-to-cart and checkout. "
        "Checkout stays on Shopify.\n"
        "Product words (title, description, SEO, AEO, photos, confirmed facts) come from this "
        "SnapSync snapshot. Match that listing copy voice on homepage and about. "
        "Do not invent fibre percentages, care instructions, or GPSR identity.\n"
        f"{gpsr_line}"
        f"Look: {look_line}\n"
        f"Snapshot JSON: {catalogue}"
    )


def build_handoff(
    *,
    shop_domain: str,
    look: str,
    products: Sequence[WebsiteProduct],
    shop_gpsr: Mapping[str, Any] | None = None,
) -> WebsiteHandoff:
    domain = shop_domain.strip()
    if not domain:
        raise HandoffError("Shopify is not connected")
    if not products:
        raise HandoffError("Pick products that are pushed to Shopify and have listing copy")
    snapshots = [snapshot_product(product) for product in products]
    prompt = _prompt(
        shop_domain=domain, look=look, snapshots=snapshots, shop_gpsr=shop_gpsr
    )
    if len(prompt) > PROMPT_CHAR_LIMIT:
        raise HandoffError("Too many products for one website handoff. Pick fewer.")
    query = urlencode({"autosubmit": "true"})
    fragment = urlencode({"prompt": prompt})
    url = f"{LOVABLE_BUILD_ORIGIN}?{query}#{fragment}"
    lowered = url.lower()
    if "shpat_" in lowered or "shpss_" in lowered or "access_token" in lowered:
        raise HandoffError("Website handoff refused to include Shopify credentials")
    return WebsiteHandoff(lovable_url=url, product_count=len(products))


async def with_channel_photos(
    connection, settings: Settings, products: list[WebsiteProduct]
) -> list[WebsiteProduct]:
    if connection is None:
        return products
    graphql = shopify_graphql_for(connection, settings)
    filled: list[WebsiteProduct] = []
    for product in products:
        try:
            urls = await list_shopify_product_image_urls(graphql, product.shopify_product_id)
        except Exception:
            urls = ()
        filled.append(replace(product, photo_urls=urls) if urls else product)
    return filled


HandoffRefused = Literal["not_connected", "plan_blocked", "overflow_confirm", "invalid"]


@dataclass(frozen=True)
class HandedOff:
    handoff: WebsiteHandoff | None = None
    spent: bool = False
    refused: HandoffRefused | None = None
    message: str | None = None


async def hand_off_website(
    session: AsyncSession,
    settings: Settings,
    user_id: str,
    *,
    look: str,
    product_ids: Sequence[int],
    confirm_overflow: bool = False,
) -> HandedOff:
    """The website page and the conversation both hand off here; one Allowance use when it lands."""
    connection = await connections.get_shopify(session, user_id)
    if connection is None:
        return HandedOff(refused="not_connected", message="Shopify is not connected")
    images = await store.list_images(session, user_id)
    eligible = await with_channel_photos(
        connection, settings, eligible_products(photos_from_images(images))
    )
    wanted = set(product_ids)
    selected = [product for product in eligible if product.id in wanted]
    identity = connection.gpsr_identity

    async def build():
        return build_handoff(
            shop_domain=connection.shop_domain,
            look=look,
            products=selected,
            shop_gpsr=identity if isinstance(identity, dict) else None,
        )

    try:
        landed = await spend_when_landed(
            session, settings, user_id, "website_handoff", build, confirm_overflow=confirm_overflow
        )
    except HandoffError as exc:
        return HandedOff(refused="invalid", message=str(exc))
    if landed.refused:
        refused = "overflow_confirm" if landed.refused == NEED_OVERFLOW_CONFIRM else "plan_blocked"
        return HandedOff(refused=refused, message=landed.refused)
    return HandedOff(handoff=landed.result, spent=landed.spent)
