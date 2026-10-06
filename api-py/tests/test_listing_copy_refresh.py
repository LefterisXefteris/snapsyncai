"""Listing copy refresh module — demand-shaped rewrite stays gated on facts and copy.

The HTTP tests map each propose and accept outcome to its status; the rules behind them
are tested in `test_listing_copy_propose.py` and `test_listing_copy_accept.py`.
"""

import httpx
import pytest

from app.config import get_settings
from app.services import listing_copy_propose
from app.services.listing_copy_refresh import (
    REFRESH_PROPOSAL_SYSTEM,
    accept_listing_copy_refresh,
    parse_refresh_proposal,
    refresh_blocked_reason,
    refresh_payload_outcomes,
    rewrite_constraints,
    seed_search_demand,
    start_listing_copy_refresh,
)
from app.services.plan import NEED_PLAN
from app.services.product_facts import (
    ProductFacts,
    confirm_facts,
    description_blocks,
    facts_from_stored,
    persistable_from_vision,
)
from tests import seed
from tests.seed import OTHER_SELLER

VISION_NON_TEXTILE = {"isTextile": False}


def _confirmed_facts():
    return confirm_facts(
        persistable_from_vision(VISION_NON_TEXTILE).facts,
        is_textile=False,
        gpsr_choice="skip",
    ).facts


def test_unconfirmed_facts_cannot_refresh() -> None:
    assert refresh_blocked_reason(
        facts_from_stored(None),
        listing_copy={"title": "Cotton tee"},
        demand_configured=True,
    ) == "Confirm product facts before refreshing listing copy."


def test_confirmed_facts_without_listing_copy_cannot_refresh() -> None:
    assert refresh_blocked_reason(
        _confirmed_facts(),
        listing_copy=None,
        demand_configured=True,
    ) == "Generate listing copy before refreshing from search demand."


def test_stale_listing_copy_cannot_refresh() -> None:
    facts = _confirmed_facts()
    stale = ProductFacts(
        suggested=facts.suggested,
        confirmed=facts.confirmed,
        listing_copy_stale=True,
    )
    assert refresh_blocked_reason(
        stale,
        listing_copy={"title": "Cotton tee"},
        demand_configured=True,
    ) == (
        "Regenerate listing copy from confirmed facts before refreshing from search demand."
    )


def test_unconfigured_search_demand_cannot_refresh() -> None:
    assert refresh_blocked_reason(
        _confirmed_facts(),
        listing_copy={"title": "Cotton tee"},
        demand_configured=False,
    ) == "Search demand is not configured."


def test_unconfirmed_facts_win_over_missing_search_demand() -> None:
    assert refresh_blocked_reason(
        facts_from_stored(None),
        listing_copy={"title": "Cotton tee"},
        demand_configured=False,
    ) == "Confirm product facts before refreshing listing copy."


def test_title_only_listing_copy_can_refresh_when_demand_is_configured() -> None:
    assert (
        refresh_blocked_reason(
            _confirmed_facts(),
            listing_copy={"title": "Cotton tee"},
            demand_configured=True,
        )
        is None
    )


def test_empty_listing_copy_fields_cannot_refresh() -> None:
    assert refresh_blocked_reason(
        _confirmed_facts(),
        listing_copy={"title": "", "tags": []},
        demand_configured=True,
    ) == "Generate listing copy before refreshing from search demand."


def test_refresh_payload_names_the_blocked_reason() -> None:
    assert refresh_payload_outcomes(
        facts_from_stored(None),
        {"title": "Cotton tee"},
        demand_configured=True,
    ) == {
        "may_refresh_listing_copy": False,
        "refresh_blocked_reason": "Confirm product facts before refreshing listing copy.",
    }


def test_refresh_payload_allows_refresh_when_the_gate_is_open() -> None:
    assert refresh_payload_outcomes(
        _confirmed_facts(),
        {"title": "Cotton tee"},
        demand_configured=True,
    ) == {
        "may_refresh_listing_copy": True,
        "refresh_blocked_reason": None,
    }


