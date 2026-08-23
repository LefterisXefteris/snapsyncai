"""Product-facts module — listing copy stays gated until facts are confirmed."""

from app.services.product_facts import (
    apply_description_blocks,
    apply_suggested,
    confirm_facts,
    description_blocks,
    effective_gpsr,
    facts_from_stored,
    generation_blocked_reason,
    listing_copy_constraints,
    may_generate_listing_copy,
    merge_product_facts,
    persistable_from_vision,
    stored_from_facts,
)

VISION_WITH_LISTING_COPY = {
    "title": "Organic Cotton Tee",
    "description": "<p>Soft organic cotton jersey.</p>",
    "tags": ["cotton", "tee"],
    "seoTitle": "Buy Organic Cotton Tee",
    "seoDescription": "Soft organic cotton tee for everyday wear",
    "aeoFaqs": [{"q": "Is it cotton?", "a": "Yes, organic cotton."}],
    "aeoSnippet": "A soft organic cotton tee.",
    "category": "Apparel > T-Shirts",
    "mainCategory": "Apparel",
    "productType": "T-Shirt",
    "price": "29.99",
    "variants": [{"name": "Color", "values": ["Blue"]}],
    "isTextile": False,
    "fibreNames": ["cotton"],
}


def test_vision_listing_copy_is_not_persistable() -> None:
    persistable = persistable_from_vision(VISION_WITH_LISTING_COPY)
    updates = persistable.as_image_updates()

    assert "title" not in updates
    assert "description" not in updates
    assert "tags" not in updates
    assert "seo_title" not in updates
    assert "seo_description" not in updates
    assert "aeo_faqs" not in updates
    assert "aeo_snippet" not in updates

    assert updates["category"] == "Apparel > T-Shirts"
    assert updates["main_category"] == "Apparel"
    assert updates["product_type"] == "T-Shirt"
    assert updates["price"] == "29.99"
    assert updates["variants"] == [{"name": "Color", "values": ["Blue"]}]
    assert persistable.facts.suggested is not None
    assert persistable.facts.suggested.is_textile is False
    assert persistable.facts.suggested.fibre_names == ("cotton",)
    assert persistable.facts.confirmed is None
    assert may_generate_listing_copy(persistable.facts) is False


def test_unconfirmed_facts_cannot_generate() -> None:
    facts = facts_from_stored(None)
    assert may_generate_listing_copy(facts) is False
    grandfathered = facts_from_stored({})
    assert may_generate_listing_copy(grandfathered) is False


def test_unconfirmed_facts_return_a_generate_conflict() -> None:
    assert generation_blocked_reason(facts_from_stored(None)) == (
        "Confirm product facts before generating listing copy."
    )
    confirmed = confirm_facts(
        persistable_from_vision(VISION_WITH_LISTING_COPY).facts,
        is_textile=False,
        gpsr_choice="skip",
    ).facts
    assert generation_blocked_reason(confirmed) is None


def test_confirming_not_a_textile_opens_the_gate() -> None:
    facts = persistable_from_vision(VISION_WITH_LISTING_COPY).facts
    result = confirm_facts(facts, is_textile=False, gpsr_choice="skip")
    assert result.ok is True
    assert result.facts.confirmed is not None
    assert result.facts.confirmed.is_textile is False
    assert may_generate_listing_copy(result.facts) is True
    assert listing_copy_constraints(result.facts) == (
        "This product is not a textile. Do not invent fibre composition, "
        "care instructions, manufacturer identity, or GPSR / EU responsible person details."
    )


def test_confirming_a_textile_without_composition_does_not_open_the_gate() -> None:
    facts = persistable_from_vision({**VISION_WITH_LISTING_COPY, "isTextile": True}).facts
    result = confirm_facts(facts, is_textile=True, gpsr_choice="skip")
    assert result.ok is False
    assert result.error == "Fibre composition is required to confirm a textile product."
    assert may_generate_listing_copy(result.facts) is False


def test_eighty_percent_cotton_alone_cannot_confirm() -> None:
    facts = persistable_from_vision({**VISION_WITH_LISTING_COPY, "isTextile": True}).facts
    result = confirm_facts(
        facts,
        is_textile=True,
        composition=[{"name": "cotton", "percent": 80}],
        gpsr_choice="skip",
    )
    assert result.ok is False
    assert result.error == "Fibre percentages must be integers that sum to 100."
    assert may_generate_listing_copy(result.facts) is False
    assert result.facts.confirmed is None


