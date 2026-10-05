"""Trendyol International — connect, the listing, Push, and approval.

One adapter for this Channel. Publications, Go live, Inventory Autopilot, Shop
GPSR, and the website stay Shopify-shaped. Callers pass a Trendyol account
(the live API, or an in-memory one in tests) and map the result to HTTP.
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Protocol

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.models.inventory import InventoryItem, InventorySettings
from app.models.trendyol import TrendyolBarcode, TrendyolConnection, TrendyolListing
from app.services import connections, product
from app.services.crypto import decrypt_shopify_token, encrypt_shopify_token
from app.services.inventory.core import calculate_sellable_quantity
from app.services.listing_copy_refresh import listing_copy_from_image
from app.services.product_facts import listing_copy_present
from app.services.supabase_storage import media_original_source

NEED_SHOPIFY = "Connect Shopify before Trendyol International."
TURKEY = "This Channel is not the Turkey marketplace."
REJECTED_ACCOUNT = "Trendyol refused these credentials."
NEED_CREDENTIALS = "Enter the seller id, API key, and API secret."
NEED_VAT = "Set a VAT rate for this storefront."
UNKNOWN_STOREFRONT = "That storefront is not on this account."
NO_STOREFRONT = "Trendyol did not return an origin storefront."
SETTINGS = "Connect Trendyol International in Settings."
NEED_CATEGORY = "This product needs a Trendyol category."
NEED_BRAND = "This product needs a Trendyol brand."
NEED_COPY = "This product needs listing copy."
NEED_TITLE = "This product needs a title."
NEED_DESCRIPTION = "This product needs a description."
NEED_BARCODE = "This product needs a barcode."
NEED_SKU = "This product needs a SKU."
NEED_SALE = "This product needs a sale price greater than zero."
NEED_LIST = "This product needs a list price."
LIST_BELOW = "The list price must be at least the sale price."
TURKEY_CODE = "TR"


@dataclass(frozen=True)
class Storefront:
    code: str
    currency: str


@dataclass(frozen=True)
class Credentials:
    seller_id: str
    api_key: str
    api_secret: str


@dataclass(frozen=True)
class Category:
    id: str
    name: str


@dataclass(frozen=True)
class Brand:
    id: str
    name: str


@dataclass(frozen=True)
class RequiredAttribute:
    id: str
    name: str
    choices: tuple[tuple[str, str], ...] = ()


@dataclass(frozen=True)
class AttributeValue:
    attribute_id: str
    value_id: str | None = None
    custom: str | None = None


@dataclass(frozen=True)
class ListingItem:
    barcode: str
    title: str
    description: str
    brand_id: str
    category_id: str
    stock_code: str
    list_price: Decimal
    sale_price: Decimal
    vat_rate: int
    currency: str
    images: tuple[str, ...]
    attributes: tuple[AttributeValue, ...]
    quantity: int | None
    model_code: str | None


@dataclass(frozen=True)
class Batch:
    accepted: bool
    reason: str | None = None


@dataclass(frozen=True)
class Decision:
    status: str
    reason: str | None = None


@dataclass(frozen=True)
class ListingDraft:
    category_id: str | None = None
    category_name: str | None = None
    brand_id: str | None = None
    brand_name: str | None = None
    attributes: tuple[AttributeValue, ...] = ()
    sale_price: Decimal | None = None
    list_price: Decimal | None = None


@dataclass(frozen=True)
class AttributeField:
    id: str
    name: str
    value_id: str | None
    custom: str | None
    choices: tuple[tuple[str, str], ...]


@dataclass(frozen=True)
class Link:
    available: bool
    connected: bool
    message: str | None = None
    storefront: str | None = None
    currency: str | None = None
    vat_rate: int | None = None
    storefronts: tuple[Storefront, ...] = ()


@dataclass(frozen=True)
class Page:
    connected: bool
    storefront: str | None = None
    currency: str | None = None
    vat_rate: int | None = None
    category_id: str | None = None
    category_name: str | None = None
    brand_id: str | None = None
    brand_name: str | None = None
    sale_price: str | None = None
    list_price: str | None = None
    attributes: tuple[AttributeField, ...] = ()
    approval: str | None = None
    reason: str | None = None
    push_wait: str | None = None


class TrendyolAccount(Protocol):
    async def storefronts_for(self, credentials: Credentials) -> tuple[Storefront, ...] | None: ...

    async def categories_for(
        self, credentials: Credentials, storefront: str
    ) -> tuple[Category, ...]: ...

    async def brands_for(
        self, credentials: Credentials, storefront: str, query: str
    ) -> tuple[Brand, ...]: ...

    async def required_attributes(
        self, credentials: Credentials, storefront: str, category_id: str
    ) -> tuple[RequiredAttribute, ...]: ...

    async def submit(
        self, credentials: Credentials, storefront: str, item: ListingItem
    ) -> Batch: ...

    async def approval(
        self, credentials: Credentials, storefront: str, barcode: str
    ) -> Decision: ...


def _clean(value: object) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _money(value: Decimal | None) -> str | None:
    if value is None:
        return None
    return format(value, "f")


def _attribute_filled(value: AttributeValue) -> bool:
    return bool(_clean(value.value_id) or _clean(value.custom))


def _need_attribute(name: str) -> str:
    return f"This product needs {name}."


def _origin(storefronts: tuple[Storefront, ...]) -> tuple[Storefront, ...]:
    return tuple(item for item in storefronts if item.code.upper() != TURKEY_CODE)


async def _shopify(session: AsyncSession, user_id: str) -> bool:
    return await connections.get_shopify(session, user_id) is not None


async def _connection(session: AsyncSession, user_id: str) -> TrendyolConnection | None:
    return (
        await session.execute(
            select(TrendyolConnection).where(TrendyolConnection.session_id == user_id)
        )
    ).scalar_one_or_none()


async def _listing(session: AsyncSession, user_id: str, image_id: int) -> TrendyolListing | None:
    return (
        await session.execute(
            select(TrendyolListing).where(
                TrendyolListing.session_id == user_id, TrendyolListing.image_id == image_id
            )
        )
    ).scalar_one_or_none()


async def _barcode(session: AsyncSession, user_id: str, barcode: str) -> TrendyolBarcode | None:
    return (
        await session.execute(
            select(TrendyolBarcode).where(
                TrendyolBarcode.session_id == user_id, TrendyolBarcode.barcode == barcode
            )
        )
    ).scalar_one_or_none()


def _credentials(row: TrendyolConnection, settings: Settings) -> Credentials:
    key = settings.connection_encryption_key or ""
    return Credentials(
        seller_id=row.seller_id,
        api_key=decrypt_shopify_token(row.api_key, key),
        api_secret=decrypt_shopify_token(row.api_secret, key),
    )


def _values(raw: object) -> tuple[AttributeValue, ...]:
    if not isinstance(raw, list):
        return ()
    loaded: list[AttributeValue] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        attribute_id = _clean(item.get("attributeId"))
        if not attribute_id:
            continue
        loaded.append(
            AttributeValue(
                attribute_id=attribute_id,
                value_id=_clean(item.get("valueId")),
                custom=_clean(item.get("custom")),
            )
        )
    return tuple(loaded)


def _dump(values: tuple[AttributeValue, ...]) -> list[dict[str, str | None]]:
    return [
        {"attributeId": item.attribute_id, "valueId": item.value_id, "custom": item.custom}
        for item in values
    ]


async def connection(session: AsyncSession, user_id: str) -> Link:
    """Settings reads this. It does not call Trendyol."""
    if not await _shopify(session, user_id):
        return Link(available=False, connected=False, message=NEED_SHOPIFY)
    row = await _connection(session, user_id)
    if row is None:
        return Link(available=True, connected=False)
    return Link(
        available=True,
        connected=True,
        storefront=row.storefront_code,
        currency=row.currency,
        vat_rate=row.vat_rate,
    )


async def connect(
    session: AsyncSession,
    settings: Settings,
    trendyol: TrendyolAccount,
    user_id: str,
    *,
    seller_id: str,
    api_key: str,
    api_secret: str,
    storefront_code: str | None,
    vat_rate: int | None,
) -> Link:
    if not await _shopify(session, user_id):
        return Link(available=False, connected=False, message=NEED_SHOPIFY)
    seller_id = seller_id.strip()
    api_key = api_key.strip()
    api_secret = api_secret.strip()
    if not seller_id or not api_key or not api_secret:
        return Link(available=True, connected=False, message=NEED_CREDENTIALS)
    found = await trendyol.storefronts_for(
        Credentials(seller_id=seller_id, api_key=api_key, api_secret=api_secret)
    )
    if found is None:
        return Link(available=True, connected=False, message=REJECTED_ACCOUNT)
    origins = _origin(found)
    if not origins:
        message = TURKEY if found else NO_STOREFRONT
        return Link(available=True, connected=False, message=message)
    chosen_code = _clean(storefront_code)
    if chosen_code is None:
        if len(origins) == 1 and vat_rate is not None and vat_rate >= 0:
            chosen = origins[0]
        else:
            return Link(available=True, connected=False, storefronts=origins)
    else:
        if chosen_code.upper() == TURKEY_CODE:
            return Link(available=True, connected=False, message=TURKEY, storefronts=origins)
        chosen = next((item for item in origins if item.code.upper() == chosen_code.upper()), None)
        if chosen is None:
            return Link(
                available=True,
                connected=False,
                message=UNKNOWN_STOREFRONT,
                storefronts=origins,
            )
    if vat_rate is None or vat_rate < 0:
        return Link(available=True, connected=False, message=NEED_VAT, storefronts=(chosen,))
    key = settings.connection_encryption_key
    if not key:
        raise RuntimeError("CONNECTION_ENCRYPTION_KEY is required to store Trendyol credentials")
    row = await _connection(session, user_id)
    if row is None:
        row = TrendyolConnection(
            session_id=user_id,
            seller_id=seller_id,
            api_key=encrypt_shopify_token(api_key, key),
            api_secret=encrypt_shopify_token(api_secret, key),
            storefront_code=chosen.code,
            currency=chosen.currency,
            vat_rate=vat_rate,
        )
        session.add(row)
    else:
        row.seller_id = seller_id
        row.api_key = encrypt_shopify_token(api_key, key)
        row.api_secret = encrypt_shopify_token(api_secret, key)
        row.storefront_code = chosen.code
        row.currency = chosen.currency
        row.vat_rate = vat_rate
    await session.flush()
    return Link(
        available=True,
        connected=True,
        storefront=chosen.code,
        currency=chosen.currency,
        vat_rate=vat_rate,
    )


async def disconnect(session: AsyncSession, user_id: str) -> None:
    """Removes the account link only. The listing and Trendyol stay."""
    row = await _connection(session, user_id)
    if row is not None:
        await session.delete(row)
        await session.flush()


async def _keep_required(
    trendyol: TrendyolAccount,
    credentials: Credentials,
    storefront: str,
    category_id: str | None,
    attributes: tuple[AttributeValue, ...],
) -> tuple[AttributeValue, ...]:
    if not category_id:
        return ()
    required = await trendyol.required_attributes(credentials, storefront, category_id)
    allowed = {item.id for item in required}
    return tuple(
        item for item in attributes if item.attribute_id in allowed and _attribute_filled(item)
    )


async def save_listing(
    session: AsyncSession,
    settings: Settings,
    trendyol: TrendyolAccount,
    user_id: str,
    product_id: int,
    draft: ListingDraft,
) -> Page | None:
    """Stores the Trendyol listing. Selling, facts, and listing copy stay as they are."""
    loaded = await product.load(session, user_id, product_id)
    if loaded is None:
        return None
    link = await _connection(session, user_id)
    category_id = _clean(draft.category_id)
    brand_id = _clean(draft.brand_id)
    attributes = draft.attributes
    if link is not None:
        attributes = await _keep_required(
            trendyol, _credentials(link, settings), link.storefront_code, category_id, attributes
        )
    row = await _listing(session, user_id, product_id)
    if row is None:
        row = TrendyolListing(
            session_id=user_id,
            image_id=product_id,
            category_id=category_id,
            category_name=_clean(draft.category_name),
            brand_id=brand_id,
            brand_name=_clean(draft.brand_name),
            attributes=_dump(attributes),
            sale_price=draft.sale_price,
            list_price=draft.list_price,
        )
        session.add(row)
    else:
        row.category_id = category_id
        row.category_name = _clean(draft.category_name)
        row.brand_id = brand_id
        row.brand_name = _clean(draft.brand_name)
        row.attributes = _dump(attributes)
        row.sale_price = draft.sale_price
        row.list_price = draft.list_price
    await session.flush()
    return await _page(
        session,
        user_id,
        product_id,
        trendyol=trendyol if link is not None else None,
        credentials=_credentials(link, settings) if link is not None else None,
        storefront=link.storefront_code if link is not None else None,
    )


def _gap(
    *,
    connected: bool,
    listing: TrendyolListing | None,
    copy_present: bool,
    title: str | None,
    description: str | None,
    barcode: str | None,
    sku: str | None,
    missing_attribute: str | None,
) -> str | None:
    if not connected:
        return SETTINGS
    if listing is None or not _clean(listing.category_id):
        return NEED_CATEGORY
    if not _clean(listing.brand_id):
        return NEED_BRAND
    if missing_attribute:
        return _need_attribute(missing_attribute)
    sale = listing.sale_price
    if sale is None or sale <= 0:
        return NEED_SALE
    listed = listing.list_price
    if listed is None:
        return NEED_LIST
    if listed < sale:
        return LIST_BELOW
    if not copy_present:
        return NEED_COPY
    if not _clean(title):
        return NEED_TITLE
    if not _clean(description):
        return NEED_DESCRIPTION
    if not barcode:
        return NEED_BARCODE
    if not sku:
        return NEED_SKU
    return None


async def _missing_attribute_name(
    trendyol: TrendyolAccount | None,
    credentials: Credentials | None,
    storefront: str | None,
    listing: TrendyolListing | None,
) -> str | None:
    if (
        trendyol is None
        or credentials is None
        or storefront is None
        or listing is None
        or not _clean(listing.category_id)
    ):
        return None
    required = await trendyol.required_attributes(
        credentials, storefront, listing.category_id or ""
    )
    filled = {item.attribute_id for item in _values(listing.attributes) if _attribute_filled(item)}
    for attribute in required:
        if attribute.id not in filled:
            return attribute.name
    return None


def _fields(
    required: tuple[RequiredAttribute, ...], stored: tuple[AttributeValue, ...]
) -> tuple[AttributeField, ...]:
    by_id = {item.attribute_id: item for item in stored}
    return tuple(
        AttributeField(
            id=attribute.id,
            name=attribute.name,
            value_id=(by_id.get(attribute.id).value_id if attribute.id in by_id else None),
            custom=(by_id.get(attribute.id).custom if attribute.id in by_id else None),
            choices=attribute.choices,
        )
        for attribute in required
    )


async def _page(
    session: AsyncSession,
    user_id: str,
    product_id: int,
    *,
    reason: str | None = None,
    attributes: tuple[AttributeField, ...] = (),
    refresh_wait: bool = True,
    trendyol: TrendyolAccount | None = None,
    credentials: Credentials | None = None,
    storefront: str | None = None,
) -> Page | None:
    loaded = await product.load(session, user_id, product_id)
    if loaded is None:
        return None
    link = await _connection(session, user_id)
    listing = await _listing(session, user_id, product_id)
    barcode = _clean(loaded.photo.barcode)
    accepted = await _barcode(session, user_id, barcode) if barcode else None
    missing = None
    if refresh_wait:
        missing = await _missing_attribute_name(trendyol, credentials, storefront, listing)
    copy = listing_copy_from_image(loaded.photo)
    wait = _gap(
        connected=link is not None,
        listing=listing,
        copy_present=listing_copy_present(copy),
        title=_clean(copy.get("title")),
        description=_clean(copy.get("description")),
        barcode=barcode,
        sku=_clean(loaded.photo.sku),
        missing_attribute=missing,
    )
    return Page(
        connected=link is not None,
        storefront=link.storefront_code if link else None,
        currency=link.currency if link else None,
        vat_rate=link.vat_rate if link else None,
        category_id=listing.category_id if listing else None,
        category_name=listing.category_name if listing else None,
        brand_id=listing.brand_id if listing else None,
        brand_name=listing.brand_name if listing else None,
        sale_price=_money(listing.sale_price) if listing else None,
        list_price=_money(listing.list_price) if listing else None,
        attributes=attributes,
        approval=accepted.approval if accepted else None,
        reason=reason if reason is not None else (accepted.rejection_reason if accepted else None),
        push_wait=wait,
    )


async def read_product(session: AsyncSession, user_id: str, product_id: int) -> Page | None:
    """The stored listing and approval. Does not ask Trendyol."""
    return await _page(session, user_id, product_id, refresh_wait=False)


async def open_product(
    session: AsyncSession,
    settings: Settings,
    trendyol: TrendyolAccount,
    user_id: str,
    product_id: int,
) -> Page | None:
    """The product page. Asks Trendyol for approval of the current barcode."""
    loaded = await product.load(session, user_id, product_id)
    if loaded is None:
        return None
    link = await _connection(session, user_id)
    credentials = _credentials(link, settings) if link else None
    storefront = link.storefront_code if link else None
    barcode = _clean(loaded.photo.barcode)
    if link is not None and credentials is not None and barcode:
        accepted = await _barcode(session, user_id, barcode)
        if accepted is not None:
            decision = await trendyol.approval(credentials, link.storefront_code, barcode)
            status = (
                decision.status
                if decision.status in ("waiting", "approved", "rejected")
                else "waiting"
            )
            accepted.approval = status
            accepted.rejection_reason = decision.reason if status == "rejected" else None
            await session.flush()
    required: tuple[RequiredAttribute, ...] = ()
    listing = await _listing(session, user_id, product_id)
    if link is not None and credentials is not None and listing and _clean(listing.category_id):
        required = await trendyol.required_attributes(
            credentials, link.storefront_code, listing.category_id or ""
        )
    return await _page(
        session,
        user_id,
        product_id,
        attributes=_fields(required, _values(listing.attributes) if listing else ()),
        trendyol=trendyol,
        credentials=credentials,
        storefront=storefront,
    )


async def _available_quantity(session: AsyncSession, user_id: str, sku: str) -> int:
    """Inventory's available quantity: on-hand minus the safety buffer, or zero."""
    row = (
        await session.execute(
            select(InventoryItem.ledger_quantity, InventoryItem.safety_buffer)
            .where(InventoryItem.user_id == user_id, InventoryItem.sku == sku)
            .order_by(InventoryItem.id)
            .limit(1)
        )
    ).one_or_none()
    if row is None:
        return 0
    ledger, buffer = row
    if buffer is None:
        default = (
            await session.execute(
                select(InventorySettings.default_safety_buffer).where(
                    InventorySettings.user_id == user_id
                )
            )
        ).scalar_one_or_none()
        buffer = default if default is not None else 2
    return calculate_sellable_quantity(int(ledger), int(buffer))


