"""Subscription HTTP routes — port of `server/routes.ts:1101-1677`.

Paths stay byte-stable with the Express handlers they replace.
"""

from __future__ import annotations

import asyncio
import logging
import time

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
    UnlockResult,
    VerifyResponse,
)
from app.services import billing, image_analysis
from app.services import images as image_store
from app.services.billing import WEEKLY_PRODUCT_LIMIT
from app.services.product_facts import (
    apply_suggested,
    facts_from_stored,
    persistable_from_vision,
    stored_from_facts,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["billing"])

CONCURRENCY_LIMIT = 10


def _app_url(request: Request) -> str:
    protocol = request.headers.get("x-forwarded-proto") or request.url.scheme or "https"
    host = (
        request.headers.get("x-forwarded-host")
        or request.headers.get("host")
        or request.url.hostname
    )
    return f"{protocol}://{host}"


def _http_error(status_code: int, message: str, **extra) -> HTTPException:
    if extra:
        return HTTPException(status_code=status_code, detail={"message": message, **extra})
    return HTTPException(status_code=status_code, detail=message)


async def _run_with_concurrency(items, limit, fn):
    if not items:
        return []
    semaphore = asyncio.Semaphore(limit)
    results: list = [None] * len(items)

    async def worker(index, item):
        async with semaphore:
            results[index] = await fn(item)

    await asyncio.gather(*(worker(i, item) for i, item in enumerate(items)))
    return results


