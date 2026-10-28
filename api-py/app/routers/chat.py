"""Chat — the card's thread. Auth and the shop domain live here; the job does not."""

import logging
from decimal import Decimal, InvalidOperation
from typing import Annotated

from fastapi import APIRouter, Depends

from app.auth.clerk import CurrentUser
from app.config import SettingsDep
from app.db import SessionDep
from app.schemas.base import CamelModel
from app.services import product as product_page
from app.services.chat import Model, SqlThreadStore, ask, model_from, products_from_images
from app.services.chat_catalogue import Rewritten, Started
from app.services.chat_channel import Sent
from app.services.chat_import import ShopifyImport
from app.services.chat_listing import (
    Kept,
    Proposal,
    copy_for_accept,
    copy_for_refresh,
    proposal_text,
)
from app.services.chat_records import ShopRecords
from app.services.connections import get_shopify
from app.services.images import get_image, get_images_by_ids, list_images, update_image
from app.services.listing_copy_accept import accept_generated, accept_refresh
from app.services.listing_copy_generate import generate_listing_copy, regenerate_listing_field
from app.services.listing_copy_propose import propose_bulk_seo, propose_refresh
from app.services.listing_copy_trace import listing_copy_trace_store, mark_refresh
from app.services.push import RECONNECT_FOR_PUBLICATIONS, push_products
from app.services.shopify import (
    ShopifyGraphQLForDep,
    list_shopify_publications,
    online_store_publication_id,
)
from app.services.trendyol import (
    AttributeValue,
    ListingDraft,
    open_product,
)
from app.services.trendyol import (
    push as push_trendyol_listing,
)
from app.services.trendyol_api import get_trendyol_account

router = APIRouter(tags=["chat"])


class ChatTurnOut(CamelModel):
    role: str
    text: str


class ChatResponse(CamelModel):
    thread: list[ChatTurnOut]


class ChatFaq(CamelModel):
    q: str = ""
    a: str = ""


class ChatProposalIn(CamelModel):
    title: str = ""
    description: str = ""
    tags: list[str] = []
    seo_title: str = ""
    seo_description: str = ""
    aeo_faqs: list[ChatFaq] = []


class ChatBody(CamelModel):
    message: str
    open_product_id: int | None = None
    page_proposal: ChatProposalIn | None = None
    bulk_seo_ids: list[int] = []


def get_chat_model(settings: SettingsDep) -> Model:
    return model_from(settings.chat_model_url, token=settings.chat_model_token)


ChatModel = Annotated[Model, Depends(get_chat_model)]


class _PageWriter:
    """Confirm and typed listing copy, the same saves as the product page."""

    def __init__(self, session, user_id: str) -> None:
        self._session = session
        self._user_id = user_id

    async def confirm(self, product_id: int, facts: dict) -> str | None:
        saved = await product_page.confirm(self._session, self._user_id, product_id, **facts)
        if saved.product is None:
            return saved.message or "Which product? I don't see that one."
        return None

    async def type_listing_copy(self, product_id: int, updates: dict) -> str | None:
        saved = await update_image(self._session, product_id, dict(updates), self._user_id)
        if saved is None:
            return "Which product? I don't see that one."
        return None


