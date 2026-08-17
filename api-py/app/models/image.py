"""The `images` table — ported from `shared/schema.ts`.

`session_id` holds the Clerk user id and is the row-level tenancy key; every query must
filter on it (`server/storage.ts` throws if it is missing, and that guard is worth
keeping on the Python side too).

The three indexes come from `runAppMigrations()` in `server/index.ts:146-166`, which
created them at boot with `CREATE INDEX CONCURRENTLY`. They are declared here so Alembic
knows they exist and does not propose recreating them.
"""

from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import Index
from sqlalchemy import text as sa_text
from sqlmodel import Field, SQLModel

from app.models.base import integer, jsonb, numeric, timestamp, txt, txt_array


class Image(SQLModel, table=True):
    __tablename__ = "images"
    __table_args__ = (
        Index("idx_images_session_id", "session_id"),
        Index(
            "idx_images_product_group_id",
            "product_group_id",
            postgresql_where=sa_text("product_group_id IS NOT NULL"),
        ),
        Index("idx_images_session_created", "session_id", sa_text("created_at DESC")),
    )

    id: int | None = Field(default=None, primary_key=True)

    # --- File ---------------------------------------------------------------
    original_name: str = Field(sa_column=txt(nullable=False))
    mime_type: str = Field(sa_column=txt(nullable=False))
    size: int = Field(sa_column=integer(nullable=False))
    # Legacy base64 payload. New uploads go to Supabase Storage and set storage_url.
    image_data: str | None = Field(default=None, sa_column=txt())
    storage_url: str | None = Field(default=None, sa_column=txt())

    # --- Listing content ------------------------------------------------------
    title: str | None = Field(default=None, sa_column=txt())
    description: str | None = Field(default=None, sa_column=txt())
    price: Decimal | None = Field(default=None, sa_column=numeric())
    category: str | None = Field(default=None, sa_column=txt())
    main_category: str | None = Field(
        default=None, sa_column=txt(server_default="Uncategorized")
    )
    product_type: str | None = Field(default=None, sa_column=txt())
    tags: list[str] | None = Field(default=None, sa_column=txt_array())

    # --- SEO / AEO ------------------------------------------------------------
    seo_title: str | None = Field(default=None, sa_column=txt())
    seo_description: str | None = Field(default=None, sa_column=txt())
    alt_text: str | None = Field(default=None, sa_column=txt())
    aeo_faqs: Any | None = Field(default=None, sa_column=jsonb())
    aeo_snippet: str | None = Field(default=None, sa_column=txt())

    # --- Commerce -------------------------------------------------------------
    variants: Any | None = Field(default=None, sa_column=jsonb())
    compare_at_price: Decimal | None = Field(default=None, sa_column=numeric())
    cost_per_item: Decimal | None = Field(default=None, sa_column=numeric())
    sku: str | None = Field(default=None, sa_column=txt())
    barcode: str | None = Field(default=None, sa_column=txt())
    # Stored as text 'true'/'false', not boolean — matching the live column.
    track_quantity: str | None = Field(default=None, sa_column=txt(server_default="true"))
    inventory_quantity: int | None = Field(default=None, sa_column=integer(default=0))
    media_gallery: list[str] | None = Field(default=None, sa_column=txt_array())
    collections: list[str] | None = Field(default=None, sa_column=txt_array())

    # --- Channel publish state -------------------------------------------------
    shopify_product_id: str | None = Field(default=None, sa_column=txt())
    shopify_status: str | None = Field(default=None, sa_column=txt(server_default="pending"))

    # --- Generation context -----------------------------------------------------
    payment_status: str | None = Field(default=None, sa_column=txt(server_default="unpaid"))
    product_context: str | None = Field(default=None, sa_column=txt())
    brand_tone: str | None = Field(default=None, sa_column=txt(server_default="professional"))
    ai_data: Any | None = Field(default=None, sa_column=jsonb())
    product_facts: Any | None = Field(default=None, sa_column=jsonb())

    # --- Grouping / tenancy -------------------------------------------------------
    product_group_id: str | None = Field(default=None, sa_column=txt())
    session_id: str | None = Field(default=None, sa_column=txt())
    created_at: datetime | None = Field(default=None, sa_column=timestamp(now=True))
