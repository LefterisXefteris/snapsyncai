"""Plan entitlement and spend decisions. Stripe is an adapter, not this module."""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Literal

Entitlement = Literal["free", "plan", "leftover_weekly", "local_bypass"]
JobKind = Literal["generate_persist", "refresh_accept", "website_handoff", "bulk_seo_persist"]

PLAN_INCLUDED = 20
LEFTOVER_WEEKLY_INCLUDED = 30
FREE_WRITES_INCLUDED = 3
PLAN_MONTHLY_PENCE = 1900
PLAN_ANNUAL_PENCE = 19_000
OVERAGE_PENCE = 70
WRITE_PENCE = OVERAGE_PENCE

NEED_PLAN = (
    "Subscribe to a Plan to generate listing copy, refresh from search demand, "
    "run Bulk SEO, or build a website."
)
WEEKLY_LIMIT = (
    "You've used all 30 listing-copy writes this week. "
    "Your leftover weekly Plan resets every Monday at midnight UTC."
)
NEED_OVERFLOW_CONFIRM = "overflow_confirm_required"

_LISTING_COPY_WRITE_JOBS = frozenset(
    {"generate_persist", "refresh_accept", "bulk_seo_persist"}
)
_SPENDING_JOBS = frozenset({*_LISTING_COPY_WRITE_JOBS, "website_handoff"})


@dataclass(frozen=True)
class Spend:
    at: datetime
    kind: JobKind


@dataclass(frozen=True)
class AllowanceView:
    entitlement: Entitlement
    included: int | None
    used: int
    overage: int


@dataclass(frozen=True)
class SpendDecision:
    allowed: bool
    blocked_reason: str | None
    records_spend: bool
    as_overage: bool
    overflow_notice: bool = False
    overflow_confirm_required: bool = False


def _aware(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value


def month_key_utc(now: datetime) -> str:
    now = _aware(now).astimezone(UTC)
    return f"{now.year:04d}-{now.month:02d}"


def week_start_utc(now: datetime) -> datetime:
    now = _aware(now).astimezone(UTC)
    return now.replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=now.weekday())


def _in_period(spend: Spend, start: datetime) -> bool:
    return _aware(spend.at) >= start


def _listing_copy_writes(spends: Sequence[Spend]) -> int:
    return sum(1 for item in spends if item.kind in _LISTING_COPY_WRITE_JOBS)


def view(entitlement: Entitlement, spends: Sequence[Spend], now: datetime) -> AllowanceView:
    if entitlement == "local_bypass":
        return AllowanceView(entitlement=entitlement, included=None, used=0, overage=0)
    if entitlement == "free":
        used = _listing_copy_writes(spends)
        return AllowanceView(
            entitlement=entitlement,
            included=FREE_WRITES_INCLUDED,
            used=used,
            overage=max(0, used - FREE_WRITES_INCLUDED),
        )
    if entitlement == "leftover_weekly":
        start = week_start_utc(now)
        used = sum(1 for item in spends if item.kind in _SPENDING_JOBS and _in_period(item, start))
        return AllowanceView(
            entitlement=entitlement,
            included=LEFTOVER_WEEKLY_INCLUDED,
            used=used,
            overage=0,
        )
    return AllowanceView(entitlement=entitlement, included=None, used=0, overage=0)


def _records_listing_copy_write(
    job: JobKind, *, completed: bool, listing_copy_was_stale: bool
) -> bool:
    return completed and not listing_copy_was_stale and job in _LISTING_COPY_WRITE_JOBS


def decide(
    entitlement: Entitlement,
    spends: Sequence[Spend],
    now: datetime,
    job: JobKind,
    *,
    listing_copy_was_stale: bool = False,
    completed: bool = True,
    overflow_confirmed_month: str | None = None,
    confirm_overflow: bool = False,
    paid_write_confirmed: bool = False,
) -> SpendDecision:
    if entitlement == "free":
        if job == "website_handoff":
            return SpendDecision(
                allowed=True,
                blocked_reason=None,
                records_spend=False,
                as_overage=False,
            )
        if job not in _LISTING_COPY_WRITE_JOBS:
            return SpendDecision(
                allowed=True,
                blocked_reason=None,
                records_spend=False,
                as_overage=False,
            )
        used = _listing_copy_writes(spends)
        records = _records_listing_copy_write(
            job, completed=completed, listing_copy_was_stale=listing_copy_was_stale
        )
        if used < FREE_WRITES_INCLUDED:
            return SpendDecision(
                allowed=True,
                blocked_reason=None,
                records_spend=records,
                as_overage=False,
            )
        confirmed = paid_write_confirmed or bool(overflow_confirmed_month)
        if not (confirm_overflow or confirmed):
            if not completed:
                return SpendDecision(
                    allowed=True,
                    blocked_reason=None,
                    records_spend=False,
                    as_overage=True,
                    overflow_notice=True,
                    overflow_confirm_required=True,
                )
            return SpendDecision(
                allowed=False,
                blocked_reason=NEED_OVERFLOW_CONFIRM,
                records_spend=False,
                as_overage=True,
                overflow_confirm_required=True,
            )
        return SpendDecision(
            allowed=True,
            blocked_reason=None,
            records_spend=records,
            as_overage=True,
        )
    if entitlement == "local_bypass":
        return SpendDecision(
            allowed=True,
            blocked_reason=None,
            records_spend=False,
            as_overage=False,
        )
    if entitlement == "leftover_weekly":
        snapshot = view(entitlement, spends, now)
        if snapshot.used >= LEFTOVER_WEEKLY_INCLUDED:
            return SpendDecision(
                allowed=False,
                blocked_reason=WEEKLY_LIMIT,
                records_spend=False,
                as_overage=False,
            )
        records = completed and not listing_copy_was_stale and job in _SPENDING_JOBS
        return SpendDecision(
            allowed=True,
            blocked_reason=None,
            records_spend=records,
            as_overage=False,
        )

    return SpendDecision(
        allowed=True,
        blocked_reason=None,
        records_spend=False,
        as_overage=False,
    )


def entitlement_of(
    *,
    local_pro: bool,
    has_active_plan: bool,
    leftover_weekly: bool = False,
) -> Entitlement:
    if local_pro:
        return "local_bypass"
    if leftover_weekly:
        return "leftover_weekly"
    if has_active_plan:
        return "plan"
    return "free"


def leftover_weekly_from_interval(interval: str | None) -> bool:
    """Existing rows with no stored interval are leftover £4/week, not a new Plan."""
    return interval not in ("month", "year")


def may_start_checkout(entitlement: Entitlement) -> bool:
    """Plan is not sold. No entitlement starts a Plan checkout."""
    return False


def workspace_origin(app_base_url: str) -> str:
    return app_base_url.rstrip("/")
