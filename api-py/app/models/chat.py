"""One Chat thread per seller and shop.

`shop_domain` is empty when no Shopify shop is connected yet. That workspace
thread is not the shop's thread: connecting starts a new one.
"""

from typing import Any

from sqlalchemy import UniqueConstraint
from sqlmodel import Field, SQLModel

from app.models.base import jsonb, sa_text, txt


class ChatThread(SQLModel, table=True):
    __tablename__ = "chat_threads"
    __table_args__ = (
        UniqueConstraint("session_id", "shop_domain", name="chat_threads_shop_key"),
    )

    id: int | None = Field(default=None, primary_key=True)
    session_id: str = Field(sa_column=txt(nullable=False))
    shop_domain: str = Field(sa_column=txt(nullable=False, server_default=sa_text("''")))
    thread: Any = Field(
        default_factory=list,
        sa_column=jsonb(nullable=False, server_default=sa_text("'[]'::jsonb")),
    )
