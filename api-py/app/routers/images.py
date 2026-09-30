"""Image CRUD + grouping + Shopify push — port of `server/routes.ts`."""

import logging

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse, RedirectResponse, Response

from app.auth.clerk import CurrentUser
from app.config import SettingsDep
from app.db import SessionDep
from app.schemas.image import (
    LIST_EXCLUDE,
    AcceptGeneratedListingCopyBody,
    AssignGroupBatchBody,
    AssignGroupBody,
    ConfirmProductFactsBody,
    DeletedResponse,
    ImageListOut,
    ImageOut,
    ImageUpdate,
    ListingCopyRefreshAcceptBody,
    ListingCopyRefreshDismissBody,
    ListingCopyRefreshOut,
    ListingCopyRefreshRegenerateBody,
    OkResponse,
    OkUpdatedResponse,
    PushIdsBody,
    PushResponse,
    with_facts_outcomes,
)
from app.services import catalogue_cache, connections
from app.services import images as store
from app.services.listing_copy_accept import Accepted, accept_generated, accept_refresh
from app.services.listing_copy_propose import Proposed, propose_refresh
from app.services.listing_copy_refresh import search_demand_configured
from app.services.listing_copy_trace import (
    listing_copy_trace_store,
    mark_refresh,
)
from app.services.product_facts import (
    confirm_facts,
    merge_product_facts,
    stored_from_facts,
)
from app.services.push import push_products
from app.services.shopify import ShopifyGraphQLForDep

logger = logging.getLogger(__name__)

router = APIRouter(tags=["images"])


def _owned(image, user_id: str) -> bool:
    return image is not None and image.session_id == user_id


async def _sync_product_facts(session, user_id: str, image) -> None:
    group = await store.get_image_group(session, image.id, user_id)
    merged = merge_product_facts([img.product_facts for img in group])
    await store.persist_product_facts(session, image, stored_from_facts(merged))


def _catalogue_payload(items: list[ImageListOut]) -> list[dict]:
    return [
        item.model_dump(by_alias=True, mode="json", exclude=LIST_EXCLUDE) for item in items
    ]


def _image_out(image, settings, shop_gpsr=None, *, list_item: bool = False):
    return with_facts_outcomes(
        image,
        shop_gpsr,
        list_item=list_item,
        demand_configured=search_demand_configured(
            settings.search_demand_api_key,
            settings.search_demand_url,
            settings.search_demand_login,
        ),
    )


@router.get("/api/images", response_model=list[ImageListOut], response_model_exclude=LIST_EXCLUDE)
async def list_images(
    user_id: CurrentUser, session: SessionDep, settings: SettingsDep
) -> list[ImageListOut] | JSONResponse:
    cached = await catalogue_cache.get(user_id)
    if cached is not None:
        return JSONResponse(content=cached)
    try:
        rows = await store.list_images(session, user_id)
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to fetch images") from None
    items = [_image_out(row, settings, list_item=True) for row in rows]
    await catalogue_cache.put(user_id, _catalogue_payload(items))
    return items


@router.get(
    "/api/images/{image_id}/group",
    response_model=list[ImageListOut],
    response_model_exclude=LIST_EXCLUDE,
)
async def get_group(
    image_id: int, user_id: CurrentUser, session: SessionDep, settings: SettingsDep
) -> list[ImageListOut]:
    try:
        rows = await store.get_image_group(session, image_id, user_id)
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to fetch product group") from None
    return [_image_out(row, settings, list_item=True) for row in rows]


@router.post("/api/images/{image_id}/unlink-from-group", response_model=OkResponse)
async def unlink_from_group(image_id: int, user_id: CurrentUser, session: SessionDep) -> OkResponse:
    image = await store.get_image(session, image_id, user_id)
    if not _owned(image, user_id):
        raise HTTPException(status_code=404, detail="Image not found")
    await store.update_image(session, image_id, {"product_group_id": None}, user_id)
    return OkResponse()


