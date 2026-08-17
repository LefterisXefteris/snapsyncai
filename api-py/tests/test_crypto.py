from app.services.crypto import (
    decrypt_shopify_token,
    encrypt_shopify_token,
    verify_shopify_webhook_hmac,
)


def test_round_trip() -> None:
    secret = "test-connection-key"
    token = "shpat_live_example_token"
    stored = encrypt_shopify_token(token, secret)
    assert stored.startswith("enc:v1:")
    assert decrypt_shopify_token(stored, secret) == token


def test_plaintext_passthrough() -> None:
    assert decrypt_shopify_token("shpat_plain", "secret") == "shpat_plain"


def test_already_encrypted_is_not_double_wrapped() -> None:
    secret = "k"
    once = encrypt_shopify_token("tok", secret)
    assert encrypt_shopify_token(once, secret) == once


def test_shopify_webhook_hmac_accepts_matching_signature() -> None:
    import hashlib
    import hmac
    from base64 import b64encode

    body = b'{"hello":"shopify"}'
    secret = "shpss_test"
    expected = b64encode(hmac.new(secret.encode(), body, hashlib.sha256).digest()).decode()
    assert verify_shopify_webhook_hmac(body, expected, secret) is True
    assert verify_shopify_webhook_hmac(body, None, secret) is False
    assert verify_shopify_webhook_hmac(body, expected, None) is False
    assert verify_shopify_webhook_hmac(body, "nope", secret) is False
