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
    publish_saved_website,
    published_storefront,
    save_website_prototype,
    saved_website_prototype,
    seller_website_publication,
    unpublish_website,
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
    product_ids: list[int] = []
    brief: str = ""
    look: Any | None = None
    host: str | None = None
    live: bool = False


class WebsitePrototypeBody(CamelModel):
    product_ids: list[int]
    brief: str = ""


class WebsitePreviewBody(CamelModel):
    product_ids: list[int]
    palette: str
    type_pairing: str


class WebsitePublishBody(WebsitePreviewBody):
    confirm_overflow: bool = False


class StorefrontVariantResponse(CamelModel):
    id: str
    title: str
    price: str | None = None
    compare_at_price: str | None = None


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
    price: str | None = None
    compare_at_price: str | None = None
    can_buy: bool = False
    variants: list[StorefrontVariantResponse] = []


class StorefrontResponse(CamelModel):
    handle: str
    host: str
    shop_name: str
    palette: str
    type_pairing: str
    products: list[StorefrontProductResponse]
    shop_domain: str | None = None


class WebsitePublishResponse(CamelModel):
    host: str
    spent: bool
    product_count: int


class WebsiteUnpublishResponse(CamelModel):
    host: str


def _storefront_response(site: Storefront) -> StorefrontResponse:
    return StorefrontResponse(
        handle=site.handle,
        host=site.host,
        shop_name=site.shop_name,
        palette=site.palette,
        type_pairing=site.type_pairing,
        products=[StorefrontProductResponse.model_validate(product) for product in site.products],
        shop_domain=site.shop_domain,
    )


async def _prototype_response(
    user_id: str, session: SessionDep, settings: SettingsDep
) -> WebsitePrototypeResponse:
    connection = await connections.get_shopify(session, user_id)
    images = await store.list_images(session, user_id)
    products = await with_channel_photos(
        connection, settings, eligible_products(photos_from_images(images))
    )
    saved = await saved_website_prototype(session, settings, user_id)
    publication = await seller_website_publication(session, user_id)
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
        product_ids=list(saved.product_ids),
        brief=saved.brief,
        look=saved.look,
        host=publication.host if publication is not None else None,
        live=publication.live if publication is not None else False,
    )


@router.get("/api/website/prototype", response_model=WebsitePrototypeResponse)
async def website_prototype(
    user_id: CurrentUser, session: SessionDep, settings: SettingsDep
) -> WebsitePrototypeResponse:
    return await _prototype_response(user_id, session, settings)


@router.put("/api/website/prototype", response_model=WebsitePrototypeResponse)
async def save_prototype(
    body: WebsitePrototypeBody, user_id: CurrentUser, session: SessionDep, settings: SettingsDep
) -> WebsitePrototypeResponse:
    await save_website_prototype(
        session,
        settings,
        user_id,
        product_ids=body.product_ids,
        brief=body.brief,
    )
    return await _prototype_response(user_id, session, settings)


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
    _body: WebsitePublishBody, user_id: CurrentUser, session: SessionDep, settings: SettingsDep
) -> WebsitePublishResponse:
    result = await publish_saved_website(session, settings, user_id)
    if result.refused is not None or result.storefront is None:
        raise HTTPException(
            status_code=_PUBLISH_STATUS[result.refused or "invalid"], detail=result.message
        )
    return WebsitePublishResponse(
        host=result.storefront.host,
        spent=result.spent,
        product_count=len(result.storefront.products),
    )


@router.post("/api/website/unpublish", response_model=WebsiteUnpublishResponse)
async def website_unpublish(user_id: CurrentUser, session: SessionDep) -> WebsiteUnpublishResponse:
    down = await unpublish_website(session, user_id)
    if down is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="This website is not published"
        )
    return WebsiteUnpublishResponse(host=down.host)


@router.get("/api/storefronts/{handle}", response_model=StorefrontResponse)
async def read_storefront(
    handle: str, session: SessionDep, settings: SettingsDep
) -> StorefrontResponse:
    site = await published_storefront(session, settings, handle)
    if site is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="This website is not published"
        )
    return _storefront_response(site)