@router.post("/api/images/assign-group-batch", response_model=OkUpdatedResponse)
async def assign_group_batch(
    body: AssignGroupBatchBody, user_id: CurrentUser, session: SessionDep
) -> OkUpdatedResponse:
    if not body.product_group_id or not body.image_ids:
        raise HTTPException(status_code=400, detail="imageIds array and productGroupId required")
    updated = 0
    for image_id in body.image_ids:
        image = await store.get_image(session, image_id, user_id)
        if _owned(image, user_id):
            await store.update_image(
                session, image_id, {"product_group_id": body.product_group_id}, user_id
            )
            updated += 1
    if body.primary_image_id:
        primary = await store.get_image(session, body.primary_image_id, user_id)
        if _owned(primary, user_id) and not primary.product_group_id:
            await store.update_image(
                session,
                body.primary_image_id,
                {"product_group_id": body.product_group_id},
                user_id,
            )
            updated += 1
    synced = await store.get_image(session, body.image_ids[0], user_id)
    if _owned(synced, user_id):
        await _sync_product_facts(session, user_id, synced)
    return OkUpdatedResponse(updated=updated)


@router.post("/api/images/{image_id}/assign-group", response_model=OkResponse)
async def assign_group(
    image_id: int, body: AssignGroupBody, user_id: CurrentUser, session: SessionDep
) -> OkResponse:
    if not body.product_group_id:
        raise HTTPException(status_code=400, detail="productGroupId required")
    image = await store.get_image(session, image_id, user_id)
    if not _owned(image, user_id):
        raise HTTPException(status_code=404, detail="Image not found")
    await store.update_image(
        session, image_id, {"product_group_id": body.product_group_id}, user_id
    )
    if body.primary_image_id and body.primary_image_id != image_id:
        primary = await store.get_image(session, body.primary_image_id, user_id)
        if _owned(primary, user_id) and not primary.product_group_id:
            await store.update_image(
                session,
                body.primary_image_id,
                {"product_group_id": body.product_group_id},
                user_id,
            )
    refreshed = await store.get_image(session, image_id, user_id)
    if _owned(refreshed, user_id):
        await _sync_product_facts(session, user_id, refreshed)
    return OkResponse()


@router.post("/api/images/{image_id}/product-facts/confirm", response_model=ImageOut)
async def confirm_product_facts(
    image_id: int,
    body: ConfirmProductFactsBody,
    user_id: CurrentUser,
    session: SessionDep,
    settings: SettingsDep,
) -> ImageOut:
    image = await store.get_image(session, image_id, user_id)
    if not _owned(image, user_id):
        raise HTTPException(status_code=404, detail="Image not found")
    group = await store.get_image_group(session, image_id, user_id)
    current = merge_product_facts(
        [img.product_facts for img in group] or [image.product_facts]
    )
    connection = await connections.get_shopify(session, user_id)
    shop_gpsr = connection.gpsr_identity if connection is not None else None
    result = confirm_facts(
        current,
        is_textile=body.is_textile,
        composition=[row.model_dump() for row in body.composition]
        if body.composition is not None
        else None,
        gpsr_choice=body.gpsr_choice,
        gpsr_identity=body.gpsr_identity.model_dump(by_alias=True) if body.gpsr_identity else None,
        shop_gpsr=shop_gpsr,
        care_choice=body.care_choice,
        care=body.care.model_dump(by_alias=True) if body.care else None,
        listing_copy=store.listing_copy_from_images([image, *group]),
    )
    if not result.ok:
        raise HTTPException(status_code=400, detail=result.error)
    updated = await store.persist_product_facts(
        session, image, stored_from_facts(result.facts)
    )
    if updated is None:
        raise HTTPException(status_code=404, detail="Image not found")
    return _image_out(updated, settings, shop_gpsr)


@router.post("/api/images/{image_id}/listing-copy/accept", response_model=ImageOut)
async def accept_generated_listing_copy_route(
    image_id: int,
    body: AcceptGeneratedListingCopyBody,
    user_id: CurrentUser,
    session: SessionDep,
    settings: SettingsDep,
) -> ImageOut:
    result = await accept_generated(
        session,
        settings,
        user_id,
        image_id,
        body.model_dump(exclude_unset=True, exclude={"confirm_overflow", "trace_id"}),
        confirm_overflow=body.confirm_overflow,
        trace_id=body.trace_id,
    )
    if result.refused == "facts_blocked":
        raise HTTPException(status_code=409, detail=result.message)
    return _accepted_out(result, settings)


