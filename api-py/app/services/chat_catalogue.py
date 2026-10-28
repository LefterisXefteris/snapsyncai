"""Listing copy refresh, Bulk SEO, dismiss, and regenerate-a-field.

These are the page's jobs. A proposal is shown before Accept, and Accept of a
pack is one Accept per product already in the thread.
"""

from __future__ import annotations

from collections.abc import Callable, Sequence
from dataclasses import dataclass, replace
from typing import Protocol

from app.services.chat_listing import (
    ACCEPTED,
    WRITE_FIRST,
    ListingReply,
    Proposal,
    Shown,
    proposal_text,
)

REFRESH = "refresh"
BULK = "bulk_seo"
DISMISS = "dismiss"
REGENERATE_FIELD = "regenerate_field"
THESE = "these"
ALL = "all"
WHICH_PRODUCTS = "Which products? Name them, or tick the eligible ones on Bulk SEO."
WHICH_FIELD = "Which field?"
DISMISSED = "Dismissed."
NO_PROPOSAL = "There's no proposal to dismiss."

_LABELS = {
    "title": "Title",
    "description": "Description",
    "seoKeywords": "SEO Keywords",
    "seoTitle": "Page title",
    "seoDescription": "Meta description",
    "aeoFaqs": "AEO FAQ Pairs",
}


@dataclass(frozen=True)
class Started:
    """One product from a Bulk SEO Start. A refusal saved nothing for that row."""

    product_id: int
    proposal: Proposal | None = None
    refused: str | None = None
    trace_id: str | None = None
    pack_id: str | None = None


@dataclass(frozen=True)
class Rewritten:
    """One field the page regenerated. It is not saved until Accept."""

    field: str
    text: str
    tags: tuple[str, ...] | None = None
    faqs: tuple[tuple[str, str], ...] | None = None


class _Product(Protocol):
    id: int
    title: str
    photo_ids: tuple[int, ...]


class _Kept(Protocol):
    credits_spent: int
    refused: str | None


class CatalogueJobs(Protocol):
    async def refresh(self, product_id: int) -> Proposal | Started | str: ...

    async def bulk_seo(self, product_ids: Sequence[int]) -> tuple[Started, ...] | str: ...

    async def accept(self, product_id: int, proposal: Proposal, **extra: object) -> _Kept: ...

    async def dismiss(
        self, product_id: int, *, kind: str, trace_id: str | None = None
    ) -> str | None: ...

    async def regenerate_field(self, product_id: int, field: str) -> Rewritten | str: ...


def _photos(product_id: int, photo_ids: Sequence[int]) -> set[int]:
    return {product_id, *photo_ids}


def _title(catalogue: Sequence[_Product], product_id: int) -> str:
    for product in catalogue:
        if product.id == product_id or product_id in product.photo_ids:
            return product.title
    return str(product_id)


def _holds(act: str | None, token: str, names: Sequence[str]) -> bool:
    """Skip resolving one product when this step names a set."""
    folded = token.casefold()
    if act == BULK and (folded == THESE or len(names) > 0):
        return True
    return act == "accept" and (folded == ALL or len(names) > 1)


def _block(name: str, body: str) -> str:
    return f"{name}\n\n{body}"


def _merged(proposal: Proposal, rewritten: Rewritten) -> Proposal:
    field = rewritten.field
    if field == "title":
        return replace(proposal, title=rewritten.text)
    if field == "description":
        return replace(proposal, description=rewritten.text)
    if field == "seoKeywords" and rewritten.tags is not None:
        return replace(proposal, tags=rewritten.tags)
    if field == "seoTitle":
        return replace(proposal, seo_title=rewritten.text)
    if field == "seoDescription":
        return replace(proposal, seo_description=rewritten.text)
    if field == "aeoFaqs" and rewritten.faqs is not None:
        return replace(proposal, aeo_faqs=rewritten.faqs)
    return proposal


def _latest(shown: Sequence[Shown]) -> tuple[Shown, ...]:
    order: list[int] = []
    by_id: dict[int, Shown] = {}
    for item in shown:
        if item.product_id not in by_id:
            order.append(item.product_id)
        by_id[item.product_id] = item
    return tuple(by_id[product_id] for product_id in order)


def _match(shown: Sequence[Shown], product_id: int, photo_ids: Sequence[int]) -> Shown | None:
    photos = _photos(product_id, photo_ids)
    found: Shown | None = None
    for item in shown:
        if item.product_id in photos:
            found = item
    return found


async def shop_act(
    *,
    act: str | None,
    listing: CatalogueJobs | None,
    product_id: int | None,
    photo_ids: Sequence[int],
    token: str | None,
    names: Sequence[str],
    field: str | None,
    shown: Sequence[Shown],
    catalogue: Sequence[_Product],
    bulk_ticks: Sequence[int],
    resolve: Callable[[str], _Product | str],
    name_it: str,
) -> ListingReply | None:
    """Run a catalogue act. None means this step is not one of them."""
    word = (token or "").strip()
    if act not in (REFRESH, BULK, DISMISS, REGENERATE_FIELD) and not _holds(act, word, names):
        return None
    if listing is None:
        from app.services.chat import UNAVAILABLE

        return ListingReply(UNAVAILABLE)
    if act == REFRESH:
        return await _refresh(listing, product_id, name_it)
    if act == BULK:
        return await _bulk(
            listing, word, names, product_id, catalogue, bulk_ticks, resolve, name_it, shown
        )
    if act == DISMISS:
        return await _dismiss(listing, product_id, photo_ids, shown, name_it)
    if act == REGENERATE_FIELD:
        return await _field(listing, product_id, photo_ids, field, shown, name_it)
    return await _accept_many(listing, word, names, shown, catalogue, resolve, name_it)


