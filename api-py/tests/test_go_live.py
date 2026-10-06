"""Go live (ADR 0023) through the Push module, on `db`, against the in-memory shop."""

from decimal import Decimal

from sqlalchemy import select

from app.models.inventory import (
    InventoryChannelLink,
    InventoryItem,
    InventoryOutboxJob,
    InventorySettings,
)
from app.services import images as store
from tests import seed
from tests.seed import SELLER
from tests.shopify_shop import (
    ONLINE_STORE,
    POINT_OF_SALE,
    SHOP_FLOOR,
    WAREHOUSE,
    ShopifyShop,
)

PRICE_REQUIRED = "This product needs a price greater than zero."
PUBLICATION_SCOPES = ["read_publications", "write_publications"]
STOREFRONT = {"product_status": "ACTIVE", "publication_ids": [ONLINE_STORE]}


async def _product(db, **values) -> int:
    await seed.shop(db, granted_scopes=PUBLICATION_SCOPES)
    return await seed.product(db, **{"title": "Merino crew", "price": Decimal("24.00"), **values})


def _warehouse() -> ShopifyShop:
    return ShopifyShop(locations={WAREHOUSE: "Warehouse"})


async def _inventory_on(db, location_id: str) -> None:
    db.add(
        InventorySettings(
            user_id=SELLER,
            shop_domain="tees.myshopify.com",
            location_id=location_id,
            location_name="Inventory",
            enabled=True,
        )
    )
    await db.flush()


async def _link(db, user_id: str, product_id: str, inventory_item_gid: str) -> int:
    item = InventoryItem(user_id=user_id, title="Tee", state="active", ledger_quantity=4)
    db.add(item)
    await db.flush()
    db.add(
        InventoryChannelLink(
            user_id=user_id,
            inventory_item_id=item.id,
            external_product_id=product_id,
            external_variant_id=f"gid://shopify/ProductVariant/{item.id}",
            external_inventory_item_id=inventory_item_gid,
            external_location_id=WAREHOUSE,
            sync_state="synced",
        )
    )
    await db.flush()
    return item.id


async def _links(db, user_id: str) -> dict[str, str]:
    rows = await db.execute(
        select(InventoryChannelLink).where(InventoryChannelLink.user_id == user_id)
    )
    return {link.external_product_id: link.external_inventory_item_id for link in rows.scalars()}


async def test_storefront_write_with_listing_copy_and_a_price_is_active_on_the_online_store(
    db, push
) -> None:
    pid = await _product(db, price=Decimal("24.00"))
    shop = ShopifyShop()
    pushed = await push(
        shop, [pid], product_status="ACTIVE", publication_ids=[ONLINE_STORE, POINT_OF_SALE]
    )
    assert pushed.refused is None
    assert pushed.success == 1
    product = shop.only_product()
    assert product.status == "ACTIVE"
    assert product.publications == {ONLINE_STORE, POINT_OF_SALE}
    row = await store.get_image(db, pid, SELLER)
    assert row.shopify_product_id == product.id
    assert row.shopify_status == "synced"
    assert row.shopify_product_status == "ACTIVE"


async def test_storefront_write_without_a_price_names_the_price_and_is_not_an_allowance_refusal(
    db, push
) -> None:
    pid = await _product(db, price=None)
    shop = ShopifyShop()
    pushed = await push(shop, [pid], **STOREFRONT)
    assert pushed.refused == "missing_price"
    assert pushed.message == PRICE_REQUIRED
    assert "plan" not in pushed.message.lower()
    assert "allowance" not in pushed.message.lower()
    assert "overflow" not in pushed.message.lower()
    assert shop.products == {}
    assert (await store.get_image(db, pid, SELLER)).shopify_product_id is None


async def test_storefront_write_with_a_zero_price_names_the_price(db, push) -> None:
    pid = await _product(db, price=Decimal("0.00"))
    shop = ShopifyShop()
    pushed = await push(
        shop, [pid], product_status="ACTIVE", publication_ids=[POINT_OF_SALE, ONLINE_STORE]
    )
    assert pushed.refused == "missing_price"
    assert pushed.message == PRICE_REQUIRED
    assert shop.products == {}


async def test_draft_write_with_listing_copy_and_no_price_is_allowed(db, push) -> None:
    pid = await _product(db, price=None)
    shop = ShopifyShop()
    pushed = await push(shop, [pid], product_status="DRAFT", publication_ids=[])
    assert pushed.refused is None
    assert pushed.success == 1
    assert shop.only_product().status == "DRAFT"


