"""Add GPSR identity JSONB on shopify_connections.

Revision ID: 0005_shop_gpsr_identity
Revises: 0004_product_facts
Create Date: 2026-08-17
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0005_shop_gpsr_identity"
down_revision: str | Sequence[str] | None = "0004_product_facts"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("ALTER TABLE shopify_connections ADD COLUMN IF NOT EXISTS gpsr_identity JSONB")


def downgrade() -> None:
    op.execute("ALTER TABLE shopify_connections DROP COLUMN IF EXISTS gpsr_identity")
