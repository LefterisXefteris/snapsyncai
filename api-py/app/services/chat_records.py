"""Inventory adjustment, Selling, publications, Shop GPSR, and delete.

These are the page's writes. A missing input is asked for, and that call writes nothing.
"""

from __future__ import annotations

import logging
from collections.abc import Mapping, Sequence
from typing import Protocol

from sqlalchemy import func
from sqlmodel import select

from app.models.inventory import InventoryItem
from app.services import product as product_page
from app.services.chat_listing import (
    ListingReply,
    PreviousGpsr,
    PreviousInventory,
    PreviousPublications,
    PreviousSelling,
)
from app.services.connections import get_shopify, update_shopify_gpsr
from app.services.images import (
    delete_image,
    delete_images_by_group_id,
    get_image,
    update_image,
)
from app.services.inventory.errors import InventoryError
from app.services.inventory.service import adjust_inventory_item
from app.services.product_facts import parse_gpsr_identity, stored_gpsr_identity
from app.services.shopify import list_shopify_publications

ADJUST = "adjust_stock"
SELLING = "selling"
PUBLICATIONS = "publications"
SHOP_GPSR = "shop_gpsr"
DELETE = "delete"

STOCK = "Stock adjusted."
SELLING_SAVED = "That's the selling."
PUBLICATIONS_SET = "Those publications are set."
GPSR_SAVED = "Shop GPSR identity saved."
DELETED = "Deleted."
WHICH_QUANTITY = "What quantity?"
WHICH_REASON = "What reason?"
WHICH_SELLING = "Which selling field — price, compare-at price, cost, SKU, or barcode?"
WHICH_PUBLICATIONS = "Which publications?"
GPSR_INCOMPLETE = "GPSR identity is incomplete."
NO_SKU = "That product has no SKU, so there is no Inventory row to adjust."
NO_STOCK_ROW = "Inventory has no stock row for that SKU."
WHICH_STOCK_ROW = "Which stock row? More than one uses that SKU."
NOT_SEEN = "Which product? I don't see that one."
CONNECT_SHOPIFY = "Connect Shopify in Settings to push this product."
RECONNECT_PUBLICATIONS = "Reconnect Shopify in Settings to choose where this product is available."
CONNECT_GPSR = "Connect Shopify before saving shop GPSR identity."
WHICH_PUBLICATION = "Which publication? I don't see {name}."

_ACTS = {ADJUST, SELLING, PUBLICATIONS, SHOP_GPSR, DELETE}
_PUBLICATION_SCOPES = ("read_publications", "write_publications")
_SELLING = {
    "price": "price",
    "compare_at_price": "compare_at_price",
    "compareatprice": "compare_at_price",
    "compare-at price": "compare_at_price",
    "cost": "cost_per_item",
    "cost_per_item": "cost_per_item",
    "costperitem": "cost_per_item",
    "sku": "sku",
    "barcode": "barcode",
}

logger = logging.getLogger(__name__)


class PageRecords(Protocol):
    """The page's stock, Selling, publications, Shop GPSR, and delete."""

    async def adjust_stock(
        self, product_id: int, quantity: int, reason: str
    ) -> str | PreviousInventory | None: ...

    async def selling(
        self, product_id: int, fields: Mapping[str, str]
    ) -> str | Mapping[str, str] | None: ...

    async def publications(
        self, product_id: int, names: Sequence[str]
    ) -> str | tuple[str, ...] | None: ...

    async def shop_gpsr(self, identity: Mapping[str, object]) -> str | PreviousGpsr | None: ...

    async def delete(self, product_id: int) -> str | None: ...


def _selling_fields(raw: Mapping[str, str] | None) -> dict[str, str] | None:
    if not raw:
        return None
    fields: dict[str, str] = {}
    for key, value in raw.items():
        name = _SELLING.get(key.casefold().strip()) if isinstance(key, str) else None
        text = value.strip() if isinstance(value, str) else ""
        if name and text:
            fields[name] = text
    return fields or None


def _selling_text(value: object) -> str:
    if value is None:
        return ""
    return str(value)


def _kept(text: str) -> ListingReply:
    return ListingReply(text, continue_turn=True)


def _asked(text: str) -> ListingReply:
    return ListingReply(text)


