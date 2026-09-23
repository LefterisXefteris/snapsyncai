"""Subscription HTTP routes — port of `server/routes.ts:1101-1677`.

Paths stay byte-stable with the Express handlers they replace.
"""

from __future__ import annotations

import logging
import time
from datetime import UTC, datetime

import stripe
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse

from app.auth.clerk import CurrentUser
from app.config import SettingsDep
from app.db import SessionDep
from app.schemas.billing import (
    CancelResponse,
    CheckoutResponse,
    CheckoutSessionBody,
    CreateCheckoutBody,
    RecoverResponse,
    SubscriptionStatusResponse,
    UnlockImagesBody,
    UnlockResponse,
    VerifyResponse,
)
from app.services import billing
from app.services.plan import (
    entitlement_of,
    leftover_weekly_from_interval,
    may_start_checkout,
    view,
    workspace_origin,
)
from app.services.plan_charge import overflow_view

logger = logging.getLogger(__name__)

router = APIRouter(tags=["billing"])


async def _plan_status(
    session, user_id: str, settings, sub
) -> SubscriptionStatusResponse:
    local = billing.is_local_pro(settings) or await billing.is_dev_free_user(user_id, settings)
    active = sub is not None and billing.is_active_status(sub.status)
    leftover = bool(
        active and leftover_weekly_from_interval(sub.billing_interval if sub else None)
    )
    entitlement = entitlement_of(
        local_pro=local, has_active_plan=active, leftover_weekly=leftover
    )
    spends = await list_spends(session, user_id)
    snapshot = view(entitlement, spends, datetime.now(UTC))
    overflow_notice, overflow_confirm_required = await overflow_view(
        session, settings, user_id
    )
    return SubscriptionStatusResponse(
        subscribed=entitlement != "free",
        entitlement=entitlement,
        allowance_used=snapshot.used,
        allowance_included=snapshot.included,
        overage_this_month=snapshot.overage,
        overflow_notice=overflow_notice,
        overflow_confirm_required=overflow_confirm_required,
        status=(
            "active"
            if entitlement == "local_bypass"
            else (sub.status if sub else None)
        ),
        current_period_end=billing.period_end_iso(sub.current_period_end) if sub else None,
        stripe_subscription_id=sub.stripe_subscription_id if sub else None,
    )


def _http_error(status_code: int, message: str, **extra) -> HTTPException:
    if extra:
        return HTTPException(status_code=status_code, detail={"message": message, **extra})
    return HTTPException(status_code=status_code, detail=message)


@router.get(
    "/api/subscription/status",
    response_model=SubscriptionStatusResponse,
    response_model_exclude_none=True,
)
async def subscription_status(
    user_id: CurrentUser, session: SessionDep, settings: SettingsDep
) -> SubscriptionStatusResponse:
    try:
        sub = None
        if not (
            billing.is_local_pro(settings) or await billing.is_dev_free_user(user_id, settings)
        ):
            sub = await billing.get_subscription(session, user_id)

            if sub is None:
                try:
                    email = await billing.clerk_primary_email(user_id, settings)
                    if email:
                        customer, active_sub = await billing.find_active_stripe_subscription(email)
                        if customer and active_sub:
                            sub = await billing.relink_stripe_subscription(
                                session, user_id, customer, active_sub
                            )
                            logger.info(
                                "Auto-recovered subscription %s for user %s via email %s",
                                active_sub.id,
                                user_id,
                                email,
                            )
                except Exception as recover_err:
                    logger.warning(
                        "Auto-recover subscription failed (non-fatal): %s", recover_err
                    )

        return await _plan_status(session, user_id, settings, sub)
    except HTTPException:
        raise
    except Exception:
        logger.exception("Subscription status error")
        raise _http_error(500, "Failed to check subscription status") from None


