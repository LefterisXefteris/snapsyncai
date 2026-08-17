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
_COMPOSITION_SUM = "Fibre percentages must be integers that sum to 100."
_INCOMPLETE_ROW = "Each fibre row needs a name and a percentage."
_NON_TEXTILE_CONSTRAINTS = (
    "This product is not a textile. Do not invent fibre composition, "
    "care instructions, manufacturer identity, or GPSR / EU responsible person details."
)

_PERCENT = re.compile(r"\s*\(?\s*\d+\s*%\s*\)?", re.IGNORECASE)

EU_FIBRE_NAMES = (
    "cotton",
    "wool",
    "silk",
    "flax (linen)",
    "viscose",
    "cupro",
    "modal",
    "lyocell",
    "polyester",
    "polyamide",
    "acrylic",
    "elastane",
    "polypropylene",
)


@dataclass(frozen=True)
class SuggestedFacts:
    is_textile: bool | None
    fibre_names: tuple[str, ...]


@dataclass(frozen=True)
class FibreRow:
    name: str
    percent: int


@dataclass(frozen=True)
class ConfirmedFacts:
    is_textile: bool
    composition: tuple[FibreRow, ...] = ()


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
        is_textile = bool(
            _as_bool(confirmed_raw.get("isTextile", confirmed_raw.get("is_textile")))
        )
        composition = ()
        if is_textile:
            parsed, error = _parse_composition(
                confirmed_raw.get("composition") or ()
            )
            if error or parsed is None:
                return ProductFacts(suggested=suggested, confirmed=None)
            composition = tuple(FibreRow(name=name, percent=percent) for name, percent in parsed)
        confirmed = ConfirmedFacts(is_textile=is_textile, composition=composition)
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
        if facts.confirmed.composition:
            stored["confirmed"]["composition"] = [
                {"name": row.name, "percent": row.percent} for row in facts.confirmed.composition
            ]
    return stored


def confirm_facts(
    facts: ProductFacts,
    *,
    is_textile: bool,
    composition: Sequence[Mapping[str, Any]] | None = None,
) -> ConfirmResult:
    if is_textile:
        if not composition:
            return ConfirmResult(facts=facts, error=_TEXTILE_NEEDS_COMPOSITION)
        parsed, error = _parse_composition(composition)
        if error or parsed is None:
            return ConfirmResult(facts=facts, error=error or _TEXTILE_NEEDS_COMPOSITION)
        return ConfirmResult(
            facts=ProductFacts(
                suggested=facts.suggested,
                confirmed=ConfirmedFacts(
                    is_textile=True,
                    composition=tuple(
                        FibreRow(name=name, percent=percent) for name, percent in parsed
                    ),
                ),
            )
        )
    return ConfirmResult(
        facts=ProductFacts(
            suggested=facts.suggested,
            confirmed=ConfirmedFacts(is_textile=False),
        )
    )


def may_generate_listing_copy(facts: ProductFacts) -> bool:
    confirmed = facts.confirmed
    if confirmed is None:
        return False
    if confirmed.is_textile is False:
        return True
    return confirmed.is_textile is True and bool(confirmed.composition)


def generation_blocked_reason(facts: ProductFacts) -> str | None:
    if may_generate_listing_copy(facts):
        return None
    return _GATE_CLOSED


def listing_copy_constraints(facts: ProductFacts) -> str:
    confirmed = facts.confirmed
    if confirmed is None:
        return ""
    if confirmed.is_textile is False:
        return _NON_TEXTILE_CONSTRAINTS
    names = ", ".join(row.name for row in confirmed.composition)
    blocks = description_blocks(facts)
    return (
        f"Include this English composition block in the description HTML, unchanged: {blocks}\n"
        f"Tags and AEO may use only these confirmed fibre names: {names}. "
        "Do not use suggested or guessed materials.\n"
        "Do not invent care instructions, manufacturer identity, "
        "or GPSR / EU responsible person details."
    )


def description_blocks(facts: ProductFacts) -> str:
    confirmed = facts.confirmed
    if confirmed is None or not confirmed.is_textile or not confirmed.composition:
        return ""
    parts = ", ".join(f"{row.percent}% {row.name}" for row in confirmed.composition)
    return f"<p>Fibre composition: {parts}.</p>"


_COMPOSITION_BLOCK = re.compile(r"<p>Fibre composition:.*?</p>", re.IGNORECASE | re.DOTALL)


def apply_description_blocks(description: str, facts: ProductFacts) -> str:
    """Put the module's English blocks into listing-copy description HTML."""
    stripped = _COMPOSITION_BLOCK.sub("", description).strip()
    blocks = description_blocks(facts)
    if not blocks:
        return stripped
    return f"{stripped}\n{blocks}" if stripped else blocks


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


def _canonical_fibre(name: str) -> str:
    lowered = name.strip().lower()
    for official in EU_FIBRE_NAMES:
        if official.lower() == lowered:
            return official
        open_paren = official.find("(")
        if open_paren != -1:
            inner = official[open_paren + 1 : official.find(")")].lower()
            outer = official[:open_paren].strip().lower()
            if lowered in (inner, outer):
                return official
    return name.strip()


def _percent(value: Any) -> int | None:
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, float) and value.is_integer():
        return int(value)
    return None


def _parse_composition(
    composition: Sequence[Mapping[str, Any]],
) -> tuple[list[tuple[str, int]] | None, str | None]:
    rows: list[tuple[str, int]] = []
    for row in composition:
        if not isinstance(row, Mapping):
            return None, _INCOMPLETE_ROW
        name = _text(row.get("name"))
        other_name = _text(row.get("otherName") or row.get("other_name"))
        if name.lower() == "other":
            name = other_name
        else:
            name = _canonical_fibre(name)
            if name not in EU_FIBRE_NAMES:
                return None, _INCOMPLETE_ROW
        percent = _percent(row.get("percent"))
        if not name or percent is None or percent <= 0:
            return None, _INCOMPLETE_ROW
        rows.append((name, percent))
    if not rows:
        return None, _TEXTILE_NEEDS_COMPOSITION
    if sum(percent for _, percent in rows) != 100:
        return None, _COMPOSITION_SUM
    return rows, None


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
