"""HTTP adapters call this; the Plan module stays a pure function of Spend rows."""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.models.billing import Subscription
from app.services import billing
from app.services.plan import (
    JobKind,
    decide,
    entitlement_of,
    leftover_weekly_from_interval,
    month_key_utc,
)
from app.services.plan_ledger import list_spends, record_spend, unreported_overage_spends
from app.services.plan_overage import persist_spend_then_report


def _entitlement(sub: Subscription | None, *, local: bool):
    active = sub is not None and billing.is_active_status(sub.status)
    leftover = bool(active and leftover_weekly_from_interval(sub.billing_interval if sub else None))
    return entitlement_of(local_pro=local, has_active_plan=active, leftover_weekly=leftover)


async def _context(session: AsyncSession | None, settings: Settings, user_id: str):
    local = billing.is_local_pro(settings) or await billing.is_dev_free_user(user_id, settings)
    if local:
        return entitlement_of(local_pro=True, has_active_plan=False), [], None
    if session is None:
        return entitlement_of(local_pro=False, has_active_plan=False), [], None
    sub = await billing.get_subscription(session, user_id)
    entitlement = _entitlement(sub, local=False)
    spends = await list_spends(session, user_id)
    return entitlement, spends, sub


async def current_entitlement(session: AsyncSession, settings: Settings, user_id: str):
    entitlement, _spends, _sub = await _context(session, settings, user_id)
    return entitlement


async def overflow_ack_month(session: AsyncSession, settings: Settings, user_id: str) -> str | None:
    _entitlement, _spends, sub = await _context(session, settings, user_id)
    return None if sub is None else sub.overflow_confirmed_month


async def overflow_view(session: AsyncSession, settings: Settings, user_id: str) -> tuple[bool, bool]:
    entitlement, spends, sub = await _context(session, settings, user_id)
    decision = decide(
        entitlement,
        spends,
        datetime.now(UTC),
        "website_handoff",
        completed=False,
        overflow_confirmed_month=None if sub is None else sub.overflow_confirmed_month,
    )
    return decision.overflow_notice, decision.overflow_confirm_required


async def authorize_plan_job(
    session: AsyncSession,
    settings: Settings,
    user_id: str,
    job: JobKind,
    *,
    listing_copy_was_stale: bool = False,
    confirm_overflow: bool = False,
    completing: bool = False,
) -> str | None:
    entitlement, spends, sub = await _context(session, settings, user_id)
    decision = decide(
        entitlement,
        spends,
        datetime.now(UTC),
        job,
        listing_copy_was_stale=listing_copy_was_stale,
        completed=completing,
        overflow_confirmed_month=None if sub is None else sub.overflow_confirmed_month,
        confirm_overflow=confirm_overflow,
    )
    return None if decision.allowed else decision.blocked_reason


async def _flush_unreported_overage(session: AsyncSession, sub: Subscription | None) -> None:
    if sub is None:
        return
    pending = await unreported_overage_spends(session, sub.user_id)
    for row in pending:
        reported = persist_spend_then_report(
            records_spend=True,
            as_overage=True,
            record=lambda **_kwargs: None,
            report=lambda: billing.report_overage(sub.stripe_customer_id),
        )
        if not reported:
            return
        row.overage_reported = True
        await session.flush()


async def settle_plan_job(
    session: AsyncSession,
    settings: Settings,
    user_id: str,
    job: JobKind,
    *,
    listing_copy_was_stale: bool = False,
    confirm_overflow: bool = False,
    product_id: int | None = None,
) -> None:
    entitlement, spends, sub = await _context(session, settings, user_id)
    now = datetime.now(UTC)
    decision = decide(
        entitlement,
        spends,
        now,
        job,
        listing_copy_was_stale=listing_copy_was_stale,
        completed=True,
        overflow_confirmed_month=None if sub is None else sub.overflow_confirmed_month,
        confirm_overflow=confirm_overflow,
    )
    if decision.records_spend:
        await record_spend(
            session,
            user_id,
            job,
            as_overage=decision.as_overage,
            product_id=product_id,
            overage_reported=not decision.as_overage,
        )
        if decision.as_overage and sub is not None:
            sub.overflow_confirmed_month = month_key_utc(now)
            await session.flush()
    await _flush_unreported_overage(session, sub)
