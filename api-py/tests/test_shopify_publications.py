"""Shopify publications on the product page — Available-on list, Draft/Active, exact-set push."""

from fastapi.testclient import TestClient

from app.config import Settings
from app.models import ShopifyConnection
from app.services import shopify as shopify_svc
from app.services.shopify import (
    publication_changes,
    publication_label,
    shopify_product_status,
)
from app.services.shopify_oauth import DEFAULT_SHOPIFY_SCOPES

ONLINE_STORE = "gid://shopify/Publication/1"
POINT_OF_SALE = "gid://shopify/Publication/2"
SHOP_APP = "gid://shopify/Publication/3"

_SETTINGS = Settings(database_url="postgresql://u:p@localhost:5432/db")


def _connection(**kwargs) -> ShopifyConnection:
    values = {
        "session_id": "user_1",
        "shop_domain": "demo.myshopify.com",
        "access_token": "shpat_test",
        "granted_scopes": ["read_publications", "write_publications"],
    }
    values.update(kwargs)
    return ShopifyConnection(**values)


def test_product_status_defaults_to_draft() -> None:
    assert shopify_product_status(None) == "DRAFT"
    assert shopify_product_status("") == "DRAFT"
    assert shopify_product_status("draft") == "DRAFT"
    assert shopify_product_status("ACTIVE") == "ACTIVE"
    assert shopify_product_status("active") == "ACTIVE"


def test_publication_changes_are_the_desired_set() -> None:
    to_publish, to_unpublish = publication_changes(
        {"gid://shopify/Publication/1"},
        {"gid://shopify/Publication/1", "gid://shopify/Publication/2"},
    )
    assert to_publish == []
    assert to_unpublish == ["gid://shopify/Publication/2"]


def test_publication_changes_publish_new_ticks() -> None:
    to_publish, to_unpublish = publication_changes(
        {"gid://shopify/Publication/1", "gid://shopify/Publication/3"},
        {"gid://shopify/Publication/1"},
    )
    assert to_publish == ["gid://shopify/Publication/3"]
    assert to_unpublish == []


def test_publication_label_prefers_catalog_title() -> None:
    assert publication_label({"id": "1", "name": "Online Store", "catalog": {"title": "POS"}}) == "POS"
    assert publication_label({"id": "1", "name": "Online Store"}) == "Online Store"
    assert publication_label({"id": "1"}) == "Publication"


def test_oauth_requests_publication_scopes() -> None:
    assert "read_publications" in DEFAULT_SHOPIFY_SCOPES
    assert "write_publications" in DEFAULT_SHOPIFY_SCOPES


async def test_available_on_list_uses_the_shop_catalog_titles(monkeypatch) -> None:
    """Admin API 2026-07 deprecates Publication.name; labels come from catalog.title."""

    async def fake_graphql(_connection, _settings, query, variables=None):
        nodes = [
            {
                "id": ONLINE_STORE,
                "name": "Online Store",
                "catalog": {"title": "Online Store"},
            },
            {
                "id": POINT_OF_SALE,
                "name": "Point of Sale",
                "catalog": {"title": "Point of Sale"},
            },
        ]
        if "catalog" not in query:
            for node in nodes:
                node.pop("catalog")
                node.pop("name")
        return {"publications": {"nodes": nodes}}

    monkeypatch.setattr(shopify_svc, "shopify_graphql", fake_graphql)
    listed = await shopify_svc.list_shopify_publications(_connection(), _SETTINGS)
    assert listed == [
        {"id": ONLINE_STORE, "name": "Online Store"},
        {"id": POINT_OF_SALE, "name": "Point of Sale"},
    ]


async def test_push_sends_exactly_the_ticked_publications(monkeypatch) -> None:
    calls: list[tuple[str, dict]] = []

    async def fake_graphql(_connection, _settings, query, variables=None):
        calls.append((query, variables or {}))
        if "SnapSyncProductPublishing" in query:
            return {
                "product": {
                    "status": "DRAFT",
                    "resourcePublicationsV2": {
                        "nodes": [
                            {"isPublished": True, "publication": {"id": ONLINE_STORE}},
                            {"isPublished": True, "publication": {"id": POINT_OF_SALE}},
                        ]
                    },
                }
            }
        if "SnapSyncPublish" in query:
            return {"publishablePublish": {"userErrors": []}}
        if "SnapSyncUnpublish" in query:
            return {"publishableUnpublish": {"userErrors": []}}
        raise AssertionError(query)

    monkeypatch.setattr(shopify_svc, "shopify_graphql", fake_graphql)
    await shopify_svc.apply_shopify_publications(
        _connection(), _SETTINGS, "gid://shopify/Product/9", [ONLINE_STORE, SHOP_APP]
    )
    publish = next(variables for query, variables in calls if "SnapSyncPublish" in query)
    unpublish = next(variables for query, variables in calls if "SnapSyncUnpublish" in query)
    assert publish["input"] == [{"publicationId": SHOP_APP}]
    assert unpublish["input"] == [{"publicationId": POINT_OF_SALE}]


