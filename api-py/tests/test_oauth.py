"""OAuth helpers + connect-route contract.

Encryption fixture `NODE_SHOPIFY_CIPHERTEXT` was produced by Node
`createCipheriv("aes-256-gcm")` in `server/shopifyAdmin.ts` with a fixed 12-byte IV
so Python must decrypt existing DB rows and write ciphertext Express can still read.
"""

from __future__ import annotations

import pytest
from cryptography.exceptions import InvalidTag
from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import create_app
from app.services.shopify_crypto import decrypt_shopify_token, encrypt_shopify_token
from app.services.shopify_oauth import (
    build_shopify_oauth_authorize_url,
    create_shopify_oauth_state,
    is_valid_shopify_domain,
    normalize_shopify_domain,
    verify_shopify_hmac,
    verify_shopify_oauth_state,
)

NODE_KEY = "inventory-test-key"
NODE_TOKEN = "shpat_secret"
NODE_IV = b"0123456789ab"
NODE_SHOPIFY_CIPHERTEXT = "enc:v1:MDEyMzQ1Njc4OWFi:C7LVOp9leCVR1nixSfXw6Q:xmaCcyuFjZmhE3A-"

# createShopifyOAuthState("user_123", "shopify-secret", 1000) from Node.
NODE_OAUTH_STATE = (
    "eyJ1c2VySWQiOiJ1c2VyXzEyMyIsIm5vbmNlIjoiMGY4ZTgyZjliNjdhYzY1NzRjMjUyNzdkOTIzN2ViMWIi"
    "LCJ0cyI6MTAwMH0.15f3f10038787159044e6d8bf12579f9126e37e5326c607c280207c4e15291a0"
)
NODE_HMAC = "835e38bb619e2cb7ce07d941d41a9ce6431bc086fa27b35e9c4556af6f57e545"

BASE_ENV = {
    "DATABASE_URL": "postgresql://u:p@localhost:5432/db",
    "CLERK_SECRET_KEY": "sk_test_fake",
}


@pytest.fixture
def client(monkeypatch) -> TestClient:
    for key, value in BASE_ENV.items():
        monkeypatch.setenv(key, value)
    monkeypatch.setenv("DEV_BYPASS_AUTH", "false")
    get_settings.cache_clear()
    yield TestClient(create_app(), raise_server_exceptions=False)
    get_settings.cache_clear()


class TestShopifyCryptoParity:
    def test_decrypts_node_produced_ciphertext(self) -> None:
        assert decrypt_shopify_token(NODE_SHOPIFY_CIPHERTEXT, NODE_KEY) == NODE_TOKEN

    def test_encrypt_with_the_same_iv_matches_node_byte_for_byte(self) -> None:
        assert encrypt_shopify_token(NODE_TOKEN, NODE_KEY, iv=NODE_IV) == NODE_SHOPIFY_CIPHERTEXT

    def test_round_trip(self) -> None:
        encrypted = encrypt_shopify_token(NODE_TOKEN, NODE_KEY)
        assert encrypted.startswith("enc:v1:")
        assert encrypted != NODE_TOKEN
        assert decrypt_shopify_token(encrypted, NODE_KEY) == NODE_TOKEN

    def test_already_encrypted_is_left_alone(self) -> None:
        assert encrypt_shopify_token(NODE_SHOPIFY_CIPHERTEXT, NODE_KEY) == NODE_SHOPIFY_CIPHERTEXT

    def test_plaintext_passthrough_on_decrypt(self) -> None:
        assert decrypt_shopify_token("shpat_legacy", NODE_KEY) == "shpat_legacy"

    def test_tampered_ciphertext_is_rejected(self) -> None:
        last = "b" if NODE_SHOPIFY_CIPHERTEXT.endswith("a") else "a"
        tampered = f"{NODE_SHOPIFY_CIPHERTEXT[:-1]}{last}"
        with pytest.raises(InvalidTag):
            decrypt_shopify_token(tampered, NODE_KEY)


class TestShopifyOAuthHelpers:
    def test_normalize_domain(self) -> None:
        assert normalize_shopify_domain("snap-sync") == "snap-sync.myshopify.com"
        assert (
            normalize_shopify_domain("https://snap-sync.myshopify.com/admin")
            == "snap-sync.myshopify.com"
        )

    def test_valid_domain(self) -> None:
        assert is_valid_shopify_domain("snap-sync.myshopify.com") is True
        assert is_valid_shopify_domain("https://snap-sync.myshopify.com") is False
        assert is_valid_shopify_domain("snap-sync.example.com") is False
        assert is_valid_shopify_domain("-bad.myshopify.com") is False

    def test_hmac_accepts_node_signature(self) -> None:
        query = {
            "code": "0907a61c0c8d55e99db179b68161bc00",
            "shop": "snap-sync.myshopify.com",
            "state": "state-value",
            "timestamp": "1337178173",
            "hmac": NODE_HMAC,
        }
        assert verify_shopify_hmac(query, "shopify-secret") is True

    def test_hmac_rejects_tampered_shop(self) -> None:
        query = {
            "code": "0907a61c0c8d55e99db179b68161bc00",
            "shop": "attacker.myshopify.com",
            "state": "state-value",
            "timestamp": "1337178173",
            "hmac": NODE_HMAC,
        }
        assert verify_shopify_hmac(query, "shopify-secret") is False

    def test_verifies_node_produced_state(self) -> None:
        assert verify_shopify_oauth_state(NODE_OAUTH_STATE, "shopify-secret", now=1_500) == {
            "ok": True,
            "userId": "user_123",
        }

    def test_state_round_trip(self) -> None:
        state = create_shopify_oauth_state("user_123", "shopify-secret", now=1_000)
        assert verify_shopify_oauth_state(state, "shopify-secret", now=1_500) == {
            "ok": True,
            "userId": "user_123",
        }

    def test_state_rejects_tamper_and_expiry(self) -> None:
        state = create_shopify_oauth_state("user_123", "shopify-secret", now=1_000)
        assert verify_shopify_oauth_state(f"{state}tampered", "shopify-secret", now=1_500) == {
            "ok": False,
            "reason": "invalid_signature",
        }
        assert verify_shopify_oauth_state(state, "shopify-secret", now=11 * 60 * 1_000) == {
            "ok": False,
            "reason": "expired",
        }

    def test_authorize_url(self) -> None:
        url = build_shopify_oauth_authorize_url(
            shop="snap-sync.myshopify.com",
            api_key="key",
            scopes="read_products",
            redirect_uri="https://snapsyncai.co.uk/api/shopify/oauth/callback",
            state="abc",
        )
        assert url.startswith("https://snap-sync.myshopify.com/admin/oauth/authorize?")
        assert "client_id=key" in url
        assert "scope=read_products" in url


class TestOAuthRouteContract:
    def test_callbacks_are_public(self, client: TestClient) -> None:
        from app.db import get_session

        class _FakeSession:
            async def rollback(self) -> None:
                return None

        async def _fake_session():
            yield _FakeSession()

        client.app.dependency_overrides[get_session] = _fake_session
        try:
            shopify = client.get("/api/shopify/oauth/callback", follow_redirects=False)
            assert shopify.status_code == 302
            assert "shopify=error" in shopify.headers["location"]
        finally:
            client.app.dependency_overrides.clear()

    def test_openapi_connect_payloads_are_camel_case(self, client: TestClient) -> None:
        schemas = client.get("/openapi.json").json()["components"]["schemas"]
        assert "shopName" in schemas["ShopifyConnectResponse"]["properties"]
        assert "shopDomain" in schemas["ShopifyConnectResponse"]["properties"]
