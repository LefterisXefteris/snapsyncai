"""Import HTTP contract — auth and camelCase. No live shop.

Seam: `/api/import` (thin; Import module is the behaviour seam).
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
    ("GET", "/api/import"),
    ("POST", "/api/import/start"),
]


def test_import_routes_require_auth(monkeypatch) -> None:
    client = _client(monkeypatch)
    try:
        for method, path in PROTECTED:
            response = client.request(method, path)
            assert response.status_code == 401, path
            assert response.json() == {"detail": "Unauthenticated"}
    finally:
        get_settings.cache_clear()


def test_import_schema_is_camel_case(monkeypatch) -> None:
    client = _client(monkeypatch)
    try:
        schemas = client.get("/openapi.json").json()["components"]["schemas"]
        payload = set(schemas["ImportStatusResponse"]["properties"])
        assert payload == {
            "shopConnected",
            "startBlockedReason",
            "inProgress",
            "completed",
            "created",
            "skipped",
            "failed",
            "failures",
        }
        failure = set(schemas["ImportFailureOut"]["properties"])
        assert failure == {"channelProductId", "reason"}
        assert "start_blocked_reason" not in payload
        assert "channel_product_id" not in failure
    finally:
        get_settings.cache_clear()
