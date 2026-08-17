"""Public bootstrap config — port of `server/routes.ts:1076-1098`.

Both endpoints exist so the SPA can start without build-time env vars, and both are
deliberately unauthenticated: they return publishable keys only. Do not add a secret
to either response.
"""

from fastapi import APIRouter, HTTPException, status

from app.config import SettingsDep
from app.schemas.base import CamelModel

router = APIRouter(tags=["config"])

# server/routes.ts:302-304
SUBSCRIPTION_WEEKLY_PRICE_PENCE = 400  # £4.00/week
SUBSCRIPTION_ANNUAL_PRICE_PENCE = 17_300  # £173.00/year (2 months free vs 52 x £4)
WEEKLY_PRODUCT_LIMIT = 30


class ClerkConfigResponse(CamelModel):
    publishable_key: str


class PaymentsConfigResponse(CamelModel):
    publishable_key: str
    subscription_weekly_price_pence: int
    subscription_annual_price_pence: int
    weekly_product_limit: int


@router.get("/api/auth/clerk-config", response_model=ClerkConfigResponse)
async def clerk_config(settings: SettingsDep) -> ClerkConfigResponse:
    if not settings.clerk_publishable_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Clerk not configured",
        )
    return ClerkConfigResponse(publishable_key=settings.clerk_publishable_key)


@router.get("/api/payments/config", response_model=PaymentsConfigResponse)
async def payments_config(settings: SettingsDep) -> PaymentsConfigResponse:
    if not settings.stripe_publishable_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Payment system not available",
        )
    return PaymentsConfigResponse(
        publishable_key=settings.stripe_publishable_key,
        subscription_weekly_price_pence=SUBSCRIPTION_WEEKLY_PRICE_PENCE,
        subscription_annual_price_pence=SUBSCRIPTION_ANNUAL_PRICE_PENCE,
        weekly_product_limit=WEEKLY_PRODUCT_LIMIT,
    )
