"""Stripe webhook handling — port of `server/webhookHandlers.ts`.

`stripe-replit-sync` is not ported: those mirror tables are written by Express and never
read. Signature verification uses `STRIPE_WEBHOOK_SECRET` and the official Stripe SDK.
"""

from __future__ import annotations

import logging

import stripe
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.services import billing

logger = logging.getLogger(__name__)


async def process_stripe_webhook(
    session: AsyncSession, settings: Settings, payload: bytes, signature: str
) -> None:
    secret = settings.stripe_webhook_secret
    if not secret:
        raise RuntimeError("STRIPE_WEBHOOK_SECRET is not set")
    event = stripe.Webhook.construct_event(payload, signature, secret)
    await handle_subscription_events(session, settings, event)


async def handle_subscription_events(
    session: AsyncSession, settings: Settings, event: dict | stripe.Event
) -> None:
    event_type = event["type"] if isinstance(event, dict) else event.type
    data = (event["data"]["object"] if isinstance(event, dict) else event.data.object) or {}
    if not data:
        return

    if event_type == "checkout.session.completed" and data.get("mode") == "subscription":
        metadata = data.get("metadata") or {}
        user_id = metadata.get("userId")
        subscription = data.get("subscription")
        customer = data.get("customer")
        subscription_id = (
            subscription if isinstance(subscription, str) else (subscription or {}).get("id")
        )
        customer_id = customer if isinstance(customer, str) else (customer or {}).get("id")
        if user_id and subscription_id and customer_id:
            try:
                if not settings.stripe_secret_key:
                    raise RuntimeError("STRIPE_SECRET_KEY is not set")
                stripe.api_key = settings.stripe_secret_key
                sub = stripe.Subscription.retrieve(subscription_id)
                period_end = billing.from_unix(getattr(sub, "current_period_end", None))
                await billing.upsert_subscription(
                    session,
                    user_id=user_id,
                    stripe_customer_id=customer_id,
                    stripe_subscription_id=subscription_id,
                    status=sub.status,
                    current_period_end=period_end,
                )
                logger.info(
                    "Webhook: Subscription %s saved for user %s with status %s",
                    subscription_id,
                    user_id,
                    sub.status,
                )
            except Exception:
                logger.exception("Webhook: Error saving subscription from checkout")

    if event_type in {"customer.subscription.updated", "customer.subscription.deleted"}:
        subscription_id = data.get("id")
        status = data.get("status")
        period_end = None
        if data.get("current_period_end"):
            period_end = billing.from_unix(data["current_period_end"])
        try:
            await billing.update_subscription_status(session, subscription_id, status, period_end)
            logger.info("Webhook: Subscription %s updated to %s", subscription_id, status)
        except Exception:
            logger.exception("Webhook: Error updating subscription status")
