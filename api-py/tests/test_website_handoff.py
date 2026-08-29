"""Website handoff — eligibility, snapshot (no secrets), Lovable Build-with-URL.

Seam: `app.services.website_handoff`.
"""

from urllib.parse import parse_qs, urlparse

import pytest

from app.services.website_handoff import (
    HandoffError,
    WebsitePhoto,
    build_handoff,
    eligible_products,
    snapshot_product,
)

PUSHED = "gid://shopify/Product/99"


def _photo(**overrides) -> WebsitePhoto:
    values = dict(
        id=1,
        product_group_id=None,
        shopify_product_id=PUSHED,
        title="Organic Cotton Tee",
        description="A soft organic cotton tee. 100% cotton. Wash at 30°C.",
        tags=("cotton", "tee"),
        seo_title="Organic Cotton Tee",
        seo_description="Soft organic cotton tee",
        aeo_snippet="A soft organic cotton tee.",
        aeo_faqs=[{"q": "Is it cotton?", "a": "Yes."}],
        storage_url="https://cdn.example/tee.jpg",
        product_facts={
            "confirmed": {
                "isTextile": True,
                "composition": [{"name": "cotton", "percent": 100}],
                "gpsrChoice": "skip",
                "careChoice": "skip",
            }
        },
    )
    values.update(overrides)
    return WebsitePhoto(**values)


def test_only_pushed_products_with_listing_copy_are_eligible() -> None:
    ok = _photo()
    not_pushed = _photo(id=2, shopify_product_id=None, title="Draft")
    no_copy = _photo(id=3, title=None, description=None, seo_title=None, seo_description=None, aeo_snippet=None, aeo_faqs=None, tags=())
    products = eligible_products([ok, not_pushed, no_copy])
    assert [p.id for p in products] == [1]


def test_grouped_photos_are_one_product() -> None:
    front = _photo(id=10, product_group_id="g1", storage_url="https://cdn.example/front.jpg")
    back = _photo(id=11, product_group_id="g1", title=None, description=None, storage_url="https://cdn.example/back.jpg")
    products = eligible_products([front, back])
    assert len(products) == 1
    assert products[0].id == 10
    assert products[0].photo_urls == ("https://cdn.example/front.jpg", "https://cdn.example/back.jpg")


def test_snapshot_is_listing_copy_facts_photos_and_shopify_id() -> None:
    snap = snapshot_product(eligible_products([_photo()])[0])
    assert snap["shopifyProductId"] == PUSHED
    assert snap["title"] == "Organic Cotton Tee"
    assert "100% cotton" in snap["description"]
    assert snap["photoUrls"] == ["https://cdn.example/tee.jpg"]
    assert snap["aeoFaqs"] == [{"q": "Is it cotton?", "a": "Yes."}]
    assert snap["confirmedFacts"]["isTextile"] is True
    assert snap["confirmedFacts"]["composition"] == [{"name": "cotton", "percent": 100}]


def test_snapshot_never_carries_shopify_credentials() -> None:
    photo = _photo(
        product_facts={
            "confirmed": {"isTextile": False, "gpsrChoice": "skip"},
            "access_token": "shpat_leaked",
            "accessToken": "shpss_secret",
        }
    )
    snap = snapshot_product(eligible_products([photo])[0])
    blob = str(snap)
    assert "shpat_" not in blob
    assert "shpss_" not in blob
    assert "access_token" not in snap
    assert "accessToken" not in snap
    assert set(snap) == {
        "id",
        "shopifyProductId",
        "title",
        "description",
        "tags",
        "seoTitle",
        "seoDescription",
        "aeoSnippet",
        "aeoFaqs",
        "photoUrls",
        "confirmedFacts",
    }


def test_handoff_url_is_lovable_build_with_shop_domain_and_no_tokens() -> None:
    result = build_handoff(
        shop_domain="acme.myshopify.com",
        look="Black, serif, lookbook homepage",
        products=eligible_products([_photo()]),
    )
    parsed = urlparse(result.lovable_url)
    assert parsed.scheme == "https"
    assert parsed.netloc == "lovable.dev"
    assert parsed.path in ("", "/")
    assert parse_qs(parsed.query)["autosubmit"] == ["true"]
    prompt = parse_qs(parsed.fragment)["prompt"][0]
    assert "acme.myshopify.com" in prompt
    assert "Organic Cotton Tee" in prompt
    assert "Black, serif, lookbook homepage" in prompt
    assert "Install" in prompt
    assert "do not invent" in prompt.lower() or "Do not invent" in prompt
    assert "shpat_" not in result.lovable_url
    assert "access_token" not in result.lovable_url
    assert result.product_count == 1


def test_handoff_includes_shop_gpsr_identity() -> None:
    result = build_handoff(
        shop_domain="acme.myshopify.com",
        look="",
        products=eligible_products([_photo()]),
        shop_gpsr={"manufacturerName": "Acme Ltd", "email": "hello@acme.eu"},
    )
    prompt = parse_qs(urlparse(result.lovable_url).fragment)["prompt"][0]
    assert "Acme Ltd" in prompt
    assert "hello@acme.eu" in prompt


def test_handoff_refuses_without_a_shop() -> None:
    with pytest.raises(HandoffError, match="Shopify is not connected"):
        build_handoff(shop_domain="", look="", products=eligible_products([_photo()]))


def test_handoff_refuses_without_eligible_products() -> None:
    with pytest.raises(HandoffError, match="listing copy"):
        build_handoff(
            shop_domain="acme.myshopify.com",
            look="",
            products=eligible_products([_photo(shopify_product_id=None)]),
        )
