"""Shopify OAuth helpers — port of `server/shopifyOAuth.ts`.

State tokens and callback HMACs must verify values produced by Express (and
the other way around) so a rewrite that splits start/callback across backends
does not drop the user in an `invalid_state_*` loop.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import re
import secrets
import time
from typing import Literal
from urllib.parse import urlencode

from app.config import Settings

DEFAULT_SHOPIFY_SCOPES = (
    "read_products,write_products,read_inventory,write_inventory,read_locations"
)
DEFAULT_APP_BASE_URL = "https://snapsyncai.co.uk"

SHOPIFY_SHOP_DOMAIN_RE = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$")
STATE_TTL_MS = 10 * 60 * 1000

ShopifyOAuthStateReason = Literal["malformed", "invalid_signature", "expired"]


def hmac_sha256_hex(secret: str, message: str) -> str:
    return hmac.new(secret.encode("utf-8"), message.encode("utf-8"), hashlib.sha256).hexdigest()


def timing_safe_equal_hex(left: str, right: str) -> bool:
    if not re.fullmatch(r"[a-f0-9]+", left, re.I) or not re.fullmatch(r"[a-f0-9]+", right, re.I):
        return False
    if len(left) != len(right):
        return False
    return hmac.compare_digest(bytes.fromhex(left), bytes.fromhex(right))


def normalize_shopify_domain(raw_shop: str) -> str:
    domain = re.sub(r"^https?://", "", raw_shop.strip().lower())
    domain = re.sub(r"/.*$", "", domain)
    return domain if ".myshopify.com" in domain else f"{domain}.myshopify.com"


def is_valid_shopify_domain(shop: str) -> bool:
    return bool(SHOPIFY_SHOP_DOMAIN_RE.match(shop))


def _b64url_encode(data: bytes) -> str:
    from base64 import urlsafe_b64encode

    return urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(text: str) -> bytes:
    from base64 import urlsafe_b64decode

    pad = "=" * (-len(text) % 4)
    return urlsafe_b64decode(text + pad)


def create_shopify_oauth_state(user_id: str, secret: str, now: int | None = None) -> str:
    payload = {
        "userId": user_id,
        "nonce": secrets.token_hex(16),
        "ts": int(time.time() * 1000) if now is None else now,
    }
    encoded = _b64url_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    return f"{encoded}.{hmac_sha256_hex(secret, encoded)}"


def verify_shopify_oauth_state(
    state: str,
    secret: str,
    now: int | None = None,
) -> dict:
    encoded, _, signature = state.partition(".")
    if not encoded or not signature:
        return {"ok": False, "reason": "malformed"}

    expected = hmac_sha256_hex(secret, encoded)
    if not timing_safe_equal_hex(signature, expected):
        return {"ok": False, "reason": "invalid_signature"}

    try:
        payload = json.loads(_b64url_decode(encoded).decode("utf-8"))
        ts = payload.get("ts")
        # `bool` is an `int` subclass; Express checks `typeof ts === "number"`.
        if (
            not payload.get("userId")
            or not payload.get("nonce")
            or type(ts) not in (int, float)
        ):
            return {"ok": False, "reason": "malformed"}
        clock = int(time.time() * 1000) if now is None else now
        if clock - payload["ts"] > STATE_TTL_MS:
            return {"ok": False, "reason": "expired"}
        return {"ok": True, "userId": payload["userId"]}
    except (ValueError, json.JSONDecodeError, UnicodeDecodeError):
        return {"ok": False, "reason": "malformed"}


def verify_shopify_hmac(query: dict, secret: str) -> bool:
    hmac_value = query.get("hmac")
    provided = hmac_value[0] if isinstance(hmac_value, list) else hmac_value
    if not isinstance(provided, str):
        return False

    entries: list[tuple[str, str]] = []
    for key, value in query.items():
        if key in ("hmac", "signature"):
            continue
        values = value if isinstance(value, list) else [value]
        for item in values:
            if item is None:
                continue
            entries.append((key, str(item)))

    entries.sort(key=lambda pair: (pair[0], pair[1]))
    message = "&".join(f"{key}={value}" for key, value in entries)
    return timing_safe_equal_hex(provided, hmac_sha256_hex(secret, message))


def build_shopify_oauth_authorize_url(
    *,
    shop: str,
    api_key: str,
    scopes: str,
    redirect_uri: str,
    state: str,
) -> str:
    params = urlencode(
        {
            "client_id": api_key,
            "scope": scopes,
            "redirect_uri": redirect_uri,
            "state": state,
        }
    )
    return f"https://{shop}/admin/oauth/authorize?{params}"


def shopify_oauth_config(settings: Settings) -> dict[str, str]:
    return {
        "api_key": settings.shopify_client_id_resolved or "",
        "api_secret": settings.shopify_client_secret_resolved or "",
        "scopes": settings.shopify_scopes or DEFAULT_SHOPIFY_SCOPES,
        "app_base_url": (settings.app_base_url or DEFAULT_APP_BASE_URL).rstrip("/"),
    }
