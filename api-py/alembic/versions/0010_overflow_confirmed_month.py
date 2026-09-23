"""First overflow confirm ack on the Plan record.

Revision ID: 0010_overflow_confirmed_month
Revises: 0009_plan_interval_overage
Create Date: 2026-09-23
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0010_overflow_confirmed_month"
down_revision: str | Sequence[str] | None = "0009_plan_interval_overage"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS overflow_confirmed_month text"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE subscriptions DROP COLUMN IF EXISTS overflow_confirmed_month")
