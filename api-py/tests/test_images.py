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
    ("GET", "/api/images"),
    ("GET", "/api/images/1/group"),
    ("GET", "/api/images/1/file"),
    ("PUT", "/api/images/1"),
    ("DELETE", "/api/images/1"),
    ("DELETE", "/api/images/group/g1"),
    ("POST", "/api/images/1/unlink-from-group"),
    ("POST", "/api/images/1/assign-group"),
    ("POST", "/api/images/assign-group-batch"),
    ("POST", "/api/images/upload"),
    ("POST", "/api/images/1/generate-content"),
    ("POST", "/api/images/push-to-shopify"),
]


def test_image_routes_require_auth(monkeypatch) -> None:
    client = _client(monkeypatch)
    try:
        for method, path in PROTECTED:
            response = client.request(method, path, json={})
            assert response.status_code == 401, path
            assert response.json() == {"detail": "Unauthenticated"}
    finally:
        get_settings.cache_clear()


def test_upload_requires_auth(monkeypatch) -> None:
    client = _client(monkeypatch)
    try:
        response = client.post("/api/images/upload")
        assert response.status_code == 401
        assert response.json() == {"detail": "Unauthenticated"}
    finally:
        get_settings.cache_clear()


def test_generate_content_requires_auth(monkeypatch) -> None:
    client = _client(monkeypatch)
    try:
        response = client.post("/api/images/1/generate-content", json={})
        assert response.status_code == 401
        assert response.json() == {"detail": "Unauthenticated"}
    finally:
        get_settings.cache_clear()


def test_image_update_schema_is_camel_case(monkeypatch) -> None:
    client = _client(monkeypatch)
    try:
        schemas = client.get("/openapi.json").json()["components"]["schemas"]
        props = set(schemas["ImageUpdate"]["properties"])
        assert {"productType", "seoTitle", "productGroupId", "compareAtPrice"} <= props
    finally:
        get_settings.cache_clear()