async def test_active_write_without_online_store_needs_only_listing_copy(db, push) -> None:
    pid = await _product(db, price=None)
    shop = ShopifyShop()
    pushed = await push(shop, [pid], product_status="ACTIVE", publication_ids=[POINT_OF_SALE])
    assert pushed.refused is None
    assert pushed.success == 1
    product = shop.only_product()
    assert product.status == "ACTIVE"
    assert product.publications == {POINT_OF_SALE}


async def test_storefront_write_without_listing_copy_names_listing_copy_not_a_plan(
    db, push
) -> None:
    pid = await _product(db, listed=False, title=None)
    shop = ShopifyShop()
    pushed = await push(shop, [pid], **STOREFRONT)
    assert pushed.refused == "missing_copy"
    assert pushed.missing_copy_count == 1
    assert "listing copy" in pushed.message.lower()
    assert "plan" not in pushed.message.lower()
    assert "allowance" not in pushed.message.lower()
    assert shop.products == {}


async def test_another_shopify_error_keeps_the_stored_product(db, push) -> None:
    """A refusal other than a missing product leaves the stored id and creates nothing."""
    shop = ShopifyShop()
    existing = shop.add_product(status="DRAFT")
    pid = await _product(db, shopify_product_id=existing.id, shopify_product_status="DRAFT")
    shop.fail_next_product_set = "Title is too long"
    pushed = await push(shop, [pid], **STOREFRONT)
    assert pushed.success == 0
    assert pushed.failed == 1
    assert pushed.results[0].error == "Title is too long"
    assert list(shop.products) == [existing.id]
    assert existing.status == "DRAFT"
    row = await store.get_image(db, pid, SELLER)
    assert row.shopify_product_id == existing.id
    assert row.shopify_status == "failed"
    assert row.shopify_product_status == "DRAFT"
    assert row.shopify_publication_ids is None


async def test_a_failed_replacement_keeps_the_stored_product(db, push) -> None:
    """The deleted product stays linked when the new create itself is refused."""
    gone = "gid://shopify/Product/404"
    pid = await _product(db, shopify_product_id=gone)
    shop = ShopifyShop()
    shop.fail_next_create = "Title is too long"
    pushed = await push(shop, [pid], **STOREFRONT)
    assert pushed.success == 0
    assert pushed.failed == 1
    assert pushed.results[0].error == "Title is too long"
    assert shop.products == {}
    row = await store.get_image(db, pid, SELLER)
    assert row.shopify_product_id == gone
    assert row.shopify_status == "failed"


async def test_a_deleted_shopify_product_is_created_again_by_the_same_push(db, push) -> None:
    """A deleted Shopify product is created again. The catalogue product stays."""
    gone = "gid://shopify/Product/404"
    pid = await _product(db, shopify_product_id=gone, product_group_id="tee")
    back = await seed.product(db, shopify_product_id=gone, product_group_id="tee", listed=False)
    shop = ShopifyShop()
    pushed = await push(shop, [pid], **STOREFRONT)
    assert pushed.refused is None
    assert pushed.success == 1
    assert pushed.failed == 0
    product = shop.only_product()
    assert product.id != gone
    assert product.status == "ACTIVE"
    assert product.publications == {ONLINE_STORE}
    for image_id in (pid, back):
        row = await store.get_image(db, image_id, SELLER)
        assert row.shopify_product_id == product.id
        assert row.shopify_status == "synced"
        assert row.shopify_product_status == "ACTIVE"
        assert row.shopify_publication_ids == [ONLINE_STORE]


