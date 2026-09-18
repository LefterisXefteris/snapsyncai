"""Import — fetch missing Channel products into the catalogue.

HTTP, the SPA, Shopify Admin GraphQL, and storage are adapters. Tests call this
module with a Channel product list, existing Channel ids, and a fake persist.
"""

from __future__ import annotations

from collections.abc import Callable, Sequence
from dataclasses import dataclass
from inspect import isawaitable
from typing import Any

NOT_CONNECTED = "Connect Shopify in Settings before you Import."
IN_PROGRESS = "An Import is already in progress."


@dataclass(frozen=True)
class ChannelProduct:
    channel_product_id: str
    title: str | None = None
    description: str | None = None
    tags: tuple[str, ...] = ()
    seo_title: str | None = None
    seo_description: str | None = None
    category: str | None = None
    product_type: str | None = None
    price: str | None = None
    compare_at_price: str | None = None
    cost: str | None = None
    sku: str | None = None
    barcode: str | None = None
    track_quantity: bool | None = None
    options: tuple[tuple[str, tuple[str, ...]], ...] = ()
    media_urls: tuple[str, ...] = ()
    status: str = "DRAFT"
    publication_ids: tuple[str, ...] = ()


@dataclass(frozen=True)
class ImportListingCopy:
    title: str | None
    description: str | None
    tags: tuple[str, ...]
    seo_title: str | None
    seo_description: str | None


@dataclass(frozen=True)
class ImportSelling:
    price: str | None
    compare_at_price: str | None
    cost: str | None
    sku: str | None
    barcode: str | None
    track_quantity: bool | None


@dataclass(frozen=True)
class ImportProduct:
    channel_product_id: str
    listing_copy: ImportListingCopy
    selling: ImportSelling
    variants: tuple[dict[str, Any], ...]
    photo_urls: tuple[str, ...]
    status: str
    publication_ids: tuple[str, ...]
    category: str | None
    product_type: str | None
    product_facts: None = None
    aeo_snippet: None = None
    aeo_faqs: None = None
    inventory_quantity: None = None


@dataclass(frozen=True)
class ImportFailure:
    channel_product_id: str
    reason: str


@dataclass(frozen=True)
class ImportResult:
    blocked_reason: str | None = None
    created: int = 0
    skipped: int = 0
    failed: int = 0
    failures: tuple[ImportFailure, ...] = ()


class MemoryRunLock:
    """In-process lock so a second Start cannot race twins."""

    def __init__(self) -> None:
        self._in_progress = False
        self.last: ImportResult | None = None

    def in_progress(self) -> bool:
        return self._in_progress

    def begin(self) -> bool:
        if self._in_progress:
            return False
        self._in_progress = True
        return True

    def finish(self, result: ImportResult) -> None:
        self._in_progress = False
        self.last = result

    def abort(self) -> None:
        self._in_progress = False


class ImportRunStore:
    """Per-seller run locks for HTTP. Tests construct MemoryRunLock directly."""

    def __init__(self) -> None:
        self._locks: dict[str, MemoryRunLock] = {}

    def for_user(self, user_id: str) -> MemoryRunLock:
        lock = self._locks.get(user_id)
        if lock is None:
            lock = MemoryRunLock()
            self._locks[user_id] = lock
        return lock


RUNS = ImportRunStore()


def start_blocked_reason(*, shopify_connected: bool, run_in_progress: bool) -> str | None:
    if not shopify_connected:
        return NOT_CONNECTED
    if run_in_progress:
        return IN_PROGRESS
    return None


async def _maybe_await(value: Any) -> Any:
    if isawaitable(value):
        return await value
    return value


def _import_product(channel: ChannelProduct, photo_urls: tuple[str, ...]) -> ImportProduct:
    variants = tuple(
        {"name": name, "values": list(values)} for name, values in channel.options
    )
    return ImportProduct(
        channel_product_id=channel.channel_product_id,
        listing_copy=ImportListingCopy(
            title=channel.title,
            description=channel.description,
            tags=channel.tags,
            seo_title=channel.seo_title,
            seo_description=channel.seo_description,
        ),
        selling=ImportSelling(
            price=channel.price,
            compare_at_price=channel.compare_at_price,
            cost=channel.cost,
            sku=channel.sku,
            barcode=channel.barcode,
            track_quantity=channel.track_quantity,
        ),
        variants=variants,
        photo_urls=photo_urls,
        status=channel.status if channel.status == "ACTIVE" else "DRAFT",
        publication_ids=channel.publication_ids,
        category=channel.category,
        product_type=channel.product_type,
    )


async def _photos_for(
    channel: ChannelProduct,
    load_photo: Callable[[str], Any] | None,
) -> tuple[str, ...]:
    urls: list[str] = []
    for url in channel.media_urls:
        if load_photo is None:
            urls.append(url)
            continue
        resolved = await _maybe_await(load_photo(url))
        if resolved:
            urls.append(resolved)
    return tuple(urls)


async def start_import(
    *,
    shopify_connected: bool,
    existing_channel_ids: Sequence[str] | Callable[[], Any],
    channel_products: Sequence[ChannelProduct] | Callable[[], Any],
    persist: Callable[[ImportProduct], Any],
    run_lock: MemoryRunLock,
    load_photo: Callable[[str], Any] | None = None,
) -> ImportResult:
    blocked = start_blocked_reason(
        shopify_connected=shopify_connected,
        run_in_progress=run_lock.in_progress(),
    )
    if blocked:
        return ImportResult(blocked_reason=blocked)
    if not run_lock.begin():
        return ImportResult(blocked_reason=IN_PROGRESS)

    created = 0
    skipped = 0
    failed = 0
    failures: list[ImportFailure] = []
    try:
        ids = existing_channel_ids
        if callable(existing_channel_ids):
            ids = await _maybe_await(existing_channel_ids())
        seen = set(ids)
        products = channel_products
        if callable(channel_products):
            products = await _maybe_await(channel_products())
        for channel in products:
            channel_id = channel.channel_product_id
            if channel_id in seen:
                skipped += 1
                continue
            seen.add(channel_id)
            photo_urls = await _photos_for(channel, load_photo)
            product = _import_product(channel, photo_urls)
            try:
                await _maybe_await(persist(product))
            except Exception as exc:
                failed += 1
                failures.append(
                    ImportFailure(
                        channel_product_id=channel_id, reason=str(exc) or "failed"
                    )
                )
                continue
            created += 1
        result = ImportResult(
            created=created,
            skipped=skipped,
            failed=failed,
            failures=tuple(failures),
        )
    except Exception:
        run_lock.abort()
        raise
    run_lock.finish(result)
    return result
