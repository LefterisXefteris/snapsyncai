"""Trendyol International through the Channel module, on `db`, against an in-memory account."""

from decimal import Decimal

from app.config import Settings
from app.models.inventory import InventoryItem
from app.services import images as store
from app.services import product as product_module
from app.services.trendyol import (
    LIST_BELOW,
    NEED_BARCODE,
    NEED_BRAND,
    NEED_CATEGORY,
    NEED_COPY,
    NEED_DESCRIPTION,
    NEED_LIST,
    NEED_SALE,
    NEED_SHOPIFY,
    NEED_SKU,
    NEED_TITLE,
    REJECTED_ACCOUNT,
    SETTINGS,
    TURKEY,
    AttributeValue,
    ListingDraft,
    RequiredAttribute,
    Storefront,
    connect,
    connection,
    disconnect,
    open_product,
    push,
    read_product,
)
from tests import seed
from tests.trendyol_memory import MemoryTrendyol

BARCODE = "8690000000011"
SKU = "TEE-1"
SALE = Decimal("19.00")
LISTED = Decimal("25.00")


def _settings(db_settings: Settings) -> Settings:
    return Settings.model_construct(
        database_url=db_settings.database_url,
        environment="test",
        connection_encryption_key="test-key",
    )


def _draft(**overrides) -> ListingDraft:
    values = {
        "category_id": "11",
        "brand_id": "22",
        "sale_price": SALE,
        "list_price": LISTED,
        "attributes": (),
    }
    values.update(overrides)
    return ListingDraft(**values)


async def _shop_and_product(db, **values) -> int:
    await seed.shop(db)
    return await seed.product(
        db,
        barcode=BARCODE,
        sku=SKU,
        price=Decimal("24.00"),
        storage_url="https://cdn.example/front.jpg",
        **values,
    )


async def _connect(db, settings, port, **overrides):
    body = {
        "seller_id": "501",
        "api_key": "key",
        "api_secret": "secret",
        "storefront_code": "DE",
        "vat_rate": 19,
    }
    body.update(overrides)
    return await connect(db, settings, port, seed.SELLER, **body)


async def test_connect_is_refused_without_a_shopify_channel(db, db_settings) -> None:
    result = await _connect(db, _settings(db_settings), MemoryTrendyol())
    assert result.connected is False
    assert result.message == NEED_SHOPIFY


async def test_a_turkey_storefront_is_refused(db, db_settings) -> None:
    settings = _settings(db_settings)
    await seed.shop(db)
    only_turkey = MemoryTrendyol(storefronts=(Storefront("TR", "TRY"),))
    refused = await _connect(db, settings, only_turkey, storefront_code="TR", vat_rate=20)
    assert refused.connected is False
    assert refused.message == TURKEY
    mixed = MemoryTrendyol(storefronts=(Storefront("DE", "EUR"), Storefront("TR", "TRY")))
    picked = await _connect(db, settings, mixed, storefront_code="TR", vat_rate=19)
    assert picked.connected is False
    assert picked.message == TURKEY


async def test_currency_follows_the_storefront(db, db_settings) -> None:
    settings = _settings(db_settings)
    pid = await _shop_and_product(db)
    port = MemoryTrendyol(storefronts=(Storefront("SA", "SAR"),))
    linked = await _connect(db, settings, port, storefront_code="SA", vat_rate=15)
    assert linked.connected is True
    assert linked.currency == "SAR"
    assert (await connection(db, seed.SELLER)).currency == "SAR"
    await push(db, settings, port, seed.SELLER, pid, _draft())
    assert port.product(BARCODE).currency == "SAR"
    assert port.product(BARCODE).vat_rate == 15


async def test_the_sellers_pick_is_the_storefront_that_is_stored(db, db_settings) -> None:
    await seed.shop(db)
    port = MemoryTrendyol(storefronts=(Storefront("SA", "SAR"), Storefront("AE", "AED")))
    settings = _settings(db_settings)
    pending = await _connect(db, settings, port, storefront_code=None, vat_rate=None)
    assert pending.connected is False
    assert [item.code for item in pending.storefronts] == ["SA", "AE"]
    chosen = await _connect(db, settings, port, storefront_code="AE", vat_rate=5)
    assert chosen.connected is True
    assert chosen.storefront == "AE"
    assert chosen.currency == "AED"