def test_fibre_row_without_percentage_cannot_confirm() -> None:
    facts = persistable_from_vision({**VISION_WITH_LISTING_COPY, "isTextile": True}).facts
    result = confirm_facts(
        facts, is_textile=True, composition=[{"name": "cotton"}], gpsr_choice="skip"
    )
    assert result.ok is False
    assert result.error == "Each fibre row needs a name and a percentage."
    assert may_generate_listing_copy(result.facts) is False


COTTON_POLYESTER = [
    {"name": "cotton", "percent": 80},
    {"name": "polyester", "percent": 20},
]


def test_confirmed_textile_composition_opens_the_gate() -> None:
    facts = persistable_from_vision(
        {**VISION_WITH_LISTING_COPY, "isTextile": True, "fibreNames": ["cotton", "silk"]}
    ).facts
    result = confirm_facts(
        facts, is_textile=True, composition=COTTON_POLYESTER, gpsr_choice="skip", care_choice="skip"
    )
    assert result.ok is True
    assert result.facts.confirmed is not None
    assert result.facts.confirmed.is_textile is True
    assert may_generate_listing_copy(result.facts) is True


def test_description_html_contains_composition_not_gpsr() -> None:
    facts = confirm_facts(
        persistable_from_vision({**VISION_WITH_LISTING_COPY, "isTextile": True}).facts,
        is_textile=True,
        composition=COTTON_POLYESTER,
        gpsr_choice="skip",
        care_choice="skip",
    ).facts
    html = description_blocks(facts)
    assert html == "<p>Fibre composition: 80% cotton, 20% polyester.</p>"
    assert "gpsr" not in html.lower()
    assert "manufacturer" not in html.lower()
    assert "responsible person" not in html.lower()


def test_tags_and_aeo_use_confirmed_fibre_names_not_suggested() -> None:
    facts = confirm_facts(
        persistable_from_vision(
            {**VISION_WITH_LISTING_COPY, "isTextile": True, "fibreNames": ["cotton", "silk"]}
        ).facts,
        is_textile=True,
        composition=COTTON_POLYESTER,
        gpsr_choice="skip",
        care_choice="skip",
    ).facts
    constraints = listing_copy_constraints(facts)
    assert (
        "Tags and AEO may use only these confirmed fibre names: cotton, polyester."
        in constraints
    )
    assert "silk" not in constraints


def test_other_fibre_name_appears_in_composition_block() -> None:
    facts = confirm_facts(
        persistable_from_vision({**VISION_WITH_LISTING_COPY, "isTextile": True}).facts,
        is_textile=True,
        composition=[
            {"name": "cotton", "percent": 90},
            {"name": "Other", "percent": 10, "otherName": "hemp"},
        ],
        gpsr_choice="skip",
        care_choice="skip",
    ).facts
    assert may_generate_listing_copy(facts) is True
    assert description_blocks(facts) == "<p>Fibre composition: 90% cotton, 10% hemp.</p>"


def test_unofficial_fibre_name_must_use_other() -> None:
    result = confirm_facts(
        persistable_from_vision({**VISION_WITH_LISTING_COPY, "isTextile": True}).facts,
        is_textile=True,
        composition=[{"name": "hemp", "percent": 100}],
        gpsr_choice="skip",
    )
    assert result.ok is False
    assert may_generate_listing_copy(result.facts) is False


def test_confirmed_composition_survives_storage() -> None:
    facts = confirm_facts(
        persistable_from_vision({**VISION_WITH_LISTING_COPY, "isTextile": True}).facts,
        is_textile=True,
        composition=COTTON_POLYESTER,
        gpsr_choice="skip",
        care_choice="skip",
    ).facts
    restored = facts_from_stored(stored_from_facts(facts))
    assert may_generate_listing_copy(restored) is True
    assert description_blocks(restored) == "<p>Fibre composition: 80% cotton, 20% polyester.</p>"


