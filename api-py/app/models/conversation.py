"""One conversation per seller, kept on their Shopify shop."""

from typing import Any

from sqlmodel import Field, SQLModel

from app.models.base import jsonb, txt


class ShopConversation(SQLModel, table=True):
    __tablename__ = "conversations"

    id: int | None = Field(default=None, primary_key=True)
    session_id: str = Field(sa_column=txt(nullable=False, unique=True))
    shop_domain: str | None = Field(default=None, sa_column=txt())
    silence: Any = Field(default_factory=dict, sa_column=jsonb(nullable=False))
    thread: Any = Field(default_factory=list, sa_column=jsonb(nullable=False))
    proposal: Any | None = Field(default=None, sa_column=jsonb())
