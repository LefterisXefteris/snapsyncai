"""Product-facts module — listing copy stays gated until facts are confirmed."""

from app.services.product_facts import (
    apply_suggested,
    confirm_facts,
    facts_from_stored,
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


def test_confirming_not_a_textile_opens_the_gate() -> None:
    facts = persistable_from_vision(VISION_WITH_LISTING_COPY).facts
    result = confirm_facts(facts, is_textile=False)
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
    result = confirm_facts(facts, is_textile=True)
    assert result.ok is False
    assert result.error == "Fibre composition is required to confirm a textile product."
    assert may_generate_listing_copy(result.facts) is False


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
    confirmed = confirm_facts(facts_from_stored(None), is_textile=False).facts
    persistable = persistable_from_vision(VISION_WITH_LISTING_COPY)
    kept = apply_suggested(confirmed, persistable.facts.suggested)
    assert may_generate_listing_copy(kept) is True
    assert kept.confirmed is not None
    assert kept.confirmed.is_textile is False
    assert kept.suggested is not None
    assert kept.suggested.fibre_names == ("cotton",)

    suggested_only = stored_from_facts(persistable_from_vision(VISION_WITH_LISTING_COPY).facts)
    confirmed = stored_from_facts(
        confirm_facts(facts_from_stored(suggested_only), is_textile=False).facts
    )
    merged = merge_product_facts([suggested_only, None, confirmed])
    assert may_generate_listing_copy(merged) is True
    assert merged.confirmed is not None
    assert merged.confirmed.is_textile is False
