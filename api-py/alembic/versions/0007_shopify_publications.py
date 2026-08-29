"""Shopify product status and publication ids on images.

Revision ID: 0007_shopify_publications
Revises: 0006_restore_inventory
Create Date: 2026-08-29
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0007_shopify_publications"
down_revision: str | Sequence[str] | None = "0006_restore_inventory"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE images ADD COLUMN IF NOT EXISTS shopify_product_status text DEFAULT 'DRAFT'"
    )
    op.execute(
        "ALTER TABLE images ADD COLUMN IF NOT EXISTS shopify_publication_ids text[] DEFAULT '{}'"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE images DROP COLUMN IF EXISTS shopify_publication_ids")
    op.execute("ALTER TABLE images DROP COLUMN IF EXISTS shopify_product_status")