class _Listing:
    """Generate and Accept, the same jobs as the product page."""

    def __init__(self, session, settings, user_id: str) -> None:
        self._session = session
        self._settings = settings
        self._user_id = user_id

    async def generate(self, product_id: int) -> Proposal | str:
        return await generate_listing_copy(self._session, self._settings, self._user_id, product_id)

    async def accept(self, product_id: int, proposal: Proposal, **extra: object) -> Kept:
        kind = extra.get("kind") if isinstance(extra.get("kind"), str) else "generate"
        trace_id = extra.get("trace_id") if isinstance(extra.get("trace_id"), str) else None
        pack_id = extra.get("pack_id") if isinstance(extra.get("pack_id"), str) else ""
        if kind == "generate":
            result = await accept_generated(
                self._session,
                self._settings,
                self._user_id,
                product_id,
                copy_for_accept(proposal),
                trace_id=trace_id,
            )
        else:
            result = await accept_refresh(
                self._session,
                self._settings,
                self._user_id,
                product_id,
                copy_for_refresh(proposal),
                job="refresh" if kind == "refresh" else "bulk_seo",
                trace_id=trace_id,
                pack_id=pack_id,
            )
        if result.refused:
            return Kept(credits_spent=0, refused=result.message or "Could not accept listing copy.")
        return Kept(credits_spent=1 if result.spent else 0)

    async def refresh(self, product_id: int) -> Proposal | Started | str:
        proposed = await propose_refresh(self._session, self._settings, self._user_id, product_id)
        if proposed.proposal is None:
            return proposed.message or "Could not parse listing copy refresh."
        return _started(product_id, proposed.proposal)

    async def bulk_seo(self, product_ids: list[int] | tuple[int, ...]) -> tuple[Started, ...] | str:
        pack, pack_id = await propose_bulk_seo(
            self._session, self._settings, self._user_id, product_ids
        )
        if pack.error:
            return pack.error
        return tuple(
            _started(item.id, item.proposal, pack_id=pack_id, refused=item.error)
            for item in pack.items
        )

    async def dismiss(
        self, product_id: int, *, kind: str, trace_id: str | None = None
    ) -> str | None:
        if kind != "refresh":
            return None
        image = await get_image(self._session, product_id, self._user_id)
        if image is None:
            return "Which product? I don't see that one."
        mark_refresh(
            listing_copy_trace_store(self._settings),
            product_id=product_id,
            outcome="dismissed",
            trace_id=trace_id,
        )
        return None

    async def regenerate_field(self, product_id: int, field: str) -> Rewritten | str:
        result = await regenerate_listing_field(
            self._session, self._settings, self._user_id, product_id, field
        )
        if isinstance(result, str):
            return result
        return Rewritten(field=result.field, text=result.text, tags=result.tags, faqs=result.faqs)


def _refresh_proposal(pack: dict) -> Proposal:
    tags = pack.get("tags")
    return Proposal(
        title="",
        description=pack.get("description") if isinstance(pack.get("description"), str) else "",
        tags=tuple(tag for tag in tags if isinstance(tag, str)) if isinstance(tags, list) else (),
        seo_title=pack.get("seoTitle") if isinstance(pack.get("seoTitle"), str) else "",
        seo_description=pack.get("seoDescription")
        if isinstance(pack.get("seoDescription"), str)
        else "",
        aeo_faqs=(),
    )


def _started(
    product_id: int,
    pack: dict | None,
    *,
    pack_id: str | None = None,
    refused: str | None = None,
) -> Started:
    if pack is None:
        return Started(product_id, refused=refused)
    trace_id = pack.get("traceId")
    return Started(
        product_id,
        _refresh_proposal(pack),
        trace_id=trace_id if isinstance(trace_id, str) else None,
        pack_id=pack_id,
    )


def _page_proposal(body: ChatProposalIn | None) -> Proposal | None:
    if body is None:
        return None
    proposal = Proposal(
        title=body.title,
        description=body.description,
        tags=tuple(body.tags),
        seo_title=body.seo_title,
        seo_description=body.seo_description,
        aeo_faqs=tuple((item.q, item.a) for item in body.aeo_faqs),
    )
    if not proposal_text(proposal):
        return None
    return proposal


def _response(thread: tuple[tuple[str, str], ...]) -> ChatResponse:
    return ChatResponse(thread=[ChatTurnOut(role=role, text=text) for role, text in thread])


CONNECT_SHOPIFY = "Connect Shopify in Settings to push this product."
NO_ONLINE_STORE = "This shop has no Online Store."
NOT_SEEN = "Which product? I don't see that one."
SHOPIFY_FAILED = "Shopify did not take this product."

logger = logging.getLogger(__name__)


def _from_push(pushed) -> Sent:
    if pushed.refused == "missing_copy":
        return Sent(refused="This product needs listing copy.")
    if pushed.refused is not None:
        return Sent(refused=pushed.message or SHOPIFY_FAILED)
    if pushed.success == 0:
        error = next((item.error for item in pushed.results if item.error), None)
        return Sent(refused=error or SHOPIFY_FAILED)
    return Sent(stock_not_set=pushed.stock_not_set)


def _decimal(value: str | None) -> Decimal | None:
    if value is None or not str(value).strip():
        return None
    try:
        return Decimal(str(value))
    except InvalidOperation:
        return None


