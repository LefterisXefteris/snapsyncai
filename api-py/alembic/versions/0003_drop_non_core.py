"""Drop Instagram, chat, and Inventory Autopilot tables plus unused image columns.

Revision ID: 0003_drop_non_core
Revises: 0002_drop_etsy_amazon
Create Date: 2026-08-17
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0003_drop_non_core"
down_revision: str | Sequence[str] | None = "0002_drop_etsy_amazon"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE images
          DROP COLUMN IF EXISTS instagram_post_id,
          DROP COLUMN IF EXISTS instagram_status,
          DROP COLUMN IF EXISTS instagram_caption,
          DROP COLUMN IF EXISTS generated_backgrounds
        """
    )
    op.execute(
        """
        DROP TABLE IF EXISTS
          inventory_notifications,
          inventory_outbox_jobs,
          inventory_webhook_events,
          inventory_import_jobs,
          inventory_bundle_components,
          inventory_ledger_entries,
          inventory_channel_links,
          inventory_items,
          inventory_settings
        CASCADE
        """
    )
    op.execute("DROP TABLE IF EXISTS instagram_connections")
    op.execute("DROP TABLE IF EXISTS messages")
    op.execute("DROP TABLE IF EXISTS conversations")


def downgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS instagram_connections (
          id SERIAL PRIMARY KEY,
          session_id TEXT NOT NULL UNIQUE,
          access_token TEXT NOT NULL,
          ig_user_id TEXT NOT NULL,
          username TEXT,
          created_at TIMESTAMP DEFAULT NOW()
        )
        """
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS conversations (
          id SERIAL PRIMARY KEY,
          title TEXT NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
        """
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS messages (
          id SERIAL PRIMARY KEY,
          conversation_id INTEGER NOT NULL
            REFERENCES conversations(id) ON DELETE CASCADE,
          role TEXT NOT NULL,
          content TEXT NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
        """
    )
    op.execute(
        """
        ALTER TABLE images
          ADD COLUMN IF NOT EXISTS instagram_post_id TEXT,
          ADD COLUMN IF NOT EXISTS instagram_status TEXT DEFAULT 'pending',
          ADD COLUMN IF NOT EXISTS instagram_caption TEXT,
          ADD COLUMN IF NOT EXISTS generated_backgrounds TEXT[]
        """
    )
