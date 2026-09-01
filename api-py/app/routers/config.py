"""Public bootstrap config — port of `server/routes.ts:1076-1098`.

Both endpoints exist so the SPA can start without build-time env vars, and both are
deliberately unauthenticated: they return publishable keys only. Do not add a secret
to either response.
"""

from fastapi import APIRouter, HTTPException, status

from app.config import SettingsDep
from app.schemas.base import CamelModel

from app.services.plan import (
    OVERAGE_PENCE,
    PLAN_ANNUAL_PENCE,
    PLAN_INCLUDED,
    PLAN_MONTHLY_PENCE,
)

router = APIRouter(tags=["config"])


class ClerkConfigResponse(CamelModel):
    publishable_key: str


class PaymentsConfigResponse(CamelModel):
    publishable_key: str
    plan_monthly_price_pence: int
    plan_annual_price_pence: int
    allowance_monthly: int
    overage_pence: int


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
        plan_monthly_price_pence=PLAN_MONTHLY_PENCE,
        plan_annual_price_pence=PLAN_ANNUAL_PENCE,
        allowance_monthly=PLAN_INCLUDED,
        overage_pence=OVERAGE_PENCE,
    )
