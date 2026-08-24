"""Diff the SQLModel definitions against a live database.

`shared/schema.ts` is gone with Express. Production omitted CHECKs and `DESC`
ordering on some indexes that the old Drizzle SQL created. The models cannot be
validated against that schema; they have to be validated against a real database.

Run this before `alembic stamp head`:

    DATABASE_URL=... uv run python scripts/reflect_diff.py

Exit code 0 means the models match. Anything reported here must be resolved before
stamping, because stamping tells Alembic the models *are* the schema.
"""

import asyncio
import sys

from sqlalchemy import inspect
from sqlmodel import SQLModel

import app.models  # noqa: F401  (registers every table on SQLModel.metadata)
from app.db import create_engine


def _describe(inspector, table: str) -> dict:
    return {
        "columns": {
            c["name"]: (str(c["type"]).upper(), bool(c["nullable"]))
            for c in inspector.get_columns(table)
        },
        "indexes": {
            i["name"]: sorted(filter(None, i["column_names"]))
            for i in inspector.get_indexes(table)
        },
        "unique": {
            tuple(sorted(u["column_names"])) for u in inspector.get_unique_constraints(table)
        },
        "checks": {c.get("sqltext", "") for c in inspector.get_check_constraints(table)},
    }


def _compare(inspector, problems: list[str]) -> None:
    live_tables = set(inspector.get_table_names())
    model_tables = set(SQLModel.metadata.tables)

    for missing in sorted(model_tables - live_tables):
        problems.append(f"[{missing}] declared in models but ABSENT from the database")
    for extra in sorted(live_tables - model_tables):
        # Stripe's mirror tables and app_migrations are expected extras.
        problems.append(f"[{extra}] exists in the database but is NOT modelled")

    for name in sorted(model_tables & live_tables):
        live = _describe(inspector, name)
        model = SQLModel.metadata.tables[name]

        model_cols = {c.name for c in model.columns}
        live_cols = set(live["columns"])
        for c in sorted(model_cols - live_cols):
            problems.append(f"[{name}.{c}] in model, missing in DB")
        for c in sorted(live_cols - model_cols):
            problems.append(f"[{name}.{c}] in DB, missing in model")

        for c in sorted(model_cols & live_cols):
            live_type, live_nullable = live["columns"][c]
            model_col = model.columns[c]
            if model_col.nullable != live_nullable:
                problems.append(
                    f"[{name}.{c}] nullable mismatch: "
                    f"model={model_col.nullable} db={live_nullable}"
                )

        model_idx = {i.name for i in model.indexes}
        live_idx = set(live["indexes"])
        for i in sorted(model_idx - live_idx):
            problems.append(f"[{name}] index {i!r} in model, missing in DB")
        for i in sorted(live_idx - model_idx):
            problems.append(f"[{name}] index {i!r} in DB, missing in model")

        model_checks = len([c for c in model.constraints if type(c).__name__ == "CheckConstraint"])
        if model_checks != len(live["checks"]):
            problems.append(
                f"[{name}] CHECK count mismatch: model={model_checks} db={len(live['checks'])}"
            )


async def main() -> int:
    engine = create_engine()
    problems: list[str] = []
    async with engine.connect() as conn:
        await conn.run_sync(lambda sync_conn: _compare(inspect(sync_conn), problems))
    await engine.dispose()

    if problems:
        print(f"{len(problems)} discrepancies between models and database:\n")
        for p in problems:
            print("  ", p)
        return 1

    print(f"Models match the database ({len(SQLModel.metadata.tables)} tables).")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
