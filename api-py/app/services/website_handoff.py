"""Website prototype and Publish. SnapSync hosts the storefront. No Channel credentials."""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass, replace
from typing import Any, Literal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.models.website import PublishedWebsite, WebsitePrototypeRecord
from app.services import connections
from app.services import images as store
from app.services.plan import NEED_OVERFLOW_CONFIRM
from app.services.plan_charge import spend_when_landed
from app.services.product_facts import facts_from_stored, listing_copy_present, stored_from_facts
from app.services.shopify import list_shopify_product_image_urls, shopify_graphql_for
from app.services.supabase_storage import channel_photo_url

STOREFRONT_HOST = "sites.snapsyncai.co.uk"
PALETTES = frozenset({"ground", "ink", "clay"})
TYPE_PAIRINGS = frozenset({"sans", "serif"})

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


class PublishError(ValueError):
    """Seller-facing reason this Website cannot be previewed or published."""


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
class Storefront:
    handle: str
    host: str
    shop_name: str
    palette: str
    type_pairing: str
    products: tuple[dict[str, Any], ...]


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


def shop_handle(shop_domain: str) -> str:
    domain = shop_domain.strip().lower()
    suffix = ".myshopify.com"
    if not domain.endswith(suffix):
        raise PublishError("Shopify is not connected")
    handle = domain[: -len(suffix)]
    if not handle or "." in handle:
        raise PublishError("Shopify is not connected")
    return handle


def assemble_storefront(
    *,
    shop_domain: str,
    shop_name: str | None,
    palette: str,
    type_pairing: str,
    products: Sequence[WebsiteProduct],
    product_ids: Sequence[int],
) -> Storefront:
    handle = shop_handle(shop_domain)
    if palette not in PALETTES:
        raise PublishError("Pick a palette: Ground, Ink, or Clay")
    if type_pairing not in TYPE_PAIRINGS:
        raise PublishError("Pick a type: sans, or a serif for the hero and product titles")
    by_id = {product.id: product for product in products}
    chosen: list[dict[str, Any]] = []
    seen: set[int] = set()
    for product_id in product_ids:
        product = by_id.get(product_id)
        if product is None or product_id in seen:
            continue
        seen.add(product_id)
        chosen.append(snapshot_product(product))
    if not chosen:
        raise PublishError("Pick products that are pushed to Shopify and have listing copy")
    name = (shop_name or "").strip() or handle
    return Storefront(
        handle=handle,
        host=f"{handle}.{STOREFRONT_HOST}",
        shop_name=name,
        palette=palette,
        type_pairing=type_pairing,
        products=tuple(chosen),
    )


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


PublishRefused = Literal["not_connected", "plan_blocked", "overflow_confirm", "invalid"]


@dataclass(frozen=True)
class Published:
    storefront: Storefront | None = None
    spent: bool = False
    refused: PublishRefused | None = None
    message: str | None = None


def _storefront_from_row(row: PublishedWebsite) -> Storefront:
    products = row.products if isinstance(row.products, list) else []
    return Storefront(
        handle=row.handle,
        host=f"{row.handle}.{STOREFRONT_HOST}",
        shop_name=row.shop_name,
        palette=row.palette,
        type_pairing=row.type_pairing,
        products=tuple(products),
    )


async def _row_for_seller(session: AsyncSession, user_id: str) -> PublishedWebsite | None:
    result = await session.execute(
        select(PublishedWebsite).where(PublishedWebsite.session_id == user_id)
    )
    return result.scalar_one_or_none()


async def published_storefront(session: AsyncSession, handle: str) -> Storefront | None:
    result = await session.execute(
        select(PublishedWebsite).where(PublishedWebsite.handle == handle)
    )
    row = result.scalar_one_or_none()
    if row is None:
        return None
    return _storefront_from_row(row)


async def _draft(
    session: AsyncSession,
    settings: Settings,
    user_id: str,
    *,
    palette: str,
    type_pairing: str,
    product_ids: Sequence[int],
) -> tuple[Published, Storefront | None]:
    connection = await connections.get_shopify(session, user_id)
    if connection is None:
        return Published(refused="not_connected", message="Shopify is not connected"), None
    images = await store.list_images(session, user_id)
    eligible = await with_channel_photos(
        connection, settings, eligible_products(photos_from_images(images))
    )
    try:
        site = assemble_storefront(
            shop_domain=connection.shop_domain,
            shop_name=connection.shop_name,
            palette=palette,
            type_pairing=type_pairing,
            products=eligible,
            product_ids=product_ids,
        )
    except PublishError as exc:
        return Published(refused="invalid", message=str(exc)), None
    return Published(), site


