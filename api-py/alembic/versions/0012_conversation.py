"""One conversation per shop.

Revision ID: 0012_conversation
Revises: 0010_overflow_confirmed_month
Create Date: 2026-09-28
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0012_conversation"
down_revision: str | Sequence[str] | None = "0010_overflow_confirmed_month"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS conversations (
            id serial PRIMARY KEY,
            session_id text NOT NULL UNIQUE,
            shop_domain text,
            silence jsonb NOT NULL DEFAULT '{}'::jsonb,
            thread jsonb NOT NULL DEFAULT '[]'::jsonb,
            proposal jsonb
        )
        """
    )
    op.execute("ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY")
    op.execute("REVOKE ALL ON TABLE public.conversations FROM anon, authenticated")
    op.execute(
        "REVOKE ALL ON SEQUENCE public.conversations_id_seq FROM anon, authenticated"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS conversations")
