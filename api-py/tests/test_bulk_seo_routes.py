"""Bulk SEO HTTP contract — auth and camelCase. No database.

Seam: `/api/bulk-seo`.
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
    ("GET", "/api/bulk-seo"),
    ("POST", "/api/bulk-seo/start"),
    ("POST", "/api/bulk-seo/regenerate"),
    ("POST", "/api/bulk-seo/accept"),
]


def test_bulk_seo_catalogue_requires_auth(monkeypatch) -> None:
    client = _client(monkeypatch)
    try:
        for method, path in PROTECTED:
            response = client.request(
                method,
                path,
                json={
                    "productIds": [1],
                    "productId": 1,
                    "queries": [],
                    "tags": ["cotton"],
                    "description": "<p>Tee</p>",
                    "seoTitle": "Tee",
                    "seoDescription": "Tee",
                },
            )
            assert response.status_code == 401, path
            assert response.json() == {"detail": "Unauthenticated"}
    finally:
        get_settings.cache_clear()


def test_bulk_seo_schema_is_camel_case(monkeypatch) -> None:
    client = _client(monkeypatch)
    try:
        schemas = client.get("/openapi.json").json()["components"]["schemas"]
        payload = set(schemas["BulkSeoCatalogueResponse"]["properties"])
        assert payload == {"startBlockedReason", "rows", "proposedUseCount"}
        row = set(schemas["BulkSeoCatalogueRow"]["properties"])
        assert row == {"id", "title", "photoUrl", "eligible", "blockedReason"}
        assert "start_blocked_reason" not in payload
        assert "blocked_reason" not in row
        start_body = set(schemas["BulkSeoStartBody"]["properties"])
        assert start_body == {"productIds"}
        pack = set(schemas["BulkSeoPackResponse"]["properties"])
        assert pack == {"error", "items", "proposedUseCount"}
        item = set(schemas["BulkSeoPackItem"]["properties"])
        assert item == {"id", "error", "proposal", "queries"}
        proposal = set(schemas["BulkSeoProposal"]["properties"])
        assert proposal == {"tags", "description", "seoTitle", "seoDescription"}
        regen = set(schemas["BulkSeoRegenerateBody"]["properties"])
        assert regen == {"productId", "queries"}
        accept = set(schemas["BulkSeoAcceptBody"]["properties"])
        assert accept == {"productId", "tags", "description", "seoTitle", "seoDescription", "confirmOverflow"}
    finally:
        get_settings.cache_clear()
