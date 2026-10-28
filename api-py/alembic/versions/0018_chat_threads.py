"""One Chat thread per shop.

Revision ID: 0018_chat_threads
Revises: 0017_drop_website_conversation
Create Date: 2026-10-26
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0018_chat_threads"
down_revision: str | Sequence[str] | None = "0017_drop_website_conversation"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS chat_threads (
            id serial PRIMARY KEY,
            session_id text NOT NULL,
            shop_domain text NOT NULL DEFAULT '',
            thread jsonb NOT NULL DEFAULT '[]'::jsonb,
            CONSTRAINT chat_threads_shop_key UNIQUE (session_id, shop_domain)
        )
        """
    )
    op.execute("ALTER TABLE public.chat_threads ENABLE ROW LEVEL SECURITY")
    op.execute("REVOKE ALL ON TABLE public.chat_threads FROM anon, authenticated")
    op.execute("REVOKE ALL ON SEQUENCE public.chat_threads_id_seq FROM anon, authenticated")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS chat_threads")