def test_apply_description_blocks_inserts_module_html() -> None:
    facts = confirm_facts(
        persistable_from_vision({**VISION_WITH_LISTING_COPY, "isTextile": True}).facts,
        is_textile=True,
        composition=COTTON_POLYESTER,
        gpsr_choice="skip",
        care_choice="skip",
    ).facts
    html = apply_description_blocks("<p>A soft everyday tee.</p>", facts)
    assert html == (
        "<p>A soft everyday tee.</p>\n"
        "<p>Fibre composition: 80% cotton, 20% polyester.</p>"
    )
    replaced = apply_description_blocks(
        "<p>A soft tee.</p><p>Fibre composition: 100% silk.</p>", facts
    )
    assert replaced == (
        "<p>A soft tee.</p>\n"
        "<p>Fibre composition: 80% cotton, 20% polyester.</p>"
    )
    assert "silk" not in replaced


def test_suggested_fibre_names_drop_percentages() -> None:
    persistable = persistable_from_vision(
        {
            "isTextile": True,
            "fibreNames": ["cotton 80%", "20% polyester", {"name": "elastane", "percent": 5}],
        }
    )
    assert persistable.facts.suggested is not None
    assert persistable.facts.suggested.fibre_names == ("cotton", "polyester", "elastane")
    assert persistable.facts.suggested.is_textile is True
    stored = stored_from_facts(persistable.facts)
    assert stored["suggested"]["fibreNames"] == ["cotton", "polyester", "elastane"]
    for name in stored["suggested"]["fibreNames"]:
        assert "%" not in name


def test_unlock_vision_does_not_clear_confirmed_facts() -> None:
    confirmed = confirm_facts(
        facts_from_stored(None), is_textile=False, gpsr_choice="skip"
    ).facts
    persistable = persistable_from_vision(VISION_WITH_LISTING_COPY)
    kept = apply_suggested(confirmed, persistable.facts.suggested)
    assert may_generate_listing_copy(kept) is True
    assert kept.confirmed is not None
    assert kept.confirmed.is_textile is False
    assert kept.suggested is not None
    assert kept.suggested.fibre_names == ("cotton",)

    suggested_only = stored_from_facts(persistable_from_vision(VISION_WITH_LISTING_COPY).facts)
    confirmed = stored_from_facts(
        confirm_facts(
            facts_from_stored(suggested_only), is_textile=False, gpsr_choice="skip"
        ).facts
    )
    merged = merge_product_facts([suggested_only, None, confirmed])
    assert may_generate_listing_copy(merged) is True
    assert merged.confirmed is not None
    assert merged.confirmed.is_textile is False


COMPLETE_GPSR = {
    "manufacturer": {
        "name": "Acme Ltd",
        "postalAddress": "1 Rue Example, Paris",
        "email": "acme@example.com",
    },
    "manufacturerInEu": False,
    "euResponsiblePerson": {
        "name": "EU Agent BV",
        "postalAddress": "2 Keizersgracht, Amsterdam",
        "email": "rp@example.com",
    },
}

COMPLETE_GPSR_EU = {
    "manufacturer": {
        "name": "Acme Ltd",
        "postalAddress": "1 Rue Example, Paris",
        "email": "acme@example.com",
    },
    "manufacturerInEu": True,
}

GPSR_BLOCK = (
    "<p>Manufacturer: Acme Ltd, 1 Rue Example, Paris, acme@example.com.</p>"
    "<p>EU responsible person: EU Agent BV, 2 Keizersgracht, Amsterdam, rp@example.com.</p>"
)

GPSR_BLOCK_EU = "<p>Manufacturer: Acme Ltd, 1 Rue Example, Paris, acme@example.com.</p>"


def test_empty_gpsr_is_not_a_skip() -> None:
    facts = persistable_from_vision(VISION_WITH_LISTING_COPY).facts
    result = confirm_facts(facts, is_textile=False)
    assert result.ok is False
    assert result.error == "GPSR identity must be filled or explicitly skipped."
    assert may_generate_listing_copy(result.facts) is False


