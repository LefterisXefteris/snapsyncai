"""Product facts — the seam that keeps listing copy from inventing legal facts.

Upload, Generate, regenerate, Accept generated listing copy, Shop GPSR save,
and description-block assembly call this module. Vision and HTTP do not own these rules.
"""

from __future__ import annotations

import re
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Any

_GATE_CLOSED = "Confirm product facts before generating listing copy."
_PRODUCT_KIND_REQUIRED = "Product kind is required."
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
_CARE_REQUIRED = "Care instructions must be filled or explicitly skipped."
_CARE_INCOMPLETE = "Care instructions must be a complete five-family set or an explicit skip."
_CARE_SKIP = "skip"
_CARE_FILL = "fill"

PRODUCT_KIND_TEXTILE = "textile"
PRODUCT_KIND_COFFEE = "coffee"
PRODUCT_KINDS = (PRODUCT_KIND_TEXTILE, PRODUCT_KIND_COFFEE)

COFFEE_FORMS = ("beans", "ground", "capsules")
_COFFEE_FORM_REQUIRED = "Coffee form is required (beans, ground, or capsules)."
_ROAST_REQUIRED = "Roast level is required."
_NET_WEIGHT_REQUIRED = "Net weight is required."
_VARIANT_NET_WEIGHT_REQUIRED = "Each variant needs a net weight."
_INGREDIENTS_REQUIRED = "Ingredients list is required."
_ALLERGEN_REQUIRED = "Allergen statement is required (use none when there are none)."
_ORIGIN_REQUIRED = "Coffee origin must be filled or explicitly skipped."
_ORIGIN_SKIP = "skip"
_ORIGIN_FILL = "fill"

CARE_PICKS: dict[str, dict[str, str]] = {
    "washing": {
        "do_not_wash": "Do not wash",
        "hand_wash": "Hand wash",
        "wash_30c": "Wash at 30°C",
        "wash_40c": "Wash at 40°C",
        "wash_60c": "Wash at 60°C",
        "wash_95c": "Wash at 95°C",
    },
    "bleaching": {
        "any_bleach": "Any bleach",
        "non_chlorine_bleach": "Non-chlorine bleach only",
        "do_not_bleach": "Do not bleach",
    },
    "drying": {
        "tumble_dry_normal": "Tumble dry normal",
        "tumble_dry_low": "Tumble dry low",
        "do_not_tumble_dry": "Do not tumble dry",
        "line_dry": "Line dry",
    },
    "ironing": {
        "iron_high": "Iron high",
        "iron_medium": "Iron medium",
        "iron_low": "Iron low",
        "do_not_iron": "Do not iron",
    },
    "professional_textile_care": {
        "dry_clean": "Dry clean",
        "do_not_dry_clean": "Do not dry clean",
        "professional_wet_clean": "Professional wet clean",
    },
}

CARE_FAMILIES = tuple(CARE_PICKS.keys())

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
class CareInstructions:
    washing: str
    bleaching: str
    drying: str
    ironing: str
    professional_textile_care: str


@dataclass(frozen=True)
class VariantNetWeight:
    variant_id: str
    net_weight: str


@dataclass(frozen=True)
class ConfirmedFacts:
    is_textile: bool
    product_kind: str | None = None
    composition: tuple[FibreRow, ...] = ()
    gpsr_choice: str | None = None
    gpsr_override: GpsrIdentity | None = None
    care_choice: str | None = None
    care: CareInstructions | None = None
    coffee_form: str | None = None
    roast_level: str | None = None
    net_weight: str | None = None
    variant_net_weights: tuple[VariantNetWeight, ...] = ()
    coffee_origin_choice: str | None = None
    coffee_origin: str | None = None
    ingredients_list: str | None = None
    allergen_statement: str | None = None


@dataclass(frozen=True)
class ProductFacts:
    suggested: SuggestedFacts | None = None
    confirmed: ConfirmedFacts | None = None
    listing_copy_stale: bool = False


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


@dataclass(frozen=True)
class AcceptedListingCopy:
    facts: ProductFacts
    listing_copy: dict[str, Any]


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
        "isTextile" in confirmed_raw
        or "is_textile" in confirmed_raw
        or "productKind" in confirmed_raw
        or "product_kind" in confirmed_raw
    ):
        confirmed = _confirmed_from_stored(confirmed_raw)
        if confirmed is None and (
            "isTextile" in confirmed_raw or "is_textile" in confirmed_raw
        ):
            return ProductFacts(
                suggested=suggested,
                confirmed=None,
                listing_copy_stale=_listing_copy_stale(record),
            )
    return ProductFacts(
        suggested=suggested,
        confirmed=confirmed,
        listing_copy_stale=_listing_copy_stale(record),
    )


