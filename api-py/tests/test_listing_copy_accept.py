"""Accept — saves listing copy. A Plan does not record a use. Leftover weekly still counts.

Seam: `app.services.listing_copy_accept`, on a real Postgres (`db`).
"""

import asyncio

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.pool import NullPool

from app.db import build_engine_url, run_after_commit
from app.services import billing
from app.services import images as store
from app.services.listing_copy_accept import accept_generated, accept_refresh
from app.services.plan import NEED_PLAN
from app.services.plan_charge import report_unreported_overage
from app.services.plan_ledger import record_spend
from app.services.product_facts import facts_from_stored
from tests.seed import (
    OTHER_SELLER,
    SELLER,
    STRIPE_CUSTOMER,
    confirmed_facts,
    plan,
    product,
    spends,
    use_allowance,
)

PROPOSAL = {
    "tags": ["cotton", "tee"],
    "description": "<p>A cotton tee.</p>",
    "seoTitle": "Cotton tee",
    "seoDescription": "Buy a cotton tee",
}


@pytest.fixture
def stripe(monkeypatch) -> list[str]:
    reported: list[str] = []
    monkeypatch.setattr(
        billing, "report_overage", lambda customer, **_options: reported.append(customer)
    )
    return reported


async def _description(db, product_id: int) -> str | None:
    return (await store.get_image(db, product_id, SELLER)).description


async def test_refresh_accept_saves_the_copy_and_does_not_record_a_use(db, db_settings) -> None:
    await plan(db)
    pid = await product(db, facts=confirmed_facts())
    result = await accept_refresh(db, db_settings, SELLER, pid, PROPOSAL, job="refresh")
    assert result.refused is None
    assert result.spent is False
    assert result.product.seo_title == "Cotton tee"
    assert result.product.tags == ["cotton", "tee"]
    assert await spends(db) == []


async def test_bulk_seo_accept_does_not_record_a_use(db, db_settings) -> None:
    await plan(db)
    pid = await product(db, facts=confirmed_facts())
    result = await accept_refresh(db, db_settings, SELLER, pid, PROPOSAL, job="bulk_seo")
    assert result.spent is False
    assert result.product.seo_title == "Cotton tee"
    assert await spends(db) == []


async def test_a_proposal_that_drops_the_facts_block_saves_nothing(db, db_settings) -> None:
    await plan(db)
    pid = await product(db, facts=confirmed_facts(textile=True))
    result = await accept_refresh(db, db_settings, SELLER, pid, PROPOSAL, job="refresh")
    assert result.refused == "invalid_proposal"
    assert await _description(db, pid) == "<p>Old.</p>"
    assert await spends(db) == []


async def test_bulk_seo_accept_reads_facts_from_the_whole_product(db, db_settings) -> None:
    await plan(db)
    await product(db, facts=confirmed_facts(textile=True), product_group_id="tee")
    second_photo = await product(db, facts=None, product_group_id="tee")
    result = await accept_refresh(db, db_settings, SELLER, second_photo, PROPOSAL, job="bulk_seo")
    assert result.refused == "invalid_proposal"
    assert await spends(db) == []


async def test_without_a_plan_nothing_is_saved(db, db_settings) -> None:
    pid = await product(db, facts=confirmed_facts())
    result = await accept_refresh(db, db_settings, SELLER, pid, PROPOSAL, job="bulk_seo")
    assert (result.refused, result.message) == ("plan_blocked", NEED_PLAN)
    assert await _description(db, pid) == "<p>Old.</p>"
    assert await spends(db) == []


async def test_a_plan_accept_after_recorded_uses_saves_and_does_not_charge(
    db, db_settings, stripe
) -> None:
    await plan(db)
    await use_allowance(db, 20)
    pid = await product(db, facts=confirmed_facts())
    result = await accept_refresh(db, db_settings, SELLER, pid, PROPOSAL, job="refresh")
    assert result.refused is None
    assert result.spent is False
    assert await _description(db, pid) == "<p>A cotton tee.</p>"
    assert len(await spends(db)) == 20
    await run_after_commit(db)
    assert stripe == []


async def test_a_queued_overage_line_is_still_reported_once(db, db_settings, stripe) -> None:
    await plan(db)
    queued = await record_spend(
        db, SELLER, "refresh_accept", as_overage=True, overage_reported=False
    )
    pid = await product(db, facts=confirmed_facts())
    result = await accept_refresh(db, db_settings, SELLER, pid, PROPOSAL, job="refresh")
    assert result.spent is False
    assert [row.id for row in await spends(db)] == [queued.id]
    assert stripe == []
    await run_after_commit(db)
    assert stripe == [STRIPE_CUSTOMER]
    assert queued.overage_reported is True
    await report_unreported_overage(db, SELLER)
    assert stripe == [STRIPE_CUSTOMER]


