"""The Website page keeps picks and the Website brief.

Revision ID: 0014_website_prototypes
Revises: 0013_websites
Create Date: 2026-10-05
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0014_website_prototypes"
down_revision: str | Sequence[str] | None = "0013_websites"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS website_prototypes (
            id serial PRIMARY KEY,
            session_id text NOT NULL UNIQUE,
            product_ids jsonb NOT NULL,
            brief text NOT NULL,
            look jsonb
        )
        """
    )
    op.execute("ALTER TABLE public.website_prototypes ENABLE ROW LEVEL SECURITY")
    op.execute("REVOKE ALL ON TABLE public.website_prototypes FROM anon, authenticated")
    op.execute("REVOKE ALL ON SEQUENCE public.website_prototypes_id_seq FROM anon, authenticated")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS website_prototypes")
