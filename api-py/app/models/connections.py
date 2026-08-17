"""Per-user Shopify connections.

Keyed by `session_id` (the Clerk user id) with a UNIQUE constraint, which is what
makes the read-then-write `upsert*Connection` methods in `server/storage.ts`
race-prone. The Python port should use `INSERT ... ON CONFLICT DO UPDATE` on this
constraint instead (see `.planning/codebase/CONCERNS.md`).

Tokens here are sensitive. Shopify's `access_token` is AES-256-GCM encrypted by
`server/shopifyAdmin.ts`.
"""

from datetime import datetime

from sqlmodel import Field, SQLModel

from app.models.base import timestamp, txt, txt_array


class ShopifyConnection(SQLModel, table=True):
    __tablename__ = "shopify_connections"

    id: int | None = Field(default=None, primary_key=True)
    session_id: str = Field(sa_column=txt(nullable=False, unique=True))
    shop_domain: str = Field(sa_column=txt(nullable=False))
    access_token: str = Field(sa_column=txt(nullable=False))
    shop_name: str | None = Field(default=None, sa_column=txt())
    granted_scopes: list[str] | None = Field(default=None, sa_column=txt_array())
    webhooks_registered_at: datetime | None = Field(default=None, sa_column=timestamp())
    created_at: datetime | None = Field(default=None, sa_column=timestamp(now=True))
