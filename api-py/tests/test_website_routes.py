"""Website HTTP contract — auth and camelCase. No database.

Seam: `/api/website/prototype`, `/api/website/handoff`.
"""

from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import create_app

BASE_ENV = {
    "DATABASE_URL": "postgresql://u:p@localhost:5432/db",
    "CLERK_SECRET_KEY": "sk_test_fake",
}


def _client(monkeypatch) -> TestClient:
    for key, value in BASE_ENV.items():
        monkeypatch.setenv(key, value)
    monkeypatch.setenv("DEV_BYPASS_AUTH", "false")
    get_settings.cache_clear()
    return TestClient(create_app(), raise_server_exceptions=False)


PROTECTED = [
    ("GET", "/api/website/prototype"),
    ("POST", "/api/website/handoff"),
]


def test_website_routes_require_auth(monkeypatch) -> None:
    client = _client(monkeypatch)
    try:
        for method, path in PROTECTED:
            response = client.request(method, path, json={"productIds": [1], "look": ""})
            assert response.status_code == 401, path
            assert response.json() == {"detail": "Unauthenticated"}
    finally:
        get_settings.cache_clear()


def test_website_schemas_are_camel_case(monkeypatch) -> None:
    client = _client(monkeypatch)
    try:
        schemas = client.get("/openapi.json").json()["components"]["schemas"]
        proto = set(schemas["WebsitePrototypeResponse"]["properties"])
        assert proto == {"shopConnected", "shopDomain", "products"}
        item = set(schemas["WebsiteEligibleProduct"]["properties"])
        assert {"id", "title", "photoUrl", "shopifyProductId"} <= item
        assert "shopify_product_id" not in item
        handoff = set(schemas["WebsiteHandoffResponse"]["properties"])
        assert handoff == {"lovableUrl", "productCount"}
        body = set(schemas["WebsiteHandoffBody"]["properties"])
        assert body == {"productIds", "look"}
    finally:
        get_settings.cache_clear()
