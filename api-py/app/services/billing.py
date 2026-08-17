"""Subscription + paid-session persistence and Stripe helpers.

Storage methods are the Python port of `server/storage.ts:265-328`. Price lookup
mirrors `getOrCreateWeeklySubscriptionPriceId` / `getOrCreateAnnualSubscriptionPriceId`
in `server/routes.ts:309-384`.

`claim_paid_session` is stricter than Express `markPaidSessionUsed`: it locks the row
(`SELECT … FOR UPDATE`) and only succeeds when `used` is still 0, so concurrent
`/api/subscription/verify` calls cannot both treat the same checkout as unused.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta

import stripe
from sqlalchemy import distinct, func, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.types import String

from app.auth.clerk import _client
from app.config import Settings, get_settings
from app.models import Image, ShopifyConnection
from app.models.billing import PaidSession, Subscription, UserCredits
from app.routers.config import (
    SUBSCRIPTION_ANNUAL_PRICE_PENCE,
    SUBSCRIPTION_WEEKLY_PRICE_PENCE,
    WEEKLY_PRODUCT_LIMIT,
)
from app.services.subscriptions import (
    ACTIVE_STATUSES,
    DEV_FREE_EMAIL,
    get_subscription,
    is_dev_free_user,
)

logger = logging.getLogger(__name__)

STRIPE_API_VERSION = "2025-08-27.basil"

_cached_weekly_price_id: str | None = None
_cached_annual_price_id: str | None = None


def is_active_status(status: str | None) -> bool:
    return status in ACTIVE_STATUSES


def period_end_iso(value: datetime | None) -> str | None:
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=UTC)
    return value.isoformat().replace("+00:00", "Z")


def from_unix(ts: object) -> datetime | None:
    try:
        number = int(ts)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None
    if number <= 0:
        return None
    return datetime.fromtimestamp(number, tz=UTC).replace(tzinfo=None)


def get_week_start_utc() -> datetime:
    """UTC Monday 00:00 that starts the current ISO week. Naive, matching the column."""
    now = datetime.now(UTC)
    start = now.replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=now.weekday())
    return start.replace(tzinfo=None)


def next_monday_utc() -> datetime:
    return get_week_start_utc() + timedelta(days=7)


def configure_stripe() -> None:
    settings = get_settings()
    if not settings.stripe_secret_key or not settings.stripe_publishable_key:
        raise RuntimeError(
            "STRIPE_SECRET_KEY or STRIPE_PUBLISHABLE_KEY environment variables are missing"
        )
    stripe.api_key = settings.stripe_secret_key
    stripe.api_version = STRIPE_API_VERSION  # type: ignore[assignment]


def stripe_id(value: object) -> str:
    if isinstance(value, str):
        return value
    ident = getattr(value, "id", None)
    return str(ident) if ident else ""


async def clerk_primary_email(user_id: str, settings: Settings) -> str | None:
    if not settings.clerk_secret_key:
        return None
    user = await _client(settings.clerk_secret_key).users.get_async(user_id=user_id)
    emails = user.email_addresses or []
    primary = next((e for e in emails if e.id == user.primary_email_address_id), None)
    chosen = primary or (emails[0] if emails else None)
    return chosen.email_address if chosen else None


async def get_subscription_by_stripe_id(
    session: AsyncSession, stripe_subscription_id: str
) -> Subscription | None:
    result = await session.execute(
        select(Subscription).where(Subscription.stripe_subscription_id == stripe_subscription_id)
    )
    return result.scalar_one_or_none()


async def upsert_subscription(
    session: AsyncSession,
    *,
    user_id: str,
    stripe_customer_id: str,
    stripe_subscription_id: str,
    status: str,
    current_period_end: datetime | None,
) -> Subscription:
    values = {
        "user_id": user_id,
        "stripe_customer_id": stripe_customer_id,
        "stripe_subscription_id": stripe_subscription_id,
        "status": status,
        "current_period_end": current_period_end,
    }
    existing = await get_subscription(session, user_id)
    if existing:
        await session.execute(
            update(Subscription).where(Subscription.user_id == user_id).values(**values)
        )
        await session.flush()
        return await get_subscription(session, user_id)  # type: ignore[return-value]

    existing_by_stripe = await get_subscription_by_stripe_id(session, stripe_subscription_id)
    if existing_by_stripe:
        await session.execute(
            update(Subscription)
            .where(Subscription.stripe_subscription_id == stripe_subscription_id)
            .values(**values)
        )
        await session.flush()
        return await get_subscription_by_stripe_id(session, stripe_subscription_id)  # type: ignore[return-value]

    created = Subscription(**values)
    session.add(created)
    await session.flush()
    await session.refresh(created)
    return created


async def update_subscription_status(
    session: AsyncSession,
    stripe_subscription_id: str,
    status: str,
    current_period_end: datetime | None = None,
) -> None:
    updates: dict = {"status": status}
    if current_period_end is not None:
        updates["current_period_end"] = current_period_end
    await session.execute(
        update(Subscription)
        .where(Subscription.stripe_subscription_id == stripe_subscription_id)
        .values(**updates)
    )


async def migrate_session(session: AsyncSession, old_session_id: str, new_session_id: str) -> None:
    if old_session_id == new_session_id:
        return
    logger.info("migrateSession: moving all data from %s to %s", old_session_id, new_session_id)
    for model in (
        Image,
        ShopifyConnection,
    ):
        await session.execute(
            update(model)
            .where(model.session_id == old_session_id)
            .values(session_id=new_session_id)
        )
    await session.execute(
        update(Subscription)
        .where(Subscription.user_id == old_session_id)
        .values(user_id=new_session_id)
    )


async def get_paid_session(session: AsyncSession, checkout_session_id: str) -> PaidSession | None:
    result = await session.execute(
        select(PaidSession).where(PaidSession.checkout_session_id == checkout_session_id)
    )
    return result.scalar_one_or_none()


async def create_paid_session(
    session: AsyncSession,
    *,
    checkout_session_id: str,
    session_id: str,
    image_count: int,
    tone: str,
    amount_paid: int,
    used: int = 0,
) -> PaidSession:
    row = PaidSession(
        checkout_session_id=checkout_session_id,
        session_id=session_id,
        image_count=image_count,
        tone=tone,
        amount_paid=amount_paid,
        used=used,
    )
    session.add(row)
    await session.flush()
    await session.refresh(row)
    return row


async def mark_paid_session_used(
    session: AsyncSession, checkout_session_id: str, used_count: int
) -> None:
    await session.execute(
        update(PaidSession)
        .where(PaidSession.checkout_session_id == checkout_session_id)
        .values(used=used_count)
    )


async def ensure_paid_session(
    session: AsyncSession,
    *,
    checkout_session_id: str,
    session_id: str,
    amount_paid: int = 0,
) -> None:
    """Insert a paid_sessions row if this checkout has never been recorded."""
    stmt = (
        insert(PaidSession.__table__)
        .values(
            checkout_session_id=checkout_session_id,
            session_id=session_id,
            image_count=0,
            tone="professional",
            amount_paid=amount_paid,
            used=0,
        )
        .on_conflict_do_nothing(index_elements=["checkout_session_id"])
    )
    await session.execute(stmt)


def claim_paid_session_statement(checkout_session_id: str):
    """The locked SELECT used by `claim_paid_session` — exported so tests can assert FOR UPDATE."""
    return (
        select(PaidSession)
        .where(PaidSession.checkout_session_id == checkout_session_id)
        .with_for_update()
    )


async def claim_paid_session(session: AsyncSession, checkout_session_id: str) -> bool:
    """Atomically claim `paid_sessions.used`. True if this caller won the claim.

    `SELECT … FOR UPDATE` serialises concurrent verify calls on the same checkout
    so only the first can treat the session as unused.
    """
    result = await session.execute(claim_paid_session_statement(checkout_session_id))
    row = result.scalar_one_or_none()
    if row is None or (row.used or 0) > 0:
        return False
    row.used = 1
    await session.flush()
    return True


async def add_credits(session: AsyncSession, user_id: str, amount: int) -> UserCredits:
    result = await session.execute(
        select(UserCredits).where(UserCredits.user_id == user_id).with_for_update()
    )
    row = result.scalar_one_or_none()
    if row is None:
        row = UserCredits(user_id=user_id, balance=amount, lifetime_credits=amount)
        session.add(row)
    else:
        row.balance = (row.balance or 0) + amount
        row.lifetime_credits = (row.lifetime_credits or 0) + amount
    await session.flush()
    return row


async def claim_and_grant_credits(
    session: AsyncSession,
    *,
    checkout_session_id: str,
    user_id: str,
    credits: int,
    amount_paid: int = 0,
) -> bool:
    """Claim the checkout row then grant credits in the same transaction.

    Returns False when the session was already claimed — caller must not grant again.
    """
    await ensure_paid_session(
        session,
        checkout_session_id=checkout_session_id,
        session_id=user_id,
        amount_paid=amount_paid,
    )
    if not await claim_paid_session(session, checkout_session_id):
        return False
    await add_credits(session, user_id, credits)
    return True


async def get_weekly_product_count(session: AsyncSession, user_id: str) -> int:
    week_start = get_week_start_utc()
    result = await session.execute(
        select(
            func.count(distinct(func.coalesce(Image.product_group_id, func.cast(Image.id, String))))
        ).where(
            Image.session_id == user_id,
            Image.payment_status == "paid",
            Image.created_at >= week_start,
        )
    )
    return int(result.scalar() or 0)


async def get_or_create_weekly_subscription_price_id() -> str:
    global _cached_weekly_price_id
    if _cached_weekly_price_id:
        return _cached_weekly_price_id
    configure_stripe()
    products = stripe.Product.list(active=True, limit=100)
    existing = next(
        (p for p in products.data if (p.metadata or {}).get("type") == "weekly_subscription"),
        None,
    )
    if existing:
        prices = stripe.Price.list(product=existing.id, active=True, limit=10)
        match = next(
            (
                p
                for p in prices.data
                if p.unit_amount == SUBSCRIPTION_WEEKLY_PRICE_PENCE
                and p.type == "recurring"
                and getattr(p.recurring, "interval", None) == "week"
            ),
            None,
        )
        if match:
            _cached_weekly_price_id = match.id
            return match.id
        product_id = existing.id
    else:
        product = stripe.Product.create(
            name="SnapSync AI",
            description="Up to 30 AI-powered product listings per week",
            metadata={"type": "weekly_subscription"},
        )
        product_id = product.id

    price = stripe.Price.create(
        product=product_id,
        unit_amount=SUBSCRIPTION_WEEKLY_PRICE_PENCE,
        currency="gbp",
        recurring={"interval": "week"},
    )
    _cached_weekly_price_id = price.id
    return price.id


async def get_or_create_annual_subscription_price_id() -> str:
    global _cached_annual_price_id
    if _cached_annual_price_id:
        return _cached_annual_price_id
    configure_stripe()
    products = stripe.Product.list(active=True, limit=100)
    existing = next(
        (p for p in products.data if (p.metadata or {}).get("type") == "weekly_subscription"),
        None,
    )
    if existing:
        prices = stripe.Price.list(product=existing.id, active=True, limit=20)
        match = next(
            (
                p
                for p in prices.data
                if p.unit_amount == SUBSCRIPTION_ANNUAL_PRICE_PENCE
                and p.type == "recurring"
                and getattr(p.recurring, "interval", None) == "year"
            ),
            None,
        )
        if match:
            _cached_annual_price_id = match.id
            return match.id
        product_id = existing.id
    else:
        product = stripe.Product.create(
            name="SnapSync AI",
            description="Up to 30 AI-powered product listings per week",
            metadata={"type": "weekly_subscription"},
        )
        product_id = product.id

    price = stripe.Price.create(
        product=product_id,
        unit_amount=SUBSCRIPTION_ANNUAL_PRICE_PENCE,
        currency="gbp",
        recurring={"interval": "year"},
    )
    _cached_annual_price_id = price.id
    return price.id


async def find_active_stripe_subscription(email: str, customer_limit: int = 5, sub_limit: int = 3):
    """Return (customer, subscription) for the first active/trialing sub on this email."""
    configure_stripe()
    customers = stripe.Customer.list(email=email, limit=customer_limit)
    for customer in customers.data:
        subs = stripe.Subscription.list(customer=customer.id, status="all", limit=sub_limit)
        active = next((s for s in subs.data if s.status in ("active", "trialing")), None)
        if active:
            return customer, active
    return None, None


async def relink_stripe_subscription(
    session: AsyncSession, user_id: str, customer, active_sub
) -> Subscription:
    old = await get_subscription_by_stripe_id(session, active_sub.id)
    if old and old.user_id != user_id:
        logger.info("Migrating data from old userId %s to new userId %s", old.user_id, user_id)
        await migrate_session(session, old.user_id, user_id)
    return await upsert_subscription(
        session,
        user_id=user_id,
        stripe_customer_id=customer.id,
        stripe_subscription_id=active_sub.id,
        status=active_sub.status,
        current_period_end=from_unix(getattr(active_sub, "current_period_end", None)),
    )


__all__ = [
    "ACTIVE_STATUSES",
    "DEV_FREE_EMAIL",
    "WEEKLY_PRODUCT_LIMIT",
    "add_credits",
    "claim_and_grant_credits",
    "claim_paid_session",
    "claim_paid_session_statement",
    "clerk_primary_email",
    "configure_stripe",
    "create_paid_session",
    "ensure_paid_session",
    "find_active_stripe_subscription",
    "from_unix",
    "get_or_create_annual_subscription_price_id",
    "get_or_create_weekly_subscription_price_id",
    "get_paid_session",
    "get_subscription",
    "get_subscription_by_stripe_id",
    "get_week_start_utc",
    "get_weekly_product_count",
    "is_active_status",
    "is_dev_free_user",
    "mark_paid_session_used",
    "migrate_session",
    "next_monday_utc",
    "period_end_iso",
    "relink_stripe_subscription",
    "stripe_id",
    "update_subscription_status",
    "upsert_subscription",
]