async def test_rejected_credentials_leave_the_seller_disconnected(db, db_settings) -> None:
    await seed.shop(db)
    port = MemoryTrendyol(refuse_credentials=True)
    result = await _connect(db, _settings(db_settings), port)
    assert result.connected is False
    assert result.message == REJECTED_ACCOUNT
    assert (await connection(db, seed.SELLER)).connected is False


async def test_disconnect_keeps_the_listing_and_the_product_on_trendyol(db, db_settings) -> None:
    settings = _settings(db_settings)
    pid = await _shop_and_product(db)
    port = MemoryTrendyol()
    await _connect(db, settings, port)
    await push(db, settings, port, seed.SELLER, pid, _draft())
    await disconnect(db, seed.SELLER)
    assert (await connection(db, seed.SELLER)).connected is False
    remembered = await read_product(db, seed.SELLER, pid)
    assert remembered is not None
    assert remembered.category_id == "11"
    assert remembered.push_wait == SETTINGS
    assert port.product(BARCODE).barcode == BARCODE
    again = await push(db, settings, port, seed.SELLER, pid, _draft())
    assert again is not None
    assert again.push_wait == SETTINGS


async def test_push_waits_for_an_incomplete_listing(db, db_settings) -> None:
    settings = _settings(db_settings)
    pid = await _shop_and_product(db)
    port = MemoryTrendyol()
    await _connect(db, settings, port)
    missing_category = await push(db, settings, port, seed.SELLER, pid, _draft(category_id=None))
    assert missing_category is not None
    assert missing_category.push_wait == NEED_CATEGORY
    missing_brand = await push(db, settings, port, seed.SELLER, pid, _draft(brand_id=None))
    assert missing_brand is not None
    assert missing_brand.push_wait == NEED_BRAND
    assert BARCODE not in port.products


async def test_push_names_a_missing_required_attribute(db, db_settings) -> None:
    settings = _settings(db_settings)
    pid = await _shop_and_product(db)
    port = MemoryTrendyol(required={"11": (RequiredAttribute("5", "Colour", (("9", "Black"),)),)})
    await _connect(db, settings, port)
    waiting = await push(db, settings, port, seed.SELLER, pid, _draft())
    assert waiting is not None
    assert waiting.push_wait == "This product needs Colour."
    sent = await push(
        db,
        settings,
        port,
        seed.SELLER,
        pid,
        _draft(
            attributes=(
                AttributeValue("5", "9"),
                AttributeValue("8", custom="optional"),
            )
        ),
    )
    assert sent is not None
    assert sent.push_wait is None
    assert port.product(BARCODE).attributes == (AttributeValue("5", "9", None),)


async def test_push_waits_for_listing_copy_barcode_sku_and_prices(db, db_settings) -> None:
    settings = _settings(db_settings)
    port = MemoryTrendyol()
    await seed.shop(db)
    await _connect(db, settings, port)

    no_copy = await seed.product(db, barcode=BARCODE, sku=SKU, listed=False)
    assert (await push(db, settings, port, seed.SELLER, no_copy, _draft())).push_wait == NEED_COPY

    no_barcode = await seed.product(db, barcode=None, sku=SKU)
    assert (
        await push(db, settings, port, seed.SELLER, no_barcode, _draft())
    ).push_wait == NEED_BARCODE

    no_sku = await seed.product(db, barcode=BARCODE, sku=None)
    assert (await push(db, settings, port, seed.SELLER, no_sku, _draft())).push_wait == NEED_SKU

    no_sale = await seed.product(db, barcode="8690000000028", sku="TEE-2", price=Decimal("24.00"))
    assert (
        await push(db, settings, port, seed.SELLER, no_sale, _draft(sale_price=None))
    ).push_wait == NEED_SALE
    assert (
        await push(db, settings, port, seed.SELLER, no_sale, _draft(sale_price=Decimal("0")))
    ).push_wait == NEED_SALE
    assert (
        await push(db, settings, port, seed.SELLER, no_sale, _draft(list_price=None))
    ).push_wait == NEED_LIST
    remembered = await read_product(db, seed.SELLER, no_sale)
    assert remembered is not None
    assert remembered.list_price is None
    assert remembered.sale_price == "19.00"
    assert (
        await push(db, settings, port, seed.SELLER, no_sale, _draft(list_price=Decimal("10.00")))
    ).push_wait == LIST_BELOW
    assert "8690000000028" not in port.products


