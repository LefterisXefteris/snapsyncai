"""Shopify OAuth / connect — port of `server/routes.ts`.

Shopify start/callback/connect (~2094-2233). Disconnect routes stay on `connections.py`.
"""

from __future__ import annotations

import logging
import re
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, RedirectResponse

from app.auth.clerk import CurrentUser
from app.config import SettingsDep
from app.db import SessionDep
from app.schemas.base import CamelModel
from app.services import connections
from app.services.shopify_admin import get_shopify_shop_identity
from app.services.shopify_crypto import encrypt_shopify_token
from app.services.shopify_oauth import (
    build_shopify_oauth_authorize_url,
    create_shopify_oauth_state,
    is_valid_shopify_domain,
    normalize_shopify_domain,
    shopify_oauth_config,
    verify_shopify_hmac,
    verify_shopify_oauth_state,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["oauth"])


class ShopifyConnectBody(CamelModel):
    shop_domain: str | None = None
    access_token: str | None = None


class ShopifyConnectResponse(CamelModel):
    connected: bool
    shop_name: str
    shop_domain: str


def _message(status_code: int, message: str) -> JSONResponse:
    # Express returns `{ message }` — the SPA reads `data.message` on connect failures.
    return JSONResponse(status_code=status_code, content={"message": message})


def _query_map(request: Request) -> dict[str, str | list[str]]:
    collected: dict[str, str | list[str]] = {}
    for key, value in request.query_params.multi_items():
        existing = collected.get(key)
        if existing is None:
            collected[key] = value
        elif isinstance(existing, list):
            existing.append(value)
        else:
            collected[key] = [existing, value]
    return collected


def _query_str(query: dict[str, str | list[str]], key: str) -> str:
    value = query.get(key, "")
    if isinstance(value, list):
        return value[0] if value else ""
    return value if isinstance(value, str) else ""


# --- Shopify ----------------------------------------------------------------


@router.get("/api/shopify/oauth/start", response_model=None)
async def shopify_oauth_start(
    request: Request,
    user_id: CurrentUser,
    settings: SettingsDep,
) -> RedirectResponse | JSONResponse:
    try:
        config = shopify_oauth_config(settings)
        if not config["api_key"] or not config["api_secret"]:
            return _message(
                500,
                "Shopify OAuth is not configured. Set SHOPIFY_API_KEY and SHOPIFY_API_SECRET.",
            )

        raw_shop = _query_str(_query_map(request), "shop")
        shop = normalize_shopify_domain(raw_shop) if raw_shop else ""
        if not shop or not is_valid_shopify_domain(shop):
            return _message(400, "Invalid Shopify shop domain. Use your-store.myshopify.com.")

        redirect_uri = f"{config['app_base_url']}/api/shopify/oauth/callback"
        state = create_shopify_oauth_state(user_id, config["api_secret"])
        auth_url = build_shopify_oauth_authorize_url(
            shop=shop,
            api_key=config["api_key"],
            scopes=config["scopes"],
            redirect_uri=redirect_uri,
            state=state,
        )
        return RedirectResponse(url=auth_url, status_code=302)
    except Exception:
        logger.exception("Shopify OAuth start error")
        return _message(500, "Failed to start Shopify authorization")


@router.get("/api/shopify/oauth/callback")
async def shopify_oauth_callback(
    request: Request,
    session: SessionDep,
    settings: SettingsDep,
) -> RedirectResponse:
    config = shopify_oauth_config(settings)

    def fail(reason: str) -> RedirectResponse:
        params = urlencode({"shopify": "error", "reason": reason})
        return RedirectResponse(url=f"{config['app_base_url']}/?{params}", status_code=302)

    try:
        if not config["api_key"] or not config["api_secret"]:
            return fail("not_configured")

        query = _query_map(request)
        code = _query_str(query, "code")
        raw_shop = _query_str(query, "shop")
        shop = normalize_shopify_domain(raw_shop) if raw_shop else ""
        state = _query_str(query, "state")

        if not code:
            return fail("missing_code")
        if not shop or not is_valid_shopify_domain(shop):
            return fail("invalid_shop")
        if not verify_shopify_hmac(query, config["api_secret"]):
            return fail("invalid_hmac")

        state_result = verify_shopify_oauth_state(state, config["api_secret"])
        if not state_result.get("ok"):
            return fail(f"invalid_state_{state_result.get('reason')}")

        async with httpx.AsyncClient(timeout=30.0) as client:
            token_response = await client.post(
                f"https://{shop}/admin/oauth/access_token",
                headers={"Content-Type": "application/json", "Accept": "application/json"},
                json={
                    "client_id": config["api_key"],
                    "client_secret": config["api_secret"],
                    "code": code,
                },
            )

        if not token_response.is_success:
            logger.error(
                "Shopify OAuth token exchange failed: %s %s",
                token_response.status_code,
                token_response.text,
            )
            return fail("token_exchange_failed")

        token_data = token_response.json()
        access_token = token_data.get("access_token")
        if not access_token:
            return fail("token_exchange_failed")

        granted = {
            scope.strip()
            for scope in (token_data.get("scope") or "").split(",")
            if scope.strip()
        }
        required = [scope.strip() for scope in config["scopes"].split(",") if scope.strip()]
        if any(scope not in granted for scope in required):
            return fail("missing_inventory_scopes")

        identity = await get_shopify_shop_identity(shop, access_token)
        shop_name = identity["name"] or shop.replace(".myshopify.com", "")

        await connections.upsert_shopify(
            session,
            session_id=state_result["userId"],
            shop_domain=shop,
            access_token=encrypt_shopify_token(
                access_token, settings.connection_encryption_key or ""
            ),
            shop_name=shop_name,
            granted_scopes=list(granted),
        )

        params = urlencode({"shopify": "connected"})
        return RedirectResponse(url=f"{config['app_base_url']}/?{params}", status_code=302)
    except Exception:
        logger.exception("Shopify OAuth callback error")
        await session.rollback()
        return fail("unexpected_error")


@router.post("/api/shopify/connect", response_model=ShopifyConnectResponse)
async def shopify_connect(
    body: ShopifyConnectBody,
    user_id: CurrentUser,
    session: SessionDep,
    settings: SettingsDep,
) -> ShopifyConnectResponse | JSONResponse:
    try:
        if not body.shop_domain or not body.access_token:
            return _message(400, "Store URL and access token are required")

        domain = re.sub(r"^https?://", "", body.shop_domain)
        if domain.endswith("/"):
            domain = domain[:-1]
        full_domain = domain if ".myshopify.com" in domain else f"{domain}.myshopify.com"

        identity = await get_shopify_shop_identity(full_domain, body.access_token)
        shop_name = identity["name"] or full_domain.replace(".myshopify.com", "")

        await connections.upsert_shopify(
            session,
            session_id=user_id,
            shop_domain=full_domain,
            access_token=encrypt_shopify_token(
                body.access_token, settings.connection_encryption_key or ""
            ),
            shop_name=shop_name,
            granted_scopes=identity["granted_scopes"],
        )
        return ShopifyConnectResponse(connected=True, shop_name=shop_name, shop_domain=full_domain)
    except Exception:
        logger.exception("Shopify connect error")
        await session.rollback()
        return _message(500, "Failed to connect to Shopify")