def test_blank_search_demand_key_is_not_configured() -> None:
    from app.services.listing_copy_refresh import search_demand_configured

    assert search_demand_configured(None, "https://demand.example") is False
    assert search_demand_configured("", "https://demand.example") is False
    assert search_demand_configured("sk-demand", None) is False
    assert search_demand_configured("sk-demand", "") is False
    assert search_demand_configured("sk-demand", "https://demand.example") is True


def test_empty_search_demand_cannot_start_refresh() -> None:
    started = start_listing_copy_refresh(
        _confirmed_facts(),
        {"title": "Cotton tee"},
        demand_configured=True,
        fetch=lambda _seeds: (),
        propose=_must_not_propose,
    )
    assert started.error == "No search demand for this product."
    assert started.proposal is None
    assert started.queries == ()


def _must_not_propose(**_kwargs):
    raise AssertionError("must not propose without search demand")


def test_unconfirmed_facts_cannot_start_refresh() -> None:
    started = start_listing_copy_refresh(
        facts_from_stored(None),
        {"title": "Cotton tee"},
        demand_configured=True,
        fetch=lambda _seeds: ("cotton tee",),
        propose=_must_not_propose,
    )
    assert started.error == "Confirm product facts before refreshing listing copy."
    assert started.proposal is None


def test_start_refresh_returns_the_proposal_and_queries() -> None:
    pack = {
        "tags": ["cotton", "tee"],
        "description": "<p>A cotton tee.</p>",
        "seoTitle": "Cotton tee",
        "seoDescription": "Buy a cotton tee",
    }
    started = start_listing_copy_refresh(
        _confirmed_facts(),
        {"title": "Cotton tee"},
        demand_configured=True,
        fetch=lambda _seeds: ("cotton t-shirt", "crew neck tee"),
        propose=lambda **_kwargs: pack,
    )
    assert started.error is None
    assert started.queries == ("cotton t-shirt", "crew neck tee")
    assert started.proposal == pack


def test_search_demand_is_seeded_from_title_tags_and_fibre_names() -> None:
    facts = confirm_facts(
        persistable_from_vision({"isTextile": True, "fibreNames": ["cotton"]}).facts,
        is_textile=True,
        composition=[{"name": "cotton", "percent": 100}],
        gpsr_choice="skip",
        care_choice="skip",
    ).facts
    assert seed_search_demand(
        facts, {"title": "Summer tee", "tags": ["crew neck", "Summer tee"]}
    ) == ("Summer tee", "crew neck", "cotton")


def test_rewrite_constraints_keep_the_facts_block_and_name_the_queries() -> None:
    facts = confirm_facts(
        persistable_from_vision({"isTextile": True}).facts,
        is_textile=True,
        composition=[{"name": "cotton", "percent": 100}],
        gpsr_choice="skip",
        care_choice="skip",
    ).facts
    text = rewrite_constraints(facts, ["organic cotton tee"], {"title": "Cotton tee"})
    assert "organic cotton tee" in text
    assert description_blocks(facts) in text
    assert "cotton" in text
    assert "competitor" in text.lower()
    assert "70" in text
    assert "320" in text