def stored_from_facts(facts: ProductFacts) -> dict[str, Any]:
    stored: dict[str, Any] = {}
    if facts.suggested is not None:
        stored["suggested"] = {
            "isTextile": facts.suggested.is_textile,
            "fibreNames": list(facts.suggested.fibre_names),
        }
    if facts.confirmed is not None:
        confirmed = facts.confirmed
        stored["confirmed"] = {"isTextile": confirmed.is_textile}
        if confirmed.product_kind:
            stored["confirmed"]["productKind"] = confirmed.product_kind
        if confirmed.composition:
            stored["confirmed"]["composition"] = [
                {"name": row.name, "percent": row.percent} for row in confirmed.composition
            ]
        if confirmed.gpsr_choice:
            stored["confirmed"]["gpsrChoice"] = confirmed.gpsr_choice
        if confirmed.gpsr_override is not None:
            stored["confirmed"]["gpsrIdentity"] = stored_gpsr_identity(
                confirmed.gpsr_override
            )
        if confirmed.care_choice:
            stored["confirmed"]["careChoice"] = confirmed.care_choice
        if confirmed.care is not None:
            stored["confirmed"]["care"] = stored_care_instructions(confirmed.care)
        if confirmed.product_kind == PRODUCT_KIND_COFFEE:
            stored["confirmed"]["coffeeForm"] = confirmed.coffee_form
            stored["confirmed"]["roastLevel"] = confirmed.roast_level
            if confirmed.net_weight:
                stored["confirmed"]["netWeight"] = confirmed.net_weight
            if confirmed.variant_net_weights:
                stored["confirmed"]["variantNetWeights"] = [
                    {"variantId": row.variant_id, "netWeight": row.net_weight}
                    for row in confirmed.variant_net_weights
                ]
            if confirmed.coffee_origin_choice:
                stored["confirmed"]["coffeeOriginChoice"] = confirmed.coffee_origin_choice
            if confirmed.coffee_origin:
                stored["confirmed"]["coffeeOrigin"] = confirmed.coffee_origin
            stored["confirmed"]["ingredientsList"] = confirmed.ingredients_list
            stored["confirmed"]["allergenStatement"] = confirmed.allergen_statement
    stored["listingCopyStale"] = facts.listing_copy_stale
    return stored


def confirmed_as_confirm_kwargs(confirmed: ConfirmedFacts | None) -> dict[str, Any]:
    """The previous pack, in the inputs the page's confirm accepts."""
    if confirmed is None:
        return {}
    body: dict[str, Any] = {"is_textile": confirmed.is_textile}
    if confirmed.product_kind:
        body["product_kind"] = confirmed.product_kind
    if confirmed.composition:
        body["composition"] = [
            {"name": row.name, "percent": row.percent} for row in confirmed.composition
        ]
    if confirmed.gpsr_choice:
        body["gpsr_choice"] = confirmed.gpsr_choice
    if confirmed.gpsr_override is not None:
        body["gpsr_identity"] = stored_gpsr_identity(confirmed.gpsr_override)
    if confirmed.care_choice:
        body["care_choice"] = confirmed.care_choice
    if confirmed.care is not None:
        body["care"] = stored_care_instructions(confirmed.care)
    if confirmed.product_kind == PRODUCT_KIND_COFFEE:
        if confirmed.coffee_form:
            body["coffee_form"] = confirmed.coffee_form
        if confirmed.roast_level:
            body["roast_level"] = confirmed.roast_level
        if confirmed.net_weight:
            body["net_weight"] = confirmed.net_weight
        if confirmed.variant_net_weights:
            body["variant_net_weights"] = [
                {"variant_id": row.variant_id, "net_weight": row.net_weight}
                for row in confirmed.variant_net_weights
            ]
        if confirmed.coffee_origin_choice:
            body["coffee_origin_choice"] = confirmed.coffee_origin_choice
        if confirmed.coffee_origin:
            body["coffee_origin"] = confirmed.coffee_origin
        if confirmed.ingredients_list is not None:
            body["ingredients_list"] = confirmed.ingredients_list
        if confirmed.allergen_statement is not None:
            body["allergen_statement"] = confirmed.allergen_statement
    return body


