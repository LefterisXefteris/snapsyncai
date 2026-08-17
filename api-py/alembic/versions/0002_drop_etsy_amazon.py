"""Drop Etsy and Amazon connection tables and image listing columns.

Revision ID: 0002_drop_etsy_amazon
Revises: 0001_baseline
Create Date: 2026-08-17
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0002_drop_etsy_amazon"
down_revision: str | Sequence[str] | None = "0001_baseline"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE images
          DROP COLUMN IF EXISTS etsy_listing_id,
          DROP COLUMN IF EXISTS etsy_status,
          DROP COLUMN IF EXISTS amazon_listing_id,
          DROP COLUMN IF EXISTS amazon_status
        """
    )
    op.execute("DROP TABLE IF EXISTS etsy_connections")
    op.execute("DROP TABLE IF EXISTS amazon_connections")


def downgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS etsy_connections (
          id SERIAL PRIMARY KEY,
          session_id TEXT NOT NULL UNIQUE,
          api_keystring TEXT NOT NULL,
          access_token TEXT NOT NULL,
          shop_id TEXT NOT NULL,
          shop_name TEXT,
          created_at TIMESTAMP DEFAULT NOW()
        )
        """
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS amazon_connections (
          id SERIAL PRIMARY KEY,
          session_id TEXT NOT NULL UNIQUE,
          seller_id TEXT NOT NULL,
          marketplace_id TEXT NOT NULL,
          lwa_client_id TEXT NOT NULL,
          lwa_client_secret TEXT NOT NULL,
          lwa_refresh_token TEXT NOT NULL,
          seller_name TEXT,
          created_at TIMESTAMP DEFAULT NOW()
        )
        """
    )
    op.execute(
        """
        ALTER TABLE images
          ADD COLUMN IF NOT EXISTS etsy_listing_id TEXT,
          ADD COLUMN IF NOT EXISTS etsy_status TEXT DEFAULT 'pending',
          ADD COLUMN IF NOT EXISTS amazon_listing_id TEXT,
          ADD COLUMN IF NOT EXISTS amazon_status TEXT DEFAULT 'pending'
        """
    )
