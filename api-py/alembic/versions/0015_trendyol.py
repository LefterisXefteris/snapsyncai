"""Trendyol International connection, listing, and accepted barcodes.

Revision ID: 0015_trendyol
Revises: 0014_website_prototypes
Create Date: 2026-10-05
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0015_trendyol"
down_revision: str | Sequence[str] | None = "0014_website_prototypes"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS trendyol_connections (
            id serial PRIMARY KEY,
            session_id text NOT NULL UNIQUE,
            seller_id text NOT NULL,
            api_key text NOT NULL,
            api_secret text NOT NULL,
            storefront_code text NOT NULL,
            currency text NOT NULL,
            vat_rate integer NOT NULL
        )
        """
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS trendyol_listings (
            id serial PRIMARY KEY,
            session_id text NOT NULL,
            image_id integer NOT NULL,
            category_id text,
            category_name text,
            brand_id text,
            brand_name text,
            attributes jsonb NOT NULL DEFAULT '[]',
            sale_price numeric,
            list_price numeric,
            UNIQUE (session_id, image_id)
        )
        """
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS trendyol_barcodes (
            id serial PRIMARY KEY,
            session_id text NOT NULL,
            image_id integer NOT NULL,
            barcode text NOT NULL,
            model_code text NOT NULL,
            quantity integer NOT NULL,
            approval text NOT NULL,
            rejection_reason text,
            UNIQUE (session_id, barcode)
        )
        """
    )
    for table in ("trendyol_connections", "trendyol_listings", "trendyol_barcodes"):
        op.execute(f"ALTER TABLE public.{table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"REVOKE ALL ON TABLE public.{table} FROM anon, authenticated")
        op.execute(f"REVOKE ALL ON SEQUENCE public.{table}_id_seq FROM anon, authenticated")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS trendyol_barcodes")
    op.execute("DROP TABLE IF EXISTS trendyol_listings")
    op.execute("DROP TABLE IF EXISTS trendyol_connections")
