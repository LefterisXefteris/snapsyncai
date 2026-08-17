"""Stripe webhook — raw body, signature-checked, no Clerk session."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.db import get_session
from app.services.stripe_webhooks import process_stripe_webhook

logger = logging.getLogger(__name__)

router = APIRouter(tags=["webhooks"])


@router.post("/api/stripe/webhook")
async def stripe_webhook(request: Request) -> JSONResponse:
    signature = request.headers.get("stripe-signature")
    if not signature:
        return JSONResponse({"error": "Missing stripe-signature"}, status_code=400)
    payload = await request.body()
    if not payload:
        return JSONResponse({"error": "Webhook processing error"}, status_code=400)
    try:
        settings = get_settings()
        async for session in get_session():
            await process_stripe_webhook(session, settings, payload, signature)
            break
        return JSONResponse({"received": True}, status_code=200)
    except Exception as exc:
        logger.error("Webhook error: %s", exc)
        return JSONResponse({"error": "Webhook processing error"}, status_code=400)
