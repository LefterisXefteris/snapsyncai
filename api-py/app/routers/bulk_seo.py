"""Bulk SEO catalogue picker and pack start."""

from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, status

from app.auth.clerk import CurrentUser
from app.config import SettingsDep
from app.db import SessionDep
from app.routers.images import fetch_search_demand, propose_refresh_pack
from app.schemas.base import CamelModel
from app.services import connections
from app.services import images as store
from app.services.bulk_seo import (
    PackItem,
    accept_item,
    photos_from_images,
    picker,
    regenerate_item,
    start_pack,
)
from app.services.listing_copy_refresh import search_demand_configured
from app.services.plan import NEED_PLAN, WEEKLY_LIMIT
from app.services.plan_charge import current_entitlement, settle_plan_job
from app.services.plan_ledger import list_spends

router = APIRouter(tags=["bulk-seo"])


class BulkSeoCatalogueRow(CamelModel):
    id: int
    title: str | None = None
    photo_url: str | None = None
    eligible: bool
    blocked_reason: str | None = None


class BulkSeoCatalogueResponse(CamelModel):
    start_blocked_reason: str | None = None
    rows: list[BulkSeoCatalogueRow]
    proposed_use_count: int = 0


class BulkSeoStartBody(CamelModel):
    product_ids: list[int]


class BulkSeoRegenerateBody(CamelModel):
    product_id: int
    queries: list[str]


class BulkSeoAcceptBody(CamelModel):
    product_id: int
    tags: list[str]
    description: str
    seo_title: str
    seo_description: str


class BulkSeoProposal(CamelModel):
    tags: list[str]
    description: str
    seo_title: str
    seo_description: str


class BulkSeoPackItem(CamelModel):
    id: int
    error: str | None = None
    proposal: BulkSeoProposal | None = None
    queries: list[str] = []


class BulkSeoPackResponse(CamelModel):
    error: str | None = None
    items: list[BulkSeoPackItem]
    proposed_use_count: int = 0


def _demand_configured(settings) -> bool:
    return search_demand_configured(settings.search_demand_api_key, settings.search_demand_url)


def _pack_item_out(item: PackItem) -> BulkSeoPackItem:
    proposal = None
    if item.proposal is not None:
        proposal = BulkSeoProposal.model_validate(item.proposal)
    return BulkSeoPackItem(
        id=item.id,
        error=item.error,
        proposal=proposal,
        queries=list(item.queries),
    )


@router.get("/api/bulk-seo", response_model=BulkSeoCatalogueResponse)
async def bulk_seo_catalogue(
    user_id: CurrentUser, session: SessionDep, settings: SettingsDep
) -> BulkSeoCatalogueResponse:
    images = await store.list_images(session, user_id)
    entitlement = await current_entitlement(session, settings, user_id)
    view = picker(
        photos_from_images(images),
        demand_configured=_demand_configured(settings),
        entitlement=entitlement,
    )
    return BulkSeoCatalogueResponse(
        start_blocked_reason=view.start_blocked_reason,
        proposed_use_count=view.proposed_use_count,
        rows=[
            BulkSeoCatalogueRow(
                id=row.id,
                title=row.title,
                photo_url=row.photo_url,
                eligible=row.eligible,
                blocked_reason=row.blocked_reason,
            )
            for row in view.rows
        ],
    )


@router.post("/api/bulk-seo/start", response_model=BulkSeoPackResponse)
async def bulk_seo_start(
    body: BulkSeoStartBody,
    user_id: CurrentUser,
    session: SessionDep,
    settings: SettingsDep,
) -> BulkSeoPackResponse:
    images = await store.list_images(session, user_id)
    entitlement = await current_entitlement(session, settings, user_id)
    connection = await connections.get_shopify(session, user_id)
    shop_gpsr = connection.gpsr_identity if connection is not None else None
    configured = _demand_configured(settings)

    async def fetch(_product_id: int, seeds):
        return await fetch_search_demand(
            seeds, settings.search_demand_url, settings.search_demand_api_key
        )

    async def propose(_product_id: int, **kwargs):
        return await propose_refresh_pack(kwargs["constraints"])

    pack = await start_pack(
        photos_from_images(images),
        body.product_ids,
        demand_configured=configured,
        entitlement=entitlement,
        fetch=fetch,
        propose=propose,
        shop_gpsr=shop_gpsr if isinstance(shop_gpsr, dict) else None,
    )
    if pack.error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=pack.error)
    return BulkSeoPackResponse(
        items=[_pack_item_out(item) for item in pack.items],
        proposed_use_count=pack.proposed_use_count,
    )


@router.post("/api/bulk-seo/regenerate", response_model=BulkSeoPackItem)
async def bulk_seo_regenerate(
    body: BulkSeoRegenerateBody,
    user_id: CurrentUser,
    session: SessionDep,
    settings: SettingsDep,
) -> BulkSeoPackItem:
    images = await store.list_images(session, user_id)
    photos = photos_from_images(images)
    photo = next((item for item in photos if item.id == body.product_id), None)
    if photo is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    connection = await connections.get_shopify(session, user_id)
    shop_gpsr = connection.gpsr_identity if connection is not None else None
    configured = _demand_configured(settings)

    async def propose(**kwargs):
        return await propose_refresh_pack(kwargs["constraints"])

    item = await regenerate_item(
        photo,
        body.queries,
        demand_configured=configured,
        propose=propose,
        fetch=lambda *_args: (),
        shop_gpsr=shop_gpsr if isinstance(shop_gpsr, dict) else None,
    )
    return _pack_item_out(item)


@router.post("/api/bulk-seo/accept")
async def bulk_seo_accept(
    body: BulkSeoAcceptBody,
    user_id: CurrentUser,
    session: SessionDep,
    settings: SettingsDep,
) -> dict:
    images = await store.list_images(session, user_id)
    photos = photos_from_images(images)
    photo = next((item for item in photos if item.id == body.product_id), None)
    if photo is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    connection = await connections.get_shopify(session, user_id)
    shop_gpsr = connection.gpsr_identity if connection is not None else None
    entitlement = await current_entitlement(session, settings, user_id)
    spends = await list_spends(session, user_id)
    stash: dict = {}

    def persist(product_id: int, listing_copy):
        stash["id"] = product_id
        stash["copy"] = dict(listing_copy)

    result = accept_item(
        photo,
        {
            "tags": body.tags,
            "description": body.description,
            "seoTitle": body.seo_title,
            "seoDescription": body.seo_description,
        },
        entitlement=entitlement,
        spends=spends,
        now=datetime.now(UTC),
        persist=persist,
        record_spend=lambda: None,
        shop_gpsr=shop_gpsr if isinstance(shop_gpsr, dict) else None,
    )
    if result.error in (NEED_PLAN, WEEKLY_LIMIT):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=result.error)
    if result.error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=result.error)
    if "copy" in stash:
        updated = await store.update_image(session, stash["id"], stash["copy"])
        if updated is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    if result.spent:
        await settle_plan_job(
            session, settings, user_id, "bulk_seo_persist", product_id=photo.id
        )
    return {"ok": True}
