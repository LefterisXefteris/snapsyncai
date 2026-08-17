"""Assert the SQLModel port matches `shared/schema.ts` for the core-loop tables.

Kept tables: images, shopify_connections, paid_sessions, subscriptions, user_credits.
Dropped Autopilot/chat tables are not modelled and are not required from
`migrations/0001_inventory_autopilot.sql`.
"""

import re
from pathlib import Path

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
}


def _pg_type(column: Column) -> str:
    """The type as Postgres will see it — `str(ARRAY(Text))` only yields 'ARRAY'."""
    return column.type.compile(dialect=postgresql.dialect()).upper()


REPO_ROOT = Path(__file__).resolve().parents[2]
SCHEMA_TS = REPO_ROOT / "shared" / "schema.ts"

_TABLE_RE = re.compile(r'pgTable\(\s*"(?P<table>\w+)"\s*,\s*\{(?P<body>.*?)\n\}', re.DOTALL)
_COLUMN_RE = re.compile(r'^\s{2}\w+:\s*\w+\("(?P<column>\w+)"\)', re.MULTILINE)


def parse_drizzle_schema() -> dict[str, set[str]]:
    source = SCHEMA_TS.read_text()
    return {
        m.group("table"): set(_COLUMN_RE.findall(m.group("body")))
        for m in _TABLE_RE.finditer(source)
    }


DRIZZLE = parse_drizzle_schema()
DRIZZLE_CORE = {name: cols for name, cols in DRIZZLE.items() if name in EXPECTED_TABLES}


def test_drizzle_schema_was_parsed() -> None:
    """Guard the parser itself — a silent regex failure would make everything below vacuous."""
    assert DRIZZLE_CORE, "expected core-loop pgTable definitions"
    assert "images" in DRIZZLE_CORE
    assert "session_id" in DRIZZLE_CORE["images"]


def test_modelled_tables_are_the_core_loop() -> None:
    assert set(SQLModel.metadata.tables) == EXPECTED_TABLES


def test_every_kept_drizzle_table_has_a_model() -> None:
    assert set(DRIZZLE_CORE) == EXPECTED_TABLES


def test_columns_match_drizzle() -> None:
    for table in sorted(EXPECTED_TABLES):
        model_columns = {c.name for c in SQLModel.metadata.tables[table].columns}
        assert model_columns == DRIZZLE_CORE[table], table


class TestBehaviouralConstraints:
    def test_connections_are_unique_per_user(self) -> None:
        """What makes `INSERT ... ON CONFLICT` viable instead of read-then-write."""
        assert SQLModel.metadata.tables["shopify_connections"].columns["session_id"].unique is True


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

    def test_price_is_numeric_not_float(self) -> None:
        """Money must not round-trip through a float."""
        assert _pg_type(SQLModel.metadata.tables["images"].columns["price"]) == "NUMERIC"

    def test_boot_time_indexes_are_declared(self) -> None:
        """Created by `runAppMigrations()` in server/index.ts, not by any migration file."""
        names = {i.name for i in SQLModel.metadata.tables["images"].indexes}
        assert names == {
            "idx_images_session_id",
            "idx_images_product_group_id",
            "idx_images_session_created",
        }


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
