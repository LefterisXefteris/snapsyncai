"""Accept — saves listing copy and spends one Allowance use only when the write lands.

Seam: `app.services.listing_copy_accept`, on a real Postgres (`db`).
"""

import asyncio
from datetime import UTC, datetime

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.pool import NullPool

from app.db import build_engine_url, run_after_commit
from app.services import billing
from app.services import images as store
from app.services.listing_copy_accept import accept_generated, accept_refresh
from app.services.plan import NEED_OVERFLOW_CONFIRM, NEED_PLAN, PLAN_INCLUDED, month_key_utc
from app.services.plan_charge import report_unreported_overage
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


async def test_refresh_accept_saves_the_copy_and_spends_one_use(db, db_settings) -> None:
    await plan(db)
    pid = await product(db, facts=confirmed_facts())
    result = await accept_refresh(db, db_settings, SELLER, pid, PROPOSAL, job="refresh")
    assert result.refused is None
    assert result.spent is True
    assert result.product.seo_title == "Cotton tee"
    assert result.product.tags == ["cotton", "tee"]
    assert [(row.kind, row.product_id, row.as_overage) for row in await spends(db)] == [
        ("refresh_accept", pid, False)
    ]


async def test_bulk_seo_accept_spends_a_bulk_seo_use(db, db_settings) -> None:
    await plan(db)
    pid = await product(db, facts=confirmed_facts())
    result = await accept_refresh(db, db_settings, SELLER, pid, PROPOSAL, job="bulk_seo")
    assert result.spent is True
    assert [row.kind for row in await spends(db)] == ["bulk_seo_persist"]


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


async def test_the_first_extra_use_waits_for_overflow_confirm(db, db_settings, stripe) -> None:
    await plan(db)
    await use_allowance(db, PLAN_INCLUDED)
    pid = await product(db, facts=confirmed_facts())
    result = await accept_refresh(db, db_settings, SELLER, pid, PROPOSAL, job="refresh")
    assert (result.refused, result.message) == ("overflow_confirm", NEED_OVERFLOW_CONFIRM)
    assert await _description(db, pid) == "<p>Old.</p>"
    assert len(await spends(db)) == PLAN_INCLUDED
    assert stripe == []


async def test_a_confirmed_extra_use_is_overflow_and_reported_once(
    db, db_settings, stripe
) -> None:
    sub = await plan(db)
    await use_allowance(db, PLAN_INCLUDED)
    pid = await product(db, facts=confirmed_facts())
    result = await accept_refresh(
        db, db_settings, SELLER, pid, PROPOSAL, job="refresh", confirm_overflow=True
    )
    assert result.spent is True
    extra = (await spends(db))[-1]
    assert (extra.product_id, extra.as_overage, extra.overage_reported) == (pid, True, False)
    assert stripe == []
    assert sub.overflow_confirmed_month == month_key_utc(datetime.now(UTC))
    await run_after_commit(db)
    assert stripe == [STRIPE_CUSTOMER]
    assert extra.overage_reported is True


async def test_a_failed_overage_report_is_billed_once_on_the_next_run(
    db, db_settings, monkeypatch
) -> None:
    await plan(db)
    await use_allowance(db, PLAN_INCLUDED)
    pid = await product(db, facts=confirmed_facts())
    keys: list[str] = []

    def stripe_down(customer: str, *, idempotency_key: str) -> None:
        raise RuntimeError("stripe down")

    monkeypatch.setattr(billing, "report_overage", stripe_down)
    await accept_refresh(
        db, db_settings, SELLER, pid, PROPOSAL, job="refresh", confirm_overflow=True
    )
    await run_after_commit(db)
    extra = (await spends(db))[-1]
    assert extra.overage_reported is False

    monkeypatch.setattr(
        billing,
        "report_overage",
        lambda customer, *, idempotency_key: keys.append(idempotency_key),
    )
    await report_unreported_overage(db, SELLER)
    await report_unreported_overage(db, SELLER)
    assert keys == [f"allowance-spend-{extra.id}"]
    assert extra.overage_reported is True


async def test_two_accepts_at_the_last_included_use_do_not_both_land_included(
    test_database_url, db_settings
) -> None:
    racer = "user_racer"
    engine = create_async_engine(build_engine_url(test_database_url), poolclass=NullPool)
    try:
        async with AsyncSession(engine, expire_on_commit=False) as setup:
            await plan(setup, racer)
            await use_allowance(setup, PLAN_INCLUDED - 1, racer)
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
        assert landed.spent is True
        assert (late.refused, late.message) == ("overflow_confirm", NEED_OVERFLOW_CONFIRM)
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


async def test_first_generate_accept_spends_one_use(db, db_settings) -> None:
    await plan(db)
    pid = await product(db, facts=confirmed_facts(), listed=False)
    result = await accept_generated(
        db, db_settings, SELLER, pid, {"title": "Cotton tee", "description": "<p>A tee.</p>"}
    )
    assert result.spent is True
    assert result.product.title == "Cotton tee"
    assert [(row.kind, row.product_id) for row in await spends(db)] == [("generate_persist", pid)]


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
