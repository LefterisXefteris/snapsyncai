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
WAREHOUSE = "gid://shopify/Location/10"
SHOP_FLOOR = "gid://shopify/Location/11"
INVENTORY_LOCATION = "gid://shopify/Location/44"
INVENTORY_ITEM = "gid://shopify/InventoryItem/7"
ONE_VARIANT = [
    {
        "id": "gid://shopify/ProductVariant/1",
        "inventoryItem": {"id": INVENTORY_ITEM, "tracked": True},
    }
]


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


def _publishing(status: str, published_ids: list[str] | None = None) -> dict:
    return {
        "product": {
            "status": status,
            "resourcePublicationsV2": {
                "nodes": [
                    {"isPublished": True, "publication": {"id": publication_id}}
                    for publication_id in (published_ids or [])
                ]
            },
        }
    }


def _install(
    monkeypatch,
    product: Image,
    calls: list,
    updates: list,
    *,
    publishing: dict | None = None,
    publishing_after_publish: dict | None = None,
    locations: list | None = None,
    variant_nodes: list | None = None,
    stock_user_errors: list | None = None,
) -> None:
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

    published = {"done": False}

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
                        "variants": {
                            "nodes": variant_nodes
                            or [{"id": "gid://shopify/ProductVariant/1"}]
                        },
                    },
                    "userErrors": [],
                }
            }
        if "SnapSyncProductPublishing" in query:
            if published["done"] and publishing_after_publish is not None:
                return publishing_after_publish
            return publishing or _publishing("DRAFT")
        if "InventoryLocations" in query:
            return {"locations": {"nodes": locations or []}}
        if "SetStorefrontAvailable" in query:
            return {"inventorySetQuantities": {"userErrors": stock_user_errors or []}}
        if "SnapSyncPublish" in query:
            published["done"] = True
            return {"publishablePublish": {"userErrors": []}}
        if "SnapSyncUnpublish" in query:
            return {"publishableUnpublish": {"userErrors": []}}
        raise AssertionError(query)

    from app.services.inventory import shopify_ops

    monkeypatch.setattr(connections, "get_shopify", ready)
    monkeypatch.setattr(store, "get_images_by_ids", get_images)
    monkeypatch.setattr(store, "list_images", list_images)
    monkeypatch.setattr(store, "update_image", update_image)
    monkeypatch.setattr(shopify_svc, "shopify_graphql", fake_graphql)
    monkeypatch.setattr(shopify_ops, "shopify_graphql", fake_graphql)


def _push(monkeypatch, product: Image, **install) -> tuple[TestClient, list, list]:
    calls: list = []
    updates: list = []
    _install(monkeypatch, product, calls, updates, **install)
    return _client(monkeypatch), calls, updates


def _available_stock(calls: list) -> list[dict]:
    return [
        variables["input"]["quantities"][0]
        for query, variables in calls
        if "SetStorefrontAvailable" in query
    ]


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


def test_first_storefront_write_sets_available_stock_to_the_page_quantity(monkeypatch) -> None:
    client, calls, _updates = _push(
        monkeypatch,
        _product(inventory_quantity=4, track_quantity="true"),
        locations=[{"id": WAREHOUSE, "name": "Warehouse", "isActive": True}],
        variant_nodes=ONE_VARIANT,
    )
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
        assert response.json()["success"] == 1
        assert response.json()["stockNotSet"] is False
        assert _available_stock(calls) == [
            {
                "inventoryItemId": INVENTORY_ITEM,
                "locationId": WAREHOUSE,
                "quantity": 4,
                "changeFromQuantity": None,
            }
        ]
    finally:
        get_settings.cache_clear()


def test_landing_again_after_leaving_the_online_store_sets_available_stock(monkeypatch) -> None:
    client, calls, _updates = _push(
        monkeypatch,
        _product(
            shopify_product_id="gid://shopify/Product/9",
            inventory_quantity=6,
            track_quantity="true",
        ),
        publishing=_publishing("DRAFT"),
        publishing_after_publish=_publishing("ACTIVE", [ONLINE_STORE]),
        locations=[{"id": WAREHOUSE, "name": "Warehouse", "isActive": True}],
        variant_nodes=ONE_VARIANT,
    )
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
        assert response.json()["success"] == 1
        assert response.json()["stockNotSet"] is False
        assert _available_stock(calls) == [
            {
                "inventoryItemId": INVENTORY_ITEM,
                "locationId": WAREHOUSE,
                "quantity": 6,
                "changeFromQuantity": None,
            }
        ]
    finally:
        get_settings.cache_clear()


def _storefront(client: TestClient):
    return client.post(
        "/api/images/push-to-shopify",
        json={
            "ids": [14],
            "productStatus": "ACTIVE",
            "publicationIds": [ONLINE_STORE],
        },
    )


