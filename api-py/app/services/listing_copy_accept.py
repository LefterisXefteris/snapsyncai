"""Accept — the seller keeps proposed listing copy for one product.

The product page, the Bulk SEO page, and the conversation all call this. It loads the
product, checks the Plan, saves the copy, spends one Allowance use only when that write
lands, and records the trace. Callers map the result to HTTP or to the dialogue.
"""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any, Literal

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.models import Image
from app.services import images as store
from app.services import product
from app.services.listing_copy_refresh import accept_listing_copy_refresh
from app.services.listing_copy_trace import (
    listing_copy_trace_store,
    mark_bulk_accept,
    mark_generated_field,
    mark_refresh,
)
from app.services.plan import NEED_OVERFLOW_CONFIRM
from app.services.plan_charge import spend_when_landed
from app.services.product_facts import (
    accept_generated_listing_copy,
    generation_blocked_reason,
    stored_from_facts,
)

Refused = Literal[
    "not_found", "facts_blocked", "invalid_proposal", "plan_blocked", "overflow_confirm"
]
RefreshJob = Literal["refresh", "bulk_seo"]

PRODUCT_NOT_FOUND = "Product not found"

_GENERATED_FIELDS = (
    ("title", "title"),
    ("description", "description"),
    ("tags", "tags"),
    ("seo_title", "seoTitle"),
    ("seo_description", "seoDescription"),
    ("aeo_faqs", "aeoFaqs"),
)


@dataclass(frozen=True)
class Accepted:
    product: Image | None = None
    shop_gpsr: dict | None = None
    spent: bool = False
    refused: Refused | None = None
    message: str | None = None


def _refuse(refused: Refused, message: str) -> Accepted:
    return Accepted(refused=refused, message=message)


def _plan_refusal(reason: str) -> Accepted:
    if reason == NEED_OVERFLOW_CONFIRM:
        return _refuse("overflow_confirm", reason)
    return _refuse("plan_blocked", reason)


async def accept_generated(
    session: AsyncSession,
    settings: Settings,
    user_id: str,
    product_id: int,
    copy: Mapping[str, Any],
    *,
    confirm_overflow: bool = False,
    trace_id: str | None = None,
) -> Accepted:
    """Accept generated listing copy. Regenerating stale listing copy does not spend."""
    loaded = await product.load(session, user_id, product_id)
    if loaded is None:
        return _refuse("not_found", PRODUCT_NOT_FOUND)
    image, facts, shop_gpsr = loaded.photo, loaded.facts, loaded.shop_gpsr
    facts_blocked = generation_blocked_reason(facts)
    if facts_blocked:
        return _refuse("facts_blocked", facts_blocked)
    accepted = accept_generated_listing_copy(facts, copy, shop_gpsr)
    spent = False
    if accepted.listing_copy:
        landed = await spend_when_landed(
            session,
            settings,
            user_id,
            "generate_persist",
            lambda: store.update_image(session, product_id, accepted.listing_copy, user_id),
            listing_copy_was_stale=facts.listing_copy_stale,
            confirm_overflow=confirm_overflow,
            product_id=product_id,
        )
        if landed.refused:
            return _plan_refusal(landed.refused)
        if landed.result is None:
            return _refuse("not_found", PRODUCT_NOT_FOUND)
        image = landed.result
        spent = landed.spent
    updated = await store.persist_product_facts(session, image, stored_from_facts(accepted.facts))
    if updated is None:
        return _refuse("not_found", PRODUCT_NOT_FOUND)
    trace_store = listing_copy_trace_store(settings)
    for key, field_name in _GENERATED_FIELDS:
        if copy.get(key) is None:
            continue
        mark_generated_field(
            trace_store,
            product_id=product_id,
            field=field_name,
            accepted=copy[key],
            trace_id=trace_id,
        )
    return Accepted(product=updated, shop_gpsr=shop_gpsr, spent=spent)


async def accept_refresh(
    session: AsyncSession,
    settings: Settings,
    user_id: str,
    product_id: int,
    proposal: Mapping[str, Any],
    *,
    job: RefreshJob,
    confirm_overflow: bool = False,
    trace_id: str | None = None,
    pack_id: str = "",
) -> Accepted:
    """Accept a listing copy refresh proposal, alone or as one product of a Bulk SEO run."""
    loaded = await product.load(session, user_id, product_id)
    if loaded is None:
        return _refuse("not_found", PRODUCT_NOT_FOUND)
    facts, shop_gpsr = loaded.facts, loaded.shop_gpsr
    accepted = accept_listing_copy_refresh(facts, proposal, shop_gpsr)
    if accepted.error or accepted.listing_copy is None:
        return _refuse("invalid_proposal", accepted.error or "Could not accept listing copy.")
    landed = await spend_when_landed(
        session,
        settings,
        user_id,
        "refresh_accept" if job == "refresh" else "bulk_seo_persist",
        lambda: store.update_image(session, product_id, accepted.listing_copy, user_id),
        confirm_overflow=confirm_overflow,
        product_id=product_id,
    )
    if landed.refused:
        return _plan_refusal(landed.refused)
    if landed.result is None:
        return _refuse("not_found", PRODUCT_NOT_FOUND)
    trace_store = listing_copy_trace_store(settings)
    if job == "refresh":
        mark_refresh(trace_store, product_id=product_id, outcome="accepted", trace_id=trace_id)
    else:
        mark_bulk_accept(trace_store, product_id=product_id, pack_id=pack_id, trace_id=trace_id)
    return Accepted(product=landed.result, shop_gpsr=shop_gpsr, spent=landed.spent)