def test_skip_omits_the_gpsr_block() -> None:
    facts = confirm_facts(
        persistable_from_vision(VISION_WITH_LISTING_COPY).facts,
        is_textile=False,
        gpsr_choice="skip",
    ).facts
    assert may_generate_listing_copy(facts) is True
    html = description_blocks(facts, shop_gpsr=COMPLETE_GPSR)
    assert html == ""
    assert effective_gpsr(facts, COMPLETE_GPSR) is None
    constraints = listing_copy_constraints(facts, shop_gpsr=COMPLETE_GPSR)
    assert GPSR_BLOCK not in constraints
    assert "do not invent" in constraints.lower()
    assert "gpsr" in constraints.lower()
    assert apply_description_blocks(GPSR_BLOCK, facts, shop_gpsr=COMPLETE_GPSR) == ""
    assert apply_description_blocks(
        f"<p>A mug.</p>{GPSR_BLOCK}", facts, shop_gpsr=COMPLETE_GPSR
    ) == "<p>A mug.</p>"


def test_effective_gpsr_is_override_else_shop_default_else_none() -> None:
    suggested = persistable_from_vision(VISION_WITH_LISTING_COPY).facts
    override = confirm_facts(
        suggested,
        is_textile=False,
        gpsr_choice="override",
        gpsr_identity=COMPLETE_GPSR,
        shop_gpsr=COMPLETE_GPSR_EU,
    ).facts
    identity = effective_gpsr(override, COMPLETE_GPSR_EU)
    assert identity is not None
    assert identity.manufacturer.name == "Acme Ltd"
    assert identity.manufacturer_in_eu is False
    assert identity.eu_responsible_person is not None
    assert identity.eu_responsible_person.name == "EU Agent BV"
    assert description_blocks(override, shop_gpsr=COMPLETE_GPSR_EU) == GPSR_BLOCK

    shop_default = confirm_facts(
        suggested,
        is_textile=False,
        gpsr_choice="shop_default",
        shop_gpsr=COMPLETE_GPSR_EU,
    ).facts
    shop_identity = effective_gpsr(shop_default, COMPLETE_GPSR_EU)
    assert shop_identity is not None
    assert shop_identity.manufacturer_in_eu is True
    assert shop_identity.eu_responsible_person is None
    assert description_blocks(shop_default, shop_gpsr=COMPLETE_GPSR_EU) == GPSR_BLOCK_EU

    no_shop = confirm_facts(
        suggested,
        is_textile=False,
        gpsr_choice="shop_default",
        shop_gpsr=None,
    )
    assert no_shop.ok is False
    skipped = confirm_facts(suggested, is_textile=False, gpsr_choice="skip").facts
    assert effective_gpsr(skipped, None) is None
    assert description_blocks(skipped) == ""


def test_incomplete_gpsr_cannot_confirm() -> None:
    facts = persistable_from_vision(VISION_WITH_LISTING_COPY).facts
    empty_name = confirm_facts(
        facts,
        is_textile=False,
        gpsr_choice="override",
        gpsr_identity={
            "manufacturer": {"name": "", "postalAddress": "1 Rue", "email": "a@b.c"},
            "manufacturerInEu": True,
        },
    )
    assert empty_name.ok is False
    assert empty_name.error == "GPSR identity is incomplete."

    missing_rp = confirm_facts(
        facts,
        is_textile=False,
        gpsr_choice="override",
        gpsr_identity=COMPLETE_GPSR_EU | {"manufacturerInEu": False},
    )
    assert missing_rp.ok is False
    assert missing_rp.error == "GPSR identity is incomplete."


def test_gpsr_block_follows_composition() -> None:
    facts = confirm_facts(
        persistable_from_vision({**VISION_WITH_LISTING_COPY, "isTextile": True}).facts,
        is_textile=True,
        composition=COTTON_POLYESTER,
        gpsr_choice="override",
        gpsr_identity=COMPLETE_GPSR,
        care_choice="skip",
    ).facts
    html = description_blocks(facts)
    assert html == (
        "<p>Fibre composition: 80% cotton, 20% polyester.</p>\n" + GPSR_BLOCK
    )
    restored = facts_from_stored(stored_from_facts(facts))
    assert description_blocks(restored) == html
    applied = apply_description_blocks("<p>A soft everyday tee.</p>", facts)
    assert applied == (
        "<p>A soft everyday tee.</p>\n"
        "<p>Fibre composition: 80% cotton, 20% polyester.</p>\n" + GPSR_BLOCK
    )


