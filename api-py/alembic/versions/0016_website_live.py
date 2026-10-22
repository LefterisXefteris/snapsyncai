"""Taking the site down keeps the address.

Revision ID: 0016_website_live
Revises: 0015_trendyol
Create Date: 2026-10-22
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0016_website_live"
down_revision: str | Sequence[str] | None = "0015_trendyol"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE public.websites
        ADD COLUMN IF NOT EXISTS live boolean NOT NULL DEFAULT true
        """
    )


def downgrade() -> None:
    op.execute("ALTER TABLE public.websites DROP COLUMN IF EXISTS live")
