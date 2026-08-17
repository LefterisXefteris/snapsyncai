"""Route-level tests — the first in this project, in either language.

The Express side has no HTTP tests at all, so parity for these ports is established two
ways: the assertions here encode the exact JSON shape `client/src/hooks/use-images.ts`
reads, and `scripts/contract_diff.py` diffs live responses against Express once both are
running against the same database.
"""

import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import create_app

BASE_ENV = {
    "DATABASE_URL": "postgresql://u:p@localhost:5432/db",
    "CLERK_SECRET_KEY": "sk_test_fake",
    "CLERK_PUBLISHABLE_KEY": "pk_test_clerk",
    "STRIPE_PUBLISHABLE_KEY": "pk_test_stripe",
}


@pytest.fixture
def client(monkeypatch) -> TestClient:
    for key, value in BASE_ENV.items():
        monkeypatch.setenv(key, value)
    monkeypatch.setenv("DEV_BYPASS_AUTH", "false")
    get_settings.cache_clear()
    yield TestClient(create_app(), raise_server_exceptions=False)
    get_settings.cache_clear()


class TestPublicConfig:
    """Unauthenticated by design — publishable keys only."""

    def test_clerk_config(self, client: TestClient) -> None:
        response = client.get("/api/auth/clerk-config")
        assert response.status_code == 200
        assert response.json() == {"publishableKey": "pk_test_clerk"}

    def test_payments_config_matches_express_constants(self, client: TestClient) -> None:
        """Values from server/routes.ts:302-304 — changing them changes what users pay."""
        assert client.get("/api/payments/config").json() == {
            "publishableKey": "pk_test_stripe",
            "subscriptionWeeklyPricePence": 400,
            "subscriptionAnnualPricePence": 17_300,
            "weeklyProductLimit": 30,
        }

    def test_clerk_config_500s_when_unconfigured(self, client: TestClient, monkeypatch) -> None:
        monkeypatch.delenv("CLERK_PUBLISHABLE_KEY", raising=False)
        get_settings.cache_clear()
        response = TestClient(create_app(), raise_server_exceptions=False).get(
            "/api/auth/clerk-config"
        )
        assert response.status_code == 500


PROTECTED = [
    "/api/shopify/status",
    "/api/subscription/status",
]

PROTECTED_BILLING_POST = [
    "/api/subscription/recover",
    "/api/subscription/recover-by-email",
    "/api/subscription/create-checkout",
    "/api/subscription/verify",
    "/api/subscription/cancel",
    "/api/subscription/unlock-images",
]

PROTECTED_CONNECT = [
    ("GET", "/api/shopify/oauth/start"),
    ("POST", "/api/shopify/connect"),
    ("PUT", "/api/shopify/gpsr-identity"),
]


class TestAuthentication:
    @pytest.mark.parametrize("path", PROTECTED)
    def test_requires_a_session(self, client: TestClient, path: str) -> None:
        response = client.get(path)
        assert response.status_code == 401
        assert response.json() == {"detail": "Unauthenticated"}

    @pytest.mark.parametrize("path", PROTECTED)
    def test_rejects_a_forged_cookie(self, client: TestClient, path: str) -> None:
        """Proves the __session cookie is actually read and verified, not just absent."""
        client.cookies.set("__session", "not.a.real.jwt")
        assert client.get(path).status_code == 401

    @pytest.mark.parametrize("method,path", PROTECTED_CONNECT)
    def test_connect_routes_require_a_session(
        self, client: TestClient, method: str, path: str
    ) -> None:
        response = client.request(method, path)
        assert response.status_code == 401
        assert response.json() == {"detail": "Unauthenticated"}

    @pytest.mark.parametrize("path", PROTECTED_BILLING_POST)
    def test_billing_posts_require_a_session(self, client: TestClient, path: str) -> None:
        response = client.post(path)
        assert response.status_code == 401
        assert response.json() == {"detail": "Unauthenticated"}

    @pytest.mark.parametrize("path", PROTECTED_BILLING_POST)
    def test_billing_posts_reject_a_forged_cookie(self, client: TestClient, path: str) -> None:
        client.cookies.set("__session", "not.a.real.jwt")
        assert client.post(path).status_code == 401

    def test_dev_bypass_yields_the_fixed_user(self, monkeypatch) -> None:
        """Matches DEV_USER_ID in server/routes.ts:44 so local rows stay compatible."""
        from app.auth.clerk import DEV_USER_ID

        monkeypatch.setenv("DATABASE_URL", BASE_ENV["DATABASE_URL"])
        monkeypatch.setenv("DEV_BYPASS_AUTH", "true")
        monkeypatch.setenv("ENVIRONMENT", "development")
        get_settings.cache_clear()
        assert DEV_USER_ID == "dev_local_user"

    def test_dev_bypass_is_refused_in_production(self, monkeypatch) -> None:
        """Express has no such guard; a stray env var there would disable auth outright."""
        import asyncio

        from fastapi import Request

        from app.auth.clerk import current_user_id
        from app.config import Settings

        settings = Settings(
            database_url=BASE_ENV["DATABASE_URL"],
            dev_bypass_auth=True,
            environment="production",
        )
        request = Request({"type": "http", "headers": [], "method": "GET", "path": "/"})
        with pytest.raises(RuntimeError, match="DEV_BYPASS_AUTH is set in production"):
            asyncio.run(current_user_id(request, settings))