def confirm_facts(
    facts: ProductFacts,
    *,
    is_textile: bool | None = None,
    product_kind: str | None = None,
    composition: Sequence[Mapping[str, Any]] | None = None,
    gpsr_choice: str | None = None,
    gpsr_identity: Mapping[str, Any] | None = None,
    shop_gpsr: Mapping[str, Any] | None = None,
    care_choice: str | None = None,
    care: Mapping[str, Any] | None = None,
    coffee_form: str | None = None,
    roast_level: str | None = None,
    net_weight: str | None = None,
    variant_net_weights: Sequence[Mapping[str, Any]] | None = None,
    coffee_origin_choice: str | None = None,
    coffee_origin: str | None = None,
    ingredients_list: str | None = None,
    allergen_statement: str | None = None,
    listing_copy: Mapping[str, Any] | None = None,
) -> ConfirmResult:
    kind = _product_kind(product_kind)
    if kind is None and is_textile is True:
        kind = PRODUCT_KIND_TEXTILE
    if kind is None:
        return ConfirmResult(facts=facts, error=_PRODUCT_KIND_REQUIRED)

    if kind == PRODUCT_KIND_COFFEE:
        return _confirm_coffee(
            facts,
            coffee_form=coffee_form,
            roast_level=roast_level,
            net_weight=net_weight,
            variant_net_weights=variant_net_weights,
            coffee_origin_choice=coffee_origin_choice,
            coffee_origin=coffee_origin,
            ingredients_list=ingredients_list,
            allergen_statement=allergen_statement,
            listing_copy=listing_copy,
        )

    choice = _gpsr_choice(gpsr_choice)
    if choice is None:
        return ConfirmResult(facts=facts, error=_GPSR_REQUIRED)
    composition_rows: tuple[FibreRow, ...] = ()
    stored_care_choice: str | None = None
    care_value: CareInstructions | None = None
    if not composition:
        return ConfirmResult(facts=facts, error=_TEXTILE_NEEDS_COMPOSITION)
    parsed, error = _parse_composition(composition)
    if error or parsed is None:
        return ConfirmResult(facts=facts, error=error or _TEXTILE_NEEDS_COMPOSITION)
    composition_rows = tuple(FibreRow(name=name, percent=percent) for name, percent in parsed)
    stored_care_choice = _care_choice(care_choice)
    if stored_care_choice is None:
        return ConfirmResult(facts=facts, error=_CARE_REQUIRED)
    if stored_care_choice == _CARE_FILL:
        parsed_care, care_error = parse_care_instructions(care)
        if care_error or parsed_care is None:
            return ConfirmResult(facts=facts, error=care_error or _CARE_INCOMPLETE)
        care_value = parsed_care
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
    confirmed = ConfirmedFacts(
        is_textile=True,
        product_kind=PRODUCT_KIND_TEXTILE,
        composition=composition_rows,
        gpsr_choice=choice,
        gpsr_override=override,
        care_choice=stored_care_choice,
        care=care_value,
    )
    stale = facts.listing_copy_stale
    if confirmed != facts.confirmed and _listing_copy_present(listing_copy):
        stale = True
    return ConfirmResult(
        facts=ProductFacts(
            suggested=facts.suggested,
            confirmed=confirmed,
            listing_copy_stale=stale,
        )
    )


def may_generate_listing_copy(facts: ProductFacts) -> bool:
    confirmed = facts.confirmed
    if confirmed is None:
        return False
    if confirmed.product_kind == PRODUCT_KIND_COFFEE:
        return _coffee_pack_complete(confirmed)
    if confirmed.product_kind == PRODUCT_KIND_TEXTILE or (
        confirmed.product_kind is None and confirmed.is_textile is True
    ):
        return bool(confirmed.composition)
    return False


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
    if confirmed.product_kind == PRODUCT_KIND_COFFEE:
        parts.append(
            "This product is a Coffee product. "
            "Do not invent ingredients, allergens, net weight, roast, form, or origin "
            "beyond the confirmed facts. Do not invent fibre composition, care instructions, "
            "or GPSR / EU responsible person details."
        )
        return "\n".join(parts)
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
    invent: list[str] = []
    if confirmed.care is None:
        invent.append("care instructions")
    if effective_gpsr(facts, shop_gpsr) is None:
        invent.append("manufacturer identity, or GPSR / EU responsible person details")
    if invent:
        parts.append("Do not invent " + ", ".join(invent) + ".")
    return "\n".join(parts)


