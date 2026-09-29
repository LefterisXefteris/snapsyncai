"""Deny the Data API access to application tables.

FastAPI connects as postgres, which bypasses row level security, so existing
rows stay readable by the API. anon and authenticated lose their grants and
meet RLS with no policies, which denies the Data API. service_role keeps its
grants for server-side Storage. No policies: the app does not use Supabase Auth.

Revision ID: 0011_deny_data_api
Revises: 0012_conversation
Create Date: 2026-09-28
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0011_deny_data_api"
down_revision: str | Sequence[str] | None = "0012_conversation"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TABLES: tuple[str, ...] = (
    "alembic_version",
    "allowance_spends",
    "images",
    "inventory_bundle_components",
    "inventory_channel_links",
    "inventory_import_jobs",
    "inventory_items",
    "inventory_ledger_entries",
    "inventory_notifications",
    "inventory_outbox_jobs",
    "inventory_settings",
    "inventory_webhook_events",
    "conversations",
    "paid_sessions",
    "shopify_connections",
    "subscriptions",
    "user_credits",
)


def upgrade() -> None:
    for table in TABLES:
        op.execute(f'ALTER TABLE public."{table}" ENABLE ROW LEVEL SECURITY')
    op.execute("REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated")
    op.execute("REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated")
    op.execute(
        "ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public "
        "REVOKE ALL ON TABLES FROM anon, authenticated"
    )
    op.execute(
        "ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public "
        "REVOKE ALL ON SEQUENCES FROM anon, authenticated"
    )


def downgrade() -> None:
    op.execute(
        "ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public "
        "GRANT ALL ON TABLES TO anon, authenticated"
    )
    op.execute(
        "ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public "
        "GRANT ALL ON SEQUENCES TO anon, authenticated"
    )
    op.execute(
        "GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER "
        "ON ALL TABLES IN SCHEMA public TO anon, authenticated"
    )
    op.execute(
        "GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public "
        "TO anon, authenticated"
    )
    for table in TABLES:
        op.execute(f'ALTER TABLE public."{table}" DISABLE ROW LEVEL SECURITY')