def _photo_urls(photos, settings: Settings) -> tuple[str, ...]:
    urls: list[str] = []
    for photo in photos:
        url = media_original_source(getattr(photo, "storage_url", None), settings)
        if url:
            urls.append(url)
    return tuple(urls)


async def push(
    session: AsyncSession,
    settings: Settings,
    trendyol: TrendyolAccount,
    user_id: str,
    product_id: int,
    draft: ListingDraft,
) -> Page | None:
    saved = await save_listing(session, settings, trendyol, user_id, product_id, draft)
    if saved is None:
        return None
    loaded = await product.load(session, user_id, product_id)
    if loaded is None:
        return None
    link = await _connection(session, user_id)
    listing = await _listing(session, user_id, product_id)
    credentials = _credentials(link, settings) if link else None
    storefront = link.storefront_code if link else None
    page = await _page(
        session,
        user_id,
        product_id,
        trendyol=trendyol,
        credentials=credentials,
        storefront=storefront,
    )
    if (
        page is None
        or page.push_wait is not None
        or link is None
        or listing is None
        or credentials is None
    ):
        return page
    barcode = _clean(loaded.photo.barcode) or ""
    sku = _clean(loaded.photo.sku) or ""
    copy = listing_copy_from_image(loaded.photo)
    accepted = await _barcode(session, user_id, barcode)
    quantity = None if accepted is not None else await _available_quantity(session, user_id, sku)
    model_code = accepted.model_code if accepted is not None else sku
    attributes = _values(listing.attributes)
    batch = await trendyol.submit(
        credentials,
        link.storefront_code,
        ListingItem(
            barcode=barcode,
            title=str(copy.get("title") or ""),
            description=str(copy.get("description") or ""),
            brand_id=listing.brand_id or "",
            category_id=listing.category_id or "",
            stock_code=sku,
            list_price=listing.list_price if listing.list_price is not None else Decimal(0),
            sale_price=listing.sale_price if listing.sale_price is not None else Decimal(0),
            vat_rate=link.vat_rate,
            currency=link.currency,
            images=_photo_urls(loaded.photos, settings),
            attributes=attributes,
            quantity=quantity,
            model_code=model_code,
        ),
    )
    if not batch.accepted:
        return await _page(
            session,
            user_id,
            product_id,
            reason=batch.reason or "Trendyol did not accept this batch.",
            trendyol=trendyol,
            credentials=credentials,
            storefront=storefront,
        )
    if accepted is None:
        session.add(
            TrendyolBarcode(
                session_id=user_id,
                image_id=product_id,
                barcode=barcode,
                model_code=sku,
                quantity=quantity if quantity is not None else 0,
                approval="waiting",
            )
        )
    else:
        accepted.approval = "waiting"
        accepted.rejection_reason = None
    await session.flush()
    return await _page(
        session,
        user_id,
        product_id,
        trendyol=trendyol,
        credentials=credentials,
        storefront=storefront,
    )


async def list_categories(
    session: AsyncSession, settings: Settings, trendyol: TrendyolAccount, user_id: str
) -> tuple[Category, ...]:
    link = await _connection(session, user_id)
    if link is None:
        return ()
    return await trendyol.categories_for(_credentials(link, settings), link.storefront_code)


async def list_brands(
    session: AsyncSession,
    settings: Settings,
    trendyol: TrendyolAccount,
    user_id: str,
    query: str,
) -> tuple[Brand, ...]:
    link = await _connection(session, user_id)
    if link is None:
        return ()
    return await trendyol.brands_for(_credentials(link, settings), link.storefront_code, query)


async def list_attributes(
    session: AsyncSession,
    settings: Settings,
    trendyol: TrendyolAccount,
    user_id: str,
    category_id: str,
) -> tuple[RequiredAttribute, ...]:
    link = await _connection(session, user_id)
    if link is None:
        return ()
    return await trendyol.required_attributes(
        _credentials(link, settings), link.storefront_code, category_id
    )
