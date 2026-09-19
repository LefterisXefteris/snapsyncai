"""Bulk SEO — catalogue listing copy refresh for seller-picked products."""

from __future__ import annotations

from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass
from datetime import UTC, datetime
from inspect import isawaitable
from typing import Any

from app.services.listing_copy_refresh import (
    DEMAND_UNCONFIGURED,
    accept_listing_copy_refresh,
    listing_copy_from_image,
    refresh_blocked_reason,
    rewrite_constraints,
    seed_search_demand,
    start_listing_copy_refresh,
)
from app.services.plan import Entitlement, Spend, decide
from app.services.product_facts import ProductFacts, facts_from_stored, listing_copy_present
from app.services.supabase_storage import channel_photo_url


@dataclass(frozen=True)
class BulkSeoPhoto:
    id: int
    product_group_id: str | None
    title: str | None
    listing_copy: Mapping[str, Any]
    facts: ProductFacts
    photo_url: str | None


@dataclass(frozen=True)
class CatalogueRow:
    id: int
    title: str | None
    photo_url: str | None
    eligible: bool
    blocked_reason: str | None


@dataclass(frozen=True)
class BulkSeoPicker:
    rows: tuple[CatalogueRow, ...]
    start_blocked_reason: str | None
    proposed_use_count: int


def _group_photos(photos: Sequence[BulkSeoPhoto]) -> list[list[BulkSeoPhoto]]:
    groups: dict[str, list[BulkSeoPhoto]] = {}
    order: list[str] = []
    for photo in photos:
        key = photo.product_group_id or f"solo:{photo.id}"
        if key not in groups:
            groups[key] = []
            order.append(key)
        groups[key].append(photo)
    return [groups[key] for key in order]


def _primary(photos: Sequence[BulkSeoPhoto]) -> BulkSeoPhoto:
    ranked = sorted(
        photos,
        key=lambda photo: (0 if listing_copy_present(photo.listing_copy) else 1, photo.id),
    )
    return ranked[0]


def photos_from_images(images: Sequence[Any]) -> list[BulkSeoPhoto]:
    photos: list[BulkSeoPhoto] = []
    for image in images:
        listing_copy = listing_copy_from_image(image)
        photos.append(
            BulkSeoPhoto(
                id=int(image.id),
                product_group_id=getattr(image, "product_group_id", None),
                title=getattr(image, "title", None),
                listing_copy=listing_copy,
                facts=facts_from_stored(getattr(image, "product_facts", None)),
                photo_url=channel_photo_url(getattr(image, "storage_url", None)),
            )
        )
    return photos


EMPTY_SELECTION = "Pick products to start Bulk SEO."
PARSE_FAILED = "Could not parse listing copy refresh."


@dataclass(frozen=True)
class PackItem:
    id: int
    error: str | None = None
    proposal: Mapping[str, Any] | None = None
    queries: tuple[str, ...] = ()


@dataclass(frozen=True)
class Pack:
    error: str | None = None
    items: tuple[PackItem, ...] = ()
    proposed_use_count: int = 0


def _primary_for_ids(photos: Sequence[BulkSeoPhoto]) -> dict[int, BulkSeoPhoto]:
    mapping: dict[int, BulkSeoPhoto] = {}
    for group in _group_photos(photos):
        primary = _primary(group)
        for photo in group:
            mapping[photo.id] = primary
    return mapping


async def _maybe_await(value):
    if isawaitable(value):
        return await value
    return value


def _pack_item(
    product_id: int,
    started,
    proposal: Mapping[str, Any] | None,
) -> PackItem:
    if started.error:
        return PackItem(id=product_id, error=started.error, queries=started.queries)
    if proposal is None:
        return PackItem(id=product_id, error=PARSE_FAILED, queries=started.queries)
    return PackItem(id=product_id, proposal=proposal, queries=started.queries)