async def record_act(
    *,
    act: str | None,
    records: PageRecords | None,
    product_id: int | None,
    quantity: int | None,
    reason: str | None,
    selling: Mapping[str, str] | None,
    publications: Sequence[str],
    gpsr: Mapping[str, object] | None,
    name_it: str,
) -> ListingReply | None:
    """Run one of these writes. None means this step is not one of them."""
    if act not in _ACTS:
        return None
    if records is None:
        from app.services.chat import UNAVAILABLE

        return _asked(UNAVAILABLE)
    if act == SHOP_GPSR:
        return await _gpsr(records, gpsr)
    if product_id is None:
        return _asked(name_it)
    if act == ADJUST:
        return await _adjust(records, product_id, quantity, reason)
    if act == SELLING:
        return await _selling(records, product_id, selling)
    if act == PUBLICATIONS:
        return await _publications(records, product_id, publications)
    return await _delete(records, product_id)


async def _adjust(
    records: PageRecords, product_id: int, quantity: int | None, reason: str | None
) -> ListingReply:
    if quantity is None or quantity < 0:
        return _asked(WHICH_QUANTITY)
    words = (reason or "").strip()
    if len(words) < 3 or len(words) > 250:
        return _asked(WHICH_REASON)
    written = await records.adjust_stock(product_id, quantity, words)
    if isinstance(written, str):
        return _asked(written)
    return ListingReply(STOCK, continue_turn=True, before=written)


async def _selling(
    records: PageRecords, product_id: int, selling: Mapping[str, str] | None
) -> ListingReply:
    fields = _selling_fields(selling)
    if fields is None:
        return _asked(WHICH_SELLING)
    written = await records.selling(product_id, fields)
    if isinstance(written, str):
        return _asked(written)
    if not isinstance(written, Mapping):
        return _kept(SELLING_SAVED)
    return ListingReply(
        SELLING_SAVED,
        continue_turn=True,
        before=PreviousSelling(product_id, dict(written)),
    )


async def _publications(
    records: PageRecords, product_id: int, names: Sequence[str]
) -> ListingReply:
    chosen = tuple(name.strip() for name in names if isinstance(name, str) and name.strip())
    if not chosen:
        return _asked(WHICH_PUBLICATIONS)
    written = await records.publications(product_id, chosen)
    if isinstance(written, str):
        return _asked(written)
    if not isinstance(written, tuple):
        return _kept(PUBLICATIONS_SET)
    return ListingReply(
        PUBLICATIONS_SET,
        continue_turn=True,
        before=PreviousPublications(product_id, written),
    )


async def _gpsr(records: PageRecords, gpsr: Mapping[str, object] | None) -> ListingReply:
    if not gpsr:
        return _asked(GPSR_INCOMPLETE)
    written = await records.shop_gpsr(gpsr)
    if isinstance(written, str):
        return _asked(written)
    if not isinstance(written, PreviousGpsr):
        return _kept(GPSR_SAVED)
    return ListingReply(GPSR_SAVED, continue_turn=True, before=written)


async def _delete(records: PageRecords, product_id: int) -> ListingReply:
    refused = await records.delete(product_id)
    return _asked(refused) if refused else _kept(DELETED)


def quantity_from_payload(raw: object) -> int | None:
    if isinstance(raw, bool) or not isinstance(raw, int):
        return None
    return raw


def reason_from_payload(raw: object) -> str | None:
    if not isinstance(raw, str):
        return None
    text = raw.strip()
    return text or None


def selling_from_payload(raw: object) -> dict[str, str] | None:
    if not isinstance(raw, dict):
        return None
    fields: dict[str, str] = {}
    for key, value in raw.items():
        if not isinstance(key, str):
            continue
        if isinstance(value, bool):
            continue
        if isinstance(value, str):
            text = value.strip()
        elif isinstance(value, (int, float)):
            text = str(value)
        else:
            continue
        if text:
            fields[key] = text
    return fields or None


def publications_from_payload(raw: object) -> tuple[str, ...]:
    if not isinstance(raw, list):
        return ()
    return tuple(item.strip() for item in raw if isinstance(item, str) and item.strip())


def gpsr_from_payload(raw: object) -> dict[str, object] | None:
    if isinstance(raw, dict) and raw:
        return raw
    return None