async def test_first_push_is_draft_and_unpublishes_unticked_publications(monkeypatch) -> None:
    from app.models.image import Image

    calls: list[tuple[str, dict]] = []

    async def fake_graphql(_connection, _settings, query, variables=None):
        calls.append((query, variables or {}))
        if "CreateSnapSyncProduct" in query:
            return {
                "productSet": {
                    "product": {
                        "id": "gid://shopify/Product/9",
                        "variants": {"nodes": []},
                    },
                    "userErrors": [],
                }
            }
        if "SnapSyncProductPublishing" in query:
            return {
                "product": {
                    "status": "DRAFT",
                    "resourcePublicationsV2": {
                        "nodes": [
                            {"isPublished": True, "publication": {"id": ONLINE_STORE}},
                        ]
                    },
                }
            }
        if "SnapSyncUnpublish" in query:
            return {"publishableUnpublish": {"userErrors": []}}
        raise AssertionError(query)

    monkeypatch.setattr(shopify_svc, "shopify_graphql", fake_graphql)
    product = await shopify_svc.create_shopify_product(
        _connection(),
        _SETTINGS,
        Image(id=1, original_name="tee.jpg", mime_type="image/jpeg", size=1, title="Tee"),
        publication_ids=[],
        product_status=None,
    )
    product_set = next(variables for query, variables in calls if "CreateSnapSyncProduct" in query)
    unpublish = next(variables for query, variables in calls if "SnapSyncUnpublish" in query)
    assert product["id"] == "gid://shopify/Product/9"
    assert product_set["productSet"]["status"] == "DRAFT"
    assert unpublish["input"] == [{"publicationId": ONLINE_STORE}]
    assert not any("SnapSyncPublish" in query for query, _ in calls)


async def test_push_sends_active_when_the_seller_picks_it(monkeypatch) -> None:
    from app.models.image import Image

    calls: list[tuple[str, dict]] = []

    async def fake_graphql(_connection, _settings, query, variables=None):
        calls.append((query, variables or {}))
        if "CreateSnapSyncProduct" in query:
            return {
                "productSet": {
                    "product": {
                        "id": "gid://shopify/Product/9",
                        "variants": {"nodes": []},
                    },
                    "userErrors": [],
                }
            }
        if "SnapSyncProductPublishing" in query:
            return {"product": {"status": "ACTIVE", "resourcePublicationsV2": {"nodes": []}}}
        if "SnapSyncPublish" in query:
            return {"publishablePublish": {"userErrors": []}}
        raise AssertionError(query)

    monkeypatch.setattr(shopify_svc, "shopify_graphql", fake_graphql)
    await shopify_svc.create_shopify_product(
        _connection(),
        _SETTINGS,
        Image(id=1, original_name="tee.jpg", mime_type="image/jpeg", size=1, title="Tee"),
        publication_ids=[ONLINE_STORE],
        product_status="ACTIVE",
    )
    product_set = next(variables for query, variables in calls if "CreateSnapSyncProduct" in query)
    publish = next(variables for query, variables in calls if "SnapSyncPublish" in query)
    assert product_set["productSet"]["status"] == "ACTIVE"
    assert publish["input"] == [{"publicationId": ONLINE_STORE}]


async def test_push_skips_publications_until_the_shop_is_reconnected(monkeypatch) -> None:
    from app.models.image import Image

    calls: list[str] = []

    async def fake_graphql(_connection, _settings, query, variables=None):
        calls.append(query)
        if "CreateSnapSyncProduct" in query:
            return {
                "productSet": {
                    "product": {
                        "id": "gid://shopify/Product/9",
                        "variants": {"nodes": []},
                    },
                    "userErrors": [],
                }
            }
        raise AssertionError(query)

    monkeypatch.setattr(shopify_svc, "shopify_graphql", fake_graphql)
    await shopify_svc.create_shopify_product(
        _connection(granted_scopes=["read_products", "write_products"]),
        _SETTINGS,
        Image(id=1, original_name="tee.jpg", mime_type="image/jpeg", size=1, title="Tee"),
        publication_ids=[ONLINE_STORE],
        product_status="DRAFT",
    )
    assert all("SnapSyncPublish" not in query for query in calls)
    assert all("SnapSyncUnpublish" not in query for query in calls)
    assert all("SnapSyncProductPublishing" not in query for query in calls)


def _publications_client(monkeypatch) -> TestClient:
    from app.config import get_settings
    from app.db import get_session
    from app.main import create_app

    monkeypatch.setenv("DATABASE_URL", "postgresql://u:p@localhost:5432/db")
    monkeypatch.setenv("CLERK_SECRET_KEY", "sk_test_fake")
    monkeypatch.setenv("DEV_BYPASS_AUTH", "true")
    get_settings.cache_clear()
    app = create_app()

    async def _no_db():
        yield None

    app.dependency_overrides[get_session] = _no_db
    return TestClient(app, raise_server_exceptions=False)


