"""Inventory HTTP contract — auth, feature flag, webhook HMAC, cron secret.

Seam: `/api/inventory/*`, `/api/shopify/webhooks`, `/api/inventory/cron`.
No database: these guards run before any query.
"""

from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import create_app

BASE_ENV = {
    "DATABASE_URL": "postgresql://u:p@localhost:5432/db",
    "CLERK_SECRET_KEY": "sk_test_fake",
}


def _client(monkeypatch, **extra) -> TestClient:
    for key, value in BASE_ENV.items():
        monkeypatch.setenv(key, value)
    monkeypatch.setenv("DEV_BYPASS_AUTH", "false")
    monkeypatch.delenv("INVENTORY_AUTOPILOT_ENABLED", raising=False)
    monkeypatch.delenv("CRON_SECRET", raising=False)
    for key, value in extra.items():
        monkeypatch.setenv(key, value)
    get_settings.cache_clear()
    return TestClient(create_app(), raise_server_exceptions=False)


PROTECTED = [
    ("GET", "/api/inventory/locations"),
    ("POST", "/api/inventory/setup"),
    ("POST", "/api/inventory/setup/1/enable"),
    ("GET", "/api/inventory/imports/1"),
    ("GET", "/api/inventory/overview"),
    ("GET", "/api/inventory/items"),
    ("POST", "/api/inventory/items/1/adjustments"),
    ("PATCH", "/api/inventory/items/1/policy"),
    ("GET", "/api/inventory/items/1/ledger"),
    ("GET", "/api/inventory/bundles"),
    ("POST", "/api/inventory/bundles"),
    ("PUT", "/api/inventory/bundles/1"),
    ("DELETE", "/api/inventory/bundles/1"),
    ("GET", "/api/inventory/notifications"),
    ("POST", "/api/inventory/notifications/1/read"),
    ("POST", "/api/inventory/reconcile"),
]


def test_inventory_routes_require_auth(monkeypatch) -> None:
    client = _client(monkeypatch)
    try:
        for method, path in PROTECTED:
            response = client.request(method, path, json={})
            assert response.status_code == 401, path
            assert response.json() == {"detail": "Unauthenticated"}
    finally:
        get_settings.cache_clear()


def test_inventory_is_hidden_when_the_feature_flag_is_off(monkeypatch) -> None:
    client = _client(monkeypatch, DEV_BYPASS_AUTH="true")
    try:
        response = client.get("/api/inventory/overview")
        assert response.status_code == 404
        assert response.json() == {"message": "Inventory Autopilot is not enabled for this deployment"}
    finally:
        get_settings.cache_clear()


def test_shopify_inventory_webhook_rejects_a_bad_hmac(monkeypatch) -> None:
    client = _client(monkeypatch, SHOPIFY_API_SECRET="shpss_test")
    try:
        response = client.post(
            "/api/shopify/webhooks",
            content=b'{"id":1}',
            headers={
                "content-type": "application/json",
                "x-shopify-hmac-sha256": "nope",
                "x-shopify-webhook-id": "evt",
                "x-shopify-topic": "inventory_levels/update",
                "x-shopify-shop-domain": "demo.myshopify.com",
            },
        )
        assert response.status_code == 401
        assert response.json() == {"message": "Invalid Shopify webhook signature"}
    finally:
        get_settings.cache_clear()


def test_inventory_overview_schema_is_camel_case(monkeypatch) -> None:
    client = _client(monkeypatch)
    try:
        schemas = client.get("/openapi.json").json()["components"]["schemas"]
        props = set(schemas["InventoryOverviewResponse"]["properties"])
        assert {"latestImport", "totalItems", "lowStockItems", "unreadAlerts"} <= props
        assert "latest_import" not in props
        bundle = set(schemas["InventoryBundleListItem"]["properties"])
        assert {"computedAvailability", "components"} <= bundle
        assert "computed_availability" not in bundle
        imported = set(schemas["InventoryImportDto"]["properties"])
        assert "preview" in imported
        assert {"ledgerQuantity", "sellableQuantity"} <= set(schemas["InventoryItemDto"]["properties"])
        detail = set(schemas["InventoryBundleDetail"]["properties"])
        assert {"bundleItemId", "computedAvailability"} <= detail
        assert "bundle_item_id" not in detail
    finally:
        get_settings.cache_clear()


def test_inventory_cron_requires_the_bearer_secret(monkeypatch) -> None:
    client = _client(monkeypatch, CRON_SECRET="cron-secret")
    try:
        assert client.get("/api/inventory/cron").status_code == 401
        response = client.get(
            "/api/inventory/cron",
            headers={"authorization": "Bearer wrong"},
        )
        assert response.status_code == 401
        assert response.json() == {"message": "Unauthorized"}
    finally:
        get_settings.cache_clear()
