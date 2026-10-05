"""Website prototype, preview, and Publish. The public storefront is unsigned-in."""

from typing import Any

from fastapi import APIRouter, HTTPException, status

from app.auth.clerk import CurrentUser
from app.config import SettingsDep
from app.db import SessionDep
from app.schemas.base import CamelModel
from app.services import connections
from app.services import images as store
from app.services.website_handoff import (
    Storefront,
    eligible_products,
    photos_from_images,
    preview_website,
    publish_website,
    published_storefront,
    with_channel_photos,
)

router = APIRouter(tags=["website"])


class WebsiteEligibleProduct(CamelModel):
    id: int
    title: str | None = None
    photo_url: str | None = None
    shopify_product_id: str


class WebsitePrototypeResponse(CamelModel):
    shop_connected: bool
    shop_domain: str | None = None
    products: list[WebsiteEligibleProduct]


class WebsitePreviewBody(CamelModel):
    product_ids: list[int]
    palette: str
    type_pairing: str


class WebsitePublishBody(WebsitePreviewBody):
    confirm_overflow: bool = False


class StorefrontProductResponse(CamelModel):
    id: int
    shopify_product_id: str
    title: str | None = None
    description: str | None = None
    tags: list[str] = []
    seo_title: str | None = None
    seo_description: str | None = None
    aeo_snippet: str | None = None
    aeo_faqs: Any = None
    photo_urls: list[str] = []
    confirmed_facts: Any = None


class StorefrontResponse(CamelModel):
    handle: str
    host: str
    shop_name: str
    palette: str
    type_pairing: str
    products: list[StorefrontProductResponse]


class WebsitePublishResponse(CamelModel):
    host: str
    spent: bool
    product_count: int


def _storefront_response(site: Storefront) -> StorefrontResponse:
    return StorefrontResponse(
        handle=site.handle,
        host=site.host,
        shop_name=site.shop_name,
        palette=site.palette,
        type_pairing=site.type_pairing,
        products=[StorefrontProductResponse.model_validate(product) for product in site.products],
    )


@router.get("/api/website/prototype", response_model=WebsitePrototypeResponse)
async def website_prototype(
    user_id: CurrentUser, session: SessionDep, settings: SettingsDep
) -> WebsitePrototypeResponse:
    connection = await connections.get_shopify(session, user_id)
    images = await store.list_images(session, user_id)
    products = await with_channel_photos(
        connection, settings, eligible_products(photos_from_images(images))
    )
    return WebsitePrototypeResponse(
        shop_connected=connection is not None,
        shop_domain=connection.shop_domain if connection is not None else None,
        products=[
            WebsiteEligibleProduct(
                id=product.id,
                title=product.title,
                photo_url=product.photo_urls[0] if product.photo_urls else None,
                shopify_product_id=product.shopify_product_id,
            )
            for product in products
        ],
    )


_PUBLISH_STATUS = {
    "not_connected": status.HTTP_409_CONFLICT,
    "plan_blocked": status.HTTP_403_FORBIDDEN,
    "overflow_confirm": status.HTTP_403_FORBIDDEN,
    "invalid": status.HTTP_400_BAD_REQUEST,
}


@router.post("/api/website/preview", response_model=StorefrontResponse)
async def website_preview(
    body: WebsitePreviewBody, user_id: CurrentUser, session: SessionDep, settings: SettingsDep
) -> StorefrontResponse:
    result = await preview_website(
        session,
        settings,
        user_id,
        palette=body.palette,
        type_pairing=body.type_pairing,
        product_ids=body.product_ids,
    )
    if result.refused is not None or result.storefront is None:
        raise HTTPException(
            status_code=_PUBLISH_STATUS[result.refused or "invalid"], detail=result.message
        )
    return _storefront_response(result.storefront)


@router.post("/api/website/publish", response_model=WebsitePublishResponse)
async def website_publish(
    body: WebsitePublishBody, user_id: CurrentUser, session: SessionDep, settings: SettingsDep
) -> WebsitePublishResponse:
    result = await publish_website(
        session,
        settings,
        user_id,
        palette=body.palette,
        type_pairing=body.type_pairing,
        product_ids=body.product_ids,
        confirm_overflow=body.confirm_overflow,
    )
    if result.refused is not None or result.storefront is None:
        raise HTTPException(
            status_code=_PUBLISH_STATUS[result.refused or "invalid"], detail=result.message
        )
    return WebsitePublishResponse(
        host=result.storefront.host,
        spent=result.spent,
        product_count=len(result.storefront.products),
    )


@router.get("/api/storefronts/{handle}", response_model=StorefrontResponse)
async def read_storefront(handle: str, session: SessionDep) -> StorefrontResponse:
    site = await published_storefront(session, handle)
    if site is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="This website is not published")
    return _storefront_response(site)
