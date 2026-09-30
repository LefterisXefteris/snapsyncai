"""Propose — search demand and the model's rewrite for listing copy refresh and Bulk SEO.

The product page, the Bulk SEO page, and the conversation all call this. It loads the
product, checks eligibility, fetches search demand, asks the model, and records the trace.
Nothing is saved here; the seller's accept is `listing_copy_accept`.

Search demand and the model are external: tests replace `fetch_search_demand` and
`propose_refresh_pack` on this module.
"""

from __future__ import annotations

import logging
import time
import uuid
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any, Literal

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.services import images as store
from app.services import product
from app.services.bulk_seo import Pack, PackItem, photos_from_images, regenerate_item, start_pack
from app.services.listing_copy_accept import PRODUCT_NOT_FOUND
from app.services.listing_copy_refresh import (
    REFRESH_PROPOSAL_SYSTEM,
    listing_copy_from_image,
    parse_refresh_proposal,
    refresh_blocked_reason,
    rewrite_constraints,
    search_demand_configured,
    seed_search_demand,
    start_listing_copy_refresh,
)
from app.services.listing_copy_trace import (
    JOB_BULK,
    JOB_REFRESH,
    ListingCopyCall,
    listing_copy_trace_store,
    record_listing_copy_call,
)
from app.services.openai_client import get_openai
from app.services.plan_charge import current_entitlement

logger = logging.getLogger(__name__)

PARSE_FAILED = "Could not parse listing copy refresh."

Refused = Literal["not_found", "blocked", "unparsed"]


@dataclass(frozen=True)
class Proposed:
    proposal: dict[str, Any] | None = None
    queries: tuple[str, ...] = ()
    refused: Refused | None = None
    message: str | None = None


async def fetch_search_demand(
    seeds: Sequence[str],
    url: str | None,
    api_key: str | None,
    *,
    login: str | None = None,
) -> tuple[str, ...]:
    from app.services.search_demand import fetch_dataforseo, is_dataforseo_url

    if is_dataforseo_url(url):
        return await fetch_dataforseo(seeds, str(url), login, api_key)
    if not url or not str(url).strip():
        return ()
    headers = {}
    if api_key and str(api_key).strip():
        headers["Authorization"] = f"Bearer {api_key.strip()}"
    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.get(
            url,
            params={"q": " ".join(seeds)},
            headers=headers,
        )
        response.raise_for_status()
        data = response.json()
    raw = data.get("queries") if isinstance(data, dict) else None
    if not isinstance(raw, list):
        return ()
    return tuple(str(item).strip() for item in raw if str(item).strip())


async def propose_refresh_pack(constraints: str, *, trace: dict | None = None) -> dict | None:
    started = time.perf_counter()
    text = ""
    error: str | None = None
    input_tokens: int | None = None
    output_tokens: int | None = None
    try:
        response = await get_openai().chat.completions.create(
            model="gpt-5.2",
            max_completion_tokens=1500,
            messages=[
                {"role": "system", "content": REFRESH_PROPOSAL_SYSTEM},
                {"role": "user", "content": constraints},
            ],
        )
        usage = getattr(response, "usage", None)
        if usage is not None:
            input_tokens = getattr(usage, "prompt_tokens", None)
            output_tokens = getattr(usage, "completion_tokens", None)
        if response.choices:
            text = response.choices[0].message.content or ""
        parsed = parse_refresh_proposal(text)
        if parsed is None:
            error = PARSE_FAILED
    except Exception:
        logger.exception("listing copy refresh generation failed")
        _record_refresh_trace(trace, constraints, text, "Generation failed", started, None, None)
        raise
    recorded = _record_refresh_trace(
        trace, constraints, text, error, started, input_tokens, output_tokens
    )
    if parsed is not None and recorded is not None:
        return {**parsed, "traceId": recorded.id}
    return parsed


def _record_refresh_trace(
    trace: dict | None,
    constraints: str,
    text: str,
    error: str | None,
    started: float,
    input_tokens: int | None,
    output_tokens: int | None,
):
    if trace is None:
        return None
    return record_listing_copy_call(
        trace["store"],
        ListingCopyCall(
            job=trace["job"],
            messages=[
                {"role": "system", "content": REFRESH_PROPOSAL_SYSTEM},
                {"role": "user", "content": constraints},
            ],
            completion=text,
            error=error,
            model="gpt-5.2",
            latency_ms=int((time.perf_counter() - started) * 1000),
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            product_id=trace["product_id"],
            group_id=trace.get("group_id"),
            pack_id=trace.get("pack_id"),
        ),
    )


