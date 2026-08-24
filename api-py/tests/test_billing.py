"""Billing helpers — week math, dev-free gate, and the atomic paid-session claim."""

from datetime import UTC, datetime

import pytest
from sqlalchemy.dialects import postgresql

from app.config import Settings
from app.services.billing import (
    DEV_FREE_EMAIL,
    claim_paid_session_statement,
    get_week_start_utc,
    is_active_status,
    is_dev_free_user,
    is_local_pro,
    next_monday_utc,
)
from app.services.subscriptions import ACTIVE_STATUSES, has_active_subscription


def test_active_statuses_match_express() -> None:
    assert ACTIVE_STATUSES == frozenset({"active", "trialing", "canceling"})
    assert is_active_status("canceling")
    assert not is_active_status("canceled")
    assert not is_active_status(None)


def test_week_start_is_monday_utc_midnight() -> None:
    start = get_week_start_utc()
    assert start.weekday() == 0
    assert start.hour == start.minute == start.second == start.microsecond == 0
    assert start.tzinfo is None
    nxt = next_monday_utc()
    assert (nxt - start).days == 7


def test_claim_paid_session_locks_the_row() -> None:
    compiled = str(
        claim_paid_session_statement("cs_test").compile(dialect=postgresql.dialect())
    ).upper()
    assert "FOR UPDATE" in compiled
    assert "PAID_SESSIONS" in compiled


@pytest.mark.asyncio
async def test_dev_free_user_is_off_in_production() -> None:
    settings = Settings(
        database_url="postgresql://u:p@localhost:5432/db",
        environment="production",
        clerk_secret_key="sk_test",
    )
    assert await is_dev_free_user("user_1", settings) is False


@pytest.mark.asyncio
async def test_dev_free_user_is_off_when_bypass_is_on() -> None:
    settings = Settings(
        database_url="postgresql://u:p@localhost:5432/db",
        environment="development",
        dev_bypass_auth=True,
        clerk_secret_key="sk_test",
    )
    assert await is_dev_free_user("user_1", settings) is False


def test_dev_free_email_matches_express() -> None:
    assert DEV_FREE_EMAIL == "lefterisgilmaz@gmail.com"


def test_week_helpers_are_timezone_stable() -> None:
    """nextMondayUTC in Express is toISOString()-able; we keep a naive UTC midnight."""
    now = datetime.now(UTC)
    start = get_week_start_utc()
    assert start <= now.replace(tzinfo=None)


def _settings(**kwargs) -> Settings:
    return Settings(
        database_url="postgresql://u:p@localhost:5432/db",
        **kwargs,
    )


def test_local_pro_follows_auth_bypass() -> None:
    assert is_local_pro(_settings(environment="development", dev_bypass_auth=True)) is True
    assert is_local_pro(_settings(environment="development", dev_bypass_auth=False)) is False


def test_local_pro_never_runs_in_production() -> None:
    assert is_local_pro(_settings(environment="production", dev_bypass_auth=True)) is False


@pytest.mark.asyncio
async def test_local_pro_counts_as_subscribed_without_stripe() -> None:
    settings = _settings(environment="development", dev_bypass_auth=True)
    assert await has_active_subscription(None, "dev_local_user", settings) is True
