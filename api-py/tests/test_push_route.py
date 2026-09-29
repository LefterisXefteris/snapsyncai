"""The Push route: body, connection, ownership, and each Push outcome as HTTP."""

from decimal import Decimal

from app.services import images as store
from tests import seed
from tests.shopify_shop import ONLINE_STORE, ShopifyShop

PUBLICATION_SCOPES = ["read_publications", "write_publications"]
STOREFRONT = {"productStatus": "ACTIVE", "publicationIds": [ONLINE_STORE]}


async def _product(db, **values) -> int:
    await seed.shop(db, granted_scopes=PUBLICATION_SCOPES)
    return await seed.product(db, **{"price": Decimal("24.00"), **values})


async def test_a_push_answers_the_results(db, push_route) -> None:
    pid = await _product(db)
    shop = ShopifyShop()
    response = await push_route(shop, {"ids": [pid], **STOREFRONT})
    assert response.status_code == 200
    assert response.json() == {
        "success": 1,
        "failed": 0,
        "results": [{"id": pid, "shopifyProductId": shop.only_product().id, "error": None}],
        "stockNotSet": True,
    }


async def test_missing_listing_copy_is_402_with_the_count(db, push_route) -> None:
    first = await _product(db, listed=False)
    second = await seed.product(db, listed=False)
    response = await push_route(ShopifyShop(), {"ids": [first, second]})
    assert response.status_code == 402
    assert response.json() == {
        "message": "2 product(s) still need listing copy.",
        "missingCopyCount": 2,
    }


async def test_missing_price_is_400(db, push_route) -> None:
    pid = await _product(db, price=None)
    response = await push_route(ShopifyShop(), {"ids": [pid], **STOREFRONT})
    assert response.status_code == 400
    assert response.json() == {"message": "This product needs a price greater than zero."}


async def test_a_failed_publications_lookup_asks_to_reconnect_with_400(db, push_route) -> None:
    async def unreachable(query, variables=None):
        raise RuntimeError("Shopify said no")

    pid = await _product(db)
    response = await push_route(unreachable, {"ids": [pid], **STOREFRONT})
    assert response.status_code == 400
    assert response.json() == {
        "message": "Reconnect Shopify in Settings to choose where this product is available."
    }


async def test_no_ids_is_400(db, push_route) -> None:
    response = await push_route(ShopifyShop(), {"ids": []})
    assert response.status_code == 400
    assert response.json() == {"detail": "No image IDs provided"}


async def test_no_connection_is_400(db, push_route) -> None:
    pid = await seed.product(db)
    response = await push_route(ShopifyShop(), {"ids": [pid]})
    assert response.status_code == 400
    assert response.json() == {"detail": "Shopify not connected. Please connect your store first."}


async def test_another_sellers_products_are_not_pushed(db, push_route) -> None:
    await seed.shop(db, granted_scopes=PUBLICATION_SCOPES)
    theirs = await seed.product(db, owner=seed.OTHER_SELLER)
    shop = ShopifyShop()
    response = await push_route(shop, {"ids": [theirs]})
    assert response.status_code == 400
    assert response.json() == {"detail": "No images found for given IDs"}
    mine = await seed.product(db)
    response = await push_route(shop, {"ids": [mine, theirs]})
    assert response.status_code == 200
    assert [result["id"] for result in response.json()["results"]] == [mine]
    assert len(shop.products) == 1


async def test_a_database_connection_limit_is_503(db, push_route, monkeypatch) -> None:
    async def full(_session, _user_id):
        raise RuntimeError("EMAXCONN max client connections reached")

    pid = await _product(db)
    monkeypatch.setattr(store, "list_images", full)
    response = await push_route(ShopifyShop(), {"ids": [pid]})
    assert response.status_code == 503
    assert response.json() == {
        "message": (
            "The database is still clearing old connections. "
            "Please wait 1-2 minutes and try pushing to Shopify again."
        ),
        "code": "DATABASE_CONNECTION_LIMIT",
    }


async def test_any_other_error_is_500_with_its_message(db, push_route, monkeypatch) -> None:
    async def broken(_session, _user_id):
        raise RuntimeError("boom")

    pid = await _product(db)
    monkeypatch.setattr(store, "list_images", broken)
    response = await push_route(ShopifyShop(), {"ids": [pid]})
    assert response.status_code == 500
    assert response.json() == {"detail": "boom"}