def description_blocks(
    facts: ProductFacts, shop_gpsr: Mapping[str, Any] | None = None
) -> str:
    chunks: list[str] = []
    confirmed = facts.confirmed
    if confirmed is not None and confirmed.product_kind == PRODUCT_KIND_COFFEE:
        chunks.extend(_coffee_description_chunks(confirmed))
        return "".join(chunks) if len(chunks) == 1 else "\n".join(chunks)
    if confirmed is not None and confirmed.is_textile and confirmed.composition:
        parts = ", ".join(f"{row.percent}% {row.name}" for row in confirmed.composition)
        chunks.append(f"<p>Fibre composition: {parts}.</p>")
    if confirmed is not None and confirmed.is_textile and confirmed.care is not None:
        chunks.append(_care_html(confirmed.care))
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
    if confirmed.product_kind == PRODUCT_KIND_COFFEE:
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
_CARE_BLOCK = re.compile(r"<p>Care instructions:.*?</p>", re.IGNORECASE | re.DOTALL)
_GPSR_BLOCK = re.compile(
    r"<p>Manufacturer:.*?</p>(?:\s*<p>EU responsible person:.*?</p>)?",
    re.IGNORECASE | re.DOTALL,
)
_COFFEE_FACT_BLOCKS = re.compile(
    r"<p>(?:Coffee form|Roast level|Net weight|Coffee origin|Ingredients|Allergens):.*?</p>",
    re.IGNORECASE | re.DOTALL,
)


def apply_description_blocks(
    description: str,
    facts: ProductFacts,
    shop_gpsr: Mapping[str, Any] | None = None,
) -> str:
    """Put the module's English blocks into listing-copy description HTML."""
    stripped = _COFFEE_FACT_BLOCKS.sub(
        "",
        _GPSR_BLOCK.sub(
            "", _CARE_BLOCK.sub("", _COMPOSITION_BLOCK.sub("", description))
        ),
    ).strip()
    blocks = description_blocks(facts, shop_gpsr)
    if not blocks:
        return stripped
    return f"{stripped}\n{blocks}" if stripped else blocks


def accept_generated_listing_copy(
    facts: ProductFacts,
    generated: Mapping[str, Any],
    shop_gpsr: Mapping[str, Any] | None = None,
) -> AcceptedListingCopy:
    """Persist generated listing copy. Description Accept stamps blocks and clears stale."""
    listing_copy = _generated_listing_copy_fields(generated)
    description = _text(generated.get("description"))
    if not description:
        listing_copy.pop("description", None)
        return AcceptedListingCopy(facts=facts, listing_copy=listing_copy)
    listing_copy["description"] = apply_description_blocks(description, facts, shop_gpsr)
    return AcceptedListingCopy(
        facts=ProductFacts(
            suggested=facts.suggested,
            confirmed=facts.confirmed,
            listing_copy_stale=False,
        ),
        listing_copy=listing_copy,
    )


def stale_for_shop_gpsr_save(
    facts: ProductFacts,
    listing_copy: Mapping[str, Any] | None = None,
) -> ProductFacts:
    """Stale listing copy on shop-default products when Shop GPSR identity is saved."""
    stale = facts.listing_copy_stale
    confirmed = facts.confirmed
    if (
        confirmed is not None
        and confirmed.gpsr_choice == _GPSR_SHOP_DEFAULT
        and _listing_copy_present(listing_copy)
    ):
        stale = True
    return ProductFacts(
        suggested=facts.suggested,
        confirmed=facts.confirmed,
        listing_copy_stale=stale,
    )


def apply_suggested(facts: ProductFacts, suggested: SuggestedFacts | None) -> ProductFacts:
    """Refresh suggested facts from vision without clearing a confirmation."""
    return ProductFacts(
        suggested=suggested,
        confirmed=facts.confirmed,
        listing_copy_stale=facts.listing_copy_stale,
    )


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
        listing_copy_stale=confirmed.listing_copy_stale,
    )


