"""AES-256-GCM token encryption — byte-compatible with `server/shopifyAdmin.ts`.

Existing `shopify_connections.access_token` rows were written by Node as
`enc:v1:{iv}:{tag}:{ciphertext}` (all base64url, no padding). The key is
SHA-256(CONNECTION_ENCRYPTION_KEY) as raw bytes, 12-byte IV, 16-byte GCM tag.
Decrypting a Node-produced value here (and vice versa) is load-bearing: mixed
Express/FastAPI traffic during the strangler migration reads the same rows.
"""

from __future__ import annotations

import hashlib
import os
from base64 import urlsafe_b64decode, urlsafe_b64encode

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

_PREFIX = "enc:v1:"
_GCM_TAG_LEN = 16
_GCM_IV_LEN = 12


def _b64url_encode(data: bytes) -> str:
    return urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(text: str) -> bytes:
    pad = "=" * (-len(text) % 4)
    return urlsafe_b64decode(text + pad)


def _key_bytes(key_source: str) -> bytes:
    if not key_source:
        raise RuntimeError("CONNECTION_ENCRYPTION_KEY is required to store Shopify credentials")
    return hashlib.sha256(key_source.encode("utf-8")).digest()


def encrypt_shopify_token(token: str, key_source: str, *, iv: bytes | None = None) -> str:
    if token.startswith(_PREFIX):
        return token
    key = _key_bytes(key_source)
    nonce = iv if iv is not None else os.urandom(_GCM_IV_LEN)
    if len(nonce) != _GCM_IV_LEN:
        raise ValueError("AES-256-GCM nonce must be 12 bytes")
    packed = AESGCM(key).encrypt(nonce, token.encode("utf-8"), None)
    ciphertext, tag = packed[:-_GCM_TAG_LEN], packed[-_GCM_TAG_LEN:]
    return f"{_PREFIX}{_b64url_encode(nonce)}:{_b64url_encode(tag)}:{_b64url_encode(ciphertext)}"


def decrypt_shopify_token(stored_token: str, key_source: str | None = None) -> str:
    if not stored_token.startswith(_PREFIX):
        return stored_token
    _version, iv_text, tag_text, encrypted_text = _split_v1(stored_token)
    key = _key_bytes(key_source or "")
    packed = _b64url_decode(encrypted_text) + _b64url_decode(tag_text)
    return AESGCM(key).decrypt(_b64url_decode(iv_text), packed, None).decode("utf-8")


def _split_v1(stored_token: str) -> tuple[str, str, str, str]:
    # "enc:v1:iv:tag:ciphertext" — split(":") gives ["enc", "v1", iv, tag, ciphertext]
    parts = stored_token.split(":")
    if len(parts) != 5 or parts[0] != "enc" or parts[1] != "v1" or not all(parts[2:]):
        raise ValueError("Stored Shopify credential is malformed")
    return parts[1], parts[2], parts[3], parts[4]
