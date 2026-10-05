"""One published Website per seller, frozen at Publish."""

from typing import Any

from sqlmodel import Field, SQLModel

from app.models.base import jsonb, txt


class PublishedWebsite(SQLModel, table=True):
    __tablename__ = "websites"

    id: int | None = Field(default=None, primary_key=True)
    session_id: str = Field(sa_column=txt(nullable=False, unique=True))
    shop_domain: str = Field(sa_column=txt(nullable=False))
    handle: str = Field(sa_column=txt(nullable=False, unique=True))
    shop_name: str = Field(sa_column=txt(nullable=False))
    palette: str = Field(sa_column=txt(nullable=False))
    type_pairing: str = Field(sa_column=txt(nullable=False))
    products: Any = Field(default_factory=list, sa_column=jsonb(nullable=False))
