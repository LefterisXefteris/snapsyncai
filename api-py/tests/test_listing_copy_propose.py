"""Propose — search demand and the model's rewrite, for one product or a Bulk SEO run.

Seam: `app.services.listing_copy_propose`, on a real Postgres (`db`). Search demand and
the model are replaced on that module; nothing else is.
"""

import pytest

from app.services import listing_copy_propose
from app.services.listing_copy_accept import accept_generated
from app.services.listing_copy_propose import (
    propose_bulk_seo,
    propose_refresh,
    regenerate_bulk_seo,
)
from app.services.listing_copy_trace import JOB_REFRESH
from app.services.plan import NEED_PLAN
from tests.seed import OTHER_SELLER, SELLER, confirmed_facts, plan, product

PROPOSAL = {
    "tags": ["cotton", "tee"],
    "description": "<p>A cotton tee.</p>",
    "seoTitle": "Cotton tee",
    "seoDescription": "Buy a cotton tee",
}


class External:
    """Stands in for search demand and the model; records what they were asked."""

    def __init__(self) -> None:
        self.demand: tuple[str, ...] = ("cotton t-shirt",)
        self.reply: dict | None = PROPOSAL
        self.seeds: list[tuple[str, ...]] = []
        self.prompts: list[str] = []
        self.traces: list[dict | None] = []

    async def fetch(self, seeds, _url, _key, *, login=None):
        self.seeds.append(tuple(seeds))
        return self.demand

    async def propose(self, constraints, *, trace=None):
        self.prompts.append(constraints)
        self.traces.append(trace)
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


async def test_refresh_proposes_from_search_demand(db, settings, external) -> None:
    pid = await product(db, facts=confirmed_facts())
    result = await propose_refresh(db, settings, SELLER, pid)
    assert result.refused is None
    assert result.proposal == PROPOSAL
    assert result.queries == ("cotton t-shirt",)
    assert "cotton t-shirt" in external.prompts[0]
    assert (external.traces[0]["job"], external.traces[0]["product_id"]) == (JOB_REFRESH, pid)


async def test_seller_queries_skip_the_search_demand_fetch(db, settings, external) -> None:
    pid = await product(db, facts=confirmed_facts())
    result = await propose_refresh(db, settings, SELLER, pid, queries=["linen shirt"])
    assert result.queries == ("linen shirt",)
    assert external.seeds == []


async def test_refresh_waits_for_listing_copy(db, settings, external) -> None:
    pid = await product(db, facts=confirmed_facts(), listed=False)
    result = await propose_refresh(db, settings, SELLER, pid)
    assert (result.refused, result.message) == (
        "blocked",
        "Generate listing copy before refreshing from search demand.",
    )
    assert external.seeds == []
    assert external.prompts == []


async def test_listing_copy_accepted_on_one_photo_refreshes_from_another(
    db, settings, external
) -> None:
    await plan(db)
    front = await product(db, facts=confirmed_facts(), listed=False, product_group_id="tee")
    back = await product(db, facts=confirmed_facts(), listed=False, product_group_id="tee")
    accepted = await accept_generated(
        db, settings, SELLER, front, {"title": "Cotton tee", "tags": ["crew neck"]}
    )
    assert accepted.refused is None

    result = await propose_refresh(db, settings, SELLER, back)

    assert result.refused is None
    assert external.seeds == [("Cotton tee", "crew neck")]


async def test_no_search_demand_asks_the_model_nothing(db, settings, external) -> None:
    external.demand = ()
    pid = await product(db, facts=confirmed_facts())
    result = await propose_refresh(db, settings, SELLER, pid)
    assert (result.refused, result.message) == ("blocked", "No search demand for this product.")
    assert external.prompts == []


async def test_an_unreadable_model_reply_is_unparsed(db, settings, external) -> None:
    external.reply = None
    pid = await product(db, facts=confirmed_facts())
    result = await propose_refresh(db, settings, SELLER, pid)
    assert result.refused == "unparsed"


async def test_another_sellers_product_is_not_found(db, settings, external) -> None:
    pid = await product(db, owner=OTHER_SELLER, facts=confirmed_facts())
    result = await propose_refresh(db, settings, SELLER, pid)
    assert result.refused == "not_found"
    assert external.seeds == []


async def test_bulk_seo_proposes_per_product_and_keeps_going(db, settings, external) -> None:
    await plan(db)
    ready = await product(db, facts=confirmed_facts())
    unlisted = await product(db, facts=confirmed_facts(), listed=False)
    pack, pack_id = await propose_bulk_seo(db, settings, SELLER, [ready, unlisted])
    by_id = {item.id: item for item in pack.items}
    assert by_id[ready].proposal == PROPOSAL
    assert by_id[unlisted].error == "Generate listing copy before refreshing from search demand."
    assert pack.proposed_use_count == 1
    assert [trace["pack_id"] for trace in external.traces] == [pack_id]


async def test_bulk_seo_without_a_plan_fetches_nothing(db, settings, external) -> None:
    pid = await product(db, facts=confirmed_facts())
    pack, _pack_id = await propose_bulk_seo(db, settings, SELLER, [pid])
    assert pack.error == NEED_PLAN
    assert external.seeds == []


async def test_bulk_seo_regenerate_uses_the_seller_queries(db, settings, external) -> None:
    pid = await product(db, facts=confirmed_facts())
    item = await regenerate_bulk_seo(db, settings, SELLER, pid, ["linen shirt"], pack_id="run")
    assert item.proposal == PROPOSAL
    assert item.queries == ("linen shirt",)
    assert external.seeds == []
    assert external.traces[0]["pack_id"] == "run"


async def test_bulk_seo_regenerate_of_another_sellers_product_is_none(
    db, settings, external
) -> None:
    pid = await product(db, owner=OTHER_SELLER, facts=confirmed_facts())
    assert await regenerate_bulk_seo(db, settings, SELLER, pid, ["linen shirt"]) is None