@router.get(
    "/api/subscription/status",
    response_model=SubscriptionStatusResponse,
    response_model_exclude_none=True,
)
async def subscription_status(
    user_id: CurrentUser, session: SessionDep, settings: SettingsDep
) -> SubscriptionStatusResponse:
    try:
        if billing.is_local_pro(settings) or await billing.is_dev_free_user(
            user_id, settings
        ):
            return SubscriptionStatusResponse(
                subscribed=True,
                status="active",
                current_period_end=None,
                stripe_subscription_id=None,
            )

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

        if sub:
            return SubscriptionStatusResponse(
                subscribed=billing.is_active_status(sub.status),
                status=sub.status,
                current_period_end=billing.period_end_iso(sub.current_period_end),
                stripe_subscription_id=sub.stripe_subscription_id,
            )
        return SubscriptionStatusResponse(subscribed=False)
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
        if existing and billing.is_active_status(existing.status):
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
        app_url = _app_url(request)
        idempotency_key = (
            f"checkout-{user_id}-{billing_interval or 'weekly'}-{int(time.time() // 60)}"
        )
        params: dict = {
            "payment_method_types": ["card"],
            "line_items": [{"price": price_id, "quantity": 1}],
            "mode": "subscription",
            "success_url": (
                f"{app_url}/?subscription=success&checkout_session_id={{CHECKOUT_SESSION_ID}}"
            ),
            "cancel_url": f"{app_url}/?subscription=cancelled",
            "metadata": {"userId": user_id},
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
        if existing and billing.is_active_status(existing.status):
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
        if not isinstance(subscription, str):
            if getattr(subscription, "status", None):
                sub_status = subscription.status
            period_end = billing.from_unix(getattr(subscription, "current_period_end", None))
        else:
            try:
                full_sub = stripe.Subscription.retrieve(subscription)
                sub_status = full_sub.status
                period_end = billing.from_unix(getattr(full_sub, "current_period_end", None))
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

        await billing.upsert_subscription(
            session,
            user_id=user_id,
            stripe_customer_id=customer_id,
            stripe_subscription_id=sub_id,
            status=sub_status,
            current_period_end=period_end,
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
    try:
        image_ids = (body.image_ids if body else None) or []
        if not image_ids:
            raise _http_error(400, "No image IDs provided")

        all_images = await image_store.get_images_by_ids(session, image_ids)
        user_images = [img for img in all_images if img.session_id == user_id]
        unpaid = [img for img in user_images if img.payment_status != "paid"]
        if not unpaid:
            return UnlockResponse(processed=0, message="All selected images are already unlocked.")

        local_pro = billing.is_local_pro(settings)
        dev_free = await billing.is_dev_free_user(user_id, settings)
        sub = await billing.get_subscription(session, user_id)
        is_subscribed = local_pro or dev_free or (
            sub is not None and billing.is_active_status(sub.status)
        )
        if not is_subscribed:
            return JSONResponse(
                status_code=403,
                content={
                    "message": "Subscription required",
                    "detail": "Subscribe to SnapSync AI to unlock AI product analysis.",
                },
            )

        weekly_count = await billing.get_weekly_product_count(session, user_id)
        remaining = WEEKLY_PRODUCT_LIMIT - weekly_count
        if local_pro:
            remaining = len(unpaid)
        if remaining <= 0:
            return JSONResponse(
                status_code=403,
                content={
                    "message": "Weekly limit reached",
                    "detail": (
                        f"You've used all {WEEKLY_PRODUCT_LIMIT} products this week. "
                        "Your limit resets every Monday at midnight UTC."
                    ),
                    "weeklyLimit": WEEKLY_PRODUCT_LIMIT,
                    "used": weekly_count,
                    "resetsAt": billing.next_monday_utc().isoformat() + "Z",
                },
            )

        seen_groups: set[str] = set()
        capped = []
        for img in unpaid:
            key = img.product_group_id or f"single_{img.id}"
            if key not in seen_groups:
                if len(seen_groups) >= remaining:
                    break
                seen_groups.add(key)
            capped.append(img)
        unpaid = capped
        db_lock = asyncio.Lock()

        async def process(image):
            try:
                logger.info(
                    "[unlock-images] Processing image %s: mimeType=%s, "
                    "hasImageData=%s, hasStorageUrl=%s",
                    image.id,
                    image.mime_type,
                    bool(image.image_data),
                    bool(image.storage_url),
                )
                buffer = await image_store.load_image_bytes(image)
                logger.info(
                    "[unlock-images] loadImageBuffer for image %s: %s",
                    image.id,
                    f"got buffer ({len(buffer)} bytes)" if buffer else "null",
                )
                if not buffer:
                    async with db_lock:
                        await image_store.update_image(
                            session,
                            image.id,
                            {"payment_status": "paid"},
                        )
                    return UnlockResult(
                        id=image.id,
                        title=image.title,
                        note=(
                            "Unlocked with basic data (image buffer expired). "
                            "Re-upload for full AI analysis."
                        ),
                    )

                image_tone = image.brand_tone or "professional"
                logger.info(
                    "[unlock-images] Calling fullAnalyzeImage for image %s, tone=%s",
                    image.id,
                    image_tone,
                )
                analysis = None
                try:
                    analysis = await image_analysis.full_analyze_image(
                        buffer,
                        image.mime_type,
                        image.original_name,
                        image_tone,
                        image.product_context or None,
                    )
                except Exception:
                    logger.exception(
                        "[unlock-images] fullAnalyzeImage THREW for image %s", image.id
                    )
                logger.info(
                    "[unlock-images] fullAnalyzeImage result for image %s: %s",
                    image.id,
                    (
                        f'description="{str(analysis.get("description", ""))[:50]}"'
                        if analysis
                        else "null (threw)"
                    ),
                )

                if analysis and analysis.get("description") != "Failed to analyze image.":
                    persistable = persistable_from_vision(analysis)
                    facts = apply_suggested(
                        facts_from_stored(image.product_facts),
                        persistable.facts.suggested,
                    )
                    updates = persistable.as_image_updates()
                    updates["product_facts"] = stored_from_facts(facts)
                    updates["payment_status"] = "paid"
                    async with db_lock:
                        await image_store.update_image(session, image.id, updates)
                        await image_store.persist_product_facts(
                            session, image, stored_from_facts(facts)
                        )
                    return UnlockResult(id=image.id, title=image.title)

                async with db_lock:
                    await image_store.update_image(session, image.id, {"payment_status": "paid"})
                return UnlockResult(
                    id=image.id,
                    title=image.title,
                    error=(
                        "AI analysis failed — your preview data is preserved. "
                        "Please try unlocking again or edit manually."
                    ),
                )
            except Exception:
                logger.exception("[unlock-images] CAUGHT ERROR for image %s", image.id)
                async with db_lock:
                    await image_store.update_image(session, image.id, {"payment_status": "paid"})
                return UnlockResult(
                    id=image.id,
                    error=(
                        "Full analysis failed but product unlocked. "
                        "You can edit details manually."
                    ),
                )

        results = await _run_with_concurrency(unpaid, CONCURRENCY_LIMIT, process)
        return UnlockResponse(processed=len(results), results=results)
    except HTTPException:
        raise
    except Exception:
        logger.exception("Verify and unlock error")
        raise _http_error(500, "Failed to process payment and unlock analysis") from None
