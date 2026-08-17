"""AES-256-GCM token encryption — byte-compatible with `server/shopifyAdmin.ts`.

Format: `enc:v1:{iv_b64url}:{tag_b64url}:{ciphertext_b64url}`
Key: SHA-256(CONNECTION_ENCRYPTION_KEY).
"""

from __future__ import annotations

import hashlib
import hmac
from base64 import b64encode, urlsafe_b64decode, urlsafe_b64encode

from cryptography.hazmat.primitives.ciphers.aead import AESGCM


def _key(secret: str) -> bytes:
    return hashlib.sha256(secret.encode("utf-8")).digest()


def _b64url_encode(data: bytes) -> str:
    return urlsafe_b64encode(data).decode("ascii").rstrip("=")


def _b64url_decode(text: str) -> bytes:
    padding = "=" * (-len(text) % 4)
    return urlsafe_b64decode(text + padding)


def encrypt_shopify_token(token: str, secret: str) -> str:
    if token.startswith("enc:v1:"):
        return token
    import os

    iv = os.urandom(12)
    aes = AESGCM(_key(secret))
    packed = aes.encrypt(iv, token.encode("utf-8"), None)
    ciphertext, tag = packed[:-16], packed[-16:]
    return f"enc:v1:{_b64url_encode(iv)}:{_b64url_encode(tag)}:{_b64url_encode(ciphertext)}"


def decrypt_shopify_token(stored: str, secret: str) -> str:
    if not stored.startswith("enc:v1:"):
        return stored
    parts = stored.split(":")
    if len(parts) != 5 or parts[1] != "v1":
        raise ValueError("Stored Shopify credential is malformed")
    _, _, iv_text, tag_text, encrypted_text = parts
    iv = _b64url_decode(iv_text)
    tag = _b64url_decode(tag_text)
    ciphertext = _b64url_decode(encrypted_text)
    aes = AESGCM(_key(secret))
    return aes.decrypt(iv, ciphertext + tag, None).decode("utf-8")


def verify_shopify_webhook_hmac(raw_body: bytes, signature: str | None, secret: str | None) -> bool:
    """Port of `verifyShopifyWebhookHmac` in `server/shopifyAdmin.ts`.

    Compares the base64 HMAC strings (not the decoded digests), matching Node's
    `Buffer.from(expected)` default of UTF-8.
    """
    if not secret or not signature:
        return False
    expected = b64encode(
        hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).digest()
    ).decode("ascii")
    if len(expected) != len(signature):
        return False
    return hmac.compare_digest(expected, signature)
