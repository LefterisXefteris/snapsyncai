"""Bulk SEO module — catalogue picker reuses listing copy refresh eligibility.

Seam: `app.services.bulk_seo`.
"""

from app.services.bulk_seo import BulkSeoPhoto, photos_from_images, picker, regenerate_item, start_pack
from app.services.product_facts import (
    confirm_facts,
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


def _photo(**overrides) -> BulkSeoPhoto:
    values = dict(
        id=1,
        product_group_id=None,
        title="Cotton tee",
        listing_copy={"title": "Cotton tee"},
        facts=_confirmed_facts(),
        photo_url="https://cdn.example/tee.jpg",
    )
    values.update(overrides)
    return BulkSeoPhoto(**values)


def test_photos_from_images_omit_snapsync_storage_urls() -> None:
    from types import SimpleNamespace

    image = SimpleNamespace(
        id=8,
        product_group_id=None,
        title="Tee",
        description="Soft tee",
        tags=("tee",),
        seo_title="Tee",
        seo_description="Soft tee",
        aeo_snippet=None,
        aeo_faqs=None,
        storage_url="https://abc.supabase.co/storage/v1/object/public/product-images/8/x.jpg",
        product_facts=None,
    )
    assert photos_from_images([image])[0].photo_url is None


def test_blocked_row_keeps_the_refresh_reason() -> None:
    view = picker(
        [_photo(facts=facts_from_stored(None))],
        demand_configured=True,
        entitlement="plan",
    )
    assert len(view.rows) == 1
    assert view.rows[0].eligible is False
    assert view.rows[0].blocked_reason == (
        "Confirm product facts before refreshing listing copy."
    )


def test_refresh_eligible_product_is_tickable() -> None:
    view = picker(
        [_photo()],
        demand_configured=True,
        entitlement="plan",
    )
    assert view.rows[0].eligible is True
    assert view.rows[0].blocked_reason is None
    assert view.rows[0].id == 1
    assert view.rows[0].title == "Cotton tee"


def test_grouped_photos_are_one_catalogue_row() -> None:
    front = _photo(id=10, product_group_id="g1", photo_url="https://cdn.example/front.jpg")
    back = _photo(
        id=11,
        product_group_id="g1",
        title=None,
        listing_copy={},
        photo_url="https://cdn.example/back.jpg",
    )
    view = picker([front, back], demand_configured=True, entitlement="plan")
    assert len(view.rows) == 1
    assert view.rows[0].id == 10
    assert view.rows[0].eligible is True
    assert view.rows[0].photo_url == "https://cdn.example/front.jpg"


def test_start_without_a_plan_is_blocked() -> None:
    view = picker([_photo()], demand_configured=True, entitlement="free")
    assert view.rows[0].eligible is True
    assert view.start_blocked_reason == (
        "Subscribe to a Plan to generate listing copy, refresh from search demand, "
        "run Bulk SEO, or build a website."
    )


def test_unconfigured_search_demand_blocks_start() -> None:
    view = picker([_photo()], demand_configured=False, entitlement="plan")
    assert view.start_blocked_reason == "Search demand is not configured."


def test_dataforseo_without_login_blocks_bulk_seo_start() -> None:
    from app.services.listing_copy_refresh import search_demand_configured
    from app.services.search_demand import DATAFORSEO_LIVE_URL

    configured = search_demand_configured("password", DATAFORSEO_LIVE_URL)
    view = picker([_photo()], demand_configured=configured, entitlement="plan")
    assert view.start_blocked_reason == "Search demand is not configured."


def test_proposed_use_count_is_eligible_ticks_not_blocked_rows() -> None:
    ready = _photo(id=1)
    blocked = _photo(id=2, facts=facts_from_stored(None), title="Draft")
    view = picker(
        [ready, blocked],
        demand_configured=True,
        entitlement="plan",
        selected_ids=[1, 2],
    )
    assert view.proposed_use_count == 1


def test_proposed_use_count_ignores_unticked_eligible_products() -> None:
    view = picker(
        [_photo(id=1), _photo(id=2, title="Mug", listing_copy={"title": "Mug"})],
        demand_configured=True,
        entitlement="plan",
        selected_ids=[2],
    )
    assert view.proposed_use_count == 1


def test_empty_catalogue_has_no_rows() -> None:
    view = picker([], demand_configured=True, entitlement="plan")
    assert view.rows == ()
    assert view.proposed_use_count == 0
    assert view.start_blocked_reason is None


def test_empty_catalogue_without_a_plan_still_blocks_start() -> None:
    view = picker([], demand_configured=True, entitlement="free")
    assert view.rows == ()
    assert view.start_blocked_reason == (
        "Subscribe to a Plan to generate listing copy, refresh from search demand, "
        "run Bulk SEO, or build a website."
    )


def test_local_bypass_can_start_without_a_paid_plan() -> None:
    view = picker([_photo()], demand_configured=True, entitlement="local_bypass")
    assert view.start_blocked_reason is None
    assert view.rows[0].eligible is True


def _must_not_fetch(_product_id, _seeds):
    raise AssertionError("must not fetch search demand")


def _must_not_propose(_product_id, **_kwargs):
    raise AssertionError("must not propose listing copy")


async def test_start_with_no_ids_is_refused() -> None:
    pack = await start_pack(
        [_photo()],
        selected_ids=[],
        demand_configured=True,
        entitlement="plan",
        fetch=_must_not_fetch,
        propose=_must_not_propose,
    )
    assert pack.error == "Pick products to start Bulk SEO."
    assert pack.items == ()


_PACK = {
    "tags": ["cotton", "tee"],
    "description": "<p>A cotton tee.</p>",
    "seoTitle": "Cotton tee",
    "seoDescription": "Buy a cotton tee",
}


async def test_one_empty_demand_item_does_not_drop_siblings() -> None:
    ready = _photo(id=1)
    empty = _photo(id=2, title="Mug", listing_copy={"title": "Mug"})

    def fetch(product_id: int, _seeds):
        if product_id == 2:
            return ()
        return ("cotton t-shirt",)

    def propose(product_id: int, **_kwargs):
        if product_id == 2:
            raise AssertionError("must not propose without search demand")
        return _PACK

    pack = await start_pack(
        [ready, empty],
        selected_ids=[1, 2],
        demand_configured=True,
        entitlement="plan",
        fetch=fetch,
        propose=propose,
    )
    assert pack.error is None
    by_id = {item.id: item for item in pack.items}
    assert by_id[1].error is None
    assert by_id[1].queries == ("cotton t-shirt",)
    assert by_id[1].proposal == _PACK
    assert "title" not in by_id[1].proposal
    assert "aeoSnippet" not in by_id[1].proposal
    assert by_id[2].error == "No search demand for this product."
    assert by_id[2].proposal is None
    assert pack.proposed_use_count == 1


async def test_one_parse_failure_does_not_drop_siblings() -> None:
    ready = _photo(id=1)
    broken = _photo(id=2, title="Mug", listing_copy={"title": "Mug"})

    def fetch(_product_id: int, _seeds):
        return ("cotton t-shirt",)

    def propose(product_id: int, **_kwargs):
        if product_id == 2:
            return None
        return _PACK

    pack = await start_pack(
        [ready, broken],
        selected_ids=[1, 2],
        demand_configured=True,
        entitlement="plan",
        fetch=fetch,
        propose=propose,
    )
    by_id = {item.id: item for item in pack.items}
    assert by_id[1].proposal == _PACK
    assert by_id[2].error == "Could not parse listing copy refresh."
    assert by_id[2].proposal is None
    assert pack.proposed_use_count == 1


async def test_forged_blocked_id_returns_the_refresh_reason_and_continues() -> None:
    ready = _photo(id=1)
    blocked = _photo(id=2, facts=facts_from_stored(None), title="Draft")
    pack = await start_pack(
        [ready, blocked],
        selected_ids=[1, 2],
        demand_configured=True,
        entitlement="plan",
        fetch=lambda _pid, _seeds: ("cotton t-shirt",),
        propose=lambda _pid, **_kwargs: _PACK,
    )
    by_id = {item.id: item for item in pack.items}
    assert by_id[1].proposal == _PACK
    assert by_id[2].error == "Confirm product facts before refreshing listing copy."
    assert pack.proposed_use_count == 1


async def test_start_without_a_plan_does_not_fetch_demand() -> None:
    pack = await start_pack(
        [_photo()],
        selected_ids=[1],
        demand_configured=True,
        entitlement="free",
        fetch=_must_not_fetch,
        propose=_must_not_propose,
    )
    assert pack.error == (
        "Subscribe to a Plan to generate listing copy, refresh from search demand, "
        "run Bulk SEO, or build a website."
    )
    assert pack.items == ()


async def test_regenerate_rewrites_against_the_same_snapshot() -> None:
    snapshot = ("cotton t-shirt", "crew neck tee")
    first = {"tags": ["cotton"], "description": "<p>A</p>", "seoTitle": "A", "seoDescription": "A"}
    second = {"tags": ["tee"], "description": "<p>B</p>", "seoTitle": "B", "seoDescription": "B"}
    calls: list[tuple[str, ...]] = []

    def propose(_product_id: int, **kwargs):
        calls.append(tuple(kwargs["queries"]))
        return second if len(calls) > 1 else first

    started = await start_pack(
        [_photo()],
        selected_ids=[1],
        demand_configured=True,
        entitlement="plan",
        fetch=lambda _pid, _seeds: snapshot,
        propose=propose,
    )
    item = started.items[0]
    again = await regenerate_item(
        _photo(),
        item.queries,
        demand_configured=True,
        propose=lambda **kwargs: propose(1, **kwargs),
        fetch=_must_not_fetch,
    )
    assert item.queries == snapshot
    assert again.queries == snapshot
    assert again.proposal == second
    assert calls == [snapshot, snapshot]