@router.post(
    "/api/subscription/recover",
    response_model=RecoverResponse,
    response_model_exclude_none=True,
)
async def recover_subscription(
    user_id: CurrentUser,
    session: SessionDep,
    body: CheckoutSessionBody | None = None,
) -> RecoverResponse:
    try:
        existing = await billing.get_subscription(session, user_id)
        if existing and billing.is_active_status(existing.status):
            return RecoverResponse(recovered=True, already_active=True)

        checkout_session_id = (body.checkout_session_id if body else None) or None
        if not checkout_session_id:
            raise _http_error(400, "Missing checkout session ID")

        billing.configure_stripe()
        checkout = stripe.checkout.Session.retrieve(checkout_session_id)
        metadata = checkout.metadata or {}
        if metadata.get("userId") != user_id:
            raise _http_error(403, "Session does not belong to this user")
        if checkout.payment_status != "paid" or not checkout.subscription:
            raise _http_error(400, "No paid subscription found for this session")

        sub_id = billing.stripe_id(checkout.subscription)
        customer_id = billing.stripe_id(checkout.customer)
        full_sub = stripe.Subscription.retrieve(sub_id)
        period_end = billing.from_unix(getattr(full_sub, "current_period_end", None))

        old = await billing.get_subscription_by_stripe_id(session, sub_id)
        if old and old.user_id != user_id:
            logger.info("recover: migrating data from old userId %s to %s", old.user_id, user_id)
            await billing.migrate_session(session, old.user_id, user_id)

        await billing.upsert_subscription(
            session,
            user_id=user_id,
            stripe_customer_id=customer_id,
            stripe_subscription_id=sub_id,
            status=full_sub.status,
            current_period_end=period_end,
            billing_interval=billing.recurring_interval_of(full_sub),
        )
        logger.info("Recovered subscription %s for user %s", sub_id, user_id)
        return RecoverResponse(
            recovered=True,
            subscribed=full_sub.status in ("active", "trialing"),
        )
    except HTTPException:
        raise
    except Exception:
        logger.exception("Subscription recovery error")
        raise _http_error(500, "Failed to recover subscription") from None


@router.post(
    "/api/subscription/recover-by-email",
    response_model=RecoverResponse,
    response_model_exclude_none=True,
)
async def recover_by_email(
    user_id: CurrentUser, session: SessionDep, settings: SettingsDep
) -> RecoverResponse:
    try:
        existing = await billing.get_subscription(session, user_id)
        if existing and billing.is_active_status(existing.status):
            return RecoverResponse(
                recovered=True, subscribed=True, message="Subscription already active"
            )

        primary_email = await billing.clerk_primary_email(user_id, settings)
        if not primary_email:
            raise _http_error(400, "No email address found on your account")

        billing.configure_stripe()
        customers = stripe.Customer.list(email=primary_email, limit=10)
        if not customers.data:
            return RecoverResponse(
                recovered=False, message="No Stripe customer found for your email"
            )

        for customer in customers.data:
            subs = stripe.Subscription.list(customer=customer.id, status="all", limit=5)
            active = next((s for s in subs.data if s.status in ("active", "trialing")), None)
            if not active:
                continue
            old = await billing.get_subscription_by_stripe_id(session, active.id)
            if old and old.user_id != user_id:
                logger.info(
                    "recover-by-email: migrating data from old userId %s to %s",
                    old.user_id,
                    user_id,
                )
                await billing.migrate_session(session, old.user_id, user_id)
            await billing.upsert_subscription(
                session,
                user_id=user_id,
                stripe_customer_id=customer.id,
                stripe_subscription_id=active.id,
                status=active.status,
                current_period_end=billing.from_unix(getattr(active, "current_period_end", None)),
                billing_interval=billing.recurring_interval_of(active),
            )
            logger.info(
                "recover-by-email: linked sub %s to user %s via email %s",
                active.id,
                user_id,
                primary_email,
            )
            return RecoverResponse(recovered=True, subscribed=True)

        return RecoverResponse(
            recovered=False, message="No active subscription found for your email"
        )
    except HTTPException:
        raise
    except Exception:
        logger.exception("recover-by-email error")
        raise _http_error(500, "Failed to recover subscription") from None


