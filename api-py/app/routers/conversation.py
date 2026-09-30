"""Conversation — authenticate the seller and pass the message through."""

from fastapi import APIRouter
from sqlalchemy import select

from app.auth.clerk import CurrentUser
from app.config import SettingsDep
from app.db import SessionDep
from app.models.conversation import ShopConversation
from app.schemas.base import CamelModel
from app.services import connections
from app.services.conversation import (
    ConversationState,
    SellerAct,
    SellerMessage,
    Silence,
    dump_state,
    load_state,
    reply,
    state_for_shop,
)
from app.services.conversation_jobs import SellerJobs
from app.services.conversation_model import OpenAIConversationModel

router = APIRouter(tags=["conversation"])


class SilenceBody(CamelModel):
    offers: bool = False
    bulk_seo: bool = False
    listing_copy_refresh: bool = False
    website: bool = False


class ConversationActBody(CamelModel):
    kind: str
    product_id: int | None = None
    confirm_overflow: bool = False
    look: str = ""
    product_ids: list[int] = []
    silence: SilenceBody | None = None


class ConversationBody(CamelModel):
    text: str = ""
    act: ConversationActBody | None = None


class ThreadTurnOut(CamelModel):
    role: str
    text: str


class ProposalItemOut(CamelModel):
    product_id: int
    error: str | None = None
    proposal: dict | None = None
    queries: list[str] = []


class ProposalOut(CamelModel):
    job: str
    items: list[ProposalItemOut]


class ConversationOut(CamelModel):
    reply: str
    thread: list[ThreadTurnOut]
    silence: SilenceBody
    proposal: ProposalOut | None = None
    connect_path: str | None = None
    shop_connected: bool


def _silence_body(silence: Silence) -> SilenceBody:
    return SilenceBody(
        offers=silence.offers,
        bulk_seo=silence.bulk_seo,
        listing_copy_refresh=silence.listing_copy_refresh,
        website=silence.website,
    )


def _out(
    state: ConversationState,
    reply_text: str,
    connect_path: str | None,
    shop: bool,
) -> ConversationOut:
    proposal = None
    if state.proposal is not None:
        proposal = ProposalOut(
            job=state.proposal.job,
            items=[
                ProposalItemOut(
                    product_id=item.product_id,
                    error=item.error,
                    proposal=None if item.proposal is None else dict(item.proposal),
                    queries=list(item.queries),
                )
                for item in state.proposal.items
            ],
        )
    return ConversationOut(
        reply=reply_text,
        thread=[ThreadTurnOut(role=turn.role, text=turn.text) for turn in state.thread],
        silence=_silence_body(state.silence),
        proposal=proposal,
        connect_path=connect_path,
        shop_connected=shop,
    )


async def _row(session, user_id: str) -> ShopConversation | None:
    return (
        await session.execute(
            select(ShopConversation).where(ShopConversation.session_id == user_id)
        )
    ).scalar_one_or_none()


async def _load(session, user_id: str, shop_domain: str | None) -> ConversationState:
    row = await _row(session, user_id)
    if row is None:
        return ConversationState()
    stored = load_state(
        {"silence": row.silence or {}, "thread": row.thread or [], "proposal": row.proposal}
    )
    return state_for_shop(stored, row.shop_domain, shop_domain)


async def _save(session, user_id: str, state: ConversationState, shop_domain: str | None) -> None:
    dumped = dump_state(state)
    row = await _row(session, user_id)
    if row is None:
        session.add(
            ShopConversation(
                session_id=user_id,
                shop_domain=shop_domain,
                silence=dumped["silence"],
                thread=dumped["thread"],
                proposal=dumped["proposal"],
            )
        )
        return
    if shop_domain:
        row.shop_domain = shop_domain
    row.silence = dumped["silence"]
    row.thread = dumped["thread"]
    row.proposal = dumped["proposal"]
    session.add(row)


def _message(body: ConversationBody) -> SellerMessage:
    if body.act is None:
        return SellerMessage(text=body.text)
    silence = None
    if body.act.silence is not None:
        silence = Silence(
            offers=body.act.silence.offers,
            bulk_seo=body.act.silence.bulk_seo,
            listing_copy_refresh=body.act.silence.listing_copy_refresh,
            website=body.act.silence.website,
        )
    return SellerMessage(
        text=body.text,
        act=SellerAct(
            kind=body.act.kind,
            product_id=body.act.product_id,
            confirm_overflow=body.act.confirm_overflow,
            look=body.act.look,
            product_ids=tuple(body.act.product_ids),
            silence=silence,
        ),
    )


@router.get("/api/conversation", response_model=ConversationOut)
async def read_conversation(
    user_id: CurrentUser, session: SessionDep
) -> ConversationOut:
    connection = await connections.get_shopify(session, user_id)
    domain = connection.shop_domain if connection is not None else None
    state = await _load(session, user_id, domain)
    shop = connection is not None
    return _out(state, "", None if shop else "/api/shopify/oauth/start", shop)


@router.post("/api/conversation", response_model=ConversationOut)
async def post_conversation(
    body: ConversationBody,
    user_id: CurrentUser,
    session: SessionDep,
    settings: SettingsDep,
) -> ConversationOut:
    connection = await connections.get_shopify(session, user_id)
    domain = connection.shop_domain if connection is not None else None
    state = await _load(session, user_id, domain)
    result = await reply(
        _message(body),
        state,
        shop_connected=connection is not None,
        model=OpenAIConversationModel(),
        jobs=SellerJobs(session, user_id, settings),
    )
    await _save(session, user_id, result.state, domain)
    return _out(
        result.state,
        result.reply,
        None if result.connect is None else result.connect.path,
        connection is not None,
    )
