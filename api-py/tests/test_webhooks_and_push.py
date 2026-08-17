"""Auth and signature guards for marketplace push + webhook routes."""

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


PUSH_ROUTES = (
    "/api/images/push-to-shopify",
)


def test_push_routes_require_auth(monkeypatch) -> None:
    client = _client(monkeypatch)
    try:
        for path in PUSH_ROUTES:
            response = client.post(path, json={"ids": [1]})
            assert response.status_code == 401, path
            assert response.json() == {"detail": "Unauthenticated"}
    finally:
        get_settings.cache_clear()


def test_stripe_webhook_missing_signature_is_400(monkeypatch) -> None:
    client = _client(monkeypatch)
    try:
        response = client.post(
            "/api/stripe/webhook",
            content=b'{"type":"ping"}',
            headers={"content-type": "application/json"},
        )
        assert response.status_code == 400
        assert response.json() == {"error": "Missing stripe-signature"}
    finally:
        get_settings.cache_clear()
