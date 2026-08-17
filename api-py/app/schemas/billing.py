"""Subscription / billing DTOs — camelCase to match `client/src/hooks/use-images.ts`."""

from app.schemas.base import CamelModel


class CheckoutSessionBody(CamelModel):
    checkout_session_id: str | None = None


class CreateCheckoutBody(CamelModel):
    billing_interval: str | None = None


class UnlockImagesBody(CamelModel):
    image_ids: list[int] | None = None


class SubscriptionStatusResponse(CamelModel):
    subscribed: bool
    status: str | None = None
    current_period_end: str | None = None
    stripe_subscription_id: str | None = None


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