def test_refresh_instructions_lead_with_the_first_search_query() -> None:
    facts = confirm_facts(
        persistable_from_vision({"isTextile": True, "fibreNames": ["cotton"]}).facts,
        is_textile=True,
        composition=[{"name": "cotton", "percent": 100}],
        gpsr_choice="skip",
        care_choice="skip",
    ).facts
    text = rewrite_constraints(
        facts,
        ["organic cotton tee", "crew neck tee"],
        {"title": "Cotton tee", "description": "<p>A soft tee.</p>"},
    )
    instructions = REFRESH_PROPOSAL_SYSTEM + "\n" + text
    assert (
        "Lead the SEO title and the meta description with this search query: "
        "organic cotton tee."
    ) in instructions
    assert "Keep these search queries in the copy as support: crew neck tee." in instructions
    assert "Open the description by answering: organic cotton tee." in instructions
    assert (
        "The meta description names organic cotton tee, names a benefit taken "
        "from the confirmed facts, includes a short call to action, and leaves price out."
    ) in instructions
    assert description_blocks(facts) in instructions
    assert "70" in instructions
    assert "320" in instructions
    assert "Fibre tags use only these confirmed fibre names: cotton." in instructions
    assert "Other tags come from the search queries." in instructions
    assert "Remove generic filler phrasing." in instructions
    assert "Do not write AEO." in instructions
    assert "Do not add schema, images, links, reviews, or Shopping checks." in instructions
    assert "Tags and AEO may use only" not in instructions


def test_parse_refresh_proposal_reads_the_four_fields() -> None:
    raw = (
        '{"tags": ["cotton"], "description": "<p>Tee</p>",'
        ' "seoTitle": "Cotton tee", "seoDescription": "A cotton tee"}'
    )
    assert parse_refresh_proposal(raw) == {
        "tags": ["cotton"],
        "description": "<p>Tee</p>",
        "seoTitle": "Cotton tee",
        "seoDescription": "A cotton tee",
    }


def test_regenerate_keeps_the_snapshot_and_does_not_fetch() -> None:
    pack = {
        "tags": ["cotton"],
        "description": "<p>Tee</p>",
        "seoTitle": "Cotton tee",
        "seoDescription": "A cotton tee",
    }

    def must_not_fetch(_seeds):
        raise AssertionError("must not fetch search demand again")

    started = start_listing_copy_refresh(
        _confirmed_facts(),
        {"title": "Cotton tee"},
        demand_configured=True,
        fetch=must_not_fetch,
        propose=lambda **_kwargs: pack,
        queries=("cotton t-shirt", "crew neck tee"),
    )
    assert started.error is None
    assert started.queries == ("cotton t-shirt", "crew neck tee")
    assert started.proposal == pack


def test_accept_refresh_persists_four_fields_and_keeps_the_facts_block() -> None:
    facts = confirm_facts(
        persistable_from_vision({"isTextile": True}).facts,
        is_textile=True,
        composition=[{"name": "cotton", "percent": 100}],
        gpsr_choice="skip",
        care_choice="skip",
    ).facts
    block = description_blocks(facts)
    accepted = accept_listing_copy_refresh(
        facts,
        {
            "tags": ["cotton", "tee"],
            "description": f"<p>Soft tee.</p>\n{block}",
            "seoTitle": "Cotton tee",
            "seoDescription": "A cotton tee",
        },
    )
    assert accepted.error is None
    assert accepted.listing_copy == {
        "tags": ["cotton", "tee"],
        "description": f"<p>Soft tee.</p>\n{block}",
        "seo_title": "Cotton tee",
        "seo_description": "A cotton tee",
    }
    assert accepted.listing_copy["description"] == f"<p>Soft tee.</p>\n{block}"
    assert "title" not in accepted.listing_copy
    assert "aeo_faqs" not in accepted.listing_copy


def test_accept_refresh_leaves_stale_listing_copy_as_it_was() -> None:
    facts = confirm_facts(
        persistable_from_vision({"isTextile": False}).facts,
        is_textile=False,
        gpsr_choice="skip",
    ).facts
    stale = ProductFacts(
        suggested=facts.suggested,
        confirmed=facts.confirmed,
        listing_copy_stale=True,
    )
    accepted = accept_listing_copy_refresh(
        stale,
        {
            "tags": ["mug"],
            "description": "<p>A mug.</p>",
            "seoTitle": "Mug",
            "seoDescription": "A mug",
        },
    )
    assert accepted.error is None
    assert stale.listing_copy_stale is True
    assert "listing_copy_stale" not in (accepted.listing_copy or {})