def test_first_storefront_write_sets_available_stock_of_zero(monkeypatch) -> None:
    client, calls, _updates = _push(
        monkeypatch,
        _product(inventory_quantity=0, track_quantity="true"),
        locations=[{"id": WAREHOUSE, "name": "Warehouse", "isActive": True}],
        variant_nodes=ONE_VARIANT,
    )
    try:
        response = _storefront(client)
        assert response.status_code == 200
        assert response.json()["stockNotSet"] is False
        assert _available_stock(calls)[0]["quantity"] == 0
    finally:
        get_settings.cache_clear()


def test_available_stock_is_written_at_the_inventory_location(monkeypatch) -> None:
    async def _inventory_location(_session, _user_id):
        return INVENTORY_LOCATION

    monkeypatch.setattr(
        "app.services.inventory.service.inventory_location_for_user",
        _inventory_location,
    )
    client, calls, _updates = _push(
        monkeypatch,
        _product(inventory_quantity=4, track_quantity="true"),
        locations=[{"id": SHOP_FLOOR, "name": "Shop floor", "isActive": True}],
        variant_nodes=ONE_VARIANT,
    )
    try:
        response = _storefront(client)
        assert response.status_code == 200
        assert response.json()["stockNotSet"] is False
        assert _available_stock(calls)[0]["locationId"] == INVENTORY_LOCATION
    finally:
        get_settings.cache_clear()


def test_available_stock_uses_the_first_active_location_when_several_exist(monkeypatch) -> None:
    client, calls, _updates = _push(
        monkeypatch,
        _product(inventory_quantity=4, track_quantity="true"),
        locations=[
            {"id": WAREHOUSE, "name": "Warehouse", "isActive": True},
            {"id": SHOP_FLOOR, "name": "Shop floor", "isActive": True},
        ],
        variant_nodes=ONE_VARIANT,
    )
    try:
        response = _storefront(client)
        assert response.status_code == 200
        assert _available_stock(calls)[0]["locationId"] == WAREHOUSE
    finally:
        get_settings.cache_clear()


def test_tracking_off_does_not_set_a_quantity(monkeypatch) -> None:
    client, calls, _updates = _push(
        monkeypatch,
        _product(inventory_quantity=4, track_quantity="false"),
        locations=[{"id": WAREHOUSE, "name": "Warehouse", "isActive": True}],
        variant_nodes=ONE_VARIANT,
    )
    try:
        response = _storefront(client)
        assert response.status_code == 200
        assert response.json()["success"] == 1
        assert response.json()["stockNotSet"] is False
        assert _available_stock(calls) == []
    finally:
        get_settings.cache_clear()


def test_draft_write_does_not_set_stock(monkeypatch) -> None:
    client, calls, _updates = _push(
        monkeypatch,
        _product(inventory_quantity=4, track_quantity="true"),
        locations=[{"id": WAREHOUSE, "name": "Warehouse", "isActive": True}],
        variant_nodes=ONE_VARIANT,
    )
    try:
        response = client.post(
            "/api/images/push-to-shopify",
            json={"ids": [14], "productStatus": "DRAFT", "publicationIds": []},
        )
        assert response.status_code == 200
        assert response.json()["success"] == 1
        assert response.json()["stockNotSet"] is False
        assert _available_stock(calls) == []
    finally:
        get_settings.cache_clear()


def test_later_sync_of_a_product_on_the_online_store_does_not_change_stock(monkeypatch) -> None:
    client, calls, _updates = _push(
        monkeypatch,
        _product(
            shopify_product_id="gid://shopify/Product/9",
            inventory_quantity=4,
            track_quantity="true",
            shopify_product_status="ACTIVE",
            shopify_publication_ids=[ONLINE_STORE],
        ),
        publishing=_publishing("ACTIVE", [ONLINE_STORE]),
        locations=[{"id": WAREHOUSE, "name": "Warehouse", "isActive": True}],
        variant_nodes=ONE_VARIANT,
    )
    try:
        response = _storefront(client)
        assert response.status_code == 200
        assert response.json()["success"] == 1
        assert response.json()["stockNotSet"] is False
        assert _available_stock(calls) == []
    finally:
        get_settings.cache_clear()