def _accepted_out(result: Accepted, settings) -> ImageOut:
    if result.refused in ("plan_blocked", "overflow_confirm"):
        raise HTTPException(status_code=403, detail=result.message)
    if result.refused is not None or result.product is None:
        raise HTTPException(status_code=404, detail="Image not found")
    return _image_out(result.product, settings, result.shop_gpsr)


def _refresh_conflict(reason: str) -> JSONResponse:
    return JSONResponse(status_code=409, content={"message": reason})


def _proposed_out(result: Proposed):
    if result.refused == "not_found":
        raise HTTPException(status_code=404, detail="Image not found")
    if result.refused == "blocked":
        return _refresh_conflict(result.message or "")
    if result.proposal is None:
        return JSONResponse(status_code=502, content={"message": result.message})
    pack = result.proposal
    return ListingCopyRefreshOut(
        tags=pack["tags"],
        description=pack["description"],
        seo_title=pack["seoTitle"],
        seo_description=pack["seoDescription"],
        queries=list(result.queries),
        trace_id=pack.get("traceId"),
    )


@router.post(
    "/api/images/{image_id}/listing-copy/refresh",
    response_model=ListingCopyRefreshOut,
    response_model_exclude_none=True,
)
async def listing_copy_refresh_route(
    image_id: int,
    user_id: CurrentUser,
    session: SessionDep,
    settings: SettingsDep,
):
    return _proposed_out(await propose_refresh(session, settings, user_id, image_id))


@router.post(
    "/api/images/{image_id}/listing-copy/refresh/regenerate",
    response_model=ListingCopyRefreshOut,
    response_model_exclude_none=True,
)
async def listing_copy_refresh_regenerate_route(
    image_id: int,
    body: ListingCopyRefreshRegenerateBody,
    user_id: CurrentUser,
    session: SessionDep,
    settings: SettingsDep,
):
    return _proposed_out(
        await propose_refresh(session, settings, user_id, image_id, queries=body.queries)
    )


@router.post("/api/images/{image_id}/listing-copy/refresh/accept", response_model=ImageOut)
async def listing_copy_refresh_accept_route(
    image_id: int,
    body: ListingCopyRefreshAcceptBody,
    user_id: CurrentUser,
    session: SessionDep,
    settings: SettingsDep,
) -> ImageOut:
    result = await accept_refresh(
        session,
        settings,
        user_id,
        image_id,
        body.model_dump(),
        job="refresh",
        confirm_overflow=body.confirm_overflow,
        trace_id=body.trace_id,
    )
    if result.refused == "invalid_proposal":
        return _refresh_conflict(result.message or "Could not accept listing copy.")
    return _accepted_out(result, settings)


@router.post("/api/images/{image_id}/listing-copy/refresh/dismiss", response_model=OkResponse)
async def listing_copy_refresh_dismiss_route(
    image_id: int,
    body: ListingCopyRefreshDismissBody,
    user_id: CurrentUser,
    session: SessionDep,
    settings: SettingsDep,
) -> OkResponse:
    image = await store.get_image(session, image_id, user_id)
    if not _owned(image, user_id):
        raise HTTPException(status_code=404, detail="Image not found")
    mark_refresh(
        listing_copy_trace_store(settings),
        product_id=image_id,
        outcome="dismissed",
        trace_id=body.trace_id,
    )
    return OkResponse(ok=True)


@router.get("/api/images/{image_id}/file")
async def image_file(
    image_id: int,
    user_id: CurrentUser,
    session: SessionDep,
    settings: SettingsDep,
    proxy: str | None = Query(default=None),
):
    from app.services.supabase_storage import is_snapsync_storage_url

    image = await store.get_image(session, image_id, user_id)
    if not _owned(image, user_id):
        raise HTTPException(status_code=404, detail="Image not found")
    if (
        image.storage_url
        and proxy != "1"
        and not is_snapsync_storage_url(image.storage_url, settings)
    ):
        return RedirectResponse(image.storage_url, status_code=302)
    buffer = await store.load_image_bytes(image)
    if buffer is None:
        raise HTTPException(status_code=404, detail="Image data not found")
    return Response(
        content=buffer,
        media_type=image.mime_type,
        headers={
            "Content-Length": str(len(buffer)),
            "Cache-Control": "private, max-age=3600",
        },
    )


