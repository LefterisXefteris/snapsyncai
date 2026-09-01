"""Image CRUD + grouping + Shopify push — port of `server/routes.ts`."""

import logging
from collections.abc import Sequence

import httpx
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
    ListingCopyRefreshOut,
    ListingCopyRefreshRegenerateBody,
    OkResponse,
    OkUpdatedResponse,
    PushIdsBody,
    PushResponse,
    PushResult,
    with_facts_outcomes,
)
from app.services import catalogue_cache, connections
from app.services import images as store
from app.services.listing_copy_refresh import (
    REFRESH_PROPOSAL_SYSTEM,
    accept_listing_copy_refresh,
    listing_copy_from_image,
    parse_refresh_proposal,
    refresh_blocked_reason,
    rewrite_constraints,
    search_demand_configured,
    seed_search_demand,
    start_listing_copy_refresh,
)
from app.services.openai_client import get_openai
from app.services.plan_charge import authorize_plan_job, settle_plan_job
from app.services.product_facts import (
    accept_generated_listing_copy,
    confirm_facts,
    generation_blocked_reason,
    listing_copy_present,
    merge_product_facts,
    stored_from_facts,
)
from app.services.shopify import push_product_to_shopify, shopify_product_status

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
            settings.search_demand_api_key, settings.search_demand_url
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
    settings: SettingsDep,
) -> ImageOut:
    image = await store.get_image(session, image_id)
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
    image = await store.get_image(session, image_id)
    if not _owned(image, user_id):
        raise HTTPException(status_code=404, detail="Image not found")
    group = await store.get_image_group(session, image_id, user_id)
    current = merge_product_facts(
        [img.product_facts for img in group] or [image.product_facts]
    )
    connection = await connections.get_shopify(session, user_id)
    shop_gpsr = connection.gpsr_identity if connection is not None else None
    facts_blocked = generation_blocked_reason(current)
    if facts_blocked:
        raise HTTPException(status_code=409, detail=facts_blocked)
    accepted = accept_generated_listing_copy(
        current,
        body.model_dump(exclude_unset=True),
        shop_gpsr,
    )
    blocked = await authorize_plan_job(session, settings, user_id, "generate_persist")
    if blocked:
        raise HTTPException(status_code=403, detail=blocked)
    if accepted.listing_copy:
        written = await store.update_image(session, image_id, accepted.listing_copy)
        if written is None:
            raise HTTPException(status_code=404, detail="Image not found")
        image = written
        await settle_plan_job(
            session,
            settings,
            user_id,
            "generate_persist",
            listing_copy_was_stale=current.listing_copy_stale,
            product_id=image_id,
        )
    updated = await store.persist_product_facts(
        session, image, stored_from_facts(accepted.facts)
    )
    if updated is None:
        raise HTTPException(status_code=404, detail="Image not found")
    return _image_out(updated, settings, shop_gpsr)


def _refresh_conflict(reason: str) -> JSONResponse:
    return JSONResponse(status_code=409, content={"message": reason})


async def fetch_search_demand(
    seeds: Sequence[str], url: str | None, api_key: str | None
) -> tuple[str, ...]:
    if not url or not str(url).strip():
        return ()
    headers = {}
    if api_key and str(api_key).strip():
        headers["Authorization"] = f"Bearer {api_key.strip()}"
    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.get(
            url,
            params={"q": " ".join(seeds)},
            headers=headers,
        )
        response.raise_for_status()
        data = response.json()
    raw = data.get("queries") if isinstance(data, dict) else None
    if not isinstance(raw, list):
        return ()
    return tuple(str(item).strip() for item in raw if str(item).strip())


async def propose_refresh_pack(constraints: str) -> dict | None:
    response = await get_openai().chat.completions.create(
        model="gpt-5.2",
        max_completion_tokens=1500,
        messages=[
            {"role": "system", "content": REFRESH_PROPOSAL_SYSTEM},
            {"role": "user", "content": constraints},
        ],
    )
    text = ""
    if response.choices:
        text = response.choices[0].message.content or ""
    return parse_refresh_proposal(text)


async def _listing_copy_refresh_context(session, image, user_id: str, settings):
    group = await store.get_image_group(session, image.id, user_id)
    facts = merge_product_facts(
        [img.product_facts for img in group] or [image.product_facts]
    )
    connection = await connections.get_shopify(session, user_id)
    shop_gpsr = connection.gpsr_identity if connection is not None else None
    return (
        facts,
        listing_copy_from_image(image),
        search_demand_configured(
            settings.search_demand_api_key, settings.search_demand_url
        ),
        shop_gpsr,
    )


async def _listing_copy_refresh_pack(facts, listing_copy, started, shop_gpsr):
    if started.error:
        return _refresh_conflict(started.error)
    pack = await propose_refresh_pack(
        rewrite_constraints(facts, started.queries, listing_copy, shop_gpsr)
    )
    if pack is None:
        return JSONResponse(
            status_code=502,
            content={"message": "Could not parse listing copy refresh."},
        )
    return ListingCopyRefreshOut(
        tags=pack["tags"],
        description=pack["description"],
        seo_title=pack["seoTitle"],
        seo_description=pack["seoDescription"],
        queries=list(started.queries),
    )