def test_several_variants_stay_on_the_online_store_and_stock_is_not_set(monkeypatch) -> None:
    client, calls, updates = _push(
        monkeypatch,
        _product(inventory_quantity=4, track_quantity="true"),
        locations=[{"id": WAREHOUSE, "name": "Warehouse", "isActive": True}],
        variant_nodes=[
            *ONE_VARIANT,
            {
                "id": "gid://shopify/ProductVariant/2",
                "inventoryItem": {"id": "gid://shopify/InventoryItem/8", "tracked": True},
            },
        ],
    )
    try:
        response = _storefront(client)
        assert response.status_code == 200
        assert response.json()["success"] == 1
        assert response.json()["stockNotSet"] is True
        assert _available_stock(calls) == []
        assert updates[-1]["shopify_product_status"] == "ACTIVE"
        assert ONLINE_STORE in updates[-1]["shopify_publication_ids"]
    finally:
        get_settings.cache_clear()


def test_no_active_location_stays_on_the_online_store_and_stock_is_not_set(monkeypatch) -> None:
    client, calls, updates = _push(
        monkeypatch,
        _product(inventory_quantity=4, track_quantity="true"),
        locations=[],
        variant_nodes=ONE_VARIANT,
    )
    try:
        response = _storefront(client)
        assert response.status_code == 200
        assert response.json()["success"] == 1
        assert response.json()["stockNotSet"] is True
        assert _available_stock(calls) == []
        assert updates[-1]["shopify_product_status"] == "ACTIVE"
    finally:
        get_settings.cache_clear()


def test_a_failed_stock_write_stays_on_the_online_store(monkeypatch) -> None:
    client, calls, updates = _push(
        monkeypatch,
        _product(inventory_quantity=4, track_quantity="true"),
        locations=[{"id": WAREHOUSE, "name": "Warehouse", "isActive": True}],
        variant_nodes=ONE_VARIANT,
        stock_user_errors=[{"message": "Could not set available stock"}],
    )
    try:
        response = _storefront(client)
        assert response.status_code == 200
        assert response.json()["success"] == 1
        assert response.json()["stockNotSet"] is True
        assert _available_stock(calls)[0]["quantity"] == 4
        assert updates[-1]["shopify_status"] == "synced"
        assert updates[-1]["shopify_product_status"] == "ACTIVE"
    finally:
        get_settings.cache_clear()


def test_a_product_already_on_the_online_store_is_not_backfilled(monkeypatch) -> None:
    client, calls, _updates = _push(
        monkeypatch,
        _product(
            shopify_product_id="gid://shopify/Product/9",
            inventory_quantity=4,
            track_quantity="true",
            shopify_product_status="ACTIVE",
            shopify_publication_ids=[ONLINE_STORE],
        ),
        publishing=_publishing("ACTIVE", [ONLINE_STORE]),
        locations=[{"id": WAREHOUSE, "name": "Warehouse", "isActive": True}],
        variant_nodes=ONE_VARIANT,
    )
    try:
        response = client.post("/api/images/push-to-shopify", json={"ids": [14]})
        assert response.status_code == 200
        assert response.json()["success"] == 1
        assert response.json()["stockNotSet"] is False
        assert _available_stock(calls) == []
    finally:
        get_settings.cache_clear()


def test_when_inventory_is_on_the_ledger_starts_at_the_page_quantity(monkeypatch) -> None:
    from app.models.inventory import InventoryItem, InventoryOutboxJob, InventorySettings
    from app.services.inventory import service as inventory_service

    settings_row = InventorySettings(
        user_id=DEV_USER_ID,
        shop_domain="demo.myshopify.com",
        location_id=WAREHOUSE,
        location_name="Warehouse",
        enabled=True,
    )

    class _Rows:
        def scalar_one_or_none(self):
            return settings_row

    class _Session:
        def __init__(self) -> None:
            self.added: list = []

        def add(self, obj) -> None:
            self.added.append(obj)

        async def flush(self) -> None:
            for obj in self.added:
                if isinstance(obj, InventoryItem) and obj.id is None:
                    obj.id = 1

        async def execute(self, *_args, **_kwargs):
            return _Rows()

    session = _Session()

    monkeypatch.setattr(inventory_service, "feature_enabled", lambda _settings: True)
    client, calls, _updates = _push(
        monkeypatch,
        _product(inventory_quantity=4, track_quantity="true"),
        locations=[{"id": SHOP_FLOOR, "name": "Shop floor", "isActive": True}],
        variant_nodes=ONE_VARIANT,
    )

    async def _db():
        yield session

    client.app.dependency_overrides[get_session] = _db
    try:
        response = _storefront(client)
        assert response.status_code == 200
        assert response.json()["success"] == 1
        written = _available_stock(calls)
        assert written[0]["quantity"] == 4
        assert written[0]["locationId"] == WAREHOUSE
        ledgers = [obj for obj in session.added if isinstance(obj, InventoryItem)]
        assert [item.ledger_quantity for item in ledgers] == [4]
        assert not any(isinstance(obj, InventoryOutboxJob) for obj in session.added)
    finally:
        get_settings.cache_clear()
