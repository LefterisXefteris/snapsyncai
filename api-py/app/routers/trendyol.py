"""Trendyol International routes. Outcomes only — the rules live in the module."""

from decimal import Decimal, InvalidOperation

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response

from app.auth.clerk import CurrentUser
from app.config import SettingsDep
from app.db import SessionDep
from app.schemas.base import CamelModel
from app.services.trendyol import (
    AttributeValue,
    ListingDraft,
    connect,
    connection,
    disconnect,
    list_attributes,
    list_brands,
    list_categories,
    open_product,
    push,
)
from app.services.trendyol_api import get_trendyol_account

router = APIRouter(tags=["trendyol"])


class StorefrontOut(CamelModel):
    code: str
    currency: str


class LinkOut(CamelModel):
    available: bool
    connected: bool
    message: str | None = None
    storefront: str | None = None
    currency: str | None = None
    vat_rate: int | None = None
    storefronts: list[StorefrontOut] = []


class ConnectBody(CamelModel):
    seller_id: str
    api_key: str
    api_secret: str
    storefront_code: str | None = None
    vat_rate: int | None = None


class AttributeBody(CamelModel):
    attribute_id: str
    value_id: str | None = None
    custom: str | None = None


class ListingBody(CamelModel):
    category_id: str | None = None
    category_name: str | None = None
    brand_id: str | None = None
    brand_name: str | None = None
    attributes: list[AttributeBody] = []
    sale_price: str | None = None
    list_price: str | None = None


class ChoiceOut(CamelModel):
    id: str
    name: str


class AttributeOut(CamelModel):
    id: str
    name: str
    value_id: str | None = None
    custom: str | None = None
    choices: list[ChoiceOut] = []


class PageOut(CamelModel):
    connected: bool
    storefront: str | None = None
    currency: str | None = None
    vat_rate: int | None = None
    category_id: str | None = None
    category_name: str | None = None
    brand_id: str | None = None
    brand_name: str | None = None
    sale_price: str | None = None
    list_price: str | None = None
    attributes: list[AttributeOut] = []
    approval: str | None = None
    reason: str | None = None
    push_wait: str | None = None


class NamedOut(CamelModel):
    id: str
    name: str


def _price(value: str | None) -> Decimal | None:
    if value is None:
        return None
    text = value.strip()
    if not text:
        return None
    try:
        return Decimal(text)
    except InvalidOperation as exc:
        raise HTTPException(status_code=400, detail="Enter a price as a number.") from exc


def _draft(body: ListingBody) -> ListingDraft:
    return ListingDraft(
        category_id=body.category_id,
        category_name=body.category_name,
        brand_id=body.brand_id,
        brand_name=body.brand_name,
        attributes=tuple(
            AttributeValue(
                attribute_id=item.attribute_id, value_id=item.value_id, custom=item.custom
            )
            for item in body.attributes
        ),
        sale_price=_price(body.sale_price),
        list_price=_price(body.list_price),
    )


def _link_out(link) -> LinkOut:
    return LinkOut(
        available=link.available,
        connected=link.connected,
        message=link.message,
        storefront=link.storefront,
        currency=link.currency,
        vat_rate=link.vat_rate,
        storefronts=[
            StorefrontOut(code=item.code, currency=item.currency) for item in link.storefronts
        ],
    )


def _page_out(page) -> PageOut:
    return PageOut(
        connected=page.connected,
        storefront=page.storefront,
        currency=page.currency,
        vat_rate=page.vat_rate,
        category_id=page.category_id,
        category_name=page.category_name,
        brand_id=page.brand_id,
        brand_name=page.brand_name,
        sale_price=page.sale_price,
        list_price=page.list_price,
        attributes=[
            AttributeOut(
                id=item.id,
                name=item.name,
                value_id=item.value_id,
                custom=item.custom,
                choices=[ChoiceOut(id=choice_id, name=name) for choice_id, name in item.choices],
            )
            for item in page.attributes
        ],
        approval=page.approval,
        reason=page.reason,
        push_wait=page.push_wait,
    )


@router.get("/api/trendyol", response_model=LinkOut)
async def trendyol_status(user_id: CurrentUser, session: SessionDep) -> LinkOut:
    return _link_out(await connection(session, user_id))


@router.post("/api/trendyol/connect", response_model=LinkOut)
async def trendyol_connect(
    body: ConnectBody,
    user_id: CurrentUser,
    session: SessionDep,
    settings: SettingsDep,
    trendyol=Depends(get_trendyol_account),
) -> LinkOut:
    link = await connect(
        session,
        settings,
        trendyol,
        user_id,
        seller_id=body.seller_id,
        api_key=body.api_key,
        api_secret=body.api_secret,
        storefront_code=body.storefront_code,
        vat_rate=body.vat_rate,
    )
    if link.message and not link.connected:
        raise HTTPException(status_code=400, detail=link.message)
    return _link_out(link)


@router.post("/api/trendyol/disconnect", status_code=204)
async def trendyol_disconnect(user_id: CurrentUser, session: SessionDep) -> Response:
    await disconnect(session, user_id)
    return Response(status_code=204)


@router.get("/api/trendyol/categories", response_model=list[NamedOut])
async def trendyol_categories(
    user_id: CurrentUser,
    session: SessionDep,
    settings: SettingsDep,
    trendyol=Depends(get_trendyol_account),
) -> list[NamedOut]:
    rows = await list_categories(session, settings, trendyol, user_id)
    return [NamedOut(id=row.id, name=row.name) for row in rows]


@router.get("/api/trendyol/brands", response_model=list[NamedOut])
async def trendyol_brands(
    user_id: CurrentUser,
    session: SessionDep,
    settings: SettingsDep,
    trendyol=Depends(get_trendyol_account),
    q: str = "",
) -> list[NamedOut]:
    rows = await list_brands(session, settings, trendyol, user_id, q)
    return [NamedOut(id=row.id, name=row.name) for row in rows]


@router.get("/api/trendyol/categories/{category_id}/attributes", response_model=list[AttributeOut])
async def trendyol_attributes(
    category_id: str,
    user_id: CurrentUser,
    session: SessionDep,
    settings: SettingsDep,
    trendyol=Depends(get_trendyol_account),
) -> list[AttributeOut]:
    rows = await list_attributes(session, settings, trendyol, user_id, category_id)
    return [
        AttributeOut(
            id=row.id,
            name=row.name,
            choices=[ChoiceOut(id=choice_id, name=name) for choice_id, name in row.choices],
        )
        for row in rows
    ]


@router.get("/api/trendyol/products/{product_id}", response_model=PageOut)
async def trendyol_product(
    product_id: int,
    user_id: CurrentUser,
    session: SessionDep,
    settings: SettingsDep,
    trendyol=Depends(get_trendyol_account),
) -> PageOut:
    page = await open_product(session, settings, trendyol, user_id, product_id)
    if page is None:
        raise HTTPException(status_code=404, detail="Image not found")
    return _page_out(page)


@router.post("/api/trendyol/products/{product_id}/push")
async def trendyol_push(
    product_id: int,
    body: ListingBody,
    user_id: CurrentUser,
    session: SessionDep,
    settings: SettingsDep,
    trendyol=Depends(get_trendyol_account),
):
    page = await push(session, settings, trendyol, user_id, product_id, _draft(body))
    if page is None:
        raise HTTPException(status_code=404, detail="Image not found")
    if page.push_wait or page.reason:
        raise HTTPException(status_code=400, detail=page.push_wait or page.reason)
    return _page_out(page)
