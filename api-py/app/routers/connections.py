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

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.clerk import CurrentUser
from app.config import SettingsDep
from app.db import SessionDep
from app.schemas.base import CamelModel
from app.schemas.gpsr import GpsrIdentityIn
from app.services import connections
from app.services import images as store
from app.services.product_facts import (
    merge_product_facts,
    parse_gpsr_identity,
    stale_for_shop_gpsr_save,
    stored_from_facts,
    stored_gpsr_identity,
)

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
PUBLICATION_SCOPES = (
    "read_publications",
    "write_publications",
)


class ShopifyStatus(CamelModel):
    connected: bool
    shop_name: str | None = None
    shop_domain: str | None = None
    granted_scopes: list[str] | None = None
    inventory_ready: bool | None = None
    publications_ready: bool | None = None
    gpsr_identity: GpsrIdentityIn | None = None


class ShopifyPublicationOut(CamelModel):
    id: str
    name: str
    published: bool = False


class ShopifyPublicationsResponse(CamelModel):
    connected: bool
    publications_ready: bool
    product_status: str | None = None
    publications: list[ShopifyPublicationOut]


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
        publications_ready=all(scope in granted for scope in PUBLICATION_SCOPES),
        gpsr_identity=gpsr,
    )


@router.get("/api/shopify/publications", response_model=ShopifyPublicationsResponse)
async def shopify_publications(
    user_id: CurrentUser,
    session: SessionDep,
    settings: SettingsDep,
    image_id: int | None = Query(default=None, alias="imageId"),
) -> ShopifyPublicationsResponse:
    connection = await _safe_get(connections.get_shopify, session, user_id, "shopify")
    if connection is None:
        return ShopifyPublicationsResponse(connected=False, publications_ready=False, publications=[])

    granted = connection.granted_scopes or []
    ready = all(scope in granted for scope in PUBLICATION_SCOPES)
    if not ready:
        return ShopifyPublicationsResponse(connected=True, publications_ready=False, publications=[])

    from app.services.shopify import list_shopify_publications, product_publishing

    try:
        listed = await list_shopify_publications(connection, settings)
    except Exception:
        logger.exception("Shopify publications lookup failed for user %s", user_id)
        return ShopifyPublicationsResponse(connected=True, publications_ready=False, publications=[])

    published: set[str] = set()
    product_status = None
    if image_id is not None:
        image = await store.get_image(session, image_id, user_id)
        if image is not None and image.session_id == user_id and image.shopify_product_id:
            try:
                product_status, published = await product_publishing(
                    connection, settings, image.shopify_product_id
                )
            except Exception:
                logger.exception(
                    "Shopify product publications lookup failed for image %s", image_id
                )

    return ShopifyPublicationsResponse(
        connected=True,
        publications_ready=True,
        product_status=product_status,
        publications=[
            ShopifyPublicationOut(
                id=item["id"],
                name=item["name"],
                published=item["id"] in published,
            )
            for item in listed
        ],
    )


async def _stale_shop_default_products(session, user_id: str) -> None:
    rows = await store.list_images(session, user_id)
    seen: set[str | int] = set()
    for image in rows:
        key: str | int | None = image.product_group_id or image.id
        if key is None or key in seen:
            continue
        seen.add(key)
        group = (
            [img for img in rows if img.product_group_id == image.product_group_id]
            if image.product_group_id
            else [image]
        )
        facts = merge_product_facts([img.product_facts for img in group])
        staled = stale_for_shop_gpsr_save(facts, store.listing_copy_from_images(group))
        if staled.listing_copy_stale != facts.listing_copy_stale:
            await store.persist_product_facts(session, image, stored_from_facts(staled))


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
    await _stale_shop_default_products(session, user_id)
    return await shopify_status(user_id, session)


class DisconnectResponse(CamelModel):
    # Express returns `{ disconnected: true }`, not `{ success: true }`.
    disconnected: bool


@router.post("/api/shopify/disconnect", response_model=DisconnectResponse)
async def shopify_disconnect(
    user_id: CurrentUser, session: SessionDep, settings: SettingsDep
) -> DisconnectResponse:
    try:
        from app.services.inventory.service import disable_inventory_for_user

        await disable_inventory_for_user(session, settings, user_id)
        await connections.delete_shopify(session, user_id)
        return DisconnectResponse(disconnected=True)
    except Exception:
        logger.exception("Shopify disconnect failed for user %s", user_id)
        raise HTTPException(status_code=500, detail="Failed to disconnect") from None
