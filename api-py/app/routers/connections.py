"""Connection status — port of the `/status` and `/disconnect` routes in
`server/routes.ts` for Shopify (2245).

Behaviour preserved exactly, including one thing that looks like a bug but is load-bearing:
every Express handler wraps its body in `try { ... } catch { return { connected: false } }`.
A database outage therefore renders as "not connected" rather than an error toast. Changing
that would change what the user sees on `Home.tsx`, so the port keeps it and confines the
swallow to the lookup — a 500 from the DB still gets logged here, which Express never did.

`connect` / OAuth start+callback live in `app/routers/oauth.py`.
"""

import logging

from fastapi import APIRouter, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.clerk import CurrentUser
from app.db import SessionDep
from app.schemas.base import CamelModel
from app.schemas.gpsr import GpsrIdentityIn
from app.services import connections
from app.services.product_facts import parse_gpsr_identity, stored_gpsr_identity

logger = logging.getLogger(__name__)

router = APIRouter(tags=["connections"])

# server/routes.ts:2255-2261 — every scope must be granted for listing inventory push.
INVENTORY_SCOPES = (
    "read_products",
    "write_products",
    "read_inventory",
    "write_inventory",
    "read_locations",
)


class ShopifyStatus(CamelModel):
    connected: bool
    shop_name: str | None = None
    shop_domain: str | None = None
    granted_scopes: list[str] | None = None
    inventory_ready: bool | None = None
    gpsr_identity: GpsrIdentityIn | None = None


async def _safe_get(getter, session: AsyncSession, user_id: str, channel: str):
    """Express swallows lookup failures into `connected: false`; keep that, but log."""
    try:
        return await getter(session, user_id)
    except Exception:
        logger.exception("%s status lookup failed for user %s", channel, user_id)
        return None


@router.get("/api/shopify/status", response_model=ShopifyStatus)
async def shopify_status(user_id: CurrentUser, session: SessionDep) -> ShopifyStatus:
    connection = await _safe_get(connections.get_shopify, session, user_id, "shopify")
    if connection is None:
        return ShopifyStatus(connected=False)

    granted = connection.granted_scopes or []
    identity, _error = parse_gpsr_identity(connection.gpsr_identity)
    gpsr = (
        GpsrIdentityIn.model_validate(stored_gpsr_identity(identity))
        if identity is not None
        else None
    )
    return ShopifyStatus(
        connected=True,
        # Express falls back to the domain when no display name was captured.
        shop_name=connection.shop_name or connection.shop_domain,
        shop_domain=connection.shop_domain,
        granted_scopes=granted,
        inventory_ready=all(scope in granted for scope in INVENTORY_SCOPES),
        gpsr_identity=gpsr,
    )


@router.put("/api/shopify/gpsr-identity", response_model=ShopifyStatus)
async def put_shop_gpsr_identity(
    body: GpsrIdentityIn, user_id: CurrentUser, session: SessionDep
) -> ShopifyStatus:
    identity, error = parse_gpsr_identity(body.model_dump(by_alias=True))
    if error or identity is None:
        raise HTTPException(status_code=400, detail=error or "GPSR identity is incomplete.")
    updated = await connections.update_shopify_gpsr(
        session, user_id, stored_gpsr_identity(identity)
    )
    if updated is None:
        raise HTTPException(
            status_code=400,
            detail="Connect Shopify before saving shop GPSR identity.",
        )
    return await shopify_status(user_id, session)


class DisconnectResponse(CamelModel):
    # Express returns `{ disconnected: true }`, not `{ success: true }`.
    disconnected: bool


@router.post("/api/shopify/disconnect", response_model=DisconnectResponse)
async def shopify_disconnect(user_id: CurrentUser, session: SessionDep) -> DisconnectResponse:
    try:
        await connections.delete_shopify(session, user_id)
        return DisconnectResponse(disconnected=True)
    except Exception:
        logger.exception("Shopify disconnect failed for user %s", user_id)
        raise HTTPException(status_code=500, detail="Failed to disconnect") from None
