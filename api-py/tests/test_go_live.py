"""Go live — the Push route refuses a storefront write without a price greater than zero."""

from decimal import Decimal

from fastapi.testclient import TestClient

from app.auth.clerk import DEV_USER_ID
from app.config import get_settings
from app.db import get_session
from app.main import create_app
from app.models.image import Image
from app.services import shopify as shopify_svc

ONLINE_STORE = "gid://shopify/Publication/1"
POINT_OF_SALE = "gid://shopify/Publication/2"
PRICE_REQUIRED = "This product needs a price greater than zero."


def _client(monkeypatch) -> TestClient:
    monkeypatch.setenv("DATABASE_URL", "postgresql://u:p@localhost:5432/db")
    monkeypatch.setenv("CLERK_SECRET_KEY", "sk_test_fake")
    monkeypatch.setenv("DEV_BYPASS_AUTH", "true")
    get_settings.cache_clear()
    app = create_app()

    async def _no_db():
        yield None

    app.dependency_overrides[get_session] = _no_db
    return TestClient(app, raise_server_exceptions=False)


def _connection():
    from app.models import ShopifyConnection

    return ShopifyConnection(
        session_id=DEV_USER_ID,
        shop_domain="demo.myshopify.com",
        access_token="shpat_test",
        granted_scopes=["read_publications", "write_publications"],
    )


def _product(**fields) -> Image:
    values = {
        "id": 14,
        "original_name": "tee.jpg",
        "mime_type": "image/jpeg",
        "size": 1,
        "session_id": DEV_USER_ID,
        "title": "Merino crew",
        "price": Decimal("24.00"),
        "shopify_product_status": "DRAFT",
        "shopify_publication_ids": [],
    }
    values.update(fields)
    return Image(**values)


def _install(monkeypatch, product: Image, calls: list, updates: list) -> None:
    from app.services import connections
    from app.services import images as store

    async def ready(_session, _user_id):
        return _connection()

    async def get_images(_session, ids, user_id):
        if product.id in ids and product.session_id == user_id:
            return [product]
        return []

    async def list_images(_session, user_id):
        return [product] if product.session_id == user_id else []

    async def update_image(_session, _image_id, payload, _user_id):
        updates.append(payload)
        return product

    async def fake_graphql(_connection, _settings, query, variables=None):
        calls.append((query, variables or {}))
        if "SnapSyncPublications" in query:
            return {
                "publications": {
                    "nodes": [
                        {"id": ONLINE_STORE, "catalog": {"title": "Online Store"}},
                        {"id": POINT_OF_SALE, "catalog": {"title": "Point of Sale"}},
                    ]
                }
            }
        if "CreateSnapSyncProduct" in query:
            return {
                "productSet": {
                    "product": {
                        "id": "gid://shopify/Product/9",
                        "variants": {"nodes": [{"id": "gid://shopify/ProductVariant/1"}]},
                    },
                    "userErrors": [],
                }
            }
        if "SnapSyncProductPublishing" in query:
            return {"product": {"status": "DRAFT", "resourcePublicationsV2": {"nodes": []}}}
        if "SnapSyncPublish" in query:
            return {"publishablePublish": {"userErrors": []}}
        if "SnapSyncUnpublish" in query:
            return {"publishableUnpublish": {"userErrors": []}}
        raise AssertionError(query)

    monkeypatch.setattr(connections, "get_shopify", ready)
    monkeypatch.setattr(store, "get_images_by_ids", get_images)
    monkeypatch.setattr(store, "list_images", list_images)
    monkeypatch.setattr(store, "update_image", update_image)
    monkeypatch.setattr(shopify_svc, "shopify_graphql", fake_graphql)


def _push(monkeypatch, product: Image) -> tuple[TestClient, list, list]:
    calls: list = []
    updates: list = []
    _install(monkeypatch, product, calls, updates)
    return _client(monkeypatch), calls, updates


def test_storefront_write_with_listing_copy_and_a_price_is_active_on_the_online_store(
    monkeypatch,
) -> None:
    client, calls, updates = _push(
        monkeypatch,
        _product(price=Decimal("24.00")),
    )
    try:
        response = client.post(
            "/api/images/push-to-shopify",
            json={
                "ids": [14],
                "productStatus": "ACTIVE",
                "publicationIds": [ONLINE_STORE, POINT_OF_SALE],
            },
        )
        assert response.status_code == 200
        assert response.json()["success"] == 1
        product_set = next(
            variables for query, variables in calls if "CreateSnapSyncProduct" in query
        )
        publish = next(variables for query, variables in calls if "SnapSyncPublish" in query)
        assert product_set["productSet"]["status"] == "ACTIVE"
        assert {"publicationId": ONLINE_STORE} in publish["input"]
        assert {"publicationId": POINT_OF_SALE} in publish["input"]
        assert updates[-1]["shopify_status"] == "synced"
        assert updates[-1]["shopify_product_status"] == "ACTIVE"
    finally:
        get_settings.cache_clear()


def test_storefront_write_without_a_price_names_the_price_and_is_not_an_allowance_refusal(
    monkeypatch,
) -> None:
    client, calls, updates = _push(monkeypatch, _product(price=None))
    try:
        response = client.post(
            "/api/images/push-to-shopify",
            json={
                "ids": [14],
                "productStatus": "ACTIVE",
                "publicationIds": [ONLINE_STORE],
            },
        )
        assert response.status_code == 400
        body = response.json()
        assert body["message"] == PRICE_REQUIRED
        assert "plan" not in body["message"].lower()
        assert "allowance" not in body["message"].lower()
        assert "overflow" not in body["message"].lower()
        assert all("CreateSnapSyncProduct" not in query for query, _ in calls)
        assert updates == []
    finally:
        get_settings.cache_clear()