async def test_push_waits_until_the_title_and_description_exist(db, db_settings) -> None:
    settings = _settings(db_settings)
    await seed.shop(db)
    port = MemoryTrendyol()
    await _connect(db, settings, port)
    tags_only = await seed.product(
        db, barcode="8690000000042", sku="TEE-4", listed=False, tags=["tee"]
    )
    titled = await push(db, settings, port, seed.SELLER, tags_only, _draft())
    assert titled is not None
    assert titled.push_wait == NEED_TITLE
    await store.update_image(db, tags_only, {"title": "Cotton tee"}, seed.SELLER)
    described = await push(db, settings, port, seed.SELLER, tags_only, _draft())
    assert described is not None
    assert described.push_wait == NEED_DESCRIPTION


async def test_the_first_accepted_push_stores_quantity_and_the_model_code(db, db_settings) -> None:
    settings = _settings(db_settings)
    pid = await _shop_and_product(db)
    port = MemoryTrendyol()
    await _connect(db, settings, port)
    db.add(
        InventoryItem(
            user_id=seed.SELLER,
            title="Tee",
            sku=SKU,
            ledger_quantity=4,
            kind="standalone",
            safety_buffer=0,
        )
    )
    await db.flush()
    sent = await push(db, settings, port, seed.SELLER, pid, _draft())
    assert sent is not None
    assert sent.approval == "waiting"
    assert sent.push_wait is None
    assert port.product(BARCODE).quantity == 4
    assert port.product(BARCODE).model_code == SKU
    assert port.product(BARCODE).title == "Cotton tee"
    assert port.product(BARCODE).description == "<p>Old.</p>"
    loaded = await product_module.load(db, seed.SELLER, pid)
    assert loaded is not None
    assert loaded.photo.price == Decimal("24.00")
    assert loaded.photo.shopify_product_id is None
    assert await seed.spends(db) == []


async def test_a_missing_inventory_quantity_is_sent_as_zero(db, db_settings) -> None:
    settings = _settings(db_settings)
    pid = await _shop_and_product(db)
    port = MemoryTrendyol()
    await _connect(db, settings, port)
    await push(db, settings, port, seed.SELLER, pid, _draft())
    assert port.product(BARCODE).quantity == 0


async def test_a_zero_inventory_quantity_is_sent_as_zero(db, db_settings) -> None:
    settings = _settings(db_settings)
    pid = await _shop_and_product(db)
    port = MemoryTrendyol()
    await _connect(db, settings, port)
    db.add(
        InventoryItem(
            user_id=seed.SELLER,
            title="Tee",
            sku=SKU,
            ledger_quantity=0,
            kind="standalone",
            safety_buffer=0,
        )
    )
    await db.flush()
    await push(db, settings, port, seed.SELLER, pid, _draft())
    assert port.product(BARCODE).quantity == 0


async def test_a_refused_batch_does_not_fix_quantity_or_the_model_code(db, db_settings) -> None:
    settings = _settings(db_settings)
    pid = await _shop_and_product(db)
    port = MemoryTrendyol()
    port.refuse_reason = "Dimensional weight is required."
    await _connect(db, settings, port)
    db.add(
        InventoryItem(
            user_id=seed.SELLER,
            title="Tee",
            sku=SKU,
            ledger_quantity=4,
            kind="standalone",
            safety_buffer=0,
        )
    )
    await db.flush()
    refused = await push(db, settings, port, seed.SELLER, pid, _draft())
    assert refused is not None
    assert refused.reason == "Dimensional weight is required."
    assert refused.approval is None
    assert BARCODE not in port.products
    accepted = await push(db, settings, port, seed.SELLER, pid, _draft())
    assert accepted is not None
    assert accepted.approval == "waiting"
    assert port.product(BARCODE).quantity == 4
    assert port.product(BARCODE).model_code == SKU


