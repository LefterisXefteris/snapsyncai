"""Listing copy refresh — propose tags, description, SEO title, and meta from search demand."""

from __future__ import annotations

import json
import re
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass
from typing import Any

from app.services.product_facts import (
    ProductFacts,
    listing_copy_present,
    may_generate_listing_copy,
)

_FACTS_CLOSED = "Confirm product facts before refreshing listing copy."
_COPY_MISSING = "Generate listing copy before refreshing from search demand."
_COPY_STALE = (
    "Regenerate listing copy from confirmed facts before refreshing from search demand."
)
DEMAND_UNCONFIGURED = "Search demand is not configured."
_EMPTY_DEMAND = "No search demand for this product."


@dataclass(frozen=True)
class RefreshStart:
    error: str | None = None
    proposal: Mapping[str, Any] | None = None
    queries: tuple[str, ...] = ()


def refresh_blocked_reason(
    facts: ProductFacts,
    listing_copy: Mapping[str, Any] | None,
    demand_configured: bool,
) -> str | None:
    if not may_generate_listing_copy(facts):
        return _FACTS_CLOSED
    if not listing_copy_present(listing_copy):
        return _COPY_MISSING
    if facts.listing_copy_stale:
        return _COPY_STALE
    if not demand_configured:
        return DEMAND_UNCONFIGURED
    return None


def refresh_payload_outcomes(
    facts: ProductFacts,
    listing_copy: Mapping[str, Any] | None,
    demand_configured: bool,
) -> dict[str, Any]:
    reason = refresh_blocked_reason(facts, listing_copy, demand_configured)
    return {
        "may_refresh_listing_copy": reason is None,
        "refresh_blocked_reason": reason,
    }


def listing_copy_from_image(image: Any) -> dict[str, Any]:
    return {
        "title": getattr(image, "title", None),
        "description": getattr(image, "description", None),
        "tags": getattr(image, "tags", None),
        "seo_title": getattr(image, "seo_title", None),
        "seo_description": getattr(image, "seo_description", None),
        "aeo_snippet": getattr(image, "aeo_snippet", None),
        "aeo_faqs": getattr(image, "aeo_faqs", None),
    }


def search_demand_configured(
    api_key: str | None, url: str | None = None, login: str | None = None
) -> bool:
    from app.services.search_demand import is_dataforseo_url

    if not url or not str(url).strip():
        return False
    if is_dataforseo_url(url):
        return bool(login and str(login).strip() and api_key and str(api_key).strip())
    return bool(api_key and str(api_key).strip())


def seed_search_demand(
    facts: ProductFacts, listing_copy: Mapping[str, Any] | None
) -> tuple[str, ...]:
    seeds: list[str] = []
    copy = listing_copy or {}
    title = copy.get("title")
    if isinstance(title, str) and title.strip():
        seeds.append(title.strip())
    tags = copy.get("tags")
    if isinstance(tags, Sequence) and not isinstance(tags, (str, bytes)):
        for tag in tags:
            if isinstance(tag, str) and tag.strip():
                seeds.append(tag.strip())
    confirmed = facts.confirmed
    if confirmed is not None:
        for row in confirmed.composition:
            seeds.append(row.name)
    return tuple(dict.fromkeys(seeds))


def start_listing_copy_refresh(
    facts: ProductFacts,
    listing_copy: Mapping[str, Any] | None,
    demand_configured: bool,
    fetch: Callable[[Sequence[str]], Sequence[str]],
    propose: Callable[..., Mapping[str, Any]] | None = None,
    shop_gpsr: Mapping[str, Any] | None = None,
    queries: Sequence[str] | None = None,
) -> RefreshStart:
    reason = refresh_blocked_reason(facts, listing_copy, demand_configured)
    if reason:
        return RefreshStart(error=reason)
    if queries is None:
        raw = fetch(seed_search_demand(facts, listing_copy))
    else:
        raw = queries
    queries = tuple(str(query).strip() for query in raw if str(query).strip())
    if not queries:
        return RefreshStart(error=_EMPTY_DEMAND)
    if propose is None:
        return RefreshStart(queries=queries)
    pack = propose(
        queries=queries,
        constraints=rewrite_constraints(facts, queries, listing_copy, shop_gpsr),
        listing_copy=listing_copy,
    )
    return RefreshStart(proposal=pack, queries=queries)


