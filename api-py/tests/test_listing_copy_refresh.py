"""Listing copy refresh module — demand-shaped rewrite stays gated on facts and copy."""

from app.services.listing_copy_refresh import (
    accept_listing_copy_refresh,
    parse_refresh_proposal,
    refresh_blocked_reason,
    refresh_payload_outcomes,
    rewrite_constraints,
    seed_search_demand,
    start_listing_copy_refresh,
)
from app.services.product_facts import (
    ProductFacts,
    confirm_facts,
    description_blocks,
    facts_from_stored,
    persistable_from_vision,
)

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


def _refresh_client(monkeypatch):
    from fastapi.testclient import TestClient

    from app.config import get_settings
    from app.db import get_session
    from app.main import create_app

    monkeypatch.setenv("DATABASE_URL", "postgresql://u:p@localhost:5432/db")
    monkeypatch.setenv("CLERK_SECRET_KEY", "sk_test_fake")
    monkeypatch.setenv("DEV_BYPASS_AUTH", "true")
    monkeypatch.setenv("SEARCH_DEMAND_API_KEY", "sk-demand")
    monkeypatch.setenv("SEARCH_DEMAND_URL", "https://demand.example/queries")
    get_settings.cache_clear()
    app = create_app()

    async def _no_db():
        yield None

    app.dependency_overrides[get_session] = _no_db
    return TestClient(app, raise_server_exceptions=False)


def test_refresh_http_refuses_unconfirmed_facts(monkeypatch) -> None:
    from app.auth.clerk import DEV_USER_ID
    from app.config import get_settings
    from app.models.image import Image
    from app.services import connections
    from app.services import images as store

    photo = Image(
        id=21,
        original_name="shirt.jpg",
        mime_type="image/jpeg",
        size=12,
        session_id=DEV_USER_ID,
        title="Cotton tee",
    )

    async def fake_get(_session, image_id: int, _session_id: str = ""):
        return photo if image_id == photo.id else None

    async def fake_group(_session, image_id: int, _user_id: str):
        return [photo] if image_id == photo.id else []

    async def fake_shopify(_session, _user_id: str):
        return None

    monkeypatch.setattr(store, "get_image", fake_get)
    monkeypatch.setattr(store, "get_image_group", fake_group)
    monkeypatch.setattr(connections, "get_shopify", fake_shopify)
    client = _refresh_client(monkeypatch)
    try:
        response = client.post(f"/api/images/{photo.id}/listing-copy/refresh")
        assert response.status_code == 409
        assert response.json() == {
            "message": "Confirm product facts before refreshing listing copy."
        }
    finally:
        get_settings.cache_clear()


def test_refresh_http_returns_a_pack_from_demand(monkeypatch) -> None:
    from app.auth.clerk import DEV_USER_ID
    from app.config import get_settings
    from app.models.image import Image
    from app.routers import images as images_router
    from app.services import connections
    from app.services import images as store
    from app.services.product_facts import stored_from_facts

    photo = Image(
        id=22,
        original_name="shirt.jpg",
        mime_type="image/jpeg",
        size=12,
        session_id=DEV_USER_ID,
        title="Cotton tee",
        description="<p>A tee.</p>",
        product_facts=stored_from_facts(_confirmed_facts()),
    )

    async def fake_get(_session, image_id: int, _session_id: str = ""):
        return photo if image_id == photo.id else None

    async def fake_group(_session, image_id: int, _user_id: str):
        return [photo] if image_id == photo.id else []

    async def fake_fetch(_seeds, _url, _key, *, login=None):
        return ("cotton t-shirt",)

    async def fake_propose(_constraints):
        return {
            "tags": ["cotton", "tee"],
            "description": "<p>A cotton tee.</p>",
            "seoTitle": "Cotton tee",
            "seoDescription": "Buy a cotton tee",
        }

    async def fake_shopify(_session, _user_id: str):
        return None

    monkeypatch.setattr(store, "get_image", fake_get)
    monkeypatch.setattr(store, "get_image_group", fake_group)
    monkeypatch.setattr(connections, "get_shopify", fake_shopify)
    monkeypatch.setattr(images_router, "fetch_search_demand", fake_fetch)
    monkeypatch.setattr(images_router, "propose_refresh_pack", fake_propose)
    client = _refresh_client(monkeypatch)
    try:
        response = client.post(f"/api/images/{photo.id}/listing-copy/refresh")
        assert response.status_code == 200
        assert response.json() == {
            "tags": ["cotton", "tee"],
            "description": "<p>A cotton tee.</p>",
            "seoTitle": "Cotton tee",
            "seoDescription": "Buy a cotton tee",
            "queries": ["cotton t-shirt"],
        }
    finally:
        get_settings.cache_clear()
