"""Plan module — Allowance math with an injected clock. No Stripe."""

from datetime import UTC, datetime

from app.services.plan import (
    LEFTOVER_WEEKLY_INCLUDED,
    NEED_PLAN,
    WEEKLY_LIMIT,
    Spend,
    decide,
    view,
)

JAN = datetime(2026, 1, 15, 12, 0, tzinfo=UTC)
JAN_31 = datetime(2026, 1, 31, 23, 0, tzinfo=UTC)
FEB = datetime(2026, 2, 1, 0, 0, tzinfo=UTC)
MONDAY = datetime(2026, 1, 12, 10, 0, tzinfo=UTC)  # Monday
NEXT_MONDAY = datetime(2026, 1, 19, 0, 0, tzinfo=UTC)


def test_free_cannot_run_plan_jobs() -> None:
    decision = decide("free", (), JAN, "generate_persist")
    assert decision.allowed is False
    assert decision.blocked_reason == NEED_PLAN
    assert decision.records_spend is False


def test_plan_generate_is_allowed_and_not_counted() -> None:
    decision = decide("plan", (), JAN, "generate_persist")
    assert decision.allowed is True
    assert decision.blocked_reason is None
    assert decision.records_spend is False
    assert decision.as_overage is False


def test_stale_generate_persist_does_not_spend() -> None:
    decision = decide("plan", (), JAN, "generate_persist", listing_copy_was_stale=True)
    assert decision.allowed is True
    assert decision.records_spend is False


def test_uncompleted_generate_does_not_spend() -> None:
    decision = decide("plan", (), JAN, "generate_persist", completed=False)
    assert decision.allowed is True
    assert decision.records_spend is False
    assert decision.overflow_confirm_required is False


def test_plan_refresh_is_allowed_and_not_counted() -> None:
    decision = decide("plan", (), JAN, "refresh_accept")
    assert decision.allowed is True
    assert decision.records_spend is False
    assert decision.as_overage is False


def test_plan_past_twenty_uses_is_allowed_without_a_charge() -> None:
    spends = tuple(Spend(at=JAN, kind="generate_persist") for _ in range(20))
    decision = decide("plan", spends, JAN, "generate_persist")
    assert decision.allowed is True
    assert decision.blocked_reason is None
    assert decision.as_overage is False
    assert decision.overflow_notice is False
    assert decision.overflow_confirm_required is False
    assert decision.records_spend is False


def test_plan_has_no_use_count() -> None:
    spends = tuple(Spend(at=JAN, kind="generate_persist") for _ in range(20))
    assert view("plan", spends, JAN_31).included is None
    assert view("plan", spends, JAN_31).used == 0
    assert view("plan", spends, JAN_31).overage == 0
    assert view("plan", spends, FEB).included is None
    assert view("plan", spends, FEB).overage == 0


def test_workspace_origin_is_the_app_base_url() -> None:
    from app.services.plan import workspace_origin

    assert workspace_origin("https://www.snapsyncai.co.uk/") == "https://www.snapsyncai.co.uk"


def test_leftover_weekly_hard_stops_at_thirty_with_no_overage() -> None:
    spends = tuple(Spend(at=MONDAY, kind="generate_persist") for _ in range(30))
    decision = decide("leftover_weekly", spends, MONDAY, "generate_persist")
    assert decision.allowed is False
    assert decision.blocked_reason == WEEKLY_LIMIT
    assert decision.records_spend is False
    assert view("leftover_weekly", spends, MONDAY).overage == 0
    assert view("leftover_weekly", spends, MONDAY).included == LEFTOVER_WEEKLY_INCLUDED


def test_leftover_weekly_resets_on_utc_monday() -> None:
    spends = tuple(Spend(at=MONDAY, kind="generate_persist") for _ in range(30))
    assert decide("leftover_weekly", spends, NEXT_MONDAY, "generate_persist").allowed is True
    assert view("leftover_weekly", spends, NEXT_MONDAY).used == 0


def test_local_bypass_is_unlimited_and_unbilled() -> None:
    spends = tuple(Spend(at=JAN, kind="generate_persist") for _ in range(50))
    decision = decide("local_bypass", spends, JAN, "generate_persist")
    assert decision.allowed is True
    assert decision.records_spend is False
    assert view("local_bypass", spends, JAN).included is None


def test_plan_website_publish_is_allowed_and_not_counted() -> None:
    spends = tuple(Spend(at=JAN, kind="generate_persist") for _ in range(20))
    decision = decide("plan", spends, JAN, "website_handoff")
    assert decision.allowed is True
    assert decision.records_spend is False
    assert decision.as_overage is False


def test_entitlement_prefers_local_bypass_then_plan_then_free() -> None:
    from app.services.plan import entitlement_of

    assert entitlement_of(local_pro=True, has_active_plan=True) == "local_bypass"
    assert entitlement_of(local_pro=False, has_active_plan=True) == "plan"
    assert entitlement_of(local_pro=False, has_active_plan=False) == "free"
    assert (
        entitlement_of(local_pro=False, has_active_plan=True, leftover_weekly=True)
        == "leftover_weekly"
    )


def test_week_interval_is_leftover_weekly_and_new_plans_are_not() -> None:
    from app.services.plan import leftover_weekly_from_interval

    assert leftover_weekly_from_interval("week") is True
    assert leftover_weekly_from_interval(None) is True
    assert leftover_weekly_from_interval("month") is False
    assert leftover_weekly_from_interval("year") is False


def test_leftover_weekly_may_start_a_plan_checkout_and_plan_may_not() -> None:
    from app.services.plan import may_start_checkout

    assert may_start_checkout("free") is True
    assert may_start_checkout("leftover_weekly") is True
    assert may_start_checkout("plan") is False
    assert may_start_checkout("local_bypass") is False

