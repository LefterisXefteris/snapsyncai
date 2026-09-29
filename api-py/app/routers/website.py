"""Website prototype listing and Lovable handoff."""

from fastapi import APIRouter, HTTPException, status

from app.auth.clerk import CurrentUser
from app.config import SettingsDep
from app.db import SessionDep
from app.schemas.base import CamelModel
from app.services import connections
from app.services import images as store
from app.services.website_handoff import (
    eligible_products,
    hand_off_website,
    photos_from_images,
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


class WebsiteHandoffBody(CamelModel):
    product_ids: list[int]
    look: str = ""
    confirm_overflow: bool = False


class WebsiteHandoffResponse(CamelModel):
    lovable_url: str
    product_count: int


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


_HANDOFF_STATUS = {
    "not_connected": status.HTTP_409_CONFLICT,
    "plan_blocked": status.HTTP_403_FORBIDDEN,
    "overflow_confirm": status.HTTP_403_FORBIDDEN,
    "invalid": status.HTTP_400_BAD_REQUEST,
}


@router.post("/api/website/handoff", response_model=WebsiteHandoffResponse)
async def website_handoff(
    body: WebsiteHandoffBody, user_id: CurrentUser, session: SessionDep, settings: SettingsDep
) -> WebsiteHandoffResponse:
    result = await hand_off_website(
        session,
        settings,
        user_id,
        look=body.look,
        product_ids=body.product_ids,
        confirm_overflow=body.confirm_overflow,
    )
    if result.refused is not None or result.handoff is None:
        raise HTTPException(
            status_code=_HANDOFF_STATUS[result.refused or "invalid"], detail=result.message
        )
    return WebsiteHandoffResponse(
        lovable_url=result.handoff.lovable_url, product_count=result.handoff.product_count
    )