async def test_a_later_push_updates_the_listing_and_leaves_quantity_and_model_code(
    db, db_settings
) -> None:
    settings = _settings(db_settings)
    pid = await _shop_and_product(db)
    port = MemoryTrendyol()
    await _connect(db, settings, port)
    db.add(
        InventoryItem(
            user_id=seed.SELLER,
            title="Tee",
            sku=SKU,
            ledger_quantity=4,
            kind="standalone",
            safety_buffer=0,
        )
    )
    await db.flush()
    await push(db, settings, port, seed.SELLER, pid, _draft())
    await store.update_image(
        db,
        pid,
        {
            "description": "<p>New.</p>",
            "sku": "TEE-2",
            "storage_url": "https://cdn.example/replaced.jpg",
        },
        seed.SELLER,
    )
    db.add(
        InventoryItem(
            user_id=seed.SELLER,
            title="Tee",
            sku="TEE-2",
            ledger_quantity=9,
            kind="standalone",
            safety_buffer=0,
        )
    )
    await db.flush()
    again = await push(
        db,
        settings,
        port,
        seed.SELLER,
        pid,
        _draft(sale_price=Decimal("21.00"), list_price=Decimal("30.00")),
    )
    assert again is not None
    assert again.approval == "waiting"
    held = port.product(BARCODE)
    assert held.description == "<p>New.</p>"
    assert held.sale_price == Decimal("21.00")
    assert held.list_price == Decimal("30.00")
    assert held.images == ("https://cdn.example/replaced.jpg",)
    assert held.stock_code == "TEE-2"
    assert held.quantity == 4
    assert held.model_code == SKU


async def test_photos_go_in_the_products_order(db, db_settings) -> None:
    settings = _settings(db_settings)
    await seed.shop(db)
    front = await seed.product(
        db,
        barcode=BARCODE,
        sku=SKU,
        product_group_id="tee",
        storage_url="https://cdn.example/front.jpg",
    )
    back = await seed.product(
        db,
        product_group_id="tee",
        listed=False,
        storage_url="https://cdn.example/back.jpg",
    )
    await store.update_image(db, front, {"media_gallery": [str(back), str(front)]}, seed.SELLER)
    port = MemoryTrendyol()
    await _connect(db, settings, port)
    await push(db, settings, port, seed.SELLER, front, _draft())
    assert port.product(BARCODE).images == (
        "https://cdn.example/back.jpg",
        "https://cdn.example/front.jpg",
    )


async def test_a_new_barcode_is_a_second_product_and_the_old_one_stays(db, db_settings) -> None:
    settings = _settings(db_settings)
    pid = await _shop_and_product(db)
    port = MemoryTrendyol()
    await _connect(db, settings, port)
    db.add(
        InventoryItem(
            user_id=seed.SELLER,
            title="Tee",
            sku=SKU,
            ledger_quantity=4,
            kind="standalone",
            safety_buffer=0,
        )
    )
    await db.flush()
    await push(db, settings, port, seed.SELLER, pid, _draft())
    await store.update_image(db, pid, {"barcode": "8690000000099", "sku": "TEE-9"}, seed.SELLER)
    db.add(
        InventoryItem(
            user_id=seed.SELLER,
            title="Tee",
            sku="TEE-9",
            ledger_quantity=2,
            kind="standalone",
            safety_buffer=0,
        )
    )
    await db.flush()
    await push(db, settings, port, seed.SELLER, pid, _draft())
    assert port.product(BARCODE).quantity == 4
    assert port.product(BARCODE).model_code == SKU
    assert port.product("8690000000099").quantity == 2
    assert port.product("8690000000099").model_code == "TEE-9"


