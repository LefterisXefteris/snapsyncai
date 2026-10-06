"""Plan charge. Jobs ask here before they start and spend here when their write lands.

The Plan module stays a pure function of Spend rows.
"""

from __future__ import annotations

import logging
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.db import after_commit
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

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class Landed[T]:
    """`refused` is a Plan reason; no refusal and no `result` means the write did not land."""

    result: T | None = None
    spent: bool = False
    refused: str | None = None


def entitlement_for(sub: Subscription | None, *, local: bool):
    active = sub is not None and billing.is_active_status(sub.status)
    leftover = bool(active and leftover_weekly_from_interval(sub.billing_interval if sub else None))
    return entitlement_of(local_pro=local, has_active_plan=active, leftover_weekly=leftover)


async def _locked_subscription(session: AsyncSession, user_id: str) -> Subscription | None:
    result = await session.execute(
        select(Subscription).where(Subscription.user_id == user_id).with_for_update()
    )
    return result.scalar_one_or_none()


async def _context(
    session: AsyncSession | None, settings: Settings, user_id: str, *, lock: bool = False
):
    local = billing.is_local_pro(settings) or await billing.is_dev_free_user(user_id, settings)
    if local:
        return entitlement_of(local_pro=True, has_active_plan=False), [], None
    if session is None:
        return entitlement_of(local_pro=False, has_active_plan=False), [], None
    if lock:
        sub = await _locked_subscription(session, user_id)
    else:
        sub = await billing.get_subscription(session, user_id)
    entitlement = entitlement_for(sub, local=False)
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


async def may_start(
    session: AsyncSession, settings: Settings, user_id: str, job: JobKind
) -> str | None:
    """The Plan reason this job may not start, or None. Spends nothing."""
    entitlement, spends, sub = await _context(session, settings, user_id)
    decision = decide(
        entitlement,
        spends,
        datetime.now(UTC),
        job,
        overflow_confirmed_month=None if sub is None else sub.overflow_confirmed_month,
    )
    return None if decision.allowed else decision.blocked_reason


async def spend_when_landed[T](
    session: AsyncSession,
    settings: Settings,
    user_id: str,
    job: JobKind,
    write: Callable[[], Awaitable[T | None]],
    *,
    listing_copy_was_stale: bool = False,
    confirm_overflow: bool = False,
    product_id: int | None = None,
) -> Landed[T]:
    """Run `write` if the Plan allows this job. A Plan does not record a use.

    The seller's subscription row stays locked until the request commits, so a concurrent
    job decides after this one's spend is visible. Overflow reaches Stripe only after commit.
    """
    entitlement, spends, sub = await _context(session, settings, user_id, lock=True)
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
    if not decision.allowed:
        return Landed(refused=decision.blocked_reason)
    result = await write()
    if result is None:
        return Landed(result=None)
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
    if decision.records_spend or entitlement == "plan":
        after_commit(
            session,
            f"overage:{user_id}",
            lambda committed: report_unreported_overage(committed, user_id),
        )
    return Landed(result=result, spent=decision.records_spend)


async def report_unreported_overage(session: AsyncSession, user_id: str) -> None:
    """Bill each landed overflow use once. A failed report stays unreported for the next run."""
    sub = await _locked_subscription(session, user_id)
    if sub is None:
        return
    for row in await unreported_overage_spends(session, user_id):
        try:
            billing.report_overage(
                sub.stripe_customer_id, idempotency_key=f"allowance-spend-{row.id}"
            )
        except Exception:
            logger.exception("Overage report failed; spend %s stays unreported", row.id)
            return
        row.overage_reported = True
        await session.flush()
