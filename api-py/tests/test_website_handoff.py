"""Website — eligibility, snapshot (no secrets), and Publish.

Seam: `app.services.website_handoff`.
"""

import pytest
from sqlalchemy import update

from app.models.image import Image
from app.services import website_handoff
from app.services.website_handoff import (
    PublishError,
    WebsitePhoto,
    assemble_storefront,
    eligible_products,
    preview_website,
    publish_saved_website,
    publish_website,
    published_storefront,
    save_website_prototype,
    saved_website_prototype,
    snapshot_product,
)
from tests import seed

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
    front = _photo(id=10, product_group_id="g1", storage_url="https://cdn.shopify.com/s/files/1/front.jpg")
    back = _photo(id=11, product_group_id="g1", title=None, description=None, storage_url="https://cdn.shopify.com/s/files/1/back.jpg")
    products = eligible_products([front, back])
    assert len(products) == 1
    assert products[0].id == 10
    assert products[0].photo_urls == (
        "https://cdn.shopify.com/s/files/1/front.jpg",
        "https://cdn.shopify.com/s/files/1/back.jpg",
    )


def test_website_snapshot_drops_snapsync_storage_urls() -> None:
    photo = _photo(
        storage_url="https://abc.supabase.co/storage/v1/object/public/product-images/1/x.jpg"
    )
    products = eligible_products([photo])
    assert products[0].photo_urls == ()


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


def test_publish_freezes_the_picked_order_on_the_shop_address() -> None:
    first = eligible_products([_photo(id=1, title="First")])[0]
    second = eligible_products([_photo(id=2, title="Second")])[0]
    site = assemble_storefront(
        shop_domain="Tees.myshopify.com",
        shop_name="Tees",
        palette="ink",
        type_pairing="serif",
        products=[first, second],
        product_ids=[2, 1, 2],
    )
    assert site.handle == "tees"
    assert site.host == "tees.sites.snapsyncai.co.uk"
    assert site.shop_name == "Tees"
    assert site.palette == "ink"
    assert site.type_pairing == "serif"
    assert [product["title"] for product in site.products] == ["Second", "First"]
    assert site.products[0]["seoTitle"] == "Organic Cotton Tee"
    assert site.products[0]["confirmedFacts"]["composition"] == [{"name": "cotton", "percent": 100}]


def test_publish_refuses_a_palette_or_a_shop_that_is_not_ready() -> None:
    products = eligible_products([_photo()])
    with pytest.raises(PublishError, match="palette"):
        assemble_storefront(
            shop_domain="acme.myshopify.com",
            shop_name="Acme",
            palette="gold",
            type_pairing="sans",
            products=products,
            product_ids=[1],
        )
    with pytest.raises(PublishError, match="Shopify is not connected"):
        assemble_storefront(
            shop_domain="",
            shop_name="",
            palette="ground",
            type_pairing="sans",
            products=products,
            product_ids=[1],
        )
    with pytest.raises(PublishError, match="listing copy"):
        assemble_storefront(
            shop_domain="acme.myshopify.com",
            shop_name="Acme",
            palette="ground",
            type_pairing="sans",
            products=[],
            product_ids=[1],
        )


CHANNEL_PHOTO = "https://cdn.shopify.com/tee-front.jpg"


@pytest.fixture
def channel_photos(monkeypatch) -> None:
    async def urls(_graphql, _product_id):
        return (CHANNEL_PHOTO,)

    monkeypatch.setattr(website_handoff, "list_shopify_product_image_urls", urls)


async def test_the_first_publish_spends_one_use_and_freezes_the_channel_photo(
    db, db_settings, channel_photos
) -> None:
    await seed.plan(db)
    await seed.shop(db, shop_name="Tees")
    pid = await seed.product(
        db, facts=seed.confirmed_facts(textile=True), shopify_product_id=PUSHED
    )
    result = await publish_website(
        db,
        db_settings,
        seed.SELLER,
        palette="ground",
        type_pairing="sans",
        product_ids=[pid],
    )
    assert result.refused is None
    assert result.spent is True
    assert result.storefront is not None
    assert result.storefront.host == "tees.sites.snapsyncai.co.uk"
    assert result.storefront.products[0]["photoUrls"] == [CHANNEL_PHOTO]
    assert result.storefront.products[0]["title"] == "Cotton tee"
    assert [row.kind for row in await seed.spends(db)] == ["website_handoff"]


async def test_a_later_publish_replaces_the_site_and_does_not_spend(
    db, db_settings, channel_photos
) -> None:
    await seed.plan(db)
    await seed.shop(db, shop_name="Tees")
    pid = await seed.product(db, facts=seed.confirmed_facts(), shopify_product_id=PUSHED)
    first = await publish_website(
        db,
        db_settings,
        seed.SELLER,
        palette="ground",
        type_pairing="sans",
        product_ids=[pid],
    )
    assert first.spent is True
    await db.execute(update(Image).where(Image.id == pid).values(title="Linen shirt"))
    await db.flush()
    second = await publish_website(
        db,
        db_settings,
        seed.SELLER,
        palette="clay",
        type_pairing="serif",
        product_ids=[pid],
    )
    assert second.spent is False
    assert second.storefront is not None
    assert second.storefront.palette == "clay"
    assert second.storefront.products[0]["title"] == "Linen shirt"
    assert [row.kind for row in await seed.spends(db)] == ["website_handoff"]


async def test_a_catalogue_edit_does_not_change_the_published_words(
    db, db_settings, channel_photos
) -> None:
    await seed.plan(db)
    await seed.shop(db, shop_name="Tees")
    pid = await seed.product(db, facts=seed.confirmed_facts(), shopify_product_id=PUSHED)
    await publish_website(
        db,
        db_settings,
        seed.SELLER,
        palette="ground",
        type_pairing="sans",
        product_ids=[pid],
    )
    await db.execute(update(Image).where(Image.id == pid).values(title="Changed in the catalogue"))
    await db.flush()
    site = await published_storefront(db, "tees")
    assert site is not None
    assert site.products[0]["title"] == "Cotton tee"
    assert site.products[0]["photoUrls"] == [CHANNEL_PHOTO]
    assert await published_storefront(db, "other") is None


async def test_a_preview_does_not_publish_or_spend(db, db_settings, channel_photos) -> None:
    await seed.plan(db)
    await seed.shop(db, shop_name="Tees")
    pid = await seed.product(db, facts=seed.confirmed_facts(), shopify_product_id=PUSHED)
    result = await preview_website(
        db,
        db_settings,
        seed.SELLER,
        palette="ink",
        type_pairing="sans",
        product_ids=[pid],
    )
    assert result.spent is False
    assert result.storefront is not None
    assert result.storefront.palette == "ink"
    assert await published_storefront(db, "tees") is None
    assert await seed.spends(db) == []


async def test_publish_without_a_shop_spends_nothing(db, db_settings) -> None:
    await seed.plan(db)
    pid = await seed.product(db, facts=seed.confirmed_facts(), shopify_product_id=PUSHED)
    result = await publish_website(
        db,
        db_settings,
        seed.SELLER,
        palette="ground",
        type_pairing="sans",
        product_ids=[pid],
    )
    assert result.refused == "not_connected"
    assert result.storefront is None
    assert await seed.spends(db) == []


async def test_a_product_that_is_no_longer_eligible_leaves_the_picks(db, db_settings) -> None:
    await seed.shop(db, shop_name="Tees")
    kept = await seed.product(db, facts=seed.confirmed_facts(), shopify_product_id=PUSHED)
    dropped = await seed.product(
        db, facts=seed.confirmed_facts(), shopify_product_id="gid://shopify/Product/100"
    )
    await save_website_prototype(
        db, db_settings, seed.SELLER, product_ids=[kept, dropped], brief="Quiet type"
    )
    await db.execute(update(Image).where(Image.id == dropped).values(shopify_product_id=None))
    await db.flush()
    saved = await saved_website_prototype(db, db_settings, seed.SELLER)
    assert saved.product_ids == (kept,)
    assert saved.brief == "Quiet type"


async def test_publish_without_a_look_spends_nothing(db, db_settings) -> None:
    await seed.plan(db)
    await seed.shop(db, shop_name="Tees")
    pid = await seed.product(db, facts=seed.confirmed_facts(), shopify_product_id=PUSHED)
    await save_website_prototype(
        db, db_settings, seed.SELLER, product_ids=[pid], brief="Warm paper"
    )
    result = await publish_saved_website(db, db_settings, seed.SELLER)
    assert result.refused == "invalid"
    assert result.spent is False
    assert result.storefront is None
    assert await published_storefront(db, "tees") is None
    assert await seed.spends(db) == []


async def test_the_page_keeps_the_picks_and_the_brief(db, db_settings) -> None:
    await seed.shop(db, shop_name="Tees")
    first = await seed.product(db, facts=seed.confirmed_facts(), shopify_product_id=PUSHED)
    second = await seed.product(db, facts=seed.confirmed_facts(), shopify_product_id="gid://shopify/Product/100")
    await save_website_prototype(
        db,
        db_settings,
        seed.SELLER,
        product_ids=[second, first],
        brief="Warm paper, wide margins",
    )
    saved = await saved_website_prototype(db, db_settings, seed.SELLER)
    assert saved.product_ids == (second, first)
    assert saved.brief == "Warm paper, wide margins"
    assert saved.look is None


async def test_publish_without_a_plan_spends_nothing(db, db_settings, channel_photos) -> None:
    await seed.shop(db, shop_name="Tees")
    pid = await seed.product(db, facts=seed.confirmed_facts(), shopify_product_id=PUSHED)
    result = await publish_website(
        db,
        db_settings,
        seed.SELLER,
        palette="ground",
        type_pairing="sans",
        product_ids=[pid],
    )
    assert result.refused == "plan_blocked"
    assert result.storefront is None
    assert await published_storefront(db, "tees") is None
    assert await seed.spends(db) == []
