"""Image CRUD + grouping + Shopify push — port of `server/routes.ts`."""

import logging

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse, RedirectResponse, Response

from app.auth.clerk import CurrentUser
from app.config import SettingsDep
from app.db import SessionDep
from app.schemas.image import (
    AssignGroupBatchBody,
    AssignGroupBody,
    ConfirmProductFactsBody,
    DeletedResponse,
    ImageListOut,
    ImageOut,
    ImageUpdate,
    OkResponse,
    OkUpdatedResponse,
    PushIdsBody,
    PushResponse,
    PushResult,
)
from app.services import connections
from app.services import images as store
from app.services.product_facts import (
    confirm_facts,
    merge_product_facts,
    stored_from_facts,
)
from app.services.shopify import push_product_to_shopify

logger = logging.getLogger(__name__)

router = APIRouter(tags=["images"])


def _owned(image, user_id: str) -> bool:
    return image is not None and image.session_id == user_id


async def _sync_product_facts(session, user_id: str, image) -> None:
    group = await store.get_image_group(session, image.id, user_id)
    merged = merge_product_facts([img.product_facts for img in group])
    await store.persist_product_facts(session, image, stored_from_facts(merged))


_LIST_EXCLUDE = {
    "image_data",
    "ai_data",
    "aeo_faqs",
}


@router.get("/api/images", response_model=list[ImageListOut], response_model_exclude=_LIST_EXCLUDE)
async def list_images(user_id: CurrentUser, session: SessionDep) -> list[ImageListOut]:
    try:
        rows = await store.list_images(session, user_id)
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to fetch images") from None
    return [ImageListOut.model_validate(row) for row in rows]


@router.get(
    "/api/images/{image_id}/group",
    response_model=list[ImageListOut],
    response_model_exclude=_LIST_EXCLUDE,
)
async def get_group(image_id: int, user_id: CurrentUser, session: SessionDep) -> list[ImageListOut]:
    try:
        rows = await store.get_image_group(session, image_id, user_id)
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to fetch product group") from None
    return [ImageListOut.model_validate(row) for row in rows]


@router.post("/api/images/{image_id}/unlink-from-group", response_model=OkResponse)
async def unlink_from_group(image_id: int, user_id: CurrentUser, session: SessionDep) -> OkResponse:
    image = await store.get_image(session, image_id)
    if not _owned(image, user_id):
        raise HTTPException(status_code=404, detail="Image not found")
    await store.update_image(session, image_id, {"product_group_id": None})
    return OkResponse()


@router.post("/api/images/assign-group-batch", response_model=OkUpdatedResponse)
async def assign_group_batch(
    body: AssignGroupBatchBody, user_id: CurrentUser, session: SessionDep
) -> OkUpdatedResponse:
    if not body.product_group_id or not body.image_ids:
        raise HTTPException(status_code=400, detail="imageIds array and productGroupId required")
    updated = 0
    for image_id in body.image_ids:
        image = await store.get_image(session, image_id)
        if _owned(image, user_id):
            await store.update_image(session, image_id, {"product_group_id": body.product_group_id})
            updated += 1
    if body.primary_image_id:
        primary = await store.get_image(session, body.primary_image_id)
        if _owned(primary, user_id) and not primary.product_group_id:
            await store.update_image(
                session, body.primary_image_id, {"product_group_id": body.product_group_id}
            )
            updated += 1
    synced = await store.get_image(session, body.image_ids[0])
    if _owned(synced, user_id):
        await _sync_product_facts(session, user_id, synced)
    return OkUpdatedResponse(updated=updated)


@router.post("/api/images/{image_id}/assign-group", response_model=OkResponse)
async def assign_group(
    image_id: int, body: AssignGroupBody, user_id: CurrentUser, session: SessionDep
) -> OkResponse:
    if not body.product_group_id:
        raise HTTPException(status_code=400, detail="productGroupId required")
    image = await store.get_image(session, image_id)
    if not _owned(image, user_id):
        raise HTTPException(status_code=404, detail="Image not found")
    await store.update_image(session, image_id, {"product_group_id": body.product_group_id})
    if body.primary_image_id and body.primary_image_id != image_id:
        primary = await store.get_image(session, body.primary_image_id)
        if _owned(primary, user_id) and not primary.product_group_id:
            await store.update_image(
                session, body.primary_image_id, {"product_group_id": body.product_group_id}
            )
    refreshed = await store.get_image(session, image_id)
    if _owned(refreshed, user_id):
        await _sync_product_facts(session, user_id, refreshed)
    return OkResponse()


@router.post("/api/images/{image_id}/product-facts/confirm", response_model=ImageOut)
async def confirm_product_facts(
    image_id: int,
    body: ConfirmProductFactsBody,
    user_id: CurrentUser,
    session: SessionDep,
) -> ImageOut:
    image = await store.get_image(session, image_id)
    if not _owned(image, user_id):
        raise HTTPException(status_code=404, detail="Image not found")
    group = await store.get_image_group(session, image_id, user_id)
    current = merge_product_facts(
        [img.product_facts for img in group] or [image.product_facts]
    )
    result = confirm_facts(
        current,
        is_textile=body.is_textile,
        composition=[row.model_dump() for row in body.composition]
        if body.composition is not None
        else None,
    )
    if not result.ok:
        raise HTTPException(status_code=400, detail=result.error)
    updated = await store.persist_product_facts(
        session, image, stored_from_facts(result.facts)
    )
    if updated is None:
        raise HTTPException(status_code=404, detail="Image not found")
    return ImageOut.model_validate(updated)


