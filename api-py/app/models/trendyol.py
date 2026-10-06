"""Trendyol International connection, listing, and accepted barcodes.

The connection is not columns on the Shopify shop. The listing is not Selling.
An accepted barcode keeps the quantity and model code from the first Push
Trendyol accepted; a later barcode is another row, and the previous one stays.
"""

from decimal import Decimal
from typing import Any

from sqlalchemy import UniqueConstraint
from sqlmodel import Field, SQLModel

from app.models.base import integer, jsonb, numeric, txt


class TrendyolConnection(SQLModel, table=True):
    __tablename__ = "trendyol_connections"

    id: int | None = Field(default=None, primary_key=True)
    session_id: str = Field(sa_column=txt(nullable=False, unique=True))
    seller_id: str = Field(sa_column=txt(nullable=False))
    api_key: str = Field(sa_column=txt(nullable=False))
    api_secret: str = Field(sa_column=txt(nullable=False))
    storefront_code: str = Field(sa_column=txt(nullable=False))
    currency: str = Field(sa_column=txt(nullable=False))
    vat_rate: int = Field(sa_column=integer(nullable=False))


class TrendyolListing(SQLModel, table=True):
    __tablename__ = "trendyol_listings"
    __table_args__ = (
        UniqueConstraint("session_id", "image_id", name="trendyol_listings_product_key"),
    )

    id: int | None = Field(default=None, primary_key=True)
    session_id: str = Field(sa_column=txt(nullable=False))
    image_id: int = Field(sa_column=integer(nullable=False))
    category_id: str | None = Field(default=None, sa_column=txt())
    category_name: str | None = Field(default=None, sa_column=txt())
    brand_id: str | None = Field(default=None, sa_column=txt())
    brand_name: str | None = Field(default=None, sa_column=txt())
    attributes: Any = Field(default_factory=list, sa_column=jsonb(nullable=False))
    sale_price: Decimal | None = Field(default=None, sa_column=numeric())
    list_price: Decimal | None = Field(default=None, sa_column=numeric())


class TrendyolBarcode(SQLModel, table=True):
    """One accepted barcode. Quantity and model code are fixed here."""

    __tablename__ = "trendyol_barcodes"
    __table_args__ = (
        UniqueConstraint("session_id", "barcode", name="trendyol_barcodes_barcode_key"),
    )

    id: int | None = Field(default=None, primary_key=True)
    session_id: str = Field(sa_column=txt(nullable=False))
    image_id: int = Field(sa_column=integer(nullable=False))
    barcode: str = Field(sa_column=txt(nullable=False))
    model_code: str = Field(sa_column=txt(nullable=False))
    quantity: int = Field(sa_column=integer(nullable=False))
    approval: str = Field(sa_column=txt(nullable=False))
    rejection_reason: str | None = Field(default=None, sa_column=txt())
