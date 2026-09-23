"""Plan and Allowance — entitlement and spend decisions. Stripe is an adapter, not this module."""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Literal

Entitlement = Literal["free", "plan", "leftover_weekly", "local_bypass"]
JobKind = Literal["generate_persist", "refresh_accept", "website_handoff", "bulk_seo_persist"]

PLAN_INCLUDED = 20
LEFTOVER_WEEKLY_INCLUDED = 30
PLAN_MONTHLY_PENCE = 1900
PLAN_ANNUAL_PENCE = 19_000
OVERAGE_PENCE = 70

NEED_PLAN = (
    "Subscribe to a Plan to generate listing copy, refresh from search demand, "
    "run Bulk SEO, or build a website."
)
WEEKLY_LIMIT = (
    "You've used all 30 listing-copy writes this week. "
    "Your leftover weekly Plan resets every Monday at midnight UTC."
)
NEED_OVERFLOW_CONFIRM = "overflow_confirm_required"

_SPENDING_JOBS = frozenset(
    {"generate_persist", "refresh_accept", "website_handoff", "bulk_seo_persist"}
)


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


def month_start_utc(now: datetime) -> datetime:
    now = _aware(now).astimezone(UTC)
    return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


def month_key_utc(now: datetime) -> str:
    now = _aware(now).astimezone(UTC)
    return f"{now.year:04d}-{now.month:02d}"


def week_start_utc(now: datetime) -> datetime:
    now = _aware(now).astimezone(UTC)
    return now.replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=now.weekday())


def _in_period(spend: Spend, start: datetime) -> bool:
    return _aware(spend.at) >= start


def view(entitlement: Entitlement, spends: Sequence[Spend], now: datetime) -> AllowanceView:
    if entitlement == "local_bypass":
        return AllowanceView(entitlement=entitlement, included=None, used=0, overage=0)
    if entitlement == "free":
        return AllowanceView(entitlement=entitlement, included=0, used=0, overage=0)
    if entitlement == "leftover_weekly":
        start = week_start_utc(now)
        used = sum(1 for item in spends if item.kind in _SPENDING_JOBS and _in_period(item, start))
        return AllowanceView(
            entitlement=entitlement,
            included=LEFTOVER_WEEKLY_INCLUDED,
            used=used,
            overage=0,
        )
    start = month_start_utc(now)
    count = sum(1 for item in spends if item.kind in _SPENDING_JOBS and _in_period(item, start))
    used = min(count, PLAN_INCLUDED)
    overage = max(0, count - PLAN_INCLUDED)
    return AllowanceView(
        entitlement=entitlement,
        included=PLAN_INCLUDED,
        used=used,
        overage=overage,
    )


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
) -> SpendDecision:
    if entitlement == "free":
        return SpendDecision(
            allowed=False,
            blocked_reason=NEED_PLAN,
            records_spend=False,
            as_overage=False,
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

    would_spend = not listing_copy_was_stale and job in _SPENDING_JOBS
    snapshot = view(entitlement, spends, now)
    overflow_notice = would_spend and snapshot.used >= PLAN_INCLUDED
    overflow_confirm_required = overflow_notice and overflow_confirmed_month != month_key_utc(
        now
    )
    if completed and overflow_confirm_required and not confirm_overflow:
        return SpendDecision(
            allowed=False,
            blocked_reason=NEED_OVERFLOW_CONFIRM,
            records_spend=False,
            as_overage=False,
            overflow_notice=True,
            overflow_confirm_required=True,
        )
    records = completed and would_spend
    return SpendDecision(
        allowed=True,
        blocked_reason=None,
        records_spend=records,
        as_overage=records and overflow_notice,
        overflow_notice=overflow_notice,
        overflow_confirm_required=overflow_confirm_required,
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
    return entitlement in ("free", "leftover_weekly")


def workspace_origin(app_base_url: str) -> str:
    return app_base_url.rstrip("/")