@router.post("/api/subscription/create-checkout", response_model=CheckoutResponse)
async def create_checkout(
    request: Request,
    user_id: CurrentUser,
    session: SessionDep,
    settings: SettingsDep,
    body: CreateCheckoutBody | None = None,
) -> CheckoutResponse | JSONResponse:
    try:
        existing = await billing.get_subscription(session, user_id)
        local = billing.is_local_pro(settings) or await billing.is_dev_free_user(
            user_id, settings
        )
        leftover = bool(
            existing
            and billing.is_active_status(existing.status)
            and leftover_weekly_from_interval(existing.billing_interval)
        )
        entitlement = entitlement_of(
            local_pro=local,
            has_active_plan=bool(existing and billing.is_active_status(existing.status)),
            leftover_weekly=leftover,
        )
        if existing and billing.is_active_status(existing.status) and not may_start_checkout(
            entitlement
        ):
            raise _http_error(400, "You already have an active subscription")

        billing.configure_stripe()
        existing_customer_id: str | None = None
        primary_email: str | None = None
        try:
            primary_email = await billing.clerk_primary_email(user_id, settings)
            if primary_email:
                customers = stripe.Customer.list(email=primary_email, limit=5)
                for customer in customers.data:
                    subs = stripe.Subscription.list(
                        customer=customer.id, status="all", limit=3
                    )
                    active = next(
                        (s for s in subs.data if s.status in ("active", "trialing")), None
                    )
                    if active:
                        interval = billing.recurring_interval_of(active)
                        if leftover_weekly_from_interval(interval):
                            existing_customer_id = customer.id
                            continue
                        old = await billing.get_subscription_by_stripe_id(session, active.id)
                        if old and old.user_id != user_id:
                            logger.info(
                                "create-checkout: migrating data from old userId %s to %s",
                                old.user_id,
                                user_id,
                            )
                            await billing.migrate_session(session, old.user_id, user_id)
                        await billing.upsert_subscription(
                            session,
                            user_id=user_id,
                            stripe_customer_id=customer.id,
                            stripe_subscription_id=active.id,
                            status=active.status,
                            current_period_end=billing.from_unix(
                                getattr(active, "current_period_end", None)
                            ),
                            billing_interval=interval,
                        )
                        logger.info(
                            "create-checkout: recovered existing sub %s for user %s via email %s",
                            active.id,
                            user_id,
                            primary_email,
                        )
                        return JSONResponse(
                            status_code=409,
                            content={
                                "message": (
                                    "You already have an active subscription on this email "
                                    "— your account has been refreshed."
                                ),
                                "recovered": True,
                            },
                        )
                    if not existing_customer_id:
                        existing_customer_id = customer.id
        except HTTPException:
            raise
        except Exception as lookup_err:
            logger.warning(
                "create-checkout: email-based Stripe lookup failed (non-fatal): %s",
                lookup_err,
            )

        billing_interval = (body.billing_interval if body else None) or None
        price_id = (
            await billing.get_or_create_annual_subscription_price_id()
            if billing_interval == "annual"
            else await billing.get_or_create_weekly_subscription_price_id()
        )
        origin = workspace_origin(settings.app_base_url)
        idempotency_key = (
            f"checkout-{user_id}-{billing_interval or 'monthly'}-{int(time.time() // 60)}"
        )
        params: dict = {
            "payment_method_types": ["card"],
            "line_items": [{"price": price_id, "quantity": 1}],
            "mode": "subscription",
            "success_url": (
                f"{origin}/?subscription=success&checkout_session_id={{CHECKOUT_SESSION_ID}}"
            ),
            "cancel_url": f"{origin}/?subscription=cancelled",
            "metadata": {
                "userId": user_id,
                "planInterval": "year" if billing_interval == "annual" else "month",
            },
        }
        if existing_customer_id:
            params["customer"] = existing_customer_id
        elif primary_email:
            params["customer_email"] = primary_email

        checkout = stripe.checkout.Session.create(**params, idempotency_key=idempotency_key)
        return CheckoutResponse(checkout_url=checkout.url, session_id=checkout.id)
    except HTTPException:
        raise
    except Exception as error:
        logger.exception("Subscription checkout error details")
        raise _http_error(
            500,
            "Failed to create subscription checkout",
            detail=str(getattr(error, "message", None) or error),
        ) from None


