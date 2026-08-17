"""Subscription lookup + the localhost free-user exception from `server/routes.ts`."""

from __future__ import annotations

import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.clerk import _client
from app.config import Settings
from app.models.billing import Subscription

logger = logging.getLogger(__name__)

DEV_FREE_EMAIL = "lefterisgilmaz@gmail.com"
ACTIVE_STATUSES = frozenset({"active", "trialing", "canceling"})


async def get_subscription(session: AsyncSession, user_id: str) -> Subscription | None:
    result = await session.execute(select(Subscription).where(Subscription.user_id == user_id))
    return result.scalar_one_or_none()


async def is_dev_free_user(user_id: str, settings: Settings) -> bool:
    if settings.is_production:
        return False
    if settings.dev_bypass_auth:
        return False
    if not settings.clerk_secret_key or not user_id:
        return False
    try:
        clerk_user = await _client(settings.clerk_secret_key).users.get_async(user_id=user_id)
        emails = clerk_user.email_addresses or []
        primary_id = clerk_user.primary_email_address_id
        email = next(
            (e.email_address for e in emails if e.id == primary_id),
            emails[0].email_address if emails else None,
        )
        return email == DEV_FREE_EMAIL
    except Exception:
        logger.exception("is_dev_free_user lookup failed")
        return False


async def has_active_subscription(
    session: AsyncSession, user_id: str, settings: Settings
) -> bool:
    if await is_dev_free_user(user_id, settings):
        return True
    sub = await get_subscription(session, user_id)
    return bool(sub and sub.status in ACTIVE_STATUSES)