async def test_replacing_a_deleted_shopify_product_drops_its_inventory_links(
    db, db_settings, push
) -> None:
    """Links to the deleted Shopify product go. A different product, and another seller, stay."""
    gone = "gid://shopify/Product/404"
    kept = "gid://shopify/Product/9"
    await _inventory_on(db, WAREHOUSE)
    pid = await _product(db, shopify_product_id=gone, inventory_quantity=4, track_quantity="true")
    old = await _link(db, SELLER, gone, "gid://shopify/InventoryItem/901")
    await _link(db, SELLER, kept, "gid://shopify/InventoryItem/902")
    await _link(db, seed.OTHER_SELLER, gone, "gid://shopify/InventoryItem/903")
    shop = _warehouse()
    pushed = await push(
        shop,
        [pid],
        **STOREFRONT,
        settings=db_settings.model_copy(update={"inventory_autopilot_enabled": True}),
    )
    assert pushed.success == 1
    product = shop.only_product()
    db.expire_all()
    seller_links = await _links(db, SELLER)
    assert gone not in seller_links
    assert seller_links[kept] == "gid://shopify/InventoryItem/902"
    assert seller_links[product.id]
    assert (await _links(db, seed.OTHER_SELLER))[gone] == "gid://shopify/InventoryItem/903"
    item = await db.get(InventoryItem, old)
    assert item is not None
    assert item.state == "archived"


async def test_catalogue_bulk_push_of_a_draft_does_not_ask_for_a_price(db, push) -> None:
    """Catalogue bulk Push sends ids only. A stored Draft is not a storefront write."""
    pid = await _product(db, price=None, shopify_product_status="DRAFT", shopify_publication_ids=[])
    shop = ShopifyShop()
    pushed = await push(shop, [pid])
    assert pushed.refused is None
    assert pushed.success == 1
    assert shop.only_product().status == "DRAFT"


async def test_first_storefront_write_sets_available_stock_to_the_page_quantity(db, push) -> None:
    pid = await _product(db, inventory_quantity=4, track_quantity="true")
    shop = _warehouse()
    pushed = await push(shop, [pid], **STOREFRONT)
    assert pushed.success == 1
    assert pushed.stock_not_set is False
    assert shop.stock(shop.only_product()) == {WAREHOUSE: 4}


async def test_landing_again_after_leaving_the_online_store_sets_available_stock(
    db, push
) -> None:
    shop = _warehouse()
    left = shop.add_product(status="DRAFT")
    pid = await _product(
        db, shopify_product_id=left.id, inventory_quantity=6, track_quantity="true"
    )
    pushed = await push(shop, [pid], **STOREFRONT)
    assert pushed.success == 1
    assert pushed.stock_not_set is False
    assert left.status == "ACTIVE"
    assert left.publications == {ONLINE_STORE}
    assert shop.stock(left) == {WAREHOUSE: 6}


async def test_first_storefront_write_sets_available_stock_of_zero(db, push) -> None:
    pid = await _product(db, inventory_quantity=0, track_quantity="true")
    shop = _warehouse()
    pushed = await push(shop, [pid], **STOREFRONT)
    assert pushed.success == 1
    assert pushed.stock_not_set is False
    assert shop.stock(shop.only_product()) == {WAREHOUSE: 0}


async def test_available_stock_is_written_at_the_inventory_location(db, push) -> None:
    await _inventory_on(db, WAREHOUSE)
    pid = await _product(db, inventory_quantity=4, track_quantity="true")
    shop = ShopifyShop(locations={SHOP_FLOOR: "Shop floor", WAREHOUSE: "Warehouse"})
    pushed = await push(shop, [pid], **STOREFRONT)
    assert pushed.success == 1
    assert pushed.stock_not_set is False
    assert shop.stock(shop.only_product()) == {WAREHOUSE: 4}


async def test_available_stock_uses_the_first_active_location_when_several_exist(
    db, push
) -> None:
    pid = await _product(db, inventory_quantity=4, track_quantity="true")
    shop = ShopifyShop(locations={WAREHOUSE: "Warehouse", SHOP_FLOOR: "Shop floor"})
    pushed = await push(shop, [pid], **STOREFRONT)
    assert pushed.success == 1
    assert shop.stock(shop.only_product()) == {WAREHOUSE: 4}


async def test_tracking_off_does_not_set_a_quantity(db, push) -> None:
    pid = await _product(db, inventory_quantity=4, track_quantity="false")
    shop = _warehouse()
    pushed = await push(shop, [pid], **STOREFRONT)
    assert pushed.success == 1
    assert pushed.stock_not_set is False
    assert shop.available == {}


async def test_draft_write_does_not_set_stock(db, push) -> None:
    pid = await _product(db, inventory_quantity=4, track_quantity="true")
    shop = _warehouse()
    pushed = await push(shop, [pid], product_status="DRAFT", publication_ids=[])
    assert pushed.success == 1
    assert pushed.stock_not_set is False
    assert shop.available == {}