def test_empty_care_is_not_a_skip() -> None:
    facts = persistable_from_vision({**VISION_WITH_LISTING_COPY, "isTextile": True}).facts
    result = confirm_facts(
        facts,
        is_textile=True,
        composition=COTTON_POLYESTER,
        gpsr_choice="skip",
    )
    assert result.ok is False
    assert result.error == "Care instructions must be filled or explicitly skipped."
    assert may_generate_listing_copy(result.facts) is False


COMPLETE_CARE = {
    "washing": "wash_40c",
    "bleaching": "do_not_bleach",
    "drying": "line_dry",
    "ironing": "iron_low",
    "professionalTextileCare": "dry_clean",
}

CARE_BLOCK = (
    "<p>Care instructions: Wash at 40°C. Do not bleach. Line dry. Iron low. Dry clean.</p>"
)

PICTOGRAM_CHARS = "△□○◯🧺"


def test_skip_omits_the_care_block() -> None:
    facts = confirm_facts(
        persistable_from_vision({**VISION_WITH_LISTING_COPY, "isTextile": True}).facts,
        is_textile=True,
        composition=COTTON_POLYESTER,
        gpsr_choice="skip",
        care_choice="skip",
    ).facts
    html = description_blocks(facts)
    assert html == "<p>Fibre composition: 80% cotton, 20% polyester.</p>"
    assert "care" not in html.lower()
    constraints = listing_copy_constraints(facts)
    assert "Do not invent care instructions" in constraints
    assert CARE_BLOCK not in constraints
    stripped = apply_description_blocks(f"<p>A tee.</p>{CARE_BLOCK}", facts)
    assert stripped == (
        "<p>A tee.</p>\n<p>Fibre composition: 80% cotton, 20% polyester.</p>"
    )
    assert "Care instructions" not in stripped


def test_partial_care_cannot_confirm() -> None:
    facts = persistable_from_vision({**VISION_WITH_LISTING_COPY, "isTextile": True}).facts
    missing_family = confirm_facts(
        facts,
        is_textile=True,
        composition=COTTON_POLYESTER,
        gpsr_choice="skip",
        care_choice="fill",
        care={
            "washing": "wash_40c",
            "bleaching": "do_not_bleach",
            "drying": "line_dry",
            "ironing": "iron_low",
        },
    )
    assert missing_family.ok is False
    assert missing_family.error == (
        "Care instructions must be a complete five-family set or an explicit skip."
    )
    assert may_generate_listing_copy(missing_family.facts) is False

    invalid_pick = confirm_facts(
        facts,
        is_textile=True,
        composition=COTTON_POLYESTER,
        gpsr_choice="skip",
        care_choice="fill",
        care={**COMPLETE_CARE, "washing": "machine_wash_delicate"},
    )
    assert invalid_pick.ok is False
    assert may_generate_listing_copy(invalid_pick.facts) is False

    fill_without_codes = confirm_facts(
        facts,
        is_textile=True,
        composition=COTTON_POLYESTER,
        gpsr_choice="skip",
        care_choice="fill",
    )
    assert fill_without_codes.ok is False
    assert may_generate_listing_copy(fill_without_codes.facts) is False


def test_rendered_care_matches_picks_and_contains_no_pictograms() -> None:
    facts = confirm_facts(
        persistable_from_vision({**VISION_WITH_LISTING_COPY, "isTextile": True}).facts,
        is_textile=True,
        composition=COTTON_POLYESTER,
        gpsr_choice="skip",
        care_choice="fill",
        care=COMPLETE_CARE,
    ).facts
    html = description_blocks(facts)
    assert html == (
        "<p>Fibre composition: 80% cotton, 20% polyester.</p>\n" + CARE_BLOCK
    )
    for char in PICTOGRAM_CHARS:
        assert char not in html
    assert "Wash at 40°C" in html
    assert "Do not bleach" in html
    assert "Line dry" in html
    assert "Iron low" in html
    assert "Dry clean" in html
    constraints = listing_copy_constraints(facts)
    assert CARE_BLOCK in constraints
    assert "Do not invent care instructions" not in constraints
    restored = facts_from_stored(stored_from_facts(facts))
    assert description_blocks(restored) == html


