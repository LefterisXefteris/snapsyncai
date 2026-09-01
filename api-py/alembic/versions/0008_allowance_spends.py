"""Allowance spend ledger.

Revision ID: 0008_allowance_spends
Revises: 0007_shopify_publications
Create Date: 2026-09-01
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0008_allowance_spends"
down_revision: str | Sequence[str] | None = "0007_shopify_publications"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS allowance_spends (
          id serial PRIMARY KEY,
          user_id text NOT NULL,
          kind text NOT NULL,
          product_id integer,
          as_overage boolean NOT NULL DEFAULT false,
          created_at timestamp DEFAULT now()
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_allowance_spends_user_id ON allowance_spends (user_id)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_allowance_spends_user_id")
    op.execute("DROP TABLE IF EXISTS allowance_spends")