async def test_later_sync_of_a_product_on_the_online_store_does_not_change_stock(
    db, push
) -> None:
    shop = _warehouse()
    live = shop.add_product(status="ACTIVE", publications={ONLINE_STORE})
    shop.available[(live.variants[0].inventory_item, WAREHOUSE)] = 9
    pid = await _product(
        db,
        shopify_product_id=live.id,
        inventory_quantity=4,
        track_quantity="true",
        shopify_product_status="ACTIVE",
        shopify_publication_ids=[ONLINE_STORE],
    )
    pushed = await push(shop, [pid], **STOREFRONT)
    assert pushed.success == 1
    assert pushed.stock_not_set is False
    assert shop.stock(live) == {WAREHOUSE: 9}


async def test_several_variants_stay_on_the_online_store_and_stock_is_not_set(db, push) -> None:
    pid = await _product(
        db,
        inventory_quantity=4,
        track_quantity="true",
        variants=[{"name": "Size", "values": ["S", "M"]}],
    )
    shop = _warehouse()
    pushed = await push(shop, [pid], **STOREFRONT)
    assert pushed.success == 1
    assert pushed.stock_not_set is True
    product = shop.only_product()
    assert len(product.variants) == 2
    assert product.status == "ACTIVE"
    assert ONLINE_STORE in product.publications
    assert shop.available == {}
    row = await store.get_image(db, pid, SELLER)
    assert row.shopify_product_status == "ACTIVE"
    assert ONLINE_STORE in row.shopify_publication_ids


async def test_no_active_location_stays_on_the_online_store_and_stock_is_not_set(
    db, push
) -> None:
    pid = await _product(db, inventory_quantity=4, track_quantity="true")
    shop = ShopifyShop(locations={})
    pushed = await push(shop, [pid], **STOREFRONT)
    assert pushed.success == 1
    assert pushed.stock_not_set is True
    assert shop.available == {}
    assert shop.only_product().status == "ACTIVE"
    assert (await store.get_image(db, pid, SELLER)).shopify_product_status == "ACTIVE"


async def test_a_failed_stock_write_stays_on_the_online_store(db, push) -> None:
    """The Inventory location is no longer in the shop, so Shopify refuses the stock write."""
    await _inventory_on(db, "gid://shopify/Location/404")
    pid = await _product(db, inventory_quantity=4, track_quantity="true")
    shop = _warehouse()
    pushed = await push(shop, [pid], **STOREFRONT)
    assert pushed.success == 1
    assert pushed.stock_not_set is True
    assert shop.available == {}
    product = shop.only_product()
    assert product.status == "ACTIVE"
    assert product.publications == {ONLINE_STORE}
    row = await store.get_image(db, pid, SELLER)
    assert row.shopify_status == "synced"
    assert row.shopify_product_status == "ACTIVE"


async def test_a_product_already_on_the_online_store_is_not_backfilled(db, push) -> None:
    shop = _warehouse()
    live = shop.add_product(status="ACTIVE", publications={ONLINE_STORE})
    pid = await _product(
        db,
        shopify_product_id=live.id,
        inventory_quantity=4,
        track_quantity="true",
        shopify_product_status="ACTIVE",
        shopify_publication_ids=[ONLINE_STORE],
    )
    pushed = await push(shop, [pid])
    assert pushed.success == 1
    assert pushed.stock_not_set is False
    assert shop.available == {}


async def test_when_inventory_is_on_the_ledger_starts_at_the_page_quantity(
    db, db_settings, push
) -> None:
    await _inventory_on(db, WAREHOUSE)
    pid = await _product(db, inventory_quantity=4, track_quantity="true")
    shop = ShopifyShop(locations={SHOP_FLOOR: "Shop floor", WAREHOUSE: "Warehouse"})
    pushed = await push(
        shop,
        [pid],
        **STOREFRONT,
        settings=db_settings.model_copy(update={"inventory_autopilot_enabled": True}),
    )
    assert pushed.success == 1
    assert shop.stock(shop.only_product()) == {WAREHOUSE: 4}
    items = await db.execute(select(InventoryItem).where(InventoryItem.user_id == SELLER))
    assert [item.ledger_quantity for item in items.scalars()] == [4]
    jobs = await db.execute(select(InventoryOutboxJob).where(InventoryOutboxJob.user_id == SELLER))
    assert jobs.scalars().all() == []