async def start_pack(
    photos: Sequence[BulkSeoPhoto],
    selected_ids: Sequence[int],
    *,
    demand_configured: bool,
    entitlement: Entitlement,
    fetch: Callable[[int, Sequence[str]], Sequence[str]],
    propose: Callable[..., Mapping[str, Any] | None],
    shop_gpsr: Mapping[str, Any] | None = None,
) -> Pack:
    if not selected_ids:
        return Pack(error=EMPTY_SELECTION)
    blocked = picker(
        photos,
        demand_configured=demand_configured,
        entitlement=entitlement,
    ).start_blocked_reason
    if blocked:
        return Pack(error=blocked)

    primaries = _primary_for_ids(photos)
    items: list[PackItem] = []
    seen: set[int] = set()
    for selected_id in selected_ids:
        primary = primaries.get(selected_id)
        if primary is None or primary.id in seen:
            continue
        seen.add(primary.id)
        product_id = primary.id
        gate = refresh_blocked_reason(
            primary.facts, primary.listing_copy, demand_configured
        )
        if gate:
            started = start_listing_copy_refresh(
                primary.facts,
                primary.listing_copy,
                demand_configured,
                fetch=lambda _seeds: (),
            )
            items.append(_pack_item(product_id, started, None))
            continue
        raw = await _maybe_await(
            fetch(product_id, seed_search_demand(primary.facts, primary.listing_copy))
        )
        started = start_listing_copy_refresh(
            primary.facts,
            primary.listing_copy,
            demand_configured,
            fetch=lambda _seeds: (),
            queries=raw,
            shop_gpsr=shop_gpsr,
        )
        if started.error:
            items.append(_pack_item(product_id, started, None))
            continue
        proposal = await _maybe_await(
            propose(
                product_id,
                queries=started.queries,
                constraints=rewrite_constraints(
                    primary.facts, started.queries, primary.listing_copy, shop_gpsr
                ),
                listing_copy=primary.listing_copy,
            )
        )
        items.append(_pack_item(product_id, started, proposal))
    return Pack(
        items=tuple(items),
        proposed_use_count=sum(1 for item in items if item.proposal is not None),
    )


async def regenerate_item(
    photo: BulkSeoPhoto,
    queries: Sequence[str],
    *,
    demand_configured: bool,
    propose: Callable[..., Mapping[str, Any] | None],
    fetch: Callable[..., Sequence[str]],
    shop_gpsr: Mapping[str, Any] | None = None,
) -> PackItem:
    started = start_listing_copy_refresh(
        photo.facts,
        photo.listing_copy,
        demand_configured,
        fetch=fetch,
        shop_gpsr=shop_gpsr,
        queries=queries,
    )
    if started.error:
        return _pack_item(photo.id, started, None)
    proposal = await _maybe_await(
        propose(
            queries=started.queries,
            constraints=rewrite_constraints(
                photo.facts, started.queries, photo.listing_copy, shop_gpsr
            ),
            listing_copy=photo.listing_copy,
        )
    )
    return _pack_item(photo.id, started, proposal)


@dataclass(frozen=True)
class AcceptResult:
    error: str | None = None
    listing_copy: dict[str, Any] | None = None
    spent: bool = False


def accept_item(
    photo: BulkSeoPhoto,
    proposal: Mapping[str, Any],
    *,
    entitlement: Entitlement,
    spends: Sequence[Spend],
    now: datetime,
    persist: Callable[[int, Mapping[str, Any]], None],
    record_spend: Callable[[], None],
    shop_gpsr: Mapping[str, Any] | None = None,
) -> AcceptResult:
    accepted = accept_listing_copy_refresh(photo.facts, proposal, shop_gpsr)
    if accepted.error or accepted.listing_copy is None:
        return AcceptResult(error=accepted.error)
    decision = decide(entitlement, spends, now, "bulk_seo_persist")
    if not decision.allowed:
        return AcceptResult(error=decision.blocked_reason)
    persist(photo.id, accepted.listing_copy)
    if decision.records_spend:
        record_spend()
    return AcceptResult(listing_copy=accepted.listing_copy, spent=decision.records_spend)


def picker(
    photos: Sequence[BulkSeoPhoto],
    *,
    demand_configured: bool,
    entitlement: Entitlement,
    selected_ids: Sequence[int] = (),
) -> BulkSeoPicker:
    rows: list[CatalogueRow] = []
    for group in _group_photos(photos):
        primary = _primary(group)
        reason = refresh_blocked_reason(
            primary.facts, primary.listing_copy, demand_configured
        )
        photo_url = next((item.photo_url for item in group if item.photo_url), primary.photo_url)
        title = primary.title or next((item.title for item in group if item.title), None)
        rows.append(
            CatalogueRow(
                id=primary.id,
                title=title,
                photo_url=photo_url,
                eligible=reason is None,
                blocked_reason=reason,
            )
        )
    plan_decision = decide(
        entitlement, (), datetime.now(UTC), "bulk_seo_persist", completed=False
    )
    start_blocked = None if plan_decision.allowed else plan_decision.blocked_reason
    if start_blocked is None and not demand_configured:
        start_blocked = DEMAND_UNCONFIGURED
    wanted = set(selected_ids)
    proposed = sum(1 for row in rows if row.eligible and row.id in wanted)
    return BulkSeoPicker(
        rows=tuple(rows), start_blocked_reason=start_blocked, proposed_use_count=proposed
    )
