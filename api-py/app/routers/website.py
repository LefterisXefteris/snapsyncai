"""Website prototype listing and Lovable handoff."""

from dataclasses import replace

from fastapi import APIRouter, HTTPException, status

from app.auth.clerk import CurrentUser
from app.config import SettingsDep
from app.db import SessionDep
from app.schemas.base import CamelModel
from app.services import connections
from app.services import images as store
from app.services.plan_charge import authorize_plan_job, settle_plan_job
from app.services.shopify import list_shopify_product_image_urls
from app.services.website_handoff import (
    HandoffError,
    WebsiteProduct,
    build_handoff,
    eligible_products,
    photos_from_images,
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


class WebsiteHandoffResponse(CamelModel):
    lovable_url: str
    product_count: int


async def _with_channel_photos(
    connection, settings, products: list[WebsiteProduct]
) -> list[WebsiteProduct]:
    if connection is None:
        return products
    filled: list[WebsiteProduct] = []
    for product in products:
        try:
            urls = await list_shopify_product_image_urls(
                connection, settings, product.shopify_product_id
            )
        except Exception:
            urls = ()
        filled.append(replace(product, photo_urls=urls) if urls else product)
    return filled


@router.get("/api/website/prototype", response_model=WebsitePrototypeResponse)
async def website_prototype(
    user_id: CurrentUser, session: SessionDep, settings: SettingsDep
) -> WebsitePrototypeResponse:
    connection = await connections.get_shopify(session, user_id)
    images = await store.list_images(session, user_id)
    products = await _with_channel_photos(
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


@router.post("/api/website/handoff", response_model=WebsiteHandoffResponse)
async def website_handoff(
    body: WebsiteHandoffBody, user_id: CurrentUser, session: SessionDep, settings: SettingsDep
) -> WebsiteHandoffResponse:
    connection = await connections.get_shopify(session, user_id)
    if connection is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Shopify is not connected"
        )
    images = await store.list_images(session, user_id)
    eligible = await _with_channel_photos(
        connection, settings, eligible_products(photos_from_images(images))
    )
    wanted = set(body.product_ids)
    selected = [product for product in eligible if product.id in wanted]
    blocked = await authorize_plan_job(session, settings, user_id, "website_handoff")
    if blocked:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=blocked)
    try:
        result = build_handoff(
            shop_domain=connection.shop_domain,
            look=body.look,
            products=selected,
            shop_gpsr=connection.gpsr_identity if isinstance(connection.gpsr_identity, dict) else None,
        )
    except HandoffError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    await settle_plan_job(session, settings, user_id, "website_handoff")
    return WebsiteHandoffResponse(
        lovable_url=result.lovable_url, product_count=result.product_count
    )
