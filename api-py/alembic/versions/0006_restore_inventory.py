"""Restore Inventory Autopilot tables dropped in 0003.

Revision ID: 0006_restore_inventory
Revises: 0005_shop_gpsr_identity
Create Date: 2026-08-21
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0006_restore_inventory"
down_revision: str | Sequence[str] | None = "0005_shop_gpsr_identity"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS inventory_settings (
          id SERIAL PRIMARY KEY,
          user_id TEXT NOT NULL UNIQUE,
          shop_domain TEXT NOT NULL,
          location_id TEXT NOT NULL,
          location_name TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'setup',
          enabled BOOLEAN NOT NULL DEFAULT FALSE,
          default_safety_buffer INTEGER NOT NULL DEFAULT 2 CHECK (default_safety_buffer >= 0),
          default_low_stock_threshold INTEGER NOT NULL DEFAULT 5 CHECK (default_low_stock_threshold >= 0),
          grace_ends_at TIMESTAMP,
          last_reconciled_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS inventory_items (
          id SERIAL PRIMARY KEY,
          user_id TEXT NOT NULL,
          title TEXT NOT NULL,
          variant_title TEXT,
          sku TEXT,
          kind TEXT NOT NULL DEFAULT 'standalone',
          ledger_quantity INTEGER NOT NULL DEFAULT 0 CHECK (ledger_quantity >= 0),
          safety_buffer INTEGER CHECK (safety_buffer IS NULL OR safety_buffer >= 0),
          low_stock_threshold INTEGER CHECK (low_stock_threshold IS NULL OR low_stock_threshold >= 0),
          tracking_enabled BOOLEAN NOT NULL DEFAULT TRUE,
          state TEXT NOT NULL DEFAULT 'draft',
          version INTEGER NOT NULL DEFAULT 0,
          last_synced_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS inventory_channel_links (
          id SERIAL PRIMARY KEY,
          user_id TEXT NOT NULL,
          inventory_item_id INTEGER NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
          channel TEXT NOT NULL DEFAULT 'shopify',
          external_product_id TEXT NOT NULL,
          external_variant_id TEXT NOT NULL,
          external_inventory_item_id TEXT NOT NULL,
          external_location_id TEXT NOT NULL,
          observed_quantity INTEGER NOT NULL DEFAULT 0,
          pushed_quantity INTEGER,
          pending_quantity INTEGER,
          external_status TEXT,
          sync_state TEXT NOT NULL DEFAULT 'draft',
          last_error TEXT,
          last_observed_at TIMESTAMP,
          last_pushed_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          UNIQUE (inventory_item_id, channel),
          UNIQUE (channel, external_inventory_item_id, external_location_id)
        );

        CREATE TABLE IF NOT EXISTS inventory_ledger_entries (
          id SERIAL PRIMARY KEY,
          user_id TEXT NOT NULL,
          inventory_item_id INTEGER NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
          delta INTEGER NOT NULL,
          quantity_after INTEGER NOT NULL CHECK (quantity_after >= 0),
          reason TEXT NOT NULL,
          source TEXT NOT NULL,
          idempotency_key TEXT NOT NULL UNIQUE,
          external_reference TEXT,
          metadata JSONB,
          created_at TIMESTAMP DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS inventory_bundle_components (
          id SERIAL PRIMARY KEY,
          user_id TEXT NOT NULL,
          bundle_item_id INTEGER NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
          component_item_id INTEGER NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
          units INTEGER NOT NULL CHECK (units > 0),
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          CHECK (bundle_item_id <> component_item_id),
          UNIQUE (bundle_item_id, component_item_id)
        );

        CREATE TABLE IF NOT EXISTS inventory_import_jobs (
          id SERIAL PRIMARY KEY,
          user_id TEXT NOT NULL,
          provider TEXT NOT NULL DEFAULT 'shopify',
          external_operation_id TEXT UNIQUE,
          status TEXT NOT NULL DEFAULT 'queued',
          total_items INTEGER NOT NULL DEFAULT 0,
          imported_items INTEGER NOT NULL DEFAULT 0,
          preview JSONB,
          error TEXT,
          created_at TIMESTAMP DEFAULT NOW(),
          completed_at TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS inventory_webhook_events (
          id SERIAL PRIMARY KEY,
          provider TEXT NOT NULL DEFAULT 'shopify',
          external_event_id TEXT NOT NULL UNIQUE,
          user_id TEXT,
          topic TEXT NOT NULL,
          shop_domain TEXT NOT NULL,
          payload JSONB NOT NULL,
          status TEXT NOT NULL DEFAULT 'received',
          attempts INTEGER NOT NULL DEFAULT 0,
          last_error TEXT,
          received_at TIMESTAMP DEFAULT NOW(),
          processed_at TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS inventory_outbox_jobs (
          id SERIAL PRIMARY KEY,
          user_id TEXT,
          type TEXT NOT NULL,
          payload JSONB NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          attempts INTEGER NOT NULL DEFAULT 0,
          available_at TIMESTAMP DEFAULT NOW(),
          processing_started_at TIMESTAMP,
          last_error TEXT,
          created_at TIMESTAMP DEFAULT NOW(),
          processed_at TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS inventory_notifications (
          id SERIAL PRIMARY KEY,
          user_id TEXT NOT NULL,
          inventory_item_id INTEGER REFERENCES inventory_items(id) ON DELETE CASCADE,
          type TEXT NOT NULL,
          severity TEXT NOT NULL DEFAULT 'warning',
          title TEXT NOT NULL,
          body TEXT NOT NULL,
          dedupe_key TEXT NOT NULL,
          read_at TIMESTAMP,
          resolved_at TIMESTAMP,
          emailed_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_inventory_settings_enabled ON inventory_settings(enabled);
        CREATE INDEX IF NOT EXISTS idx_inventory_items_user ON inventory_items(user_id);
        CREATE INDEX IF NOT EXISTS idx_inventory_items_user_state ON inventory_items(user_id, state);
        CREATE INDEX IF NOT EXISTS idx_inventory_items_user_sku ON inventory_items(user_id, sku);
        CREATE INDEX IF NOT EXISTS idx_inventory_channel_user ON inventory_channel_links(user_id);
        CREATE INDEX IF NOT EXISTS idx_inventory_ledger_item_created ON inventory_ledger_entries(inventory_item_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_inventory_ledger_user_created ON inventory_ledger_entries(user_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_inventory_bundle_component_item ON inventory_bundle_components(component_item_id);
        CREATE INDEX IF NOT EXISTS idx_inventory_import_user_created ON inventory_import_jobs(user_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_inventory_webhook_status ON inventory_webhook_events(status, received_at);
        CREATE INDEX IF NOT EXISTS idx_inventory_webhook_shop ON inventory_webhook_events(shop_domain);
        CREATE INDEX IF NOT EXISTS idx_inventory_outbox_pending ON inventory_outbox_jobs(status, available_at);
        CREATE INDEX IF NOT EXISTS idx_inventory_notification_user_created ON inventory_notifications(user_id, created_at DESC);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_notification_dedupe
          ON inventory_notifications(user_id, dedupe_key)
          WHERE resolved_at IS NULL;
        """
    )


def downgrade() -> None:
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