async def test_opening_the_product_shows_waiting_approved_or_rejected(db, db_settings) -> None:
    settings = _settings(db_settings)
    pid = await _shop_and_product(db)
    port = MemoryTrendyol()
    await _connect(db, settings, port)
    await push(db, settings, port, seed.SELLER, pid, _draft())
    waiting = await open_product(db, settings, port, seed.SELLER, pid)
    assert waiting is not None
    assert waiting.approval == "waiting"
    port.decide(BARCODE, "approved")
    approved = await open_product(db, settings, port, seed.SELLER, pid)
    assert approved is not None
    assert approved.approval == "approved"
    assert approved.reason is None
    port.decide(BARCODE, "rejected", "Image is blurry")
    rejected = await open_product(db, settings, port, seed.SELLER, pid)
    assert rejected is not None
    assert rejected.approval == "rejected"
    assert rejected.reason == "Image is blurry"


async def test_a_later_push_after_rejection_leaves_quantity(db, db_settings) -> None:
    settings = _settings(db_settings)
    pid = await _shop_and_product(db)
    port = MemoryTrendyol()
    await _connect(db, settings, port)
    db.add(
        InventoryItem(
            user_id=seed.SELLER,
            title="Tee",
            sku=SKU,
            ledger_quantity=4,
            kind="standalone",
            safety_buffer=0,
        )
    )
    await db.flush()
    await push(db, settings, port, seed.SELLER, pid, _draft())
    port.decide(BARCODE, "rejected", "Image is blurry")
    await store.update_image(db, pid, {"description": "<p>Fixed.</p>"}, seed.SELLER)
    again = await push(db, settings, port, seed.SELLER, pid, _draft())
    assert again is not None
    assert again.approval == "waiting"
    assert port.product(BARCODE).quantity == 4
    assert port.product(BARCODE).description == "<p>Fixed.</p>"
    assert port.product(BARCODE).model_code == SKU


async def test_the_catalogue_read_does_not_ask_trendyol(db, db_settings) -> None:
    settings = _settings(db_settings)
    pid = await _shop_and_product(db)
    port = MemoryTrendyol()
    await _connect(db, settings, port)
    await push(db, settings, port, seed.SELLER, pid, _draft())
    port.decide(BARCODE, "approved")
    await store.list_images(db, seed.SELLER)
    remembered = await read_product(db, seed.SELLER, pid)
    assert remembered is not None
    assert remembered.approval == "waiting"
    opened = await open_product(db, settings, port, seed.SELLER, pid)
    assert opened is not None
    assert opened.approval == "approved"


async def test_stale_or_unconfirmed_listing_copy_can_still_be_pushed(db, db_settings) -> None:
    settings = _settings(db_settings)
    stale = await _shop_and_product(db, facts=seed.confirmed_facts(stale=True))
    typed = await seed.product(
        db,
        barcode="8690000000035",
        sku="TEE-3",
        facts=None,
        storage_url="https://cdn.example/typed.jpg",
    )
    port = MemoryTrendyol()
    await _connect(db, settings, port)
    stale_push = await push(db, settings, port, seed.SELLER, stale, _draft())
    assert stale_push is not None
    assert stale_push.push_wait is None
    loaded = await product_module.load(db, seed.SELLER, stale)
    assert loaded is not None
    assert loaded.facts.listing_copy_stale is True
    typed_push = await push(db, settings, port, seed.SELLER, typed, _draft())
    assert typed_push is not None
    assert typed_push.approval == "waiting"
    assert port.product("8690000000035").model_code == "TEE-3"


async def test_saving_the_listing_does_not_change_selling(db, db_settings) -> None:
    settings = _settings(db_settings)
    pid = await _shop_and_product(db, facts=seed.confirmed_facts(stale=True))
    port = MemoryTrendyol()
    await _connect(db, settings, port)
    await push(db, settings, port, seed.SELLER, pid, _draft(sale_price=Decimal("40.00")))
    loaded = await product_module.load(db, seed.SELLER, pid)
    assert loaded is not None
    assert loaded.photo.price == Decimal("24.00")
    assert loaded.photo.barcode == BARCODE
    assert loaded.facts.listing_copy_stale is True
    assert loaded.photo.category is None
