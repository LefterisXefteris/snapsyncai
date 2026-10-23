"""Subscription / billing DTOs — camelCase to match `client/src/hooks/use-images.ts`."""

from app.schemas.base import CamelModel


class CheckoutSessionBody(CamelModel):
    checkout_session_id: str | None = None


class CreateCheckoutBody(CamelModel):
    billing_interval: str | None = None


class BuyCreditsBody(CamelModel):
    pack: int


class UnlockImagesBody(CamelModel):
    image_ids: list[int] | None = None


class SubscriptionStatusResponse(CamelModel):
    subscribed: bool
    entitlement: str | None = None
    allowance_used: int | None = None
    allowance_included: int | None = None
    overage_this_month: int | None = None
    overflow_notice: bool = False
    overflow_confirm_required: bool = False
    credit_balance: int = 0
    credits_needed: bool = False
    credit_packs: list[dict] | None = None
    status: str | None = None
    current_period_end: str | None = None
    stripe_subscription_id: str | None = None


class VerifyCreditsResponse(CamelModel):
    verified: bool
    credit_balance: int | None = None
    already_claimed: bool | None = None


class RecoverResponse(CamelModel):
    recovered: bool
    already_active: bool | None = None
    subscribed: bool | None = None
    message: str | None = None


class CheckoutResponse(CamelModel):
    checkout_url: str | None = None
    session_id: str | None = None


class VerifyResponse(CamelModel):
    verified: bool
    already_active: bool | None = None
    subscribed: bool | None = None


class CancelResponse(CamelModel):
    cancelled: bool
    message: str


class UnlockResult(CamelModel):
    id: int
    title: str | None = None
    note: str | None = None
    error: str | None = None


class UnlockResponse(CamelModel):
    processed: int
    results: list[UnlockResult] | None = None
    message: str | None = None