def test_publications_query_param_is_imageId(monkeypatch) -> None:
    client = _publications_client(monkeypatch)
    try:
        params = client.get("/openapi.json").json()["paths"]["/api/shopify/publications"]["get"][
            "parameters"
        ]
        names = {param["name"] for param in params}
        assert "imageId" in names
        assert "image_id" not in names
    finally:
        from app.config import get_settings

        get_settings.cache_clear()


def test_publications_are_empty_when_shopify_is_not_connected(monkeypatch) -> None:
    from app.services import connections

    async def none_connected(_session, _user_id):
        return None

    monkeypatch.setattr(connections, "get_shopify", none_connected)
    client = _publications_client(monkeypatch)
    try:
        response = client.get("/api/shopify/publications")
        assert response.status_code == 200
        assert response.json() == {
            "connected": False,
            "publicationsReady": False,
            "productStatus": None,
            "publications": [],
        }
    finally:
        from app.config import get_settings

        get_settings.cache_clear()


def test_publications_need_reconnect_when_scopes_are_missing(monkeypatch) -> None:
    from app.services import connections

    async def old_connection(_session, _user_id):
        return _connection(granted_scopes=["read_products", "write_products"])

    monkeypatch.setattr(connections, "get_shopify", old_connection)
    client = _publications_client(monkeypatch)
    try:
        response = client.get("/api/shopify/publications")
        assert response.status_code == 200
        assert response.json() == {
            "connected": True,
            "publicationsReady": False,
            "productStatus": None,
            "publications": [],
        }
    finally:
        from app.config import get_settings

        get_settings.cache_clear()


def test_publications_endpoint_returns_the_shop_live_list(monkeypatch) -> None:
    from app.services import connections

    async def ready_connection(_session, _user_id):
        return _connection()

    async def fake_graphql(_connection, _settings, query, variables=None):
        if "SnapSyncPublications" in query:
            return {
                "publications": {
                    "nodes": [
                        {
                            "id": ONLINE_STORE,
                            "name": "Online Store",
                            "catalog": {"title": "Online Store"},
                        },
                        {
                            "id": POINT_OF_SALE,
                            "name": "Point of Sale",
                            "catalog": {"title": "Point of Sale"},
                        },
                    ]
                }
            }
        raise AssertionError(query)

    monkeypatch.setattr(connections, "get_shopify", ready_connection)
    monkeypatch.setattr(shopify_svc, "shopify_graphql", fake_graphql)
    client = _publications_client(monkeypatch)
    try:
        response = client.get("/api/shopify/publications")
        assert response.status_code == 200
        assert response.json() == {
            "connected": True,
            "publicationsReady": True,
            "productStatus": None,
            "publications": [
                {"id": ONLINE_STORE, "name": "Online Store", "published": False},
                {"id": POINT_OF_SALE, "name": "Point of Sale", "published": False},
            ],
        }
    finally:
        from app.config import get_settings

        get_settings.cache_clear()


def test_publications_endpoint_ticks_the_product_live_set(monkeypatch) -> None:
    from app.auth.clerk import DEV_USER_ID
    from app.models.image import Image
    from app.services import connections
    from app.services import images as store

    async def ready_connection(_session, _user_id):
        return _connection()

    async def fake_get(_session, image_id: int):
        if image_id != 14:
            return None
        return Image(
            id=14,
            original_name="tee.jpg",
            mime_type="image/jpeg",
            size=1,
            session_id=DEV_USER_ID,
            shopify_product_id="gid://shopify/Product/9",
        )

    async def fake_graphql(_connection, _settings, query, variables=None):
        if "SnapSyncPublications" in query:
            return {
                "publications": {
                    "nodes": [
                        {"id": ONLINE_STORE, "catalog": {"title": "Online Store"}},
                        {"id": POINT_OF_SALE, "catalog": {"title": "Point of Sale"}},
                    ]
                }
            }
        if "SnapSyncProductPublishing" in query:
            assert variables == {"id": "gid://shopify/Product/9"}
            return {
                "product": {
                    "status": "ACTIVE",
                    "resourcePublicationsV2": {
                        "nodes": [
                            {"isPublished": True, "publication": {"id": ONLINE_STORE}},
                            {"isPublished": False, "publication": {"id": POINT_OF_SALE}},
                        ]
                    },
                }
            }
        raise AssertionError(query)

    monkeypatch.setattr(connections, "get_shopify", ready_connection)
    monkeypatch.setattr(store, "get_image", fake_get)
    monkeypatch.setattr(shopify_svc, "shopify_graphql", fake_graphql)
    client = _publications_client(monkeypatch)
    try:
        response = client.get("/api/shopify/publications?imageId=14")
        assert response.status_code == 200
        body = response.json()
        assert body["productStatus"] == "ACTIVE"
        assert body["publications"] == [
            {"id": ONLINE_STORE, "name": "Online Store", "published": True},
            {"id": POINT_OF_SALE, "name": "Point of Sale", "published": False},
        ]
    finally:
        from app.config import get_settings

        get_settings.cache_clear()