def test_care_block_sits_between_composition_and_gpsr() -> None:
    facts = confirm_facts(
        persistable_from_vision({**VISION_WITH_LISTING_COPY, "isTextile": True}).facts,
        is_textile=True,
        composition=COTTON_POLYESTER,
        gpsr_choice="override",
        gpsr_identity=COMPLETE_GPSR,
        care_choice="fill",
        care=COMPLETE_CARE,
    ).facts
    html = description_blocks(facts)
    assert html == (
        "<p>Fibre composition: 80% cotton, 20% polyester.</p>\n"
        + CARE_BLOCK
        + "\n"
        + GPSR_BLOCK
    )


def test_non_textile_does_not_require_or_show_care() -> None:
    facts = confirm_facts(
        persistable_from_vision(VISION_WITH_LISTING_COPY).facts,
        is_textile=False,
        gpsr_choice="skip",
    ).facts
    assert may_generate_listing_copy(facts) is True
    assert description_blocks(facts) == ""
    assert "care" not in description_blocks(facts).lower()
    filled_anyway = confirm_facts(
        persistable_from_vision(VISION_WITH_LISTING_COPY).facts,
        is_textile=False,
        gpsr_choice="skip",
        care_choice="fill",
        care=COMPLETE_CARE,
    ).facts
    assert description_blocks(filled_anyway) == ""
    assert "Care instructions" not in listing_copy_constraints(filled_anyway)


COTTON_ONLY = [{"name": "cotton", "percent": 100}]


def _confirm_textile(facts, composition=COTTON_POLYESTER, listing_copy=None):
    return confirm_facts(
        facts,
        is_textile=True,
        composition=composition,
        gpsr_choice="skip",
        care_choice="skip",
        listing_copy=listing_copy,
    )


def test_first_confirm_without_listing_copy_is_not_stale() -> None:
    result = _confirm_textile(
        persistable_from_vision({**VISION_WITH_LISTING_COPY, "isTextile": True}).facts
    )
    assert result.ok is True
    assert result.facts.listing_copy_stale is False
    assert may_generate_listing_copy(result.facts) is True


def test_grandfathered_title_plus_first_confirm_marks_stale() -> None:
    result = _confirm_textile(
        persistable_from_vision({**VISION_WITH_LISTING_COPY, "isTextile": True}).facts,
        listing_copy={"title": "Organic Cotton Tee"},
    )
    assert result.ok is True
    assert result.facts.listing_copy_stale is True
    assert may_generate_listing_copy(result.facts) is True
    assert description_blocks(result.facts) == (
        "<p>Fibre composition: 80% cotton, 20% polyester.</p>"
    )


def test_same_values_confirm_does_not_mark_stale() -> None:
    first = _confirm_textile(
        persistable_from_vision({**VISION_WITH_LISTING_COPY, "isTextile": True}).facts
    ).facts
    again = _confirm_textile(first, listing_copy={"title": "Generated Tee"})
    assert again.ok is True
    assert again.facts.listing_copy_stale is False
    assert may_generate_listing_copy(again.facts) is True


def test_changing_confirmed_facts_with_listing_copy_marks_stale() -> None:
    first = _confirm_textile(
        persistable_from_vision({**VISION_WITH_LISTING_COPY, "isTextile": True}).facts
    ).facts
    changed = _confirm_textile(
        first, composition=COTTON_ONLY, listing_copy={"title": "Generated Tee"}
    )
    assert changed.ok is True
    assert changed.facts.listing_copy_stale is True
    assert may_generate_listing_copy(changed.facts) is True
    assert description_blocks(changed.facts) == "<p>Fibre composition: 100% cotton.</p>"


def test_same_values_confirm_keeps_an_existing_stale_mark() -> None:
    stale = _confirm_textile(
        persistable_from_vision({**VISION_WITH_LISTING_COPY, "isTextile": True}).facts,
        listing_copy={"title": "Organic Cotton Tee"},
    ).facts
    again = _confirm_textile(stale, listing_copy={"title": "Organic Cotton Tee"})
    assert again.facts.listing_copy_stale is True
    assert may_generate_listing_copy(again.facts) is True


def test_failed_confirm_does_not_mark_stale() -> None:
    facts = persistable_from_vision({**VISION_WITH_LISTING_COPY, "isTextile": True}).facts
    result = confirm_facts(
        facts,
        is_textile=True,
        composition=[{"name": "cotton", "percent": 80}],
        gpsr_choice="skip",
        listing_copy={"title": "Organic Cotton Tee"},
    )
    assert result.ok is False
    assert result.facts.listing_copy_stale is False
    assert may_generate_listing_copy(result.facts) is False


