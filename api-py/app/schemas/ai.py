"""Request/response DTOs for upload + AI routes. camelCase for the SPA."""

from typing import Literal

from app.schemas.base import CamelModel


class GenerateContentBody(CamelModel):
    category: str | None = None
    style_tone: str | None = None
    audience: str | None = None


class RegenerateFieldBody(CamelModel):
    field: Literal["title", "description", "seoKeywords", "aeoFaqs"]
    category: str | None = None
    style_tone: str | None = None
    audience: str | None = None
