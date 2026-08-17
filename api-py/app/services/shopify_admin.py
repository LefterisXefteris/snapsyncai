"""Shopify Admin GraphQL helpers used by OAuth/connect.

Only `get_shopify_shop_identity` is needed here. The rest of `server/shopifyAdmin.ts`
(inventory mutations, webhooks, product create) lands with those routers.
"""

from __future__ import annotations

import asyncio
from typing import Any

import httpx

from app.services.shopify_crypto import decrypt_shopify_token

SHOPIFY_API_VERSION = "2026-07"

_IDENTITY_QUERY = """
    query SnapSyncShopIdentity {
      shop { name }
      currentAppInstallation {
        accessScopes { handle }
      }
    }
"""


async def shopify_graphql(
    shop_domain: str,
    access_token: str,
    query: str,
    variables: dict[str, Any] | None = None,
    *,
    key_source: str | None = None,
) -> dict[str, Any]:
    token = decrypt_shopify_token(access_token, key_source)
    endpoint = f"https://{shop_domain}/admin/api/{SHOPIFY_API_VERSION}/graphql.json"

    async with httpx.AsyncClient(timeout=30.0) as client:
        for attempt in range(3):
            response = await client.post(
                endpoint,
                headers={
                    "Content-Type": "application/json",
                    "X-Shopify-Access-Token": token,
                },
                json={"query": query, "variables": variables or {}},
            )
            if response.status_code == 429 or response.status_code >= 500:
                if attempt == 2:
                    raise RuntimeError(
                        f"Shopify GraphQL request failed with {response.status_code}"
                    )
                retry_after = float(response.headers.get("retry-after") or 0)
                await asyncio.sleep(retry_after if retry_after > 0 else 0.25 * 2**attempt)
                continue

            body = response.json()
            errors = body.get("errors") or []
            if not response.is_success or errors:
                message = "; ".join(
                    error.get("message", "") for error in errors if error.get("message")
                )
                raise RuntimeError(
                    message or f"Shopify GraphQL request failed with {response.status_code}"
                )
            data = body.get("data")
            if not data:
                raise RuntimeError("Shopify returned an empty GraphQL response")
            return data

    raise RuntimeError("Shopify GraphQL request exhausted retries")


async def get_shopify_shop_identity(
    shop_domain: str,
    access_token: str,
    *,
    key_source: str | None = None,
) -> dict[str, Any]:
    data = await shopify_graphql(
        shop_domain, access_token, _IDENTITY_QUERY, key_source=key_source
    )
    installation = data.get("currentAppInstallation") or {}
    scopes = installation.get("accessScopes") or []
    return {
        "name": (data.get("shop") or {}).get("name"),
        "granted_scopes": [scope.get("handle") for scope in scopes if scope.get("handle")],
    }
