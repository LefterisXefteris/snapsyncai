"""Bulk SEO catalogue picker and pack start."""

from fastapi import APIRouter, HTTPException, status

from app.auth.clerk import CurrentUser
from app.config import SettingsDep
from app.db import SessionDep
from app.schemas.base import CamelModel
from app.services import images as store
from app.services.bulk_seo import (
    PackItem,
    photos_from_images,
    picker,
)
from app.services.listing_copy_accept import accept_refresh
from app.services.listing_copy_propose import propose_bulk_seo, regenerate_bulk_seo
from app.services.listing_copy_refresh import search_demand_configured
from app.services.plan_charge import current_entitlement

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
    pack_id: str | None = None


class BulkSeoAcceptBody(CamelModel):
    product_id: int
    tags: list[str]
    description: str
    seo_title: str
    seo_description: str
    confirm_overflow: bool = False
    trace_id: str | None = None
    pack_id: str | None = None


class BulkSeoProposal(CamelModel):
    tags: list[str]
    description: str
    seo_title: str
    seo_description: str
    trace_id: str | None = None


class BulkSeoPackItem(CamelModel):
    id: int
    error: str | None = None
    proposal: BulkSeoProposal | None = None
    queries: list[str] = []


class BulkSeoPackResponse(CamelModel):
    error: str | None = None
    items: list[BulkSeoPackItem]
    proposed_use_count: int = 0
    pack_id: str | None = None


def _demand_configured(settings) -> bool:
    return search_demand_configured(
        settings.search_demand_api_key,
        settings.search_demand_url,
        settings.search_demand_login,
    )


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
    pack, pack_id = await propose_bulk_seo(session, settings, user_id, body.product_ids)
    if pack.error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=pack.error)
    return BulkSeoPackResponse(
        items=[_pack_item_out(item) for item in pack.items],
        proposed_use_count=pack.proposed_use_count,
        pack_id=pack_id,
    )


@router.post("/api/bulk-seo/regenerate", response_model=BulkSeoPackItem)
async def bulk_seo_regenerate(
    body: BulkSeoRegenerateBody,
    user_id: CurrentUser,
    session: SessionDep,
    settings: SettingsDep,
) -> BulkSeoPackItem:
    item = await regenerate_bulk_seo(
        session, settings, user_id, body.product_id, body.queries, pack_id=body.pack_id
    )
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    return _pack_item_out(item)


@router.post("/api/bulk-seo/accept")
async def bulk_seo_accept(
    body: BulkSeoAcceptBody,
    user_id: CurrentUser,
    session: SessionDep,
    settings: SettingsDep,
) -> dict:
    result = await accept_refresh(
        session,
        settings,
        user_id,
        body.product_id,
        {
            "tags": body.tags,
            "description": body.description,
            "seoTitle": body.seo_title,
            "seoDescription": body.seo_description,
        },
        job="bulk_seo",
        confirm_overflow=body.confirm_overflow,
        trace_id=body.trace_id,
        pack_id=body.pack_id or "",
    )
    if result.refused in ("plan_blocked", "overflow_confirm"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=result.message)
    if result.refused == "not_found":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=result.message)
    if result.refused is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=result.message)
    return {"ok": True}
