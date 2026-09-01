"""Plan billing interval and overage report flag.

Revision ID: 0009_plan_interval_overage
Revises: 0008_allowance_spends
Create Date: 2026-09-01
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0009_plan_interval_overage"
down_revision: str | Sequence[str] | None = "0008_allowance_spends"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS billing_interval text")
    op.execute(
        """
        ALTER TABLE allowance_spends
        ADD COLUMN IF NOT EXISTS overage_reported boolean NOT NULL DEFAULT true
        """
    )


def downgrade() -> None:
    op.execute("ALTER TABLE allowance_spends DROP COLUMN IF EXISTS overage_reported")
    op.execute("ALTER TABLE subscriptions DROP COLUMN IF EXISTS billing_interval")