class ShopRecords:
    """The same writes as Inventory, the product page, and Settings."""

    def __init__(self, session, settings, user_id: str, graphql_for) -> None:
        self._session = session
        self._settings = settings
        self._user_id = user_id
        self._graphql_for = graphql_for

    async def adjust_stock(
        self, product_id: int, quantity: int, reason: str
    ) -> str | PreviousInventory | None:
        image = await get_image(self._session, product_id, self._user_id)
        if image is None:
            return NOT_SEEN
        sku = (image.sku or "").strip()
        if not sku:
            return NO_SKU
        rows = (
            (
                await self._session.execute(
                    select(InventoryItem).where(
                        InventoryItem.user_id == self._user_id,
                        func.lower(InventoryItem.sku) == sku.casefold(),
                    )
                )
            )
            .scalars()
            .all()
        )
        if not rows:
            return NO_STOCK_ROW
        if len(rows) > 1:
            return WHICH_STOCK_ROW
        item_id = rows[0].id
        if item_id is None:
            return NO_STOCK_ROW
        previous = int(rows[0].ledger_quantity)
        try:
            await adjust_inventory_item(
                self._session,
                self._settings,
                user_id=self._user_id,
                item_id=item_id,
                mode="set",
                quantity=quantity,
                reason=reason,
            )
        except InventoryError as exc:
            return str(exc)
        return PreviousInventory(item_id, previous)

    async def selling(
        self, product_id: int, fields: Mapping[str, str]
    ) -> str | dict[str, str] | None:
        image = await get_image(self._session, product_id, self._user_id)
        if image is None:
            return NOT_SEEN
        previous = {name: _selling_text(getattr(image, name, None)) for name in fields}
        try:
            saved = await update_image(self._session, product_id, dict(fields), self._user_id)
        except ValueError:
            return "Invalid update data"
        if saved is None:
            return NOT_SEEN
        return previous

    async def publications(
        self, product_id: int, names: Sequence[str]
    ) -> str | tuple[str, ...] | None:
        image = await get_image(self._session, product_id, self._user_id)
        if image is None:
            return NOT_SEEN
        connection = await get_shopify(self._session, self._user_id)
        if connection is None:
            return CONNECT_SHOPIFY
        granted = connection.granted_scopes or []
        if not all(scope in granted for scope in _PUBLICATION_SCOPES):
            return RECONNECT_PUBLICATIONS
        try:
            listed = await list_shopify_publications(self._graphql_for(connection))
        except Exception:
            logger.exception("Shopify publications lookup failed for user %s", self._user_id)
            return RECONNECT_PUBLICATIONS
        ids: list[str] = []
        for name in names:
            matches = [
                item for item in listed if item.get("name") == name or item.get("id") == name
            ]
            if len(matches) != 1:
                return WHICH_PUBLICATION.format(name=name)
            ids.append(matches[0]["id"])
        previous = tuple(
            item for item in (image.shopify_publication_ids or []) if isinstance(item, str) and item
        )
        saved = await update_image(
            self._session,
            product_id,
            {"shopify_publication_ids": ids},
            self._user_id,
        )
        if saved is None:
            return NOT_SEEN
        return previous

    async def shop_gpsr(self, identity: Mapping[str, object]) -> str | PreviousGpsr | None:
        parsed, error = parse_gpsr_identity(identity)
        if error or parsed is None:
            return error or GPSR_INCOMPLETE
        connection = await get_shopify(self._session, self._user_id)
        if connection is None:
            return CONNECT_GPSR
        raw = connection.gpsr_identity
        previous = dict(raw) if isinstance(raw, Mapping) else None
        updated = await update_shopify_gpsr(
            self._session, self._user_id, stored_gpsr_identity(parsed)
        )
        if updated is None:
            return CONNECT_GPSR
        await product_page.stale_shop_default_products(self._session, self._user_id)
        return PreviousGpsr(previous)

    async def delete(self, product_id: int) -> str | None:
        image = await get_image(self._session, product_id, self._user_id)
        if image is None:
            return NOT_SEEN
        group_id = (image.product_group_id or "").strip()
        if group_id:
            count = await delete_images_by_group_id(self._session, group_id, self._user_id)
            if count == 0:
                return NOT_SEEN
            return None
        await delete_image(self._session, product_id, self._user_id)
        return None
