"""Conversation HTTP contract — the dialogue is authenticated. No database.

Seam: `/api/conversation`.
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


def test_conversation_requires_auth(monkeypatch) -> None:
    client = _client(monkeypatch)
    try:
        for method in ("GET", "POST"):
            response = client.request(method, "/api/conversation", json={"text": "what is on hand"})
            assert response.status_code == 401, method
            assert response.json() == {"detail": "Unauthenticated"}
    finally:
        get_settings.cache_clear()