def test_accept_refresh_does_not_stamp_description_blocks() -> None:
    facts = confirm_facts(
        persistable_from_vision({"isTextile": True}).facts,
        is_textile=True,
        composition=[{"name": "cotton", "percent": 100}],
        gpsr_choice="skip",
        care_choice="skip",
    ).facts
    block = description_blocks(facts)
    proposed = f"<p>Soft tee.</p>\n{block}"
    accepted = accept_listing_copy_refresh(
        facts,
        {
            "tags": ["cotton"],
            "description": proposed,
            "seoTitle": "Cotton tee",
            "seoDescription": "A cotton tee",
        },
    )
    assert accepted.listing_copy is not None
    assert accepted.listing_copy["description"] == proposed


def test_accept_refresh_truncates_seo_title_and_meta() -> None:
    accepted = accept_listing_copy_refresh(
        _confirmed_facts(),
        {
            "tags": ["tee"],
            "description": "<p>A tee.</p>",
            "seoTitle": "T" * 80,
            "seoDescription": "M" * 400,
        },
    )
    assert accepted.listing_copy is not None
    assert accepted.listing_copy["seo_title"] == "T" * 70
    assert accepted.listing_copy["seo_description"] == "M" * 320


def test_a_new_start_fetches_a_new_snapshot() -> None:
    packs = [
        {"tags": ["a"], "description": "a", "seoTitle": "a", "seoDescription": "a"},
        {"tags": ["b"], "description": "b", "seoTitle": "b", "seoDescription": "b"},
    ]
    first = start_listing_copy_refresh(
        _confirmed_facts(),
        {"title": "Cotton tee"},
        demand_configured=True,
        fetch=lambda _seeds: ("first query",),
        propose=lambda **_kwargs: packs[0],
    )
    second = start_listing_copy_refresh(
        _confirmed_facts(),
        {"title": "Cotton tee"},
        demand_configured=True,
        fetch=lambda _seeds: ("second query",),
        propose=lambda **_kwargs: packs[1],
    )
    assert first.queries == ("first query",)
    assert second.queries == ("second query",)
    assert first.queries != second.queries


def test_accept_refresh_rejects_a_mutated_facts_block() -> None:
    facts = confirm_facts(
        persistable_from_vision({"isTextile": True}).facts,
        is_textile=True,
        composition=[{"name": "cotton", "percent": 100}],
        gpsr_choice="skip",
        care_choice="skip",
    ).facts
    accepted = accept_listing_copy_refresh(
        facts,
        {
            "tags": ["organic"],
            "description": "<p>Organic silk-feel tee.</p>",
            "seoTitle": "Organic tee",
            "seoDescription": "Organic",
        },
    )
    assert accepted.error == (
        "Proposed description must keep the product-facts block unchanged."
    )
    assert accepted.listing_copy is None


PROPOSAL = {
    "tags": ["cotton", "tee"],
    "description": "<p>A cotton tee.</p>",
    "seoTitle": "Cotton tee",
    "seoDescription": "Buy a cotton tee",
}


class External:
    """Stands in for search demand and the model on the propose module."""

    def __init__(self) -> None:
        self.reply: dict | None = PROPOSAL

    async def fetch(self, _seeds, _url, _key, *, login=None):
        return ("cotton t-shirt",)

    async def propose(self, _constraints, *, trace=None):
        return self.reply


@pytest.fixture
def external(monkeypatch) -> External:
    fake = External()
    monkeypatch.setattr(listing_copy_propose, "fetch_search_demand", fake.fetch)
    monkeypatch.setattr(listing_copy_propose, "propose_refresh_pack", fake.propose)
    return fake


@pytest.fixture
def settings(db_settings):
    return db_settings.model_copy(
        update={"search_demand_url": "https://demand.test/queries", "search_demand_api_key": "k"}
    )