def rewrite_constraints(
    facts: ProductFacts,
    queries: Sequence[str],
    listing_copy: Mapping[str, Any] | None,
    shop_gpsr: Mapping[str, Any] | None = None,
) -> str:
    from app.services.product_facts import description_blocks, listing_copy_constraints

    parts = [
        listing_copy_constraints(facts, shop_gpsr),
        "Aim listing copy at these search queries: " + ", ".join(queries) + ".",
        (
            "Rewrite only tags, description, SEO title (max 70 characters), "
            "and meta description (max 320 characters)."
        ),
        (
            "Do not change the product title. Do not write AEO. "
            "Do not invent claims that are not confirmed facts."
        ),
        "Drop rising or season words that are not true of the confirmed facts.",
        "Do not scrape, name, or imitate competitor listings.",
    ]
    blocks = description_blocks(facts, shop_gpsr)
    if blocks:
        parts.append(
            "The description must contain this English facts block verbatim: " + blocks
        )
    copy = listing_copy or {}
    current = copy.get("description")
    if isinstance(current, str) and current.strip():
        parts.append("Current description:\n" + current.strip())
    return "\n".join(part for part in parts if part)


REFRESH_PROPOSAL_SYSTEM = """You rewrite existing listing copy so it can rank for search demand.
Output ONLY valid JSON with this exact structure (no markdown, no code fences):
{"tags": ["keyword"], "description": "HTML description",
 "seoTitle": "page title", "seoDescription": "meta description"}
Rules:
- tags: Shopify tags; use only confirmed fibre names for materials
- seoTitle: max 70 characters
- seoDescription: max 320 characters
- description must keep the English facts block unchanged when one is provided
- do not invent product facts, competitor names, or AEO
- do not change the product title
"""


def parse_refresh_proposal(text: str) -> dict[str, Any] | None:
    stripped = text.strip()
    try:
        parsed = json.loads(stripped)
    except json.JSONDecodeError:
        match = re.search(r"\{[\s\S]*\}", stripped)
        if match is None:
            return None
        try:
            parsed = json.loads(match.group(0))
        except json.JSONDecodeError:
            return None
    if not isinstance(parsed, dict):
        return None
    tags = parsed.get("tags")
    description = parsed.get("description")
    seo_title = parsed.get("seoTitle", parsed.get("seo_title"))
    seo_description = parsed.get("seoDescription", parsed.get("seo_description"))
    if not isinstance(description, str) or not isinstance(seo_title, str):
        return None
    if not isinstance(seo_description, str):
        return None
    if not isinstance(tags, list) or not all(isinstance(tag, str) for tag in tags):
        return None
    return {
        "tags": tags,
        "description": description,
        "seoTitle": seo_title[:70],
        "seoDescription": seo_description[:320],
    }


_BLOCK_CHANGED = "Proposed description must keep the product-facts block unchanged."


@dataclass(frozen=True)
class RefreshAccept:
    error: str | None = None
    listing_copy: dict[str, Any] | None = None


def accept_listing_copy_refresh(
    facts: ProductFacts,
    proposal: Mapping[str, Any],
    shop_gpsr: Mapping[str, Any] | None = None,
) -> RefreshAccept:
    from app.services.product_facts import description_blocks

    description = proposal.get("description")
    if not isinstance(description, str):
        description = ""
    blocks = description_blocks(facts, shop_gpsr)
    if blocks and blocks not in description:
        return RefreshAccept(error=_BLOCK_CHANGED)
    tags = proposal.get("tags")
    if not isinstance(tags, list):
        tags = []
    seo_title = proposal.get("seoTitle", proposal.get("seo_title"))
    seo_description = proposal.get("seoDescription", proposal.get("seo_description"))
    title_text = seo_title[:70] if isinstance(seo_title, str) else ""
    meta_text = seo_description[:320] if isinstance(seo_description, str) else ""
    return RefreshAccept(
        listing_copy={
            "tags": [tag for tag in tags if isinstance(tag, str)],
            "description": description,
            "seo_title": title_text,
            "seo_description": meta_text,
        }
    )
