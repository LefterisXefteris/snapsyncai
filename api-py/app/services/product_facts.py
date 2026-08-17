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
_GPSR_REQUIRED = "GPSR identity must be filled or explicitly skipped."
_GPSR_INCOMPLETE = "GPSR identity is incomplete."
_GPSR_SHOP_MISSING = "Shop GPSR identity is missing. Fill it on the product, or skip."
_GPSR_SKIP = "skip"
_GPSR_SHOP_DEFAULT = "shop_default"
_GPSR_OVERRIDE = "override"

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
class GpsrParty:
    name: str
    postal_address: str
    email: str


@dataclass(frozen=True)
class GpsrIdentity:
    manufacturer: GpsrParty
    manufacturer_in_eu: bool
    eu_responsible_person: GpsrParty | None = None


@dataclass(frozen=True)
class ConfirmedFacts:
    is_textile: bool
    composition: tuple[FibreRow, ...] = ()
    gpsr_choice: str | None = None
    gpsr_override: GpsrIdentity | None = None


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
        confirmed = ConfirmedFacts(
            is_textile=is_textile,
            composition=composition,
            gpsr_choice=_gpsr_choice(
                confirmed_raw.get("gpsrChoice", confirmed_raw.get("gpsr_choice"))
            ),
            gpsr_override=_identity_or_none(
                confirmed_raw.get("gpsrIdentity", confirmed_raw.get("gpsr_identity"))
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
        if facts.confirmed.composition:
            stored["confirmed"]["composition"] = [
                {"name": row.name, "percent": row.percent} for row in facts.confirmed.composition
            ]
        if facts.confirmed.gpsr_choice:
            stored["confirmed"]["gpsrChoice"] = facts.confirmed.gpsr_choice
        if facts.confirmed.gpsr_override is not None:
            stored["confirmed"]["gpsrIdentity"] = stored_gpsr_identity(
                facts.confirmed.gpsr_override
            )
    return stored


def confirm_facts(
    facts: ProductFacts,
    *,
    is_textile: bool,
    composition: Sequence[Mapping[str, Any]] | None = None,
    gpsr_choice: str | None = None,
    gpsr_identity: Mapping[str, Any] | None = None,
    shop_gpsr: Mapping[str, Any] | None = None,
) -> ConfirmResult:
    choice = _gpsr_choice(gpsr_choice)
    if choice is None:
        return ConfirmResult(facts=facts, error=_GPSR_REQUIRED)
    composition_rows: tuple[FibreRow, ...] = ()
    if is_textile:
        if not composition:
            return ConfirmResult(facts=facts, error=_TEXTILE_NEEDS_COMPOSITION)
        parsed, error = _parse_composition(composition)
        if error or parsed is None:
            return ConfirmResult(facts=facts, error=error or _TEXTILE_NEEDS_COMPOSITION)
        composition_rows = tuple(FibreRow(name=name, percent=percent) for name, percent in parsed)
    override: GpsrIdentity | None = None
    if choice == _GPSR_SKIP:
        override = None
    elif choice == _GPSR_SHOP_DEFAULT:
        identity, error = parse_gpsr_identity(shop_gpsr)
        if error or identity is None:
            return ConfirmResult(facts=facts, error=_GPSR_SHOP_MISSING)
    else:
        identity, error = parse_gpsr_identity(gpsr_identity)
        if error or identity is None:
            return ConfirmResult(facts=facts, error=error or _GPSR_INCOMPLETE)
        override = identity
    return ConfirmResult(
        facts=ProductFacts(
            suggested=facts.suggested,
            confirmed=ConfirmedFacts(
                is_textile=is_textile,
                composition=composition_rows,
                gpsr_choice=choice,
                gpsr_override=override,
            ),
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


def listing_copy_constraints(
    facts: ProductFacts, shop_gpsr: Mapping[str, Any] | None = None
) -> str:
    confirmed = facts.confirmed
    if confirmed is None:
        return ""
    parts: list[str] = []
    blocks = description_blocks(facts, shop_gpsr)
    if blocks:
        parts.append(
            f"Include this English facts block in the description HTML, unchanged: {blocks}"
        )
    if confirmed.is_textile is False:
        if effective_gpsr(facts, shop_gpsr) is None:
            parts.append(_NON_TEXTILE_CONSTRAINTS)
        else:
            parts.append(
                "This product is not a textile. "
                "Do not invent fibre composition or care instructions."
            )
        return "\n".join(parts)
    names = ", ".join(row.name for row in confirmed.composition)
    parts.append(
        f"Tags and AEO may use only these confirmed fibre names: {names}. "
        "Do not use suggested or guessed materials."
    )
    if effective_gpsr(facts, shop_gpsr) is None:
        parts.append(
            "Do not invent care instructions, manufacturer identity, "
            "or GPSR / EU responsible person details."
        )
    else:
        parts.append("Do not invent care instructions.")
    return "\n".join(parts)


def description_blocks(
    facts: ProductFacts, shop_gpsr: Mapping[str, Any] | None = None
) -> str:
    chunks: list[str] = []
    confirmed = facts.confirmed
    if confirmed is not None and confirmed.is_textile and confirmed.composition:
        parts = ", ".join(f"{row.percent}% {row.name}" for row in confirmed.composition)
        chunks.append(f"<p>Fibre composition: {parts}.</p>")
    identity = effective_gpsr(facts, shop_gpsr)
    if identity is not None:
        chunks.append(_gpsr_html(identity))
    return "".join(chunks) if len(chunks) == 1 else "\n".join(chunks)


def effective_gpsr(
    facts: ProductFacts, shop_gpsr: Mapping[str, Any] | None = None
) -> GpsrIdentity | None:
    confirmed = facts.confirmed
    if confirmed is None:
        return None
    choice = confirmed.gpsr_choice
    if choice == _GPSR_SKIP or choice is None:
        return None
    if choice == _GPSR_OVERRIDE:
        return confirmed.gpsr_override
    identity, error = parse_gpsr_identity(shop_gpsr)
    if error or identity is None:
        return None
    return identity


def parse_gpsr_identity(
    raw: Mapping[str, Any] | None,
) -> tuple[GpsrIdentity | None, str | None]:
    if not isinstance(raw, Mapping):
        return None, _GPSR_INCOMPLETE
    manufacturer = _gpsr_party(raw.get("manufacturer"))
    if manufacturer is None:
        return None, _GPSR_INCOMPLETE
    in_eu = _as_bool(raw.get("manufacturerInEu", raw.get("manufacturer_in_eu")))
    if in_eu is None:
        in_eu = False
    responsible = None
    if not in_eu:
        responsible = _gpsr_party(
            raw.get("euResponsiblePerson", raw.get("eu_responsible_person"))
        )
        if responsible is None:
            return None, _GPSR_INCOMPLETE
    return (
        GpsrIdentity(
            manufacturer=manufacturer,
            manufacturer_in_eu=in_eu,
            eu_responsible_person=responsible,
        ),
        None,
    )


_COMPOSITION_BLOCK = re.compile(r"<p>Fibre composition:.*?</p>", re.IGNORECASE | re.DOTALL)
_GPSR_BLOCK = re.compile(
    r"<p>Manufacturer:.*?</p>(?:\s*<p>EU responsible person:.*?</p>)?",
    re.IGNORECASE | re.DOTALL,
)


def apply_description_blocks(
    description: str,
    facts: ProductFacts,
    shop_gpsr: Mapping[str, Any] | None = None,
) -> str:
    """Put the module's English blocks into listing-copy description HTML."""
    stripped = _GPSR_BLOCK.sub("", _COMPOSITION_BLOCK.sub("", description)).strip()
    blocks = description_blocks(facts, shop_gpsr)
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


def _gpsr_choice(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    choice = value.strip().lower().replace("-", "_")
    if choice in {_GPSR_SKIP, _GPSR_SHOP_DEFAULT, _GPSR_OVERRIDE}:
        return choice
    return None


def _gpsr_party(raw: Any) -> GpsrParty | None:
    if not isinstance(raw, Mapping):
        return None
    name = _text(raw.get("name"))
    address = _text(raw.get("postalAddress") or raw.get("postal_address"))
    email = _text(raw.get("email"))
    if not name or not address or not email:
        return None
    return GpsrParty(name=name, postal_address=address, email=email)


def _identity_or_none(raw: Any) -> GpsrIdentity | None:
    identity, error = parse_gpsr_identity(raw if isinstance(raw, Mapping) else None)
    if error or identity is None:
        return None
    return identity


def stored_gpsr_identity(identity: GpsrIdentity) -> dict[str, Any]:
    stored: dict[str, Any] = {
        "manufacturer": {
            "name": identity.manufacturer.name,
            "postalAddress": identity.manufacturer.postal_address,
            "email": identity.manufacturer.email,
        },
        "manufacturerInEu": identity.manufacturer_in_eu,
    }
    if identity.eu_responsible_person is not None:
        stored["euResponsiblePerson"] = {
            "name": identity.eu_responsible_person.name,
            "postalAddress": identity.eu_responsible_person.postal_address,
            "email": identity.eu_responsible_person.email,
        }
    return stored


def _gpsr_html(identity: GpsrIdentity) -> str:
    maker = identity.manufacturer
    html = f"<p>Manufacturer: {maker.name}, {maker.postal_address}, {maker.email}.</p>"
    if identity.eu_responsible_person is not None:
        person = identity.eu_responsible_person
        html += (
            f"<p>EU responsible person: {person.name}, {person.postal_address}, {person.email}.</p>"
        )
    return html


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
