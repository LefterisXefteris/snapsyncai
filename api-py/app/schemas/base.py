"""Response DTO base.

Drizzle maps snake_case columns to camelCase TypeScript properties, and the SPA reads
those keys structurally (`img.shopifyStatus`, `img.productGroupId`, `img.mediaGallery`,
`img.aeoFaqs`, ...). Every response model must therefore serialise to camelCase or the
unmodified client breaks. SQLModel tables keep snake_case attributes; the aliasing lives
here, on the response side only.
"""

from pydantic import BaseModel, ConfigDict


def to_camel(snake: str) -> str:
    head, *rest = snake.split("_")
    return head + "".join(word.capitalize() for word in rest)


class CamelModel(BaseModel):
    """Serialises to camelCase, still accepts snake_case when constructed in Python."""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )
