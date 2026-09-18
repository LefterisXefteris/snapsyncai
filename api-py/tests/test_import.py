"""Import module — fetch missing Channel products; SnapSync owns the record.

Seam: `app.services.import_catalogue`.
"""

from app.services.import_catalogue import (
    IN_PROGRESS,
    NOT_CONNECTED,
    ChannelProduct,
    MemoryRunLock,
    start_import,
)
from app.services.listing_copy_refresh import refresh_blocked_reason
from app.services.plan import JobKind
from app.services.product_facts import facts_from_stored, may_generate_listing_copy


def _channel(**overrides) -> ChannelProduct:
    values = dict(
        channel_product_id="gid://shopify/Product/1",
        title="Linen dress",
        description="<p>A linen dress.</p>",
        tags=("linen", "dress"),
        seo_title="Linen dress",
        seo_description="A linen dress for summer",
    )
    values.update(overrides)
    return ChannelProduct(**values)


def _lock() -> MemoryRunLock:
    return MemoryRunLock()


async def test_not_connected_blocks_start() -> None:
    persisted: list = []
    result = await start_import(
        shopify_connected=False,
        existing_channel_ids=(),
        channel_products=(_channel(),),
        persist=persisted.append,
        run_lock=_lock(),
    )
    assert result.blocked_reason == NOT_CONNECTED
    assert persisted == []
    assert result.created == 0


async def test_empty_channel_list_creates_nothing() -> None:
    persisted: list = []
    result = await start_import(
        shopify_connected=True,
        existing_channel_ids=(),
        channel_products=(),
        persist=persisted.append,
        run_lock=_lock(),
    )
    assert result.blocked_reason is None
    assert result.created == 0
    assert result.skipped == 0
    assert result.failed == 0
    assert persisted == []


async def test_new_product_lands_with_grandfathered_listing_copy() -> None:
    persisted: list = []
    result = await start_import(
        shopify_connected=True,
        existing_channel_ids=(),
        channel_products=(_channel(),),
        persist=persisted.append,
        run_lock=_lock(),
    )
    assert result.created == 1
    assert result.skipped == 0
    assert len(persisted) == 1
    product = persisted[0]
    assert product.channel_product_id == "gid://shopify/Product/1"
    assert product.listing_copy.title == "Linen dress"
    assert product.listing_copy.description == "<p>A linen dress.</p>"
    assert product.listing_copy.tags == ("linen", "dress")
    assert product.listing_copy.seo_title == "Linen dress"
    assert product.listing_copy.seo_description == "A linen dress for summer"
    assert product.aeo_snippet is None
    assert product.aeo_faqs is None
    assert product.product_facts is None
    assert product.category is None
    assert product.product_type is None


async def test_existing_channel_id_is_skipped_and_not_overwritten() -> None:
    persisted: list = []
    result = await start_import(
        shopify_connected=True,
        existing_channel_ids=("gid://shopify/Product/1",),
        channel_products=(_channel(title="Shopify title I must not copy"),),
        persist=persisted.append,
        run_lock=_lock(),
    )
    assert result.created == 0
    assert result.skipped == 1
    assert persisted == []


async def test_empty_title_still_imports() -> None:
    persisted: list = []
    result = await start_import(
        shopify_connected=True,
        existing_channel_ids=(),
        channel_products=(_channel(title=None, seo_title=None),),
        persist=persisted.append,
        run_lock=_lock(),
    )
    assert result.created == 1
    assert persisted[0].listing_copy.title is None
    assert persisted[0].listing_copy.description == "<p>A linen dress.</p>"


async def test_one_new_id_among_existing_creates_one() -> None:
    persisted: list = []
    result = await start_import(
        shopify_connected=True,
        existing_channel_ids=("gid://shopify/Product/1",),
        channel_products=(
            _channel(),
            _channel(channel_product_id="gid://shopify/Product/2", title="New skirt"),
        ),
        persist=persisted.append,
        run_lock=_lock(),
    )
    assert result.created == 1
    assert result.skipped == 1
    assert persisted[0].channel_product_id == "gid://shopify/Product/2"
    assert persisted[0].listing_copy.title == "New skirt"


async def test_channel_description_does_not_become_legal_facts() -> None:
    persisted: list = []
    await start_import(
        shopify_connected=True,
        existing_channel_ids=(),
        channel_products=(
            _channel(
                description=(
                    "<p>100% cotton. Wash at 30°C. Made by Acme, 1 High St, acme@example.com.</p>"
                ),
            ),
        ),
        persist=persisted.append,
        run_lock=_lock(),
    )
    product = persisted[0]
    assert product.product_facts is None
    facts = facts_from_stored(product.product_facts)
    assert facts.confirmed is None
    assert facts.suggested is None
    listing = {
        "title": product.listing_copy.title,
        "description": product.listing_copy.description,
        "tags": list(product.listing_copy.tags),
        "seo_title": product.listing_copy.seo_title,
        "seo_description": product.listing_copy.seo_description,
    }
    assert may_generate_listing_copy(facts) is False
    assert refresh_blocked_reason(facts, listing, True) == (
        "Confirm product facts before refreshing listing copy."
    )


async def test_category_and_product_type_copy_when_present() -> None:
    persisted: list = []
    await start_import(
        shopify_connected=True,
        existing_channel_ids=(),
        channel_products=(_channel(category="Apparel > Dresses", product_type="Dress"),),
        persist=persisted.append,
        run_lock=_lock(),
    )
    assert persisted[0].category == "Apparel > Dresses"
    assert persisted[0].product_type == "Dress"


async def test_import_does_not_spend_and_is_not_a_plan_job() -> None:
    result = await start_import(
        shopify_connected=True,
        existing_channel_ids=(),
        channel_products=(_channel(),),
        persist=lambda _product: None,
        run_lock=_lock(),
    )
    assert result.created == 1
    assert "import" not in JobKind.__args__
    spending = {"generate_persist", "refresh_accept", "website_handoff", "bulk_seo_persist"}
    assert set(JobKind.__args__) == spending


async def test_several_media_are_one_product_group() -> None:
    persisted: list = []
    result = await start_import(
        shopify_connected=True,
        existing_channel_ids=(),
        channel_products=(
            _channel(media_urls=("https://cdn.example/front.jpg", "https://cdn.example/back.jpg")),
        ),
        persist=persisted.append,
        run_lock=_lock(),
    )
    assert result.created == 1
    assert len(persisted) == 1
    assert persisted[0].photo_urls == (
        "https://cdn.example/front.jpg",
        "https://cdn.example/back.jpg",
    )


async def test_no_media_still_creates() -> None:
    persisted: list = []
    result = await start_import(
        shopify_connected=True,
        existing_channel_ids=(),
        channel_products=(_channel(media_urls=()),),
        persist=persisted.append,
        run_lock=_lock(),
    )
    assert result.created == 1
    assert persisted[0].photo_urls == ()


async def test_dead_media_url_drops_that_photo_not_the_product() -> None:
    persisted: list = []

    def load_photo(url: str) -> str | None:
        if "dead" in url:
            return None
        return url

    result = await start_import(
        shopify_connected=True,
        existing_channel_ids=(),
        channel_products=(
            _channel(
                media_urls=(
                    "https://cdn.example/dead.jpg",
                    "https://cdn.example/live.jpg",
                )
            ),
        ),
        persist=persisted.append,
        load_photo=load_photo,
        run_lock=_lock(),
    )
    assert result.created == 1
    assert persisted[0].photo_urls == ("https://cdn.example/live.jpg",)


async def test_import_does_not_write_suggested_facts_from_photos() -> None:
    persisted: list = []
    await start_import(
        shopify_connected=True,
        existing_channel_ids=(),
        channel_products=(_channel(media_urls=("https://cdn.example/linen.jpg",)),),
        persist=persisted.append,
        run_lock=_lock(),
    )
    assert persisted[0].product_facts is None
    assert facts_from_stored(persisted[0].product_facts).suggested is None


async def test_selling_copies_first_variant_not_quantity() -> None:
    persisted: list = []
    await start_import(
        shopify_connected=True,
        existing_channel_ids=(),
        channel_products=(
            _channel(
                price="49.00",
                compare_at_price="59.00",
                cost="12.00",
                sku="LINEN-1",
                barcode="123456",
                track_quantity=True,
            ),
        ),
        persist=persisted.append,
        run_lock=_lock(),
    )
    selling = persisted[0].selling
    assert selling.price == "49.00"
    assert selling.compare_at_price == "59.00"
    assert selling.cost == "12.00"
    assert selling.sku == "LINEN-1"
    assert selling.barcode == "123456"
    assert selling.track_quantity is True
    assert persisted[0].inventory_quantity is None
    assert not hasattr(persisted[0], "available_quantity")


async def test_option_variants_are_visible_as_one_catalogue_product() -> None:
    persisted: list = []
    result = await start_import(
        shopify_connected=True,
        existing_channel_ids=(),
        channel_products=(
            _channel(
                options=(("Color", ("Blue", "Green")), ("Size", ("S", "M"))),
            ),
        ),
        persist=persisted.append,
        run_lock=_lock(),
    )
    assert result.created == 1
    assert persisted[0].variants == (
        {"name": "Color", "values": ["Blue", "Green"]},
        {"name": "Size", "values": ["S", "M"]},
    )


async def test_draft_active_and_publications_are_copied() -> None:
    persisted: list = []
    await start_import(
        shopify_connected=True,
        existing_channel_ids=(),
        channel_products=(
            _channel(
                status="ACTIVE",
                publication_ids=("gid://shopify/Publication/1", "gid://shopify/Publication/2"),
            ),
        ),
        persist=persisted.append,
        run_lock=_lock(),
    )
    assert persisted[0].status == "ACTIVE"
    assert persisted[0].publication_ids == (
        "gid://shopify/Publication/1",
        "gid://shopify/Publication/2",
    )


async def test_collections_vendor_weight_and_template_are_not_on_the_product() -> None:
    persisted: list = []
    await start_import(
        shopify_connected=True,
        existing_channel_ids=(),
        channel_products=(_channel(),),
        persist=persisted.append,
        run_lock=_lock(),
    )
    product = persisted[0]
    assert not hasattr(product, "collections")
    assert not hasattr(product, "vendor")
    assert not hasattr(product, "weight")
    assert not hasattr(product, "template")


async def test_same_channel_id_twice_in_one_list_persists_once() -> None:
    persisted: list = []
    result = await start_import(
        shopify_connected=True,
        existing_channel_ids=(),
        channel_products=(
            _channel(title="First"),
            _channel(title="Twin"),
        ),
        persist=persisted.append,
        run_lock=_lock(),
    )
    assert result.created == 1
    assert result.skipped == 1
    assert len(persisted) == 1
    assert persisted[0].listing_copy.title == "First"


async def test_one_channel_failure_creates_siblings_and_writes_no_row() -> None:
    persisted: list = []

    def persist(product) -> None:
        if product.channel_product_id.endswith("/bad"):
            raise RuntimeError("Channel product could not land")
        persisted.append(product)

    result = await start_import(
        shopify_connected=True,
        existing_channel_ids=(),
        channel_products=(
            _channel(channel_product_id="gid://shopify/Product/ok", title="Ok"),
            _channel(channel_product_id="gid://shopify/Product/bad", title="Bad"),
            _channel(channel_product_id="gid://shopify/Product/also", title="Also"),
        ),
        persist=persist,
        run_lock=_lock(),
    )
    assert result.created == 2
    assert result.failed == 1
    assert result.failures[0].channel_product_id == "gid://shopify/Product/bad"
    assert [item.channel_product_id for item in persisted] == [
        "gid://shopify/Product/ok",
        "gid://shopify/Product/also",
    ]


async def test_second_start_while_in_progress_is_refused() -> None:
    lock = _lock()
    lock.begin()
    persisted: list = []
    result = await start_import(
        shopify_connected=True,
        existing_channel_ids=(),
        channel_products=(_channel(),),
        persist=persisted.append,
        run_lock=lock,
    )
    assert result.blocked_reason == IN_PROGRESS
    assert persisted == []


async def test_later_start_after_complete_only_adds_missing_ids() -> None:
    lock = _lock()
    persisted: list = []
    first = await start_import(
        shopify_connected=True,
        existing_channel_ids=(),
        channel_products=(_channel(),),
        persist=persisted.append,
        run_lock=lock,
    )
    assert first.created == 1
    already = tuple(item.channel_product_id for item in persisted)
    second = await start_import(
        shopify_connected=True,
        existing_channel_ids=already,
        channel_products=(
            _channel(),
            _channel(channel_product_id="gid://shopify/Product/9", title="Later"),
        ),
        persist=persisted.append,
        run_lock=lock,
    )
    assert second.created == 1
    assert second.skipped == 1
    assert persisted[-1].listing_copy.title == "Later"


async def test_interrupted_list_releases_the_lock() -> None:
    lock = _lock()

    def explode():
        raise RuntimeError("Channel list failed")

    try:
        await start_import(
            shopify_connected=True,
            existing_channel_ids=(),
            channel_products=explode,
            persist=lambda _product: None,
            run_lock=lock,
        )
    except RuntimeError:
        pass
    assert lock.in_progress() is False
    retry = await start_import(
        shopify_connected=True,
        existing_channel_ids=(),
        channel_products=(_channel(),),
        persist=lambda _product: None,
        run_lock=lock,
    )
    assert retry.created == 1