def _trendyol_draft(page) -> ListingDraft:
    """The listing already on the product page. Push does not invent one."""
    return ListingDraft(
        category_id=page.category_id,
        category_name=page.category_name,
        brand_id=page.brand_id,
        brand_name=page.brand_name,
        attributes=tuple(
            AttributeValue(
                attribute_id=item.id,
                value_id=item.value_id,
                custom=item.custom,
            )
            for item in page.attributes
            if item.value_id or item.custom
        ),
        sale_price=_decimal(page.sale_price),
        list_price=_decimal(page.list_price),
    )


class _Channels:
    """Go live and Push, the same jobs as the product page."""

    def __init__(self, session, settings, user_id: str, graphql_for, trendyol) -> None:
        self._session = session
        self._settings = settings
        self._user_id = user_id
        self._graphql_for = graphql_for
        self._trendyol = trendyol

    async def go_live(self, product_id: int) -> Sent:
        return await self._shopify(product_id, live=True)

    async def push_shopify(self, product_id: int) -> Sent:
        return await self._shopify(product_id, live=False)

    async def push_trendyol(self, product_id: int) -> Sent:
        opened = await open_product(
            self._session, self._settings, self._trendyol, self._user_id, product_id
        )
        if opened is None:
            return Sent(refused=NOT_SEEN)
        sent = await push_trendyol_listing(
            self._session,
            self._settings,
            self._trendyol,
            self._user_id,
            product_id,
            _trendyol_draft(opened),
        )
        if sent is None:
            return Sent(refused=NOT_SEEN)
        if sent.push_wait or sent.reason:
            return Sent(refused=sent.push_wait or sent.reason)
        return Sent()

    async def _shopify(self, product_id: int, *, live: bool) -> Sent:
        connection = await get_shopify(self._session, self._user_id)
        if connection is None:
            return Sent(refused=CONNECT_SHOPIFY)
        images = await get_images_by_ids(self._session, [product_id], self._user_id)
        if not images:
            return Sent(refused=NOT_SEEN)
        graphql = self._graphql_for(connection)
        status = None
        publication_ids = None
        if live:
            target = await self._go_live_target(graphql, images[0])
            if isinstance(target, str):
                return Sent(refused=target)
            status, publication_ids = target
        pushed = await push_products(
            self._session,
            self._settings,
            graphql,
            self._user_id,
            images,
            granted_scopes=list(connection.granted_scopes or []),
            product_status=status,
            publication_ids=publication_ids,
        )
        return _from_push(pushed)

    async def _go_live_target(self, graphql, image) -> tuple[str, list[str]] | str:
        try:
            listed = await list_shopify_publications(graphql)
        except Exception:
            logger.exception("Shopify publications lookup failed before Go live")
            return RECONNECT_FOR_PUBLICATIONS
        online = online_store_publication_id(listed)
        if online is None:
            return NO_ONLINE_STORE
        stored = [
            item for item in (image.shopify_publication_ids or []) if isinstance(item, str) and item
        ]
        if online not in stored:
            stored.append(online)
        return "ACTIVE", stored


async def _shop_domain(session, user_id: str) -> str | None:
    connection = await get_shopify(session, user_id)
    if connection is None:
        return None
    return connection.shop_domain


@router.get("/api/chat", response_model=ChatResponse)
async def read_chat(user_id: CurrentUser, session: SessionDep) -> ChatResponse:
    domain = await _shop_domain(session, user_id)
    thread = await SqlThreadStore(session).load(user_id, domain)
    return _response(thread)


@router.post("/api/chat", response_model=ChatResponse)
async def post_chat(
    body: ChatBody,
    user_id: CurrentUser,
    session: SessionDep,
    settings: SettingsDep,
    model: ChatModel,
    graphql_for: ShopifyGraphQLForDep,
    trendyol=Depends(get_trendyol_account),
) -> ChatResponse:
    domain = await _shop_domain(session, user_id)
    products = products_from_images(await list_images(session, user_id))
    result = await ask(
        SqlThreadStore(session),
        user_id=user_id,
        shop_domain=domain,
        message=body.message,
        model=model,
        products=products,
        open_product_id=body.open_product_id,
        writer=_PageWriter(session, user_id),
        listing=_Listing(session, settings, user_id),
        page_proposal=_page_proposal(body.page_proposal),
        bulk_ticks=tuple(body.bulk_seo_ids),
        channels=_Channels(session, settings, user_id, graphql_for, trendyol),
        records=ShopRecords(session, settings, user_id, graphql_for),
        importer=ShopifyImport(session, user_id, domain, graphql_for),
    )
    return _response(result.thread)
