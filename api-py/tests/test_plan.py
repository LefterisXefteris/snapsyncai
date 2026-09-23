"""Plan module — Allowance math with an injected clock. No Stripe."""

from datetime import UTC, datetime

from app.services.plan import (
    LEFTOVER_WEEKLY_INCLUDED,
    NEED_OVERFLOW_CONFIRM,
    NEED_PLAN,
    PLAN_INCLUDED,
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


def test_plan_first_generate_persist_is_included() -> None:
    decision = decide("plan", (), JAN, "generate_persist")
    assert decision.allowed is True
    assert decision.blocked_reason is None
    assert decision.records_spend is True
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


def test_refresh_accept_spends() -> None:
    decision = decide("plan", (), JAN, "refresh_accept")
    assert decision.allowed is True
    assert decision.records_spend is True


def test_twenty_first_plan_use_needs_overflow_confirm() -> None:
    spends = tuple(Spend(at=JAN, kind="generate_persist") for _ in range(20))
    decision = decide("plan", spends, JAN, "generate_persist")
    assert decision.allowed is False
    assert decision.blocked_reason == NEED_OVERFLOW_CONFIRM
    assert decision.records_spend is False
    assert decision.overflow_notice is True
    assert decision.overflow_confirm_required is True


def test_twenty_first_plan_use_with_confirm_is_overage() -> None:
    spends = tuple(Spend(at=JAN, kind="generate_persist") for _ in range(20))
    decision = decide("plan", spends, JAN, "generate_persist", confirm_overflow=True)
    assert decision.allowed is True
    assert decision.as_overage is True
    assert decision.records_spend is True
    assert decision.overflow_notice is True


def test_stream_at_overflow_does_not_block() -> None:
    spends = tuple(Spend(at=JAN, kind="generate_persist") for _ in range(20))
    decision = decide("plan", spends, JAN, "generate_persist", completed=False)
    assert decision.allowed is True
    assert decision.records_spend is False
    assert decision.overflow_notice is True
    assert decision.overflow_confirm_required is True


def test_stale_generate_at_overflow_does_not_confirm_or_spend() -> None:
    spends = tuple(Spend(at=JAN, kind="generate_persist") for _ in range(20))
    decision = decide(
        "plan", spends, JAN, "generate_persist", listing_copy_was_stale=True
    )
    assert decision.allowed is True
    assert decision.records_spend is False
    assert decision.overflow_notice is False
    assert decision.overflow_confirm_required is False


def test_later_overflow_this_month_is_silent_after_ack() -> None:
    spends = tuple(Spend(at=JAN, kind="generate_persist") for _ in range(21))
    decision = decide(
        "plan", spends, JAN, "generate_persist", overflow_confirmed_month="2026-01"
    )
    assert decision.allowed is True
    assert decision.as_overage is True
    assert decision.overflow_notice is True
    assert decision.overflow_confirm_required is False


def test_next_month_needs_overflow_confirm_again() -> None:
    february = tuple(Spend(at=FEB, kind="generate_persist") for _ in range(20))
    decision = decide(
        "plan", february, FEB, "generate_persist", overflow_confirmed_month="2026-01"
    )
    assert decision.allowed is False
    assert decision.blocked_reason == NEED_OVERFLOW_CONFIRM
    assert decision.overflow_confirm_required is True


def test_unused_included_does_not_carry_into_the_next_month() -> None:
    january_spends = tuple(Spend(at=JAN, kind="generate_persist") for _ in range(5))
    assert view("plan", january_spends, JAN_31).used == 5
    assert view("plan", january_spends, FEB).used == 0
    decision = decide("plan", january_spends, FEB, "generate_persist")
    assert decision.as_overage is False


def test_annual_plan_still_refills_twenty_each_calendar_month() -> None:
    """Entitlement is still 'plan'; billing interval is not a bigger bucket."""
    spends = tuple(Spend(at=JAN, kind="generate_persist") for _ in range(20))
    assert view("plan", spends, FEB).used == 0
    assert view("plan", spends, FEB).included == PLAN_INCLUDED


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


def test_website_handoff_counts_in_the_same_twenty() -> None:
    spends = tuple(Spend(at=JAN, kind="generate_persist") for _ in range(19))
    decision = decide("plan", spends, JAN, "website_handoff")
    assert decision.records_spend is True
    assert decision.as_overage is False
    after = (*spends, Spend(at=JAN, kind="website_handoff"))
    assert decide("plan", after, JAN, "website_handoff").blocked_reason == NEED_OVERFLOW_CONFIRM
    assert decide("plan", after, JAN, "website_handoff", confirm_overflow=True).as_overage is True


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


def test_overage_report_failure_still_keeps_the_recorded_spend() -> None:
    from app.services.plan_overage import persist_spend_then_report

    recorded: list[bool] = []

    def record(*, as_overage: bool) -> None:
        recorded.append(as_overage)

    def report() -> None:
        raise RuntimeError("stripe down")

    spends = tuple(Spend(at=JAN, kind="generate_persist") for _ in range(20))
    decision = decide("plan", spends, JAN, "generate_persist", confirm_overflow=True)
    reported = persist_spend_then_report(
        records_spend=decision.records_spend,
        as_overage=decision.as_overage,
        record=record,
        report=report,
    )
    assert recorded == [True]
    assert reported is False