async def _refresh(
    listing: CatalogueJobs, product_id: int | None, name_it: str
) -> ListingReply:
    if product_id is None:
        return ListingReply(name_it)
    result = await listing.refresh(product_id)
    if isinstance(result, str):
        return ListingReply(result)
    if isinstance(result, Started):
        if result.proposal is None:
            return ListingReply(result.refused or "Could not parse listing copy refresh.")
        return ListingReply(
            proposal_text(result.proposal),
            Shown(product_id, result.proposal, kind=REFRESH, trace_id=result.trace_id),
        )
    return ListingReply(proposal_text(result), Shown(product_id, result, kind=REFRESH))


async def _bulk(
    listing: CatalogueJobs,
    word: str,
    names: Sequence[str],
    product_id: int | None,
    catalogue: Sequence[_Product],
    bulk_ticks: Sequence[int],
    resolve: Callable[[str], _Product | str],
    name_it: str,
    shown: Sequence[Shown],
) -> ListingReply:
    if word.casefold() == THESE:
        ids: tuple[int, ...] = tuple(bulk_ticks)
        if not ids:
            return ListingReply(WHICH_PRODUCTS)
    elif names:
        chosen: list[_Product] = []
        for name in names:
            found = resolve(name)
            if isinstance(found, str):
                return ListingReply(found)
            chosen.append(found)
        ids = tuple(product.id for product in chosen)
    elif product_id is not None:
        ids = (product_id,)
    else:
        return ListingReply(name_it if word else WHICH_PRODUCTS)
    started = await listing.bulk_seo(ids)
    if isinstance(started, str):
        return ListingReply(started)
    if not started:
        return ListingReply(WHICH_PRODUCTS)
    blocks: list[str] = []
    added: list[Shown] = []
    for item in started:
        name = _title(catalogue, item.product_id)
        if item.proposal is None:
            blocks.append(_block(name, item.refused or "Could not parse listing copy refresh."))
            continue
        blocks.append(_block(name, proposal_text(item.proposal)))
        added.append(
            Shown(
                item.product_id,
                item.proposal,
                kind=BULK,
                trace_id=item.trace_id,
                pack_id=item.pack_id,
            )
        )
    return ListingReply("\n\n".join(blocks), shown_after=tuple(shown) + tuple(added))


async def _dismiss(
    listing: CatalogueJobs,
    product_id: int | None,
    photo_ids: Sequence[int],
    shown: Sequence[Shown],
    name_it: str,
) -> ListingReply:
    if product_id is None:
        return ListingReply(name_it)
    current = _match(shown, product_id, photo_ids)
    if current is None:
        return ListingReply(NO_PROPOSAL)
    refused = await listing.dismiss(
        current.product_id, kind=current.kind, trace_id=current.trace_id
    )
    if refused:
        return ListingReply(refused)
    photos = _photos(product_id, photo_ids)
    kept = tuple(item for item in shown if item.product_id not in photos)
    return ListingReply(DISMISSED, shown_after=kept)


async def _field(
    listing: CatalogueJobs,
    product_id: int | None,
    photo_ids: Sequence[int],
    field: str | None,
    shown: Sequence[Shown],
    name_it: str,
) -> ListingReply:
    if product_id is None:
        return ListingReply(name_it)
    if not field or not field.strip():
        return ListingReply(WHICH_FIELD)
    result = await listing.regenerate_field(product_id, field.strip())
    if isinstance(result, str):
        return ListingReply(result)
    label = _LABELS.get(result.field, result.field)
    text = f"{label}\n{result.text}"
    current = _match(shown, product_id, photo_ids)
    if current is None or current.kind != "generate":
        return ListingReply(text)
    updated = replace(current, proposal=_merged(current.proposal, result))
    replaced = tuple(updated if item is current else item for item in shown)
    return ListingReply(text, shown_after=replaced)


async def _accept_many(
    listing: CatalogueJobs,
    word: str,
    names: Sequence[str],
    shown: Sequence[Shown],
    catalogue: Sequence[_Product],
    resolve: Callable[[str], _Product | str],
    name_it: str,
) -> ListingReply:
    if word.casefold() == ALL:
        targets = _latest(shown)
        if not targets:
            return ListingReply(WRITE_FIRST)
    else:
        targets_list: list[Shown] = []
        for name in names:
            found = resolve(name)
            if isinstance(found, str):
                return ListingReply(found)
            current = _match(shown, found.id, found.photo_ids)
            if current is None:
                return ListingReply(WRITE_FIRST)
            targets_list.append(current)
        targets = tuple(targets_list)
    lines: list[str] = []
    spent = 0
    many = len(targets) > 1
    for item in targets:
        kept = await listing.accept(
            item.product_id,
            item.proposal,
            kind=item.kind,
            trace_id=item.trace_id,
            pack_id=item.pack_id or "",
        )
        if kept.refused:
            lines.append(kept.refused)
            break
        spent += kept.credits_spent
        title = _title(catalogue, item.product_id)
        lines.append(f"{title} — {ACCEPTED}" if many else ACCEPTED)
    return ListingReply("\n\n".join(lines), credits_spent=spent)
