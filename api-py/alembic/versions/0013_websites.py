"""One published Website per shop.

Revision ID: 0013_websites
Revises: 0011_deny_data_api
Create Date: 2026-10-05
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0013_websites"
down_revision: str | Sequence[str] | None = "0011_deny_data_api"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS websites (
            id serial PRIMARY KEY,
            session_id text NOT NULL UNIQUE,
            shop_domain text NOT NULL,
            handle text NOT NULL UNIQUE,
            shop_name text NOT NULL,
            palette text NOT NULL,
            type_pairing text NOT NULL,
            products jsonb NOT NULL
        )
        """
    )
    op.execute("ALTER TABLE public.websites ENABLE ROW LEVEL SECURITY")
    op.execute("REVOKE ALL ON TABLE public.websites FROM anon, authenticated")
    op.execute("REVOKE ALL ON SEQUENCE public.websites_id_seq FROM anon, authenticated")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS websites")