@router.post("/api/images/{image_id}/listing-copy/refresh", response_model=ListingCopyRefreshOut)
async def listing_copy_refresh_route(
    image_id: int,
    user_id: CurrentUser,
    session: SessionDep,
    settings: SettingsDep,
):
    image = await store.get_image(session, image_id)
    if not _owned(image, user_id):
        raise HTTPException(status_code=404, detail="Image not found")
    facts, listing_copy, configured, shop_gpsr = await _listing_copy_refresh_context(
        session, image, user_id, settings
    )
    blocked = refresh_blocked_reason(facts, listing_copy, configured)
    if blocked:
        return _refresh_conflict(blocked)
    queries = await fetch_search_demand(
        seed_search_demand(facts, listing_copy),
        settings.search_demand_url,
        settings.search_demand_api_key,
    )
    started = start_listing_copy_refresh(
        facts,
        listing_copy,
        configured,
        fetch=lambda _seeds: queries,
        shop_gpsr=shop_gpsr,
    )
    return await _listing_copy_refresh_pack(facts, listing_copy, started, shop_gpsr)


@router.post(
    "/api/images/{image_id}/listing-copy/refresh/regenerate",
    response_model=ListingCopyRefreshOut,
)
async def listing_copy_refresh_regenerate_route(
    image_id: int,
    body: ListingCopyRefreshRegenerateBody,
    user_id: CurrentUser,
    session: SessionDep,
    settings: SettingsDep,
):
    image = await store.get_image(session, image_id)
    if not _owned(image, user_id):
        raise HTTPException(status_code=404, detail="Image not found")
    facts, listing_copy, configured, shop_gpsr = await _listing_copy_refresh_context(
        session, image, user_id, settings
    )
    blocked = refresh_blocked_reason(facts, listing_copy, configured)
    if blocked:
        return _refresh_conflict(blocked)
    started = start_listing_copy_refresh(
        facts,
        listing_copy,
        configured,
        fetch=lambda _seeds: (),
        shop_gpsr=shop_gpsr,
        queries=body.queries,
    )
    return await _listing_copy_refresh_pack(facts, listing_copy, started, shop_gpsr)


@router.post("/api/images/{image_id}/listing-copy/refresh/accept", response_model=ImageOut)
async def listing_copy_refresh_accept_route(
    image_id: int,
    body: ListingCopyRefreshAcceptBody,
    user_id: CurrentUser,
    session: SessionDep,
    settings: SettingsDep,
) -> ImageOut:
    image = await store.get_image(session, image_id)
    if not _owned(image, user_id):
        raise HTTPException(status_code=404, detail="Image not found")
    facts, _listing_copy, _configured, shop_gpsr = await _listing_copy_refresh_context(
        session, image, user_id, settings
    )
    accepted = accept_listing_copy_refresh(
        facts,
        body.model_dump(),
        shop_gpsr,
    )
    if accepted.error:
        return _refresh_conflict(accepted.error)
    blocked = await authorize_plan_job(session, settings, user_id, "refresh_accept")
    if blocked:
        raise HTTPException(status_code=403, detail=blocked)
    updated = await store.update_image(session, image_id, accepted.listing_copy or {})
    if updated is None:
        raise HTTPException(status_code=404, detail="Image not found")
    await settle_plan_job(
        session, settings, user_id, "refresh_accept", product_id=image_id
    )
    return _image_out(updated, settings, shop_gpsr)


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
    image_id: int,
    body: ImageUpdate,
    user_id: CurrentUser,
    session: SessionDep,
    settings: SettingsDep,
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
    connection = await connections.get_shopify(session, user_id)
    shop_gpsr = connection.gpsr_identity if connection is not None else None
    return _image_out(updated, settings, shop_gpsr)


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

        missing_copy = [
            img
            for img in images_to_push
            if not listing_copy_present(listing_copy_from_image(img))
        ]
        if missing_copy:
            return JSONResponse(
                status_code=402,
                content={
                    "message": (
                        f"{len(missing_copy)} product(s) still need listing copy."
                    ),
                    "missingCopyCount": len(missing_copy),
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
            result = await push_product_to_shopify(
                full_primary,
                connection,
                settings,
                view_images,
                publication_ids=body.publication_ids,
                product_status=body.product_status,
            )
            if result.get("shopify_product_id"):
                from app.services.inventory.service import register_published_shopify_product

                desired_ids = (
                    body.publication_ids
                    if body.publication_ids is not None
                    else list(full_primary.shopify_publication_ids or [])
                )
                desired_status = shopify_product_status(
                    body.product_status
                    if body.product_status is not None
                    else full_primary.shopify_product_status
                )

                await register_published_shopify_product(
                    session,
                    settings,
                    user_id=user_id,
                    image=full_primary,
                    product_id=result["shopify_product_id"],
                    variants=result.get("variants") or [],
                )
                updates = {
                    "shopify_product_id": result["shopify_product_id"],
                    "shopify_status": "synced",
                    "shopify_product_status": desired_status,
                    "shopify_publication_ids": desired_ids,
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