async def preview_website(
    session: AsyncSession,
    settings: Settings,
    user_id: str,
    *,
    palette: str,
    type_pairing: str,
    product_ids: Sequence[int],
) -> Published:
    """The page the seller is about to publish. Nothing is stored and nothing is spent."""
    refused, site = await _draft(
        session,
        settings,
        user_id,
        palette=palette,
        type_pairing=type_pairing,
        product_ids=product_ids,
    )
    if site is None:
        return refused
    return Published(storefront=site, spent=False)


async def publish_website(
    session: AsyncSession,
    settings: Settings,
    user_id: str,
    *,
    palette: str,
    type_pairing: str,
    product_ids: Sequence[int],
    confirm_overflow: bool = False,
) -> Published:
    """Put this shop's Website on its SnapSync address. The first landing spends one use."""
    connection = await connections.get_shopify(session, user_id)
    if connection is None:
        return Published(refused="not_connected", message="Shopify is not connected")
    existing = await _row_for_seller(session, user_id)
    refused, site = await _draft(
        session,
        settings,
        user_id,
        palette=palette,
        type_pairing=type_pairing,
        product_ids=product_ids,
    )
    if site is None:
        return refused

    def fill(row: PublishedWebsite) -> None:
        row.shop_domain = connection.shop_domain
        row.handle = site.handle
        row.shop_name = site.shop_name
        row.palette = site.palette
        row.type_pairing = site.type_pairing
        row.products = list(site.products)

    if existing is not None:
        fill(existing)
        await session.flush()
        return Published(storefront=site, spent=False)

    async def write() -> Storefront:
        row = PublishedWebsite(
            session_id=user_id,
            shop_domain=connection.shop_domain,
            handle=site.handle,
            shop_name=site.shop_name,
            palette=site.palette,
            type_pairing=site.type_pairing,
            products=list(site.products),
        )
        session.add(row)
        await session.flush()
        return site

    try:
        landed = await spend_when_landed(
            session,
            settings,
            user_id,
            "website_handoff",
            write,
            confirm_overflow=confirm_overflow,
        )
    except PublishError as exc:
        return Published(refused="invalid", message=str(exc))
    if landed.refused:
        refused_kind = (
            "overflow_confirm" if landed.refused == NEED_OVERFLOW_CONFIRM else "plan_blocked"
        )
        return Published(refused=refused_kind, message=landed.refused)
    return Published(storefront=landed.result, spent=landed.spent)


@dataclass(frozen=True)
class SavedPrototype:
    product_ids: tuple[int, ...]
    brief: str
    look: None = None


async def _eligible_by_id(session: AsyncSession, user_id: str) -> dict[int, WebsiteProduct]:
    images = await store.list_images(session, user_id)
    return {product.id: product for product in eligible_products(photos_from_images(images))}


def _kept_ids(
    product_ids: Sequence[int], eligible: Mapping[int, WebsiteProduct]
) -> tuple[int, ...]:
    kept: list[int] = []
    seen: set[int] = set()
    for product_id in product_ids:
        if product_id in eligible and product_id not in seen:
            kept.append(int(product_id))
            seen.add(int(product_id))
    return tuple(kept)


async def _prototype_row(session: AsyncSession, user_id: str) -> WebsitePrototypeRecord | None:
    return (
        await session.execute(
            select(WebsitePrototypeRecord).where(WebsitePrototypeRecord.session_id == user_id)
        )
    ).scalar_one_or_none()


async def save_website_prototype(
    session: AsyncSession,
    _settings: Settings,
    user_id: str,
    *,
    product_ids: Sequence[int],
    brief: str,
) -> SavedPrototype:
    kept = _kept_ids(product_ids, await _eligible_by_id(session, user_id))
    text = brief.strip()
    row = await _prototype_row(session, user_id)
    if row is None:
        row = WebsitePrototypeRecord(
            session_id=user_id, product_ids=list(kept), brief=text, look=None
        )
        session.add(row)
    else:
        row.product_ids = list(kept)
        row.brief = text
    await session.flush()
    return SavedPrototype(product_ids=kept, brief=text)


async def saved_website_prototype(
    session: AsyncSession, _settings: Settings, user_id: str
) -> SavedPrototype:
    row = await _prototype_row(session, user_id)
    if row is None:
        return SavedPrototype(product_ids=(), brief="")
    stored = row.product_ids if isinstance(row.product_ids, list) else []
    ids = [int(item) for item in stored if isinstance(item, int)]
    kept = _kept_ids(ids, await _eligible_by_id(session, user_id))
    text = row.brief if isinstance(row.brief, str) else ""
    if list(kept) != ids:
        row.product_ids = list(kept)
        await session.flush()
    return SavedPrototype(product_ids=kept, brief=text)


async def publish_saved_website(
    session: AsyncSession, settings: Settings, user_id: str
) -> Published:
    await saved_website_prototype(session, settings, user_id)
    return Published(refused="invalid", message="A look has to come back before Publish.")