@router.get("/api/images/{image_id}/file")
async def image_file(
    image_id: int,
    user_id: CurrentUser,
    session: SessionDep,
    proxy: str | None = Query(default=None),
):
    image = await store.get_image(session, image_id)
    if not _owned(image, user_id):
        raise HTTPException(status_code=404, detail="Image not found")
    if image.storage_url and proxy != "1":
        return RedirectResponse(image.storage_url, status_code=302)
    buffer = await store.load_image_bytes(image)
    if buffer is None:
        raise HTTPException(status_code=404, detail="Image data not found")
    return Response(
        content=buffer,
        media_type=image.mime_type,
        headers={
            "Content-Length": str(len(buffer)),
            "Cache-Control": "public, max-age=604800, immutable",
        },
    )


@router.put("/api/images/{image_id}", response_model=ImageOut)
async def update_image(
    image_id: int, body: ImageUpdate, user_id: CurrentUser, session: SessionDep
) -> ImageOut:
    image = await store.get_image(session, image_id)
    if not _owned(image, user_id):
        raise HTTPException(status_code=404, detail="Image not found")
    payload = body.model_dump(exclude_unset=True)
    try:
        updated = await store.update_image(session, image_id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid update data") from exc
    if updated is None:
        raise HTTPException(status_code=404, detail="Image not found")
    return ImageOut.model_validate(updated)


@router.delete("/api/images/{image_id}", status_code=204)
async def delete_image(image_id: int, user_id: CurrentUser, session: SessionDep) -> Response:
    image = await store.get_image(session, image_id)
    if not _owned(image, user_id):
        raise HTTPException(status_code=404, detail="Image not found")
    await store.delete_image(session, image_id)
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


def _sort_group_by_media_gallery(group: list) -> None:
    source = next(
        (item for item in group if isinstance(item.media_gallery, list) and item.media_gallery),
        None,
    )
    ordered_ids = []
    if source is not None:
        for raw in source.media_gallery:
            try:
                ordered_ids.append(int(raw))
            except (TypeError, ValueError):
                continue
    rank = {image_id: index for index, image_id in enumerate(ordered_ids)}

    def key(item):
        item_rank = rank.get(item.id)
        if item_rank is not None or rank:
            return (item_rank if item_rank is not None else 10**9, item.id or 0)
        return (0 if item.description else 1, item.id or 0)

    group.sort(key=key)


@router.post("/api/images/push-to-shopify", response_model=PushResponse)
async def push_to_shopify(
    body: PushIdsBody, user_id: CurrentUser, session: SessionDep, settings: SettingsDep
) -> PushResponse | JSONResponse:
    if not body.ids:
        raise HTTPException(status_code=400, detail="No image IDs provided")
    try:
        connection = await connections.get_shopify(session, user_id)
        if connection is None:
            raise HTTPException(
                status_code=400, detail="Shopify not connected. Please connect your store first."
            )

        selected = await store.get_images_by_ids(session, body.ids)
        images_to_push = [img for img in selected if img.session_id == user_id]
        if not images_to_push:
            raise HTTPException(status_code=400, detail="No images found for given IDs")

        unpaid = [img for img in images_to_push if img.payment_status != "paid"]
        if unpaid:
            return JSONResponse(
                status_code=402,
                content={
                    "message": (
                        f"{len(unpaid)} product(s) have not been unlocked yet. "
                        "Pay for full AI analysis before pushing to Shopify."
                    ),
                    "unpaidCount": len(unpaid),
                },
            )

        all_user_images = await store.list_images(session, user_id)
        group_map: dict[str, list] = {}
        for img in all_user_images:
            if img.product_group_id:
                group_map.setdefault(img.product_group_id, []).append(img)
        for group in group_map.values():
            _sort_group_by_media_gallery(group)

        processed_groups: set[str] = set()
        products: list[tuple] = []
        for img in images_to_push:
            if img.product_group_id:
                if img.product_group_id in processed_groups:
                    continue
                processed_groups.add(img.product_group_id)
                group = group_map.get(img.product_group_id) or [img]
                products.append((group[0], group[1:]))
            else:
                products.append((img, []))

        full_map = {img.id: img for img in selected}
        success = 0
        failed = 0
        results: list[PushResult] = []
        for primary, views in products:
            needed = [primary.id, *[view.id for view in views]]
            missing = [image_id for image_id in needed if image_id not in full_map]
            if missing:
                for img in await store.get_images_by_ids(session, missing):
                    full_map[img.id] = img
            full_primary = full_map.get(primary.id) or primary
            view_images = [full_map.get(view.id) or view for view in views]
            result = await push_product_to_shopify(full_primary, connection, settings, view_images)
            if result.get("shopify_product_id"):
                updates = {
                    "shopify_product_id": result["shopify_product_id"],
                    "shopify_status": "synced",
                }
                if primary.product_group_id:
                    await store.update_images_by_group_id(
                        session, primary.product_group_id, updates
                    )
                else:
                    await store.update_image(session, primary.id, updates)
                success += 1
                results.append(
                    PushResult(id=primary.id, shopify_product_id=result["shopify_product_id"])
                )
            else:
                await store.update_image(session, primary.id, {"shopify_status": "failed"})
                failed += 1
                results.append(PushResult(id=primary.id, error=result.get("error")))
        return PushResponse(success=success, failed=failed, results=results)
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
