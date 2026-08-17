"""Product facts — the seam that keeps listing copy from inventing legal facts.

Upload, Generate, regenerate, and description-block assembly call this module.
Vision and HTTP do not own these rules.
"""

from __future__ import annotations

import re
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Any

_GATE_CLOSED = "Confirm product facts before generating listing copy."
_TEXTILE_NEEDS_COMPOSITION = (
    "Fibre composition is required to confirm a textile product."
)
_NON_TEXTILE_CONSTRAINTS = (
    "This product is not a textile. Do not invent fibre composition, "
    "care instructions, manufacturer identity, or GPSR / EU responsible person details."
)

_PERCENT = re.compile(r"\s*\(?\s*\d+\s*%\s*\)?", re.IGNORECASE)


@dataclass(frozen=True)
class SuggestedFacts:
    is_textile: bool | None
    fibre_names: tuple[str, ...]


@dataclass(frozen=True)
class ConfirmedFacts:
    is_textile: bool


@dataclass(frozen=True)
class ProductFacts:
    suggested: SuggestedFacts | None = None
    confirmed: ConfirmedFacts | None = None


@dataclass(frozen=True)
class PersistableVision:
    category: str | None
    main_category: str | None
    product_type: str | None
    price: str | None
    variants: list[dict[str, Any]] | None
    facts: ProductFacts

    def as_image_updates(self) -> dict[str, Any]:
        updates: dict[str, Any] = {
            "product_facts": stored_from_facts(self.facts),
        }
        if self.category is not None:
            updates["category"] = self.category
        if self.main_category is not None:
            updates["main_category"] = self.main_category
        if self.product_type is not None:
            updates["product_type"] = self.product_type
        if self.price is not None:
            updates["price"] = self.price
        if self.variants is not None:
            updates["variants"] = self.variants
        return updates


@dataclass(frozen=True)
class ConfirmResult:
    facts: ProductFacts
    error: str | None = None

    @property
    def ok(self) -> bool:
        return self.error is None


def persistable_from_vision(vision: Mapping[str, Any] | None) -> PersistableVision:
    """Classification, price, variants, and suggested facts. Never listing copy."""
    raw = vision or {}
    fibre_names = _fibre_names(raw.get("fibreNames", raw.get("fibre_names")))
    is_textile = _as_bool(raw.get("isTextile", raw.get("is_textile")))
    variants = raw.get("variants")
    return PersistableVision(
        category=_text(raw.get("category")) or None,
        main_category=_text(raw.get("mainCategory", raw.get("main_category"))) or None,
        product_type=_text(raw.get("productType", raw.get("product_type"))) or None,
        price=_price(raw.get("price")),
        variants=variants if isinstance(variants, list) else None,
        facts=ProductFacts(
            suggested=SuggestedFacts(is_textile=is_textile, fibre_names=fibre_names),
            confirmed=None,
        ),
    )


def facts_from_stored(record: Mapping[str, Any] | None) -> ProductFacts:
    if not record:
        return ProductFacts()
    suggested_raw = record.get("suggested")
    confirmed_raw = record.get("confirmed")
    suggested = None
    if isinstance(suggested_raw, Mapping):
        suggested = SuggestedFacts(
            is_textile=_as_bool(suggested_raw.get("isTextile", suggested_raw.get("is_textile"))),
            fibre_names=_fibre_names(
                suggested_raw.get("fibreNames", suggested_raw.get("fibre_names"))
            ),
        )
    confirmed = None
    if isinstance(confirmed_raw, Mapping) and (
        "isTextile" in confirmed_raw or "is_textile" in confirmed_raw
    ):
        confirmed = ConfirmedFacts(
            is_textile=bool(
                _as_bool(confirmed_raw.get("isTextile", confirmed_raw.get("is_textile")))
            ),
        )
    return ProductFacts(suggested=suggested, confirmed=confirmed)


def stored_from_facts(facts: ProductFacts) -> dict[str, Any]:
    stored: dict[str, Any] = {}
    if facts.suggested is not None:
        stored["suggested"] = {
            "isTextile": facts.suggested.is_textile,
            "fibreNames": list(facts.suggested.fibre_names),
        }
    if facts.confirmed is not None:
        stored["confirmed"] = {"isTextile": facts.confirmed.is_textile}
    return stored


def confirm_facts(facts: ProductFacts, *, is_textile: bool) -> ConfirmResult:
    if is_textile:
        return ConfirmResult(facts=facts, error=_TEXTILE_NEEDS_COMPOSITION)
    return ConfirmResult(
        facts=ProductFacts(
            suggested=facts.suggested,
            confirmed=ConfirmedFacts(is_textile=False),
        )
    )


def may_generate_listing_copy(facts: ProductFacts) -> bool:
    return facts.confirmed is not None and facts.confirmed.is_textile is False


def generation_blocked_reason(facts: ProductFacts) -> str | None:
    if may_generate_listing_copy(facts):
        return None
    return _GATE_CLOSED


def listing_copy_constraints(facts: ProductFacts) -> str:
    if facts.confirmed is not None and facts.confirmed.is_textile is False:
        return _NON_TEXTILE_CONSTRAINTS
    return ""


def apply_suggested(facts: ProductFacts, suggested: SuggestedFacts | None) -> ProductFacts:
    """Refresh suggested facts from vision without clearing a confirmation."""
    return ProductFacts(suggested=suggested, confirmed=facts.confirmed)


def merge_product_facts(records: Sequence[Mapping[str, Any] | None]) -> ProductFacts:
    """One facts record for a product assembled from its photos."""
    parsed = [facts_from_stored(record) for record in records]
    confirmed = next((item for item in parsed if item.confirmed is not None), None)
    suggested = next((item.suggested for item in parsed if item.suggested is not None), None)
    if confirmed is None:
        return ProductFacts(suggested=suggested, confirmed=None)
    return ProductFacts(
        suggested=confirmed.suggested or suggested,
        confirmed=confirmed.confirmed,
    )


def _text(value: Any) -> str:
    return value.strip() if isinstance(value, str) else ""


def _price(value: Any) -> str | None:
    if value is None or value == "":
        return None
    return str(value)


def _as_bool(value: Any) -> bool | None:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        lowered = value.strip().lower()
        if lowered in ("true", "yes"):
            return True
        if lowered in ("false", "no"):
            return False
    return None


def _fibre_names(value: Any) -> tuple[str, ...]:
    if not isinstance(value, list):
        return ()
    names: list[str] = []
    seen: set[str] = set()
    for item in value:
        name = _fibre_name(item)
        if not name:
            continue
        key = name.lower()
        if key in seen:
            continue
        seen.add(key)
        names.append(name)
    return tuple(names)


def _fibre_name(value: Any) -> str:
    if isinstance(value, Mapping):
        value = (
            value.get("name")
            or value.get("fibre")
            or value.get("fiber")
            or value.get("fibreName")
            or ""
        )
    if not isinstance(value, str):
        return ""
    return _PERCENT.sub("", value).strip(" -,").strip()