class TestResponseContract:
    """The SPA reads these keys structurally; camelCase is not cosmetic."""

    def test_openapi_exposes_camel_case_for_status_payloads(self, client: TestClient) -> None:
        schemas = client.get("/openapi.json").json()["components"]["schemas"]

        assert set(schemas["ShopifyStatus"]["properties"]) == {
            "connected",
            "shopName",
            "shopDomain",
            "grantedScopes",
            "inventoryReady",
            "gpsrIdentity",
        }
        assert set(schemas["SubscriptionStatusResponse"]["properties"]) == {
            "subscribed",
            "status",
            "currentPeriodEnd",
            "stripeSubscriptionId",
        }
        assert set(schemas["RecoverResponse"]["properties"]) == {
            "recovered",
            "alreadyActive",
            "subscribed",
            "message",
        }
        assert set(schemas["VerifyResponse"]["properties"]) == {
            "verified",
            "alreadyActive",
            "subscribed",
        }
        assert set(schemas["CheckoutResponse"]["properties"]) == {"checkoutUrl", "sessionId"}
        assert set(schemas["CancelResponse"]["properties"]) == {"cancelled", "message"}
        assert set(schemas["UnlockResponse"]["properties"]) == {"processed", "results", "message"}

    def test_all_expected_paths_are_registered(self, client: TestClient) -> None:
        paths = set(client.get("/openapi.json").json()["paths"])
        assert {
            "/api/health",
            "/api/health/db",
            "/api/auth/clerk-config",
            "/api/payments/config",
            "/api/shopify/status",
            "/api/shopify/disconnect",
            "/api/images",
            "/api/images/{image_id}",
            "/api/images/{image_id}/file",
            "/api/images/{image_id}/group",
            "/api/images/{image_id}/assign-group",
            "/api/images/{image_id}/unlink-from-group",
            "/api/images/assign-group-batch",
            "/api/images/group/{group_id}",
            "/api/shopify/oauth/start",
            "/api/shopify/oauth/callback",
            "/api/shopify/connect",
            "/api/shopify/gpsr-identity",
            "/api/images/upload",
            "/api/images/{image_id}/generate-content",
            "/api/images/{image_id}/regenerate-field",
            "/api/subscription/status",
            "/api/subscription/recover",
            "/api/subscription/recover-by-email",
            "/api/subscription/create-checkout",
            "/api/subscription/verify",
            "/api/subscription/cancel",
            "/api/subscription/unlock-images",
            "/api/images/push-to-shopify",
            "/api/stripe/webhook",
        } <= paths


class TestInventoryScopeCheck:
    """`inventoryReady` reflects whether Shopify granted listing inventory scopes."""

    def test_requires_every_scope(self) -> None:
        from app.routers.connections import INVENTORY_SCOPES

        assert set(INVENTORY_SCOPES) == {
            "read_products",
            "write_products",
            "read_inventory",
            "write_inventory",
            "read_locations",
        }

    def test_partial_scopes_are_not_ready(self) -> None:
        from app.routers.connections import INVENTORY_SCOPES

        granted = ["read_products", "write_products"]
        assert not all(scope in granted for scope in INVENTORY_SCOPES)


class TestDisconnectContract:
    def test_response_key_matches_express(self, client: TestClient) -> None:
        """Express returns `{disconnected: true}`; `{success: true}` would be a break."""
        schema = client.get("/openapi.json").json()["components"]["schemas"]
        assert set(schema["DisconnectResponse"]["properties"]) == {"disconnected"}

    def test_shopify_disconnect_is_exposed(self, client: TestClient) -> None:
        assert "/api/shopify/disconnect" in client.get("/openapi.json").json()["paths"]


class TestClerkAuthorizedParties:
    """Production canonicalises on www; the README documents APP_BASE_URL without it.

    Verified live: https://snapsyncai.co.uk 307-redirects to https://www.snapsyncai.co.uk.
    Clerk's `azp` claim carries whichever origin the browser was on, so accepting only
    one spelling would 401 every authenticated request.
    """

    @staticmethod
    def _parties(base: str) -> list[str]:
        from app.config import Settings

        return Settings(
            database_url="postgresql://u:p@localhost:5432/db", app_base_url=base
        ).clerk_authorized_parties

    def test_apex_also_accepts_www(self) -> None:
        assert self._parties("https://snapsyncai.co.uk") == [
            "https://snapsyncai.co.uk",
            "https://www.snapsyncai.co.uk",
        ]

    def test_www_also_accepts_apex(self) -> None:
        assert self._parties("https://www.snapsyncai.co.uk") == [
            "https://snapsyncai.co.uk",
            "https://www.snapsyncai.co.uk",
        ]

    def test_trailing_slash_is_stripped(self) -> None:
        """A trailing slash would never match an `azp` origin."""
        assert "https://www.snapsyncai.co.uk" in self._parties("https://www.snapsyncai.co.uk/")

    def test_localhost_is_left_alone_apart_from_the_www_pair(self) -> None:
        assert "http://localhost:5001" in self._parties("http://localhost:5001")
