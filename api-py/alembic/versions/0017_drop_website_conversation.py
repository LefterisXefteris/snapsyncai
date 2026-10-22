"""Drop Website and Conversation tables.

Revision ID: 0017_drop_website_conversation
Revises: 0016_website_live
Create Date: 2026-10-22
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0017_drop_website_conversation"
down_revision: str | Sequence[str] | None = "0016_website_live"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("DROP TABLE IF EXISTS public.website_prototypes CASCADE")
    op.execute("DROP TABLE IF EXISTS public.websites CASCADE")
    op.execute("DROP TABLE IF EXISTS public.conversations CASCADE")


def downgrade() -> None:
    raise NotImplementedError("Website and Conversation are not restored")