async def test_a_failed_overage_report_is_billed_once_on_the_next_run(
    db, db_settings, monkeypatch
) -> None:
    await plan(db)
    queued = await record_spend(
        db, SELLER, "refresh_accept", as_overage=True, overage_reported=False
    )
    keys: list[str] = []

    def stripe_down(customer: str, *, idempotency_key: str) -> None:
        raise RuntimeError("stripe down")

    monkeypatch.setattr(billing, "report_overage", stripe_down)
    await report_unreported_overage(db, SELLER)
    assert queued.overage_reported is False

    monkeypatch.setattr(
        billing,
        "report_overage",
        lambda customer, *, idempotency_key: keys.append(idempotency_key),
    )
    await report_unreported_overage(db, SELLER)
    await report_unreported_overage(db, SELLER)
    assert keys == [f"allowance-spend-{queued.id}"]
    assert queued.overage_reported is True


async def test_two_plan_accepts_both_save(
    test_database_url, db_settings
) -> None:
    racer = "user_racer"
    engine = create_async_engine(build_engine_url(test_database_url), poolclass=NullPool)
    try:
        async with AsyncSession(engine, expire_on_commit=False) as setup:
            await plan(setup, racer)
            first = await product(setup, owner=racer, facts=confirmed_facts())
            second = await product(setup, owner=racer, facts=confirmed_facts())
            await setup.commit()
        async with AsyncSession(engine) as a, AsyncSession(engine) as b:
            landed = await accept_refresh(a, db_settings, racer, first, PROPOSAL, job="refresh")
            racing = asyncio.create_task(
                accept_refresh(b, db_settings, racer, second, PROPOSAL, job="refresh")
            )
            await asyncio.sleep(0.3)
            await a.commit()
            late = await asyncio.wait_for(racing, timeout=5)
            await b.commit()
        assert landed.refused is None
        assert landed.spent is False
        assert late.refused is None
        assert late.spent is False
    finally:
        async with engine.begin() as cleanup:
            for statement in (
                "delete from allowance_spends where user_id = :u",
                "delete from subscriptions where user_id = :u",
                "delete from images where session_id = :u",
            ):
                await cleanup.execute(text(statement), {"u": racer})
        await engine.dispose()


async def test_local_bypass_saves_without_spending(db, db_settings) -> None:
    bypass = db_settings.model_copy(update={"dev_bypass_auth": True})
    pid = await product(db, facts=confirmed_facts())
    result = await accept_refresh(db, bypass, SELLER, pid, PROPOSAL, job="refresh")
    assert result.refused is None
    assert result.spent is False
    assert await _description(db, pid) == "<p>A cotton tee.</p>"
    assert await spends(db) == []


async def test_another_sellers_product_is_not_found(db, db_settings) -> None:
    await plan(db)
    pid = await product(db, owner=OTHER_SELLER, facts=confirmed_facts())
    result = await accept_refresh(db, db_settings, SELLER, pid, PROPOSAL, job="refresh")
    assert result.refused == "not_found"
    assert (await store.get_image(db, pid, OTHER_SELLER)).description == "<p>Old.</p>"
    assert await spends(db) == []


async def test_first_generate_accept_saves_and_does_not_record_a_use(db, db_settings) -> None:
    await plan(db)
    pid = await product(db, facts=confirmed_facts(), listed=False)
    result = await accept_generated(
        db, db_settings, SELLER, pid, {"title": "Cotton tee", "description": "<p>A tee.</p>"}
    )
    assert result.spent is False
    assert result.product.title == "Cotton tee"
    assert await spends(db) == []


async def test_regenerating_stale_listing_copy_does_not_spend(db, db_settings) -> None:
    await plan(db)
    pid = await product(db, facts=confirmed_facts(stale=True))
    result = await accept_generated(
        db, db_settings, SELLER, pid, {"description": "<p>Fresh.</p>"}
    )
    assert result.refused is None
    assert result.spent is False
    assert facts_from_stored(result.product.product_facts).listing_copy_stale is False
    assert await spends(db) == []


async def test_generate_accept_waits_for_confirmed_facts(db, db_settings) -> None:
    await plan(db)
    pid = await product(db, facts=None, listed=False)
    result = await accept_generated(db, db_settings, SELLER, pid, {"title": "Cotton tee"})
    assert result.refused == "facts_blocked"
    assert (await store.get_image(db, pid, SELLER)).title is None
    assert await spends(db) == []