def payload_outcomes(
    facts: ProductFacts, shop_gpsr: Mapping[str, Any] | None = None
) -> dict[str, Any]:
    """Outcomes HTTP copies onto the product payload. Adapters must not re-encode these."""
    return {
        "may_generate_listing_copy": may_generate_listing_copy(facts),
        "listing_copy_stale": facts.listing_copy_stale,
        "description_blocks": description_blocks(facts, shop_gpsr),
    }


def _text(value: Any) -> str:
    return value.strip() if isinstance(value, str) else ""


def _product_kind(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    kind = value.strip().lower().replace("-", "_")
    if kind in PRODUCT_KINDS:
        return kind
    return None


def _origin_choice(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    choice = value.strip().lower().replace("-", "_")
    if choice in {_ORIGIN_SKIP, _ORIGIN_FILL}:
        return choice
    return None


def _coffee_form(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    form = value.strip().lower()
    if form in COFFEE_FORMS:
        return form
    return None


def _coffee_pack_complete(confirmed: ConfirmedFacts) -> bool:
    if confirmed.product_kind != PRODUCT_KIND_COFFEE:
        return False
    if confirmed.coffee_form not in COFFEE_FORMS:
        return False
    if not _text(confirmed.roast_level):
        return False
    if confirmed.variant_net_weights:
        if any(not _text(row.net_weight) for row in confirmed.variant_net_weights):
            return False
    elif not _text(confirmed.net_weight):
        return False
    if confirmed.coffee_origin_choice == _ORIGIN_SKIP:
        pass
    elif confirmed.coffee_origin_choice == _ORIGIN_FILL and _text(confirmed.coffee_origin):
        pass
    else:
        return False
    if not _text(confirmed.ingredients_list):
        return False
    if not _text(confirmed.allergen_statement):
        return False
    return True


def _parse_variant_net_weights(
    raw: Sequence[Mapping[str, Any]] | None,
) -> tuple[tuple[VariantNetWeight, ...] | None, str | None]:
    if not raw:
        return (), None
    rows: list[VariantNetWeight] = []
    for item in raw:
        if not isinstance(item, Mapping):
            return None, _VARIANT_NET_WEIGHT_REQUIRED
        variant_id = _text(item.get("variantId", item.get("variant_id")))
        weight = _text(item.get("netWeight", item.get("net_weight")))
        if not variant_id or not weight:
            return None, _VARIANT_NET_WEIGHT_REQUIRED
        rows.append(VariantNetWeight(variant_id=variant_id, net_weight=weight))
    return tuple(rows), None


def _confirm_coffee(
    facts: ProductFacts,
    *,
    coffee_form: str | None,
    roast_level: str | None,
    net_weight: str | None,
    variant_net_weights: Sequence[Mapping[str, Any]] | None,
    coffee_origin_choice: str | None,
    coffee_origin: str | None,
    ingredients_list: str | None,
    allergen_statement: str | None,
    listing_copy: Mapping[str, Any] | None,
) -> ConfirmResult:
    form = _coffee_form(coffee_form)
    if form is None:
        return ConfirmResult(facts=facts, error=_COFFEE_FORM_REQUIRED)
    roast = _text(roast_level)
    if not roast:
        return ConfirmResult(facts=facts, error=_ROAST_REQUIRED)
    weights, weight_error = _parse_variant_net_weights(variant_net_weights)
    if weight_error:
        return ConfirmResult(facts=facts, error=weight_error)
    assert weights is not None
    product_weight = _text(net_weight)
    if weights:
        product_weight = ""
    elif not product_weight:
        return ConfirmResult(facts=facts, error=_NET_WEIGHT_REQUIRED)
    origin_choice = _origin_choice(coffee_origin_choice)
    if origin_choice is None:
        return ConfirmResult(facts=facts, error=_ORIGIN_REQUIRED)
    origin_text = _text(coffee_origin)
    if origin_choice == _ORIGIN_FILL and not origin_text:
        return ConfirmResult(facts=facts, error=_ORIGIN_REQUIRED)
    if origin_choice == _ORIGIN_SKIP:
        origin_text = ""
    ingredients = _text(ingredients_list)
    if not ingredients:
        return ConfirmResult(facts=facts, error=_INGREDIENTS_REQUIRED)
    allergens = _text(allergen_statement)
    if not allergens:
        return ConfirmResult(facts=facts, error=_ALLERGEN_REQUIRED)
    confirmed = ConfirmedFacts(
        is_textile=False,
        product_kind=PRODUCT_KIND_COFFEE,
        coffee_form=form,
        roast_level=roast,
        net_weight=product_weight or None,
        variant_net_weights=weights,
        coffee_origin_choice=origin_choice,
        coffee_origin=origin_text or None,
        ingredients_list=ingredients,
        allergen_statement=allergens,
    )
    stale = facts.listing_copy_stale
    if confirmed != facts.confirmed and _listing_copy_present(listing_copy):
        stale = True
    return ConfirmResult(
        facts=ProductFacts(
            suggested=facts.suggested,
            confirmed=confirmed,
            listing_copy_stale=stale,
        )
    )


def _confirmed_from_stored(confirmed_raw: Mapping[str, Any]) -> ConfirmedFacts | None:
    kind = _product_kind(
        confirmed_raw.get("productKind", confirmed_raw.get("product_kind"))
    )
    is_textile_raw = _as_bool(confirmed_raw.get("isTextile", confirmed_raw.get("is_textile")))
    if kind is None and is_textile_raw is True:
        kind = PRODUCT_KIND_TEXTILE
    if kind == PRODUCT_KIND_COFFEE:
        form = _coffee_form(confirmed_raw.get("coffeeForm", confirmed_raw.get("coffee_form")))
        roast = _text(confirmed_raw.get("roastLevel", confirmed_raw.get("roast_level")))
        origin_choice = _origin_choice(
            confirmed_raw.get("coffeeOriginChoice", confirmed_raw.get("coffee_origin_choice"))
        )
        origin = _text(confirmed_raw.get("coffeeOrigin", confirmed_raw.get("coffee_origin")))
        ingredients = _text(
            confirmed_raw.get("ingredientsList", confirmed_raw.get("ingredients_list"))
        )
        allergens = _text(
            confirmed_raw.get("allergenStatement", confirmed_raw.get("allergen_statement"))
        )
        weights_raw = confirmed_raw.get(
            "variantNetWeights", confirmed_raw.get("variant_net_weights")
        )
        weights: tuple[VariantNetWeight, ...] = ()
        if isinstance(weights_raw, Sequence) and not isinstance(weights_raw, (str, bytes)):
            parsed_weights, weight_error = _parse_variant_net_weights(weights_raw)
            if weight_error or parsed_weights is None:
                return None
            weights = parsed_weights
        net_weight = _text(confirmed_raw.get("netWeight", confirmed_raw.get("net_weight")))
        draft = ConfirmedFacts(
            is_textile=False,
            product_kind=PRODUCT_KIND_COFFEE,
            coffee_form=form,
            roast_level=roast or None,
            net_weight=net_weight or None,
            variant_net_weights=weights,
            coffee_origin_choice=origin_choice,
            coffee_origin=origin or None,
            ingredients_list=ingredients or None,
            allergen_statement=allergens or None,
        )
        return draft

    is_textile = bool(is_textile_raw) if is_textile_raw is not None else False
    if kind == PRODUCT_KIND_TEXTILE:
        is_textile = True
    composition: tuple[FibreRow, ...] = ()
    care_choice = None
    care = None
    if is_textile:
        parsed, error = _parse_composition(confirmed_raw.get("composition") or ())
        if error or parsed is None:
            return None
        composition = tuple(FibreRow(name=name, percent=percent) for name, percent in parsed)
        care_choice = _care_choice(
            confirmed_raw.get("careChoice", confirmed_raw.get("care_choice"))
        )
        if care_choice == _CARE_FILL:
            parsed_care, care_error = parse_care_instructions(confirmed_raw.get("care"))
            if care_error or parsed_care is None:
                return None
            care = parsed_care
    return ConfirmedFacts(
        is_textile=is_textile,
        product_kind=kind,
        composition=composition,
        gpsr_choice=_gpsr_choice(
            confirmed_raw.get("gpsrChoice", confirmed_raw.get("gpsr_choice"))
        ),
        gpsr_override=_identity_or_none(
            confirmed_raw.get("gpsrIdentity", confirmed_raw.get("gpsr_identity"))
        ),
        care_choice=care_choice,
        care=care,
    )


def _coffee_description_chunks(confirmed: ConfirmedFacts) -> list[str]:
    chunks: list[str] = []
    if confirmed.coffee_form:
        chunks.append(f"<p>Coffee form: {confirmed.coffee_form}.</p>")
    if confirmed.roast_level:
        chunks.append(f"<p>Roast level: {confirmed.roast_level}.</p>")
    if confirmed.variant_net_weights:
        parts = ", ".join(
            f"{row.variant_id}: {row.net_weight}" for row in confirmed.variant_net_weights
        )
        chunks.append(f"<p>Net weight: {parts}.</p>")
    elif confirmed.net_weight:
        chunks.append(f"<p>Net weight: {confirmed.net_weight}.</p>")
    if confirmed.coffee_origin_choice == _ORIGIN_FILL and confirmed.coffee_origin:
        chunks.append(f"<p>Coffee origin: {confirmed.coffee_origin}.</p>")
    if confirmed.ingredients_list:
        chunks.append(f"<p>Ingredients: {confirmed.ingredients_list}.</p>")
    if confirmed.allergen_statement:
        chunks.append(f"<p>Allergens: {confirmed.allergen_statement}.</p>")
    return chunks


def _listing_copy_stale(record: Mapping[str, Any]) -> bool:
    return bool(record.get("listingCopyStale", record.get("listing_copy_stale")))


def _generated_listing_copy_fields(generated: Mapping[str, Any]) -> dict[str, Any]:
    updates: dict[str, Any] = {}
    mapping = (
        ("title", "title"),
        ("description", "description"),
        ("tags", "tags"),
        ("seoTitle", "seo_title"),
        ("seo_title", "seo_title"),
        ("seoDescription", "seo_description"),
        ("seo_description", "seo_description"),
        ("aeoSnippet", "aeo_snippet"),
        ("aeo_snippet", "aeo_snippet"),
        ("aeoFaqs", "aeo_faqs"),
        ("aeo_faqs", "aeo_faqs"),
    )
    for src, dest in mapping:
        if src in generated and dest not in updates:
            updates[dest] = generated[src]
    return updates


def _listing_copy_present(listing_copy: Mapping[str, Any] | None) -> bool:
    if not listing_copy:
        return False
    for key in (
        "title",
        "description",
        "seoTitle",
        "seo_title",
        "seoDescription",
        "seo_description",
        "aeoSnippet",
        "aeo_snippet",
    ):
        if _text(listing_copy.get(key)):
            return True
    tags = listing_copy.get("tags")
    if isinstance(tags, Sequence) and not isinstance(tags, (str, bytes)):
        if any(_text(tag) for tag in tags if isinstance(tag, str)):
            return True
    faqs = listing_copy.get("aeoFaqs", listing_copy.get("aeo_faqs"))
    if isinstance(faqs, Sequence) and not isinstance(faqs, (str, bytes)) and len(faqs) > 0:
        return True
    return False


listing_copy_present = _listing_copy_present


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


def _care_choice(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    choice = value.strip().lower().replace("-", "_")
    if choice in {_CARE_SKIP, _CARE_FILL}:
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


def parse_care_instructions(
    raw: Mapping[str, Any] | None,
) -> tuple[CareInstructions | None, str | None]:
    if not isinstance(raw, Mapping):
        return None, _CARE_INCOMPLETE
    codes: dict[str, str] = {}
    for family in CARE_FAMILIES:
        camel = _camel_family(family)
        code = raw.get(camel, raw.get(family))
        if not isinstance(code, str) or code not in CARE_PICKS[family]:
            return None, _CARE_INCOMPLETE
        codes[family] = code
    return (
        CareInstructions(
            washing=codes["washing"],
            bleaching=codes["bleaching"],
            drying=codes["drying"],
            ironing=codes["ironing"],
            professional_textile_care=codes["professional_textile_care"],
        ),
        None,
    )


def stored_care_instructions(care: CareInstructions) -> dict[str, str]:
    return {
        "washing": care.washing,
        "bleaching": care.bleaching,
        "drying": care.drying,
        "ironing": care.ironing,
        "professionalTextileCare": care.professional_textile_care,
    }


def _camel_family(family: str) -> str:
    parts = family.split("_")
    return parts[0] + "".join(part.title() for part in parts[1:])


def _care_html(care: CareInstructions) -> str:
    phrases = [CARE_PICKS[family][getattr(care, family)] for family in CARE_FAMILIES]
    return f"<p>Care instructions: {'. '.join(phrases)}.</p>"


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
