"""Scaffold guarantees the rest of the migration leans on."""

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.config import Settings, get_settings
from app.db import build_engine_url
from app.main import create_app
from app.schemas.base import CamelModel, to_camel


@pytest.fixture
def client(monkeypatch) -> TestClient:
    monkeypatch.setenv("DATABASE_URL", "postgresql://u:p@localhost:5432/db")
    get_settings.cache_clear()  # settings are lru_cached; don't leak across tests
    yield TestClient(create_app())
    get_settings.cache_clear()


def test_health_is_reachable(client: TestClient) -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "snapsyncai-api"}


def test_cors_allows_www_with_credentials_when_configured(monkeypatch) -> None:
    monkeypatch.setenv("DATABASE_URL", "postgresql://u:p@localhost:5432/db")
    monkeypatch.setenv(
        "CORS_ALLOW_ORIGINS",
        "https://www.snapsyncai.co.uk,https://snapsyncai.co.uk",
    )
    get_settings.cache_clear()
    client = TestClient(create_app())
    try:
        response = client.get(
            "/api/health",
            headers={"Origin": "https://www.snapsyncai.co.uk"},
        )
        assert response.status_code == 200
        assert response.headers["access-control-allow-origin"] == "https://www.snapsyncai.co.uk"
        assert response.headers["access-control-allow-credentials"] == "true"
    finally:
        get_settings.cache_clear()


def test_missing_database_url_fails_at_startup(monkeypatch) -> None:
    monkeypatch.delenv("DATABASE_URL", raising=False)
    with pytest.raises(ValidationError, match="database_url"):
        Settings(_env_file=None)  # type: ignore[call-arg]


class TestSupabasePoolerUrl:
    """`server/db.ts` hand-parses DATABASE_URL to survive these two cases."""

    URL = (
        "postgresql://postgres.ubgdfnnidnhvakcchxbw:p%40ss%2Fw0rd"
        "@aws-0-eu-west-2.pooler.supabase.com:6543/postgres"
    )

    def test_dotted_username_is_not_mistaken_for_a_host(self) -> None:
        url = build_engine_url(self.URL)
        assert url.username == "postgres.ubgdfnnidnhvakcchxbw"
        assert url.host == "aws-0-eu-west-2.pooler.supabase.com"
        assert url.port == 6543

    def test_percent_encoded_password_is_decoded(self) -> None:
        assert build_engine_url(self.URL).password == "p@ss/w0rd"

    def test_rejects_url_without_host(self) -> None:
        with pytest.raises(ValueError, match="no host"):
            build_engine_url("postgresql:///postgres")


class TestCamelCaseContract:
    """The SPA reads camelCase keys structurally; breaking this breaks the client."""

    def test_to_camel(self) -> None:
        assert to_camel("product_group_id") == "productGroupId"
        assert to_camel("id") == "id"

    def test_model_serialises_to_camel_case(self) -> None:
        class Probe(CamelModel):
            product_group_id: str | None
            shopify_status: str

        dumped = Probe(shopify_status="pending", product_group_id="g1").model_dump(by_alias=True)
        assert dumped == {"productGroupId": "g1", "shopifyStatus": "pending"}

    def test_openapi_schema_uses_camel_case(self, client: TestClient) -> None:
        """This is what makes the generated TS match what the client already reads."""
        schema = client.get("/openapi.json").json()
        properties = schema["components"]["schemas"]["DbHealthResponse"]["properties"]
        assert "databaseOk" in properties
        assert "database_ok" not in properties
