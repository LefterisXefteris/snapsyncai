"""SQLModel tables that remain after Express/`shared/` were deleted.

Alembic is the schema source of truth. These checks guard the live core-loop
tables the SPA still reads, plus Inventory Autopilot (restored in 0006).
"""

from sqlalchemy import Column
from sqlalchemy.dialects import postgresql
from sqlmodel import SQLModel

import app.models  # noqa: F401  (registers the tables)

EXPECTED_TABLES = {
    "images",
    "shopify_connections",
    "paid_sessions",
    "subscriptions",
    "user_credits",
    "inventory_settings",
    "inventory_items",
    "inventory_channel_links",
    "inventory_ledger_entries",
    "inventory_bundle_components",
    "inventory_import_jobs",
    "inventory_webhook_events",
    "inventory_outbox_jobs",
    "inventory_notifications",
}

# Known-good literals from the live images table (not derived from SQLModel).
IMAGE_COLUMNS = {
    "id",
    "original_name",
    "mime_type",
    "size",
    "image_data",
    "storage_url",
    "title",
    "description",
    "price",
    "category",
    "main_category",
    "product_type",
    "tags",
    "seo_title",
    "seo_description",
    "alt_text",
    "aeo_faqs",
    "aeo_snippet",
    "variants",
    "compare_at_price",
    "cost_per_item",
    "sku",
    "barcode",
    "track_quantity",
    "inventory_quantity",
    "media_gallery",
    "collections",
    "shopify_product_id",
    "shopify_status",
    "payment_status",
    "product_context",
    "brand_tone",
    "ai_data",
    "product_facts",
    "product_group_id",
    "session_id",
    "created_at",
}


def _pg_type(column: Column) -> str:
    """The type as Postgres will see it — `str(ARRAY(Text))` only yields 'ARRAY'."""
    return column.type.compile(dialect=postgresql.dialect()).upper()


def test_modelled_tables_are_the_core_loop() -> None:
    assert set(SQLModel.metadata.tables) == EXPECTED_TABLES


def test_images_columns_match_the_live_table() -> None:
    model_columns = {c.name for c in SQLModel.metadata.tables["images"].columns}
    assert model_columns == IMAGE_COLUMNS


class TestBehaviouralConstraints:
    def test_connections_are_unique_per_user(self) -> None:
        """What makes `INSERT ... ON CONFLICT` viable instead of read-then-write."""
        assert SQLModel.metadata.tables["shopify_connections"].columns["session_id"].unique is True

    def test_inventory_settings_are_unique_per_user(self) -> None:
        assert SQLModel.metadata.tables["inventory_settings"].columns["user_id"].unique is True


class TestImageContract:
    """`images` is the table the SPA reads structurally."""

    def test_text_columns_are_text_not_varchar(self) -> None:
        """SQLModel infers VARCHAR from a bare `str`; the live columns are all `text`."""
        for name in ("title", "description", "session_id", "product_group_id"):
            column = SQLModel.metadata.tables["images"].columns[name]
            assert _pg_type(column) == "TEXT", name

    def test_array_and_jsonb_columns(self) -> None:
        columns = SQLModel.metadata.tables["images"].columns
        assert _pg_type(columns["tags"]) == "TEXT[]"
        assert _pg_type(columns["media_gallery"]) == "TEXT[]"
        assert _pg_type(columns["aeo_faqs"]) == "JSONB"
        assert _pg_type(columns["variants"]) == "JSONB"
        assert _pg_type(columns["product_facts"]) == "JSONB"

    def test_price_is_numeric_not_float(self) -> None:
        """Money must not round-trip through a float."""
        assert _pg_type(SQLModel.metadata.tables["images"].columns["price"]) == "NUMERIC"

    def test_boot_time_indexes_are_declared(self) -> None:
        names = {i.name for i in SQLModel.metadata.tables["images"].indexes}
        assert names == {
            "idx_images_session_id",
            "idx_images_product_group_id",
            "idx_images_session_created",
        }


def test_shopify_connection_gpsr_identity_is_jsonb() -> None:
    columns = SQLModel.metadata.tables["shopify_connections"].columns
    assert _pg_type(columns["gpsr_identity"]) == "JSONB"


def test_full_schema_compiles_to_postgres_ddl() -> None:
    """The baseline revision runs `create_all`; this proves that emits valid DDL.

    Can't be executed here (no local Postgres), so compilation is the strongest
    available check — it catches bad types, malformed CHECKs and index expressions.
    """
    from sqlalchemy import create_mock_engine

    statements: list[str] = []
    engine = create_mock_engine(
        "postgresql://",
        lambda sql, *a, **kw: statements.append(str(sql.compile(dialect=engine.dialect)).strip()),
    )
    SQLModel.metadata.create_all(engine, checkfirst=False)

    assert sum(s.startswith("CREATE TABLE") for s in statements) == len(EXPECTED_TABLES)
    assert any("idx_images_session_id" in s for s in statements)
    assert any("idx_images_product_group_id" in s for s in statements)
    assert any("idx_images_session_created" in s for s in statements)