def test_any_listing_copy_field_counts_as_copy_on_first_confirm() -> None:
    suggested = persistable_from_vision(VISION_WITH_LISTING_COPY).facts
    for listing_copy in (
        {"title": "Mug"},
        {"description": "<p>A mug.</p>"},
        {"tags": ["ceramic"]},
        {"seo_title": "Buy a mug"},
        {"seo_description": "A mug for sale"},
        {"aeo_snippet": "A ceramic mug."},
        {"aeo_faqs": [{"q": "Is it ceramic?", "a": "Yes."}]},
    ):
        result = confirm_facts(
            suggested, is_textile=False, gpsr_choice="skip", listing_copy=listing_copy
        )
        assert result.facts.listing_copy_stale is True, listing_copy
        assert may_generate_listing_copy(result.facts) is True


def test_empty_listing_copy_fields_do_not_count_as_copy() -> None:
    suggested = persistable_from_vision(VISION_WITH_LISTING_COPY).facts
    for listing_copy in (None, {}, {"title": ""}, {"title": "  "}, {"tags": []}):
        result = confirm_facts(
            suggested, is_textile=False, gpsr_choice="skip", listing_copy=listing_copy
        )
        assert result.facts.listing_copy_stale is False, listing_copy


def test_existing_stored_facts_are_not_backfilled_stale() -> None:
    facts = _confirm_textile(
        persistable_from_vision({**VISION_WITH_LISTING_COPY, "isTextile": True}).facts
    ).facts
    stored = stored_from_facts(facts)
    stored.pop("listingCopyStale", None)
    restored = facts_from_stored(stored)
    assert restored.listing_copy_stale is False
    assert may_generate_listing_copy(restored) is True


def test_unreadable_confirmed_facts_keep_a_stored_stale_mark() -> None:
    restored = facts_from_stored(
        {
            "confirmed": {
                "isTextile": True,
                "composition": [{"name": "cotton", "percent": 80}],
            },
            "listingCopyStale": True,
        }
    )
    assert restored.confirmed is None
    assert restored.listing_copy_stale is True
    assert may_generate_listing_copy(restored) is False


def test_stale_mark_survives_storage_and_group_merge() -> None:
    stale = _confirm_textile(
        persistable_from_vision({**VISION_WITH_LISTING_COPY, "isTextile": True}).facts,
        listing_copy={"title": "Organic Cotton Tee"},
    ).facts
    restored = facts_from_stored(stored_from_facts(stale))
    assert restored.listing_copy_stale is True
    sibling = stored_from_facts(
        persistable_from_vision({**VISION_WITH_LISTING_COPY, "isTextile": True}).facts
    )
    merged = merge_product_facts([sibling, stored_from_facts(stale)])
    assert merged.listing_copy_stale is True
    assert may_generate_listing_copy(merged) is True


def test_changing_care_gpsr_or_textile_with_listing_copy_marks_stale() -> None:
    listing_copy = {"title": "Generated Tee"}
    textile = _confirm_textile(
        persistable_from_vision({**VISION_WITH_LISTING_COPY, "isTextile": True}).facts
    ).facts
    care_filled = confirm_facts(
        textile,
        is_textile=True,
        composition=COTTON_POLYESTER,
        gpsr_choice="skip",
        care_choice="fill",
        care=COMPLETE_CARE,
        listing_copy=listing_copy,
    )
    assert care_filled.facts.listing_copy_stale is True
    assert may_generate_listing_copy(care_filled.facts) is True

    gpsr_override = confirm_facts(
        textile,
        is_textile=True,
        composition=COTTON_POLYESTER,
        gpsr_choice="override",
        gpsr_identity=COMPLETE_GPSR,
        care_choice="skip",
        listing_copy=listing_copy,
    )
    assert gpsr_override.facts.listing_copy_stale is True

    not_textile = confirm_facts(
        textile,
        is_textile=False,
        gpsr_choice="skip",
        listing_copy=listing_copy,
    )
    assert not_textile.facts.listing_copy_stale is True
    assert may_generate_listing_copy(not_textile.facts) is True
