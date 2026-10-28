"""The inputs a Chat act may hand to the page. Anything else is dropped."""

from collections.abc import Mapping

WHICH_PART = (
    "Which part of the listing copy — title, description, tags, SEO title, "
    "meta description, or AEO text?"
)
WHAT_WORDS = "What should it say?"

_FACT_KEYS = {
    "product_kind": "product_kind",
    "productKind": "product_kind",
    "is_textile": "is_textile",
    "isTextile": "is_textile",
    "composition": "composition",
    "gpsr_choice": "gpsr_choice",
    "gpsrChoice": "gpsr_choice",
    "gpsr_identity": "gpsr_identity",
    "gpsrIdentity": "gpsr_identity",
    "care_choice": "care_choice",
    "careChoice": "care_choice",
    "care": "care",
    "coffee_form": "coffee_form",
    "coffeeForm": "coffee_form",
    "roast_level": "roast_level",
    "roastLevel": "roast_level",
    "net_weight": "net_weight",
    "netWeight": "net_weight",
    "variant_net_weights": "variant_net_weights",
    "variantNetWeights": "variant_net_weights",
    "coffee_origin_choice": "coffee_origin_choice",
    "coffeeOriginChoice": "coffee_origin_choice",
    "coffee_origin": "coffee_origin",
    "coffeeOrigin": "coffee_origin",
    "ingredients_list": "ingredients_list",
    "ingredientsList": "ingredients_list",
    "allergen_statement": "allergen_statement",
    "allergenStatement": "allergen_statement",
}

_COPY_FIELDS = {
    "title": "title",
    "description": "description",
    "tags": "tags",
    "seo title": "seo_title",
    "seo_title": "seo_title",
    "seotitle": "seo_title",
    "meta description": "seo_description",
    "seo_description": "seo_description",
    "seodescription": "seo_description",
    "meta_description": "seo_description",
    "aeo": "aeo_snippet",
    "aeo text": "aeo_snippet",
    "aeo_snippet": "aeo_snippet",
    "aeosnippet": "aeo_snippet",
}

TYPED = {
    "title": "That's the title.",
    "description": "That's the description.",
    "tags": "Those are the tags.",
    "seo_title": "That's the SEO title.",
    "seo_description": "That's the meta description.",
    "aeo_snippet": "That's the AEO text.",
}


def fact_kwargs(raw: Mapping[str, object] | None) -> dict[str, object]:
    """The inputs the page's confirm accepts."""
    if not raw:
        return {}
    kwargs: dict[str, object] = {}
    for key, value in raw.items():
        name = _FACT_KEYS.get(key)
        if name is not None and value is not None:
            kwargs[name] = value
    return kwargs


def facts_from_payload(raw: object) -> dict[str, object] | None:
    if not isinstance(raw, dict):
        return None
    facts = fact_kwargs(raw)
    return facts or None


def copy_update(field: str | None, words: str | None) -> dict[str, object] | str:
    key = _COPY_FIELDS.get(field.casefold().strip()) if field and field.strip() else None
    if key is None:
        return WHICH_PART
    text = (words or "").strip()
    if not text:
        return WHAT_WORDS
    if key == "tags":
        tags = [part.strip() for part in text.split(",") if part.strip()]
        if not tags:
            return WHAT_WORDS
        return {"tags": tags}
    return {key: text}


def quote_from_payload(raw: object) -> tuple[str | None, str | None]:
    if not isinstance(raw, dict):
        return None, None
    field = raw.get("field")
    words = raw.get("words")
    return (
        field.strip() if isinstance(field, str) and field.strip() else None,
        words if isinstance(words, str) else None,
    )