def _demand_configured(settings: Settings) -> bool:
    return search_demand_configured(
        settings.search_demand_api_key,
        settings.search_demand_url,
        settings.search_demand_login,
    )


async def _demand(settings: Settings, seeds: Sequence[str]) -> tuple[str, ...]:
    return await fetch_search_demand(
        seeds,
        settings.search_demand_url,
        settings.search_demand_api_key,
        login=settings.search_demand_login,
    )


def _trace(settings: Settings, job: str, product_id: int, photo, pack_id: str | None) -> dict:
    return {
        "store": listing_copy_trace_store(settings),
        "job": job,
        "product_id": product_id,
        "group_id": getattr(photo, "product_group_id", None) if photo is not None else None,
        "pack_id": pack_id,
    }


async def propose_refresh(
    session: AsyncSession,
    settings: Settings,
    user_id: str,
    product_id: int,
    *,
    queries: Sequence[str] | None = None,
) -> Proposed:
    """Propose a listing copy refresh. Seller-edited `queries` skip the search demand fetch."""
    loaded = await product.load(session, user_id, product_id)
    if loaded is None:
        return Proposed(refused="not_found", message=PRODUCT_NOT_FOUND)
    image, facts, shop_gpsr = loaded.photo, loaded.facts, loaded.shop_gpsr
    listing_copy = listing_copy_from_image(image)
    configured = _demand_configured(settings)
    blocked = refresh_blocked_reason(facts, listing_copy, configured)
    if blocked:
        return Proposed(refused="blocked", message=blocked)
    if queries is None:
        fetched = await _demand(settings, seed_search_demand(facts, listing_copy))
        started = start_listing_copy_refresh(
            facts, listing_copy, configured, fetch=lambda _seeds: fetched, shop_gpsr=shop_gpsr
        )
    else:
        started = start_listing_copy_refresh(
            facts,
            listing_copy,
            configured,
            fetch=lambda _seeds: (),
            shop_gpsr=shop_gpsr,
            queries=queries,
        )
    if started.error:
        return Proposed(refused="blocked", message=started.error)
    pack = await propose_refresh_pack(
        rewrite_constraints(facts, started.queries, listing_copy, shop_gpsr),
        trace=_trace(settings, JOB_REFRESH, image.id, image, None),
    )
    if pack is None:
        return Proposed(refused="unparsed", message=PARSE_FAILED, queries=started.queries)
    return Proposed(proposal=pack, queries=started.queries)


async def propose_bulk_seo(
    session: AsyncSession, settings: Settings, user_id: str, product_ids: Sequence[int]
) -> tuple[Pack, str]:
    """Start a Bulk SEO run: one listing copy refresh proposal per picked product."""
    photos = photos_from_images(await store.list_images(session, user_id))
    by_id = {photo.id: photo for photo in photos}
    pack_id = uuid.uuid4().hex

    async def fetch(_product_id: int, seeds):
        return await _demand(settings, seeds)

    async def propose(product_id: int, **kwargs):
        return await propose_refresh_pack(
            kwargs["constraints"],
            trace=_trace(settings, JOB_BULK, product_id, by_id.get(product_id), pack_id),
        )

    pack = await start_pack(
        photos,
        product_ids,
        demand_configured=_demand_configured(settings),
        entitlement=await current_entitlement(session, settings, user_id),
        fetch=fetch,
        propose=propose,
        shop_gpsr=await product.shop_gpsr(session, user_id),
    )
    return pack, pack_id


async def regenerate_bulk_seo(
    session: AsyncSession,
    settings: Settings,
    user_id: str,
    product_id: int,
    queries: Sequence[str],
    *,
    pack_id: str | None = None,
) -> PackItem | None:
    """Rewrite one Bulk SEO product against seller-edited queries. None: not this seller's."""
    photos = photos_from_images(await store.list_images(session, user_id))
    photo = next((item for item in photos if item.id == product_id), None)
    if photo is None:
        return None

    async def propose(**kwargs):
        return await propose_refresh_pack(
            kwargs["constraints"],
            trace=_trace(settings, JOB_BULK, photo.id, photo, pack_id),
        )

    return await regenerate_item(
        photo,
        queries,
        demand_configured=_demand_configured(settings),
        propose=propose,
        fetch=lambda *_args: (),
        shop_gpsr=await product.shop_gpsr(session, user_id),
    )