def test_storefront_write_with_a_zero_price_names_the_price(monkeypatch) -> None:
    client, calls, _updates = _push(monkeypatch, _product(price=Decimal("0.00")))
    try:
        response = client.post(
            "/api/images/push-to-shopify",
            json={
                "ids": [14],
                "productStatus": "ACTIVE",
                "publicationIds": [POINT_OF_SALE, ONLINE_STORE],
            },
        )
        assert response.status_code == 400
        assert response.json()["message"] == PRICE_REQUIRED
        assert all("CreateSnapSyncProduct" not in query for query, _ in calls)
    finally:
        get_settings.cache_clear()


def test_draft_write_with_listing_copy_and_no_price_is_allowed(monkeypatch) -> None:
    client, calls, _updates = _push(
        monkeypatch,
        _product(price=None, shopify_product_status="DRAFT"),
    )
    try:
        response = client.post(
            "/api/images/push-to-shopify",
            json={"ids": [14], "productStatus": "DRAFT", "publicationIds": []},
        )
        assert response.status_code == 200
        assert response.json()["success"] == 1
        product_set = next(
            variables for query, variables in calls if "CreateSnapSyncProduct" in query
        )
        assert product_set["productSet"]["status"] == "DRAFT"
    finally:
        get_settings.cache_clear()


def test_active_write_without_online_store_needs_only_listing_copy(monkeypatch) -> None:
    client, calls, _updates = _push(monkeypatch, _product(price=None))
    try:
        response = client.post(
            "/api/images/push-to-shopify",
            json={
                "ids": [14],
                "productStatus": "ACTIVE",
                "publicationIds": [POINT_OF_SALE],
            },
        )
        assert response.status_code == 200
        assert response.json()["success"] == 1
        product_set = next(
            variables for query, variables in calls if "CreateSnapSyncProduct" in query
        )
        assert product_set["productSet"]["status"] == "ACTIVE"
        publish = next(variables for query, variables in calls if "SnapSyncPublish" in query)
        assert publish["input"] == [{"publicationId": POINT_OF_SALE}]
    finally:
        get_settings.cache_clear()


def test_storefront_write_without_listing_copy_names_listing_copy_not_a_plan(monkeypatch) -> None:
    client, calls, _updates = _push(monkeypatch, _product(title=None, price=Decimal("24.00")))
    try:
        response = client.post(
            "/api/images/push-to-shopify",
            json={
                "ids": [14],
                "productStatus": "ACTIVE",
                "publicationIds": [ONLINE_STORE],
            },
        )
        assert response.status_code == 402
        message = response.json()["message"]
        assert "listing copy" in message.lower()
        assert "plan" not in message.lower()
        assert "allowance" not in message.lower()
        assert all("CreateSnapSyncProduct" not in query for query, _ in calls)
    finally:
        get_settings.cache_clear()


def test_a_failed_shopify_write_does_not_mark_the_product_live(monkeypatch) -> None:
    from app.services import connections
    from app.services import images as store

    product = _product(price=Decimal("24.00"))
    updates: list = []

    async def ready(_session, _user_id):
        return _connection()

    async def get_images(_session, ids, user_id):
        return [product] if product.id in ids else []

    async def list_images(_session, user_id):
        return [product]

    async def update_image(_session, _image_id, payload, _user_id):
        updates.append(payload)
        return product

    async def fake_graphql(_connection, _settings, query, variables=None):
        if "SnapSyncPublications" in query:
            return {
                "publications": {
                    "nodes": [{"id": ONLINE_STORE, "catalog": {"title": "Online Store"}}]
                }
            }
        if "CreateSnapSyncProduct" in query:
            return {
                "productSet": {
                    "product": None,
                    "userErrors": [{"field": ["status"], "message": "Shopify refused"}],
                }
            }
        raise AssertionError(query)

    monkeypatch.setattr(connections, "get_shopify", ready)
    monkeypatch.setattr(store, "get_images_by_ids", get_images)
    monkeypatch.setattr(store, "list_images", list_images)
    monkeypatch.setattr(store, "update_image", update_image)
    monkeypatch.setattr(shopify_svc, "shopify_graphql", fake_graphql)
    client = _client(monkeypatch)
    try:
        response = client.post(
            "/api/images/push-to-shopify",
            json={
                "ids": [14],
                "productStatus": "ACTIVE",
                "publicationIds": [ONLINE_STORE],
            },
        )
        assert response.status_code == 200
        assert response.json()["success"] == 0
        assert response.json()["failed"] == 1
        assert updates == [{"shopify_status": "failed"}]
    finally:
        get_settings.cache_clear()


def test_catalogue_bulk_push_of_a_draft_does_not_ask_for_a_price(monkeypatch) -> None:
    """Catalogue bulk Push sends ids only. A stored Draft is not a storefront write."""
    client, calls, _updates = _push(
        monkeypatch,
        _product(price=None, shopify_product_status="DRAFT", shopify_publication_ids=[]),
    )
    try:
        response = client.post("/api/images/push-to-shopify", json={"ids": [14]})
        assert response.status_code == 200
        assert response.json()["success"] == 1
        product_set = next(
            variables for query, variables in calls if "CreateSnapSyncProduct" in query
        )
        assert product_set["productSet"]["status"] == "DRAFT"
    finally:
        get_settings.cache_clear()
