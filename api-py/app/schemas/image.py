"""Image DTOs — camelCase to match Drizzle's client-facing `Image` type."""

from datetime import datetime
from decimal import Decimal
from typing import Any

from pydantic import field_serializer, field_validator

from app.schemas.base import CamelModel

LIST_EXCLUDE = frozenset(
    {
        "image_data",
        "ai_data",
        "aeo_faqs",
    }
)


class ImageOut(CamelModel):
    id: int
    original_name: str
    mime_type: str
    size: int
    image_data: str | None = None
    storage_url: str | None = None
    title: str | None = None
    description: str | None = None
    price: Decimal | str | None = None
    category: str | None = None
    main_category: str | None = None
    product_type: str | None = None
    tags: list[str] | None = None
    seo_title: str | None = None
    seo_description: str | None = None
    alt_text: str | None = None
    aeo_faqs: Any | None = None
    aeo_snippet: str | None = None
    variants: Any | None = None
    compare_at_price: Decimal | str | None = None
    cost_per_item: Decimal | str | None = None
    sku: str | None = None
    barcode: str | None = None
    track_quantity: str | None = None
    inventory_quantity: int | None = None
    media_gallery: list[str] | None = None
    collections: list[str] | None = None
    shopify_product_id: str | None = None
    shopify_status: str | None = None
    payment_status: str | None = None
    product_context: str | None = None
    brand_tone: str | None = None
    ai_data: Any | None = None
    product_group_id: str | None = None
    session_id: str | None = None
    created_at: datetime | None = None

    @field_serializer("price", "compare_at_price", "cost_per_item")
    def _decimal_as_string(self, value: Decimal | str | None) -> str | None:
        if value is None:
            return None
        return str(value)


class ImageListOut(ImageOut):
    image_data: str | None = None
    ai_data: Any | None = None
    aeo_faqs: Any | None = None


class ImageUpdate(CamelModel):
    title: str | None = None
    description: str | None = None
    price: str | None = None
    category: str | None = None
    product_type: str | None = None
    tags: list[str] | None = None
    seo_title: str | None = None
    seo_description: str | None = None
    alt_text: str | None = None
    aeo_faqs: list[dict[str, str]] | None = None
    aeo_snippet: str | None = None
    variants: Any | None = None
    compare_at_price: str | None = None
    cost_per_item: str | None = None
    sku: str | None = None
    barcode: str | None = None
    track_quantity: str | None = None
    inventory_quantity: int | None = None
    media_gallery: list[str] | None = None
    collections: list[str] | None = None
    payment_status: str | None = None
    product_group_id: str | None = None

    @field_validator("price", "compare_at_price", "cost_per_item", mode="before")
    @classmethod
    def empty_string_to_none(cls, value: object) -> object:
        if value == "":
            return None
        return value


class AssignGroupBody(CamelModel):
    product_group_id: str
    primary_image_id: int | None = None


class AssignGroupBatchBody(CamelModel):
    image_ids: list[int]
    product_group_id: str
    primary_image_id: int | None = None


class OkResponse(CamelModel):
    ok: bool = True


class OkUpdatedResponse(CamelModel):
    ok: bool = True
    updated: int


class DeletedResponse(CamelModel):
    deleted: int


class PushIdsBody(CamelModel):
    ids: list[int]


class PushResult(CamelModel):
    id: int
    shopify_product_id: str | None = None
    error: str | None = None


class PushResponse(CamelModel):
    success: int
    failed: int
    results: list[PushResult]
