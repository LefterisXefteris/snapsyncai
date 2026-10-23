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
from app.services.plan import leftover_weekly_from_interval, pack_pence

logger = logging.getLogger(__name__)


async def process_stripe_webhook(
    session: AsyncSession, settings: Settings, payload: bytes, signature: str
) -> None:
    secret = settings.stripe_webhook_secret
    if not secret:
        raise RuntimeError("STRIPE_WEBHOOK_SECRET is not set")
    event = stripe.Webhook.construct_event(payload, signature, secret)
    await handle_subscription_events(session, settings, event)


async def _grant_credit_pack(session: AsyncSession, data: dict) -> None:
    metadata = data.get("metadata") or {}
    if metadata.get("purpose") != "credit_pack":
        return
    user_id = metadata.get("userId")
    checkout_id = data.get("id")
    if not user_id or not checkout_id:
        return
    if data.get("payment_status") not in ("paid", "no_payment_required"):
        return
    try:
        pack = int(metadata.get("creditPack") or "0")
    except ValueError:
        return
    if pack_pence(pack) is None:
        logger.warning("Webhook: unknown credit pack on checkout %s", checkout_id)
        return
    amount_paid = int(data.get("amount_total") or 0)
    await billing.ensure_paid_session(
        session,
        checkout_session_id=checkout_id,
        session_id=user_id,
        amount_paid=amount_paid,
    )
    if not await billing.claim_paid_session(session, checkout_id):
        return
    await billing.add_credits(session, user_id, pack)
    logger.info("Webhook: granted %s Credits to %s from %s", pack, user_id, checkout_id)


async def handle_subscription_events(
    session: AsyncSession, settings: Settings, event: dict | stripe.Event
) -> None:
    event_type = event["type"] if isinstance(event, dict) else event.type
    data = (event["data"]["object"] if isinstance(event, dict) else event.data.object) or {}
    if not data:
        return

    if event_type == "checkout.session.completed" and data.get("mode") == "payment":
        try:
            payload = data if isinstance(data, dict) else {
                "id": getattr(data, "id", None),
                "mode": getattr(data, "mode", None),
                "payment_status": getattr(data, "payment_status", None),
                "amount_total": getattr(data, "amount_total", None),
                "metadata": getattr(data, "metadata", None) or {},
            }
            await _grant_credit_pack(session, payload)
        except Exception:
            logger.exception("Webhook: Error granting Credit pack")

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
                sub = await billing.stripe_call(stripe.Subscription.retrieve, subscription_id)
                period_end = billing.from_unix(getattr(sub, "current_period_end", None))
                previous = await billing.get_subscription(session, user_id)
                interval = billing.recurring_interval_of(sub) or metadata.get("planInterval")
                await billing.upsert_subscription(
                    session,
                    user_id=user_id,
                    stripe_customer_id=customer_id,
                    stripe_subscription_id=subscription_id,
                    status=sub.status,
                    current_period_end=period_end,
                    billing_interval=interval,
                )
                if (
                    previous
                    and previous.stripe_subscription_id != subscription_id
                    and leftover_weekly_from_interval(previous.billing_interval)
                ):
                    try:
                        await billing.stripe_call(
                            stripe.Subscription.delete, previous.stripe_subscription_id
                        )
                    except Exception:
                        logger.warning(
                            "Webhook: could not cancel leftover weekly %s",
                            previous.stripe_subscription_id,
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
            await billing.update_subscription_status(
                session,
                subscription_id,
                status,
                period_end,
                billing_interval=billing.recurring_interval_of(data),
            )
            logger.info("Webhook: Subscription %s updated to %s", subscription_id, status)
        except Exception:
            logger.exception("Webhook: Error updating subscription status")
