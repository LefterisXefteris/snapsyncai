"""Column helpers for the ported Drizzle schema.

Every column is declared with an explicit SQLAlchemy type rather than letting SQLModel
infer one. SQLModel maps a bare `str` to VARCHAR, but the live schema uses `text`
everywhere — inferring would make Alembic report drift on effectively every column.
"""

from datetime import datetime
from typing import Any

from sqlalchemy import Boolean, Column, DateTime, Integer, Numeric, Text, func
from sqlalchemy import text as sa_text
from sqlalchemy.dialects.postgresql import ARRAY, JSONB


def txt(nullable: bool = True, **kw: Any) -> Column:
    return Column(Text, nullable=nullable, **kw)


def txt_array(nullable: bool = True, **kw: Any) -> Column:
    return Column(ARRAY(Text), nullable=nullable, **kw)


def integer(nullable: bool = True, default: int | None = None, **kw: Any) -> Column:
    server_default = sa_text(str(default)) if default is not None else None
    return Column(Integer, nullable=nullable, server_default=server_default, **kw)


def boolean(nullable: bool = False, default: bool | None = None, **kw: Any) -> Column:
    server_default = sa_text("true" if default else "false") if default is not None else None
    return Column(Boolean, nullable=nullable, server_default=server_default, **kw)


def numeric(nullable: bool = True, **kw: Any) -> Column:
    """Drizzle `numeric()` with no precision — arbitrary precision, maps to Decimal."""
    return Column(Numeric, nullable=nullable, **kw)


def jsonb(nullable: bool = True, **kw: Any) -> Column:
    return Column(JSONB, nullable=nullable, **kw)


def timestamp(nullable: bool = True, now: bool = False, **kw: Any) -> Column:
    """`timestamp without time zone`, matching Drizzle's `timestamp()`."""
    return Column(
        DateTime,
        nullable=nullable,
        server_default=func.now() if now else None,
        **kw,
    )


__all__ = [
    "ARRAY",
    "JSONB",
    "boolean",
    "datetime",
    "integer",
    "jsonb",
    "numeric",
    "sa_text",
    "timestamp",
    "txt",
    "txt_array",
]