@router.post(
    "/api/subscription/verify",
    response_model=VerifyResponse,
    response_model_exclude_none=True,
)
async def verify_subscription(
    user_id: CurrentUser,
    session: SessionDep,
    body: CheckoutSessionBody | None = None,
) -> VerifyResponse:
    try:
        checkout_session_id = (body.checkout_session_id if body else None) or None
        if not checkout_session_id:
            raise _http_error(400, "Missing checkout session ID")

        existing = await billing.get_subscription(session, user_id)
        leftover = bool(
            existing
            and billing.is_active_status(existing.status)
            and leftover_weekly_from_interval(existing.billing_interval)
        )
        if existing and billing.is_active_status(existing.status) and not leftover:
            return VerifyResponse(verified=True, already_active=True)

        billing.configure_stripe()
        checkout = stripe.checkout.Session.retrieve(
            checkout_session_id, expand=["subscription"]
        )
        if checkout.payment_status not in ("paid", "no_payment_required"):
            raise _http_error(
                402, "Payment not completed", status=checkout.payment_status
            )
        subscription = checkout.subscription
        if not subscription:
            raise _http_error(400, "No subscription found in checkout session")

        sub_id = billing.stripe_id(subscription)
        customer_id = billing.stripe_id(checkout.customer)
        sub_status = "active"
        period_end = None
        stripe_sub = None if isinstance(subscription, str) else subscription
        if stripe_sub is not None:
            if getattr(stripe_sub, "status", None):
                sub_status = stripe_sub.status
            period_end = billing.from_unix(getattr(stripe_sub, "current_period_end", None))
        else:
            try:
                stripe_sub = stripe.Subscription.retrieve(subscription)
                sub_status = stripe_sub.status
                period_end = billing.from_unix(getattr(stripe_sub, "current_period_end", None))
            except Exception:
                logger.exception("Failed to retrieve subscription details")

        amount_paid = int(getattr(checkout, "amount_total", None) or 0)
        await billing.ensure_paid_session(
            session,
            checkout_session_id=checkout_session_id,
            session_id=user_id,
            amount_paid=amount_paid,
        )
        # First caller wins; a duplicate verify still upserts the subscription
        # (Express does) but cannot double-grant credits against this checkout.
        await billing.claim_paid_session(session, checkout_session_id)

        checkout_meta = checkout.metadata or {}
        interval = (
            billing.recurring_interval_of(stripe_sub)
            or checkout_meta.get("planInterval")
            or "month"
        )
        old_weekly_id = (
            existing.stripe_subscription_id if leftover and existing else None
        )
        await billing.upsert_subscription(
            session,
            user_id=user_id,
            stripe_customer_id=customer_id,
            stripe_subscription_id=sub_id,
            status=sub_status,
            current_period_end=period_end,
            billing_interval=interval,
        )
        if old_weekly_id and old_weekly_id != sub_id:
            try:
                stripe.Subscription.delete(old_weekly_id)
            except Exception:
                logger.warning(
                    "Could not cancel leftover weekly subscription %s", old_weekly_id
                )
        return VerifyResponse(verified=True, subscribed=True)
    except HTTPException:
        raise
    except Exception:
        logger.exception("Subscription verification error")
        raise _http_error(500, "Failed to verify subscription") from None


@router.post("/api/subscription/cancel", response_model=CancelResponse)
async def cancel_subscription(user_id: CurrentUser, session: SessionDep) -> CancelResponse:
    try:
        sub = await billing.get_subscription(session, user_id)
        if not sub:
            raise _http_error(400, "No active subscription found")

        billing.configure_stripe()
        stripe.Subscription.modify(sub.stripe_subscription_id, cancel_at_period_end=True)
        await billing.update_subscription_status(session, sub.stripe_subscription_id, "canceling")
        return CancelResponse(
            cancelled=True,
            message="Subscription will end at the current billing period",
        )
    except HTTPException:
        raise
    except Exception as error:
        logger.exception("Subscription cancel error")
        raise _http_error(
            500,
            "Failed to cancel subscription",
            detail=str(getattr(error, "message", None) or error),
        ) from None


@router.post(
    "/api/subscription/unlock-images",
    response_model=UnlockResponse,
    response_model_exclude_none=True,
)
async def unlock_images(
    user_id: CurrentUser,
    session: SessionDep,
    settings: SettingsDep,
    body: UnlockImagesBody | None = None,
) -> UnlockResponse | JSONResponse:
    raise _http_error(
        410,
        "Listing copy is generated after confirmed facts, not unlocked.",
    )
