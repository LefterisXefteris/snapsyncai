"""Allowance spend ledger. The Plan module stays a pure function of Spend rows."""

from __future__ import annotations

from datetime import UTC

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.billing import AllowanceSpend
from app.services.plan import JobKind, Spend


async def list_spends(session: AsyncSession | None, user_id: str) -> list[Spend]:
    if session is None:
        return []
    result = await session.execute(
        select(AllowanceSpend).where(AllowanceSpend.user_id == user_id)
    )
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