@router.put("/api/images/{image_id}", response_model=ImageOut)
async def update_image(
    image_id: int,
    body: ImageUpdate,
    user_id: CurrentUser,
    session: SessionDep,
    settings: SettingsDep,
) -> ImageOut:
    image = await store.get_image(session, image_id, user_id)
    if not _owned(image, user_id):
        raise HTTPException(status_code=404, detail="Image not found")
    payload = body.model_dump(exclude_unset=True)
    try:
        updated = await store.update_image(session, image_id, payload, user_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid update data") from exc
    if updated is None:
        raise HTTPException(status_code=404, detail="Image not found")
    connection = await connections.get_shopify(session, user_id)
    shop_gpsr = connection.gpsr_identity if connection is not None else None
    return _image_out(updated, settings, shop_gpsr)


@router.delete("/api/images/{image_id}", status_code=204)
async def delete_image(image_id: int, user_id: CurrentUser, session: SessionDep) -> Response:
    image = await store.get_image(session, image_id, user_id)
    if not _owned(image, user_id):
        raise HTTPException(status_code=404, detail="Image not found")
    await store.delete_image(session, image_id, user_id)
    return Response(status_code=204)


@router.delete("/api/images/group/{group_id}", response_model=DeletedResponse)
async def delete_group(group_id: str, user_id: CurrentUser, session: SessionDep) -> DeletedResponse:
    count = await store.delete_images_by_group_id(session, group_id, user_id)
    if count == 0:
        raise HTTPException(status_code=404, detail="No images found for this product group")
    return DeletedResponse(deleted=count)


def _is_db_connection_limit(error: Exception) -> bool:
    message = str(error)
    return "EMAXCONN" in message or "max client connections reached" in message


@router.post("/api/images/push-to-shopify", response_model=PushResponse)
async def push_to_shopify(
    body: PushIdsBody,
    user_id: CurrentUser,
    session: SessionDep,
    settings: SettingsDep,
    graphql_for: ShopifyGraphQLForDep,
) -> PushResponse | JSONResponse:
    if not body.ids:
        raise HTTPException(status_code=400, detail="No image IDs provided")
    try:
        connection = await connections.get_shopify(session, user_id)
        if connection is None:
            raise HTTPException(
                status_code=400, detail="Shopify not connected. Please connect your store first."
            )
        graphql = graphql_for(connection)

        selected = await store.get_images_by_ids(session, body.ids, user_id)
        images_to_push = [img for img in selected if img.session_id == user_id]
        if not images_to_push:
            raise HTTPException(status_code=400, detail="No images found for given IDs")

        pushed = await push_products(
            session,
            settings,
            graphql,
            user_id,
            images_to_push,
            granted_scopes=connection.granted_scopes or [],
            product_status=body.product_status,
            publication_ids=body.publication_ids,
        )
        if pushed.refused == "missing_copy":
            return JSONResponse(
                status_code=402,
                content={
                    "message": pushed.message,
                    "missingCopyCount": pushed.missing_copy_count,
                },
            )
        if pushed.refused is not None:
            return JSONResponse(status_code=400, content={"message": pushed.message})
        return PushResponse(
            success=pushed.success,
            failed=pushed.failed,
            results=list(pushed.results),
            stock_not_set=pushed.stock_not_set,
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Shopify push error")
        if _is_db_connection_limit(exc):
            return JSONResponse(
                status_code=503,
                content={
                    "message": (
                        "The database is still clearing old connections. "
                        "Please wait 1-2 minutes and try pushing to Shopify again."
                    ),
                    "code": "DATABASE_CONNECTION_LIMIT",
                },
            )
        raise HTTPException(
            status_code=500, detail=str(exc) or "Failed to push products to Shopify"
        ) from exc