async def test_refresh_http_returns_the_proposal_and_queries(db, api, settings, external) -> None:
    tee = await seed.product(db, facts=seed.confirmed_facts())

    response = await api(f"/api/images/{tee}/listing-copy/refresh", settings=settings)

    assert response.status_code == 200
    assert response.json() == {**PROPOSAL, "queries": ["cotton t-shirt"]}


async def test_catalogue_offers_refresh_on_a_photo_whose_sibling_has_listing_copy(
    db, seller_app, settings
) -> None:
    front = await seed.product(db, facts=seed.confirmed_facts(), product_group_id="tee")
    back = await seed.product(
        db, facts=seed.confirmed_facts(), listed=False, product_group_id="tee"
    )
    standalone = await seed.product(db, facts=seed.confirmed_facts(), listed=False)
    seller_app.dependency_overrides[get_settings] = lambda: settings
    transport = httpx.ASGITransport(app=seller_app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/images")

    by_id = {item["id"]: item for item in response.json()}
    assert by_id[front]["mayRefreshListingCopy"] is True
    assert by_id[back]["mayRefreshListingCopy"] is True
    assert by_id[standalone]["refreshBlockedReason"] == (
        "Generate listing copy before refreshing from search demand."
    )


async def test_refresh_http_is_a_conflict_while_blocked(db, api, settings) -> None:
    tee = await seed.product(db)

    response = await api(f"/api/images/{tee}/listing-copy/refresh", settings=settings)

    assert response.status_code == 409
    assert response.json() == {"message": "Confirm product facts before refreshing listing copy."}


async def test_refresh_http_is_a_bad_gateway_when_the_reply_is_unreadable(
    db, api, settings, external
) -> None:
    external.reply = None
    tee = await seed.product(db, facts=seed.confirmed_facts())

    response = await api(f"/api/images/{tee}/listing-copy/refresh", settings=settings)

    assert response.status_code == 502
    assert response.json() == {"message": "Could not parse listing copy refresh."}


async def test_refresh_http_of_another_sellers_product_is_not_found(db, api, settings) -> None:
    theirs = await seed.product(db, owner=OTHER_SELLER, facts=seed.confirmed_facts())

    response = await api(f"/api/images/{theirs}/listing-copy/refresh", settings=settings)

    assert response.status_code == 404
    assert response.json() == {"detail": "Image not found"}


async def test_refresh_accept_http_returns_the_saved_product(db, api) -> None:
    await seed.plan(db)
    tee = await seed.product(db, facts=seed.confirmed_facts())

    response = await api(f"/api/images/{tee}/listing-copy/refresh/accept", PROPOSAL)

    assert response.status_code == 200
    assert response.json()["seoTitle"] == "Cotton tee"
    assert response.json()["tags"] == ["cotton", "tee"]


async def test_refresh_accept_http_is_a_conflict_when_the_proposal_drops_the_facts_block(
    db, api
) -> None:
    await seed.plan(db)
    tee = await seed.product(db, facts=seed.confirmed_facts(textile=True))

    response = await api(f"/api/images/{tee}/listing-copy/refresh/accept", PROPOSAL)

    assert response.status_code == 409
    assert response.json() == {
        "message": "Proposed description must keep the product-facts block unchanged."
    }


async def test_refresh_accept_http_without_a_plan_is_forbidden(db, api) -> None:
    tee = await seed.product(db, facts=seed.confirmed_facts())

    response = await api(f"/api/images/{tee}/listing-copy/refresh/accept", PROPOSAL)

    assert response.status_code == 403
    assert response.json() == {"detail": NEED_PLAN}


async def test_refresh_accept_http_of_another_sellers_product_is_not_found(db, api) -> None:
    await seed.plan(db)
    theirs = await seed.product(db, owner=OTHER_SELLER, facts=seed.confirmed_facts())

    response = await api(f"/api/images/{theirs}/listing-copy/refresh/accept", PROPOSAL)

    assert response.status_code == 404
    assert response.json() == {"detail": "Image not found"}
