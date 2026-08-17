"""Add product_facts JSONB on images.

Revision ID: 0004_product_facts
Revises: 0003_drop_non_core
Create Date: 2026-08-17
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0004_product_facts"
down_revision: str | Sequence[str] | None = "0003_drop_non_core"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("ALTER TABLE images ADD COLUMN IF NOT EXISTS product_facts JSONB")


def downgrade() -> None:
    op.execute("ALTER TABLE images DROP COLUMN IF EXISTS product_facts")
