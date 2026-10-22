"""Allowance spend ledger. The Plan module stays a pure function of Spend rows."""

from __future__ import annotations

from collections.abc import Collection
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.billing import AllowanceSpend
from app.services.plan import (
    Entitlement,
    JobKind,
    Spend,
    week_start_utc,
)

# Kinds that free AllowanceView / decide count. Keep in sync with plan._LISTING_COPY_WRITE_JOBS.
_FREE_SPEND_KINDS = frozenset({"generate_persist", "refresh_accept", "bulk_seo_persist"})


async def list_spends(
    session: AsyncSession | None,
    user_id: str,
    *,
    since: datetime | None = None,
    kinds: Collection[str] | None = None,
) -> list[Spend]:
    if session is None:
        return []
    stmt = select(AllowanceSpend).where(AllowanceSpend.user_id == user_id)
    if since is not None:
        stmt = stmt.where(AllowanceSpend.created_at >= since)
    if kinds is not None:
        stmt = stmt.where(AllowanceSpend.kind.in_(tuple(kinds)))
    result = await session.execute(stmt)
    rows = result.scalars().all()
    spends: list[Spend] = []
    for row in rows:
        at = row.created_at
        if at is None:
            continue
        if at.tzinfo is None:
            at = at.replace(tzinfo=UTC)
        spends.append(Spend(at=at, kind=row.kind))  # type: ignore[arg-type]
    return spends


async def list_spends_for_entitlement(
    session: AsyncSession | None,
    user_id: str,
    entitlement: Entitlement,
    *,
    now: datetime | None = None,
) -> list[Spend]:
    """Load only the Spend rows `plan.view` / `decide` need for this entitlement."""
    if entitlement in ("plan", "local_bypass"):
        return []
    if entitlement == "leftover_weekly":
        return await list_spends(
            session, user_id, since=week_start_utc(now or datetime.now(UTC))
        )
    return await list_spends(session, user_id, kinds=_FREE_SPEND_KINDS)


async def record_spend(
    session: AsyncSession,
    user_id: str,
    kind: JobKind,
    *,
    as_overage: bool,
    product_id: int | None = None,
    overage_reported: bool = True,
) -> AllowanceSpend:
    row = AllowanceSpend(
        user_id=user_id,
        kind=kind,
        product_id=product_id,
        as_overage=as_overage,
        overage_reported=overage_reported,
    )
    session.add(row)
    await session.flush()
    return row


async def unreported_overage_spends(session: AsyncSession, user_id: str) -> list[AllowanceSpend]:
    result = await session.execute(
        select(AllowanceSpend).where(
            AllowanceSpend.user_id == user_id,
            AllowanceSpend.as_overage.is_(True),
            AllowanceSpend.overage_reported.is_(False),
        )
    )
    return list(result.scalars().all())
