"""One conversation for a Shopify shop.

A seller message and the stored state go in. A reply, the stored thread,
silence, any open proposal, and sometimes a connect instruction come out.
"""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import Any, Protocol

CONNECT_PATH = "/api/shopify/oauth/start"
RECENT_STRETCH = 8

_CONNECT_REPLY = (
    "Connect the Shopify shop you already use. This conversation does not open a shop."
)
_STOCK_UNCHANGED = "Inventory in this conversation is a read. Stock on hand was not changed."
_DECLINED = "That offer is declined. The job is not silenced."
_ONE_ACCEPT = "Accept one product at a time."
_SAVED = "Listing copy for that product is saved. Nothing was pushed."
_PUBLISH_ON_THE_PAGE = "Publish stays on the Website page: /website"
_ON_THE_PRODUCT_PAGE = "That stays on the product page."
_PAGE_INTENTS = frozenset({"go_live", "generate", "facts", "push", "new_listing"})
_JOB_LABEL = {
    "bulk_seo": "Bulk SEO",
    "listing_copy_refresh": "listing copy refresh",
    "website": "A website prototype",
}


@dataclass(frozen=True)
class Silence:
    offers: bool = False
    bulk_seo: bool = False
    listing_copy_refresh: bool = False
    website: bool = False

    def job_silenced(self, job: str | None) -> bool:
        if job == "bulk_seo":
            return self.bulk_seo
        if job == "listing_copy_refresh":
            return self.listing_copy_refresh
        if job == "website":
            return self.website
        return False


@dataclass(frozen=True)
class ThreadTurn:
    role: str
    text: str


@dataclass(frozen=True)
class ProposalItem:
    product_id: int
    error: str | None = None
    proposal: Mapping | None = None
    queries: tuple[str, ...] = ()


@dataclass(frozen=True)
class OpenProposal:
    job: str
    items: tuple[ProposalItem, ...] = ()


@dataclass(frozen=True)
class ConversationState:
    silence: Silence = field(default_factory=Silence)
    thread: tuple[ThreadTurn, ...] = ()
    proposal: OpenProposal | None = None


@dataclass(frozen=True)
class SellerAct:
    kind: str
    product_id: int | None = None
    confirm_overflow: bool = False
    look: str = ""
    product_ids: tuple[int, ...] = ()
    silence: Silence | None = None


@dataclass(frozen=True)
class SellerMessage:
    text: str = ""
    act: SellerAct | None = None


@dataclass(frozen=True)
class ConnectInstruction:
    path: str = CONNECT_PATH


@dataclass(frozen=True)
class ConversationResult:
    reply: str
    state: ConversationState
    connect: ConnectInstruction | None = None


@dataclass(frozen=True)
class ModelContext:
    silence: Silence
    proposal: OpenProposal | None
    recent: tuple[ThreadTurn, ...]
    message: str


@dataclass(frozen=True)
class ModelDecision:
    reply: str
    intent: str = "talk"
    job: str | None = None
    product_ids: tuple[int, ...] = ()


@dataclass(frozen=True)
class InventoryOnHand:
    total_units: int
    total_items: int
    lines: tuple[tuple[str, int], ...] = ()


@dataclass(frozen=True)
class JobOutcome:
    error: str | None = None
    items: tuple[ProposalItem, ...] = ()
    spent: bool = False
    needs_overflow_confirm: bool = False
    product_count: int = 0


class ConversationModel(Protocol):
    async def decide(self, context: ModelContext) -> ModelDecision: ...


class ConversationJobs(Protocol):
    async def read_inventory(self) -> InventoryOnHand: ...

    async def start_bulk_seo(self, product_ids: tuple[int, ...]) -> JobOutcome: ...

    async def start_refresh(self, product_id: int) -> JobOutcome: ...

    async def accept(
        self,
        job: str,
        product_id: int,
        proposal: Mapping | None,
        *,
        confirm_overflow: bool,
    ) -> JobOutcome: ...

    async def dismiss(self, job: str, product_id: int) -> JobOutcome: ...

    async def regenerate(
        self, job: str, product_id: int, queries: tuple[str, ...]
    ) -> JobOutcome: ...

    async def read_website(self) -> JobOutcome: ...


def _context(message: SellerMessage, state: ConversationState) -> ModelContext:
    return ModelContext(
        silence=state.silence,
        proposal=state.proposal,
        recent=state.thread[-RECENT_STRETCH:],
        message=message.text,
    )


_KEEP = object()


async def _start(decision: ModelDecision, jobs: ConversationJobs) -> tuple[str, object]:
    if decision.job == "listing_copy_refresh":
        product_id = decision.product_ids[0]
        outcome = await jobs.start_refresh(product_id)
        job = "listing_copy_refresh"
    elif decision.job == "website":
        outcome = await jobs.read_website()
        job = "website"
    else:
        outcome = await jobs.start_bulk_seo(tuple(decision.product_ids))
        job = "bulk_seo"
    if outcome.error and not outcome.items:
        return outcome.error, _KEEP
    lines = []
    for item in outcome.items:
        if item.error:
            lines.append(f"Product {item.product_id}: {item.error}")
        elif item.proposal is not None:
            lines.append(f"Product {item.product_id}: proposal ready.")
        else:
            lines.append(f"Product {item.product_id}.")
    return " ".join(lines), OpenProposal(job=job, items=outcome.items)


def _job_label(job: str | None) -> str:
    return _JOB_LABEL.get(job or "", "that job")


def _on_hand_reply(on_hand: InventoryOnHand) -> str:
    lines = ", ".join(f"{name}: {qty}" for name, qty in on_hand.lines)
    summary = f"On hand: {on_hand.total_units} units across {on_hand.total_items} products."
    return f"{summary} {lines}".strip()


def _append(
    state: ConversationState, seller: str, reply_text: str, **changes: object
) -> ConversationState:
    thread = state.thread + (
        ThreadTurn("seller", seller),
        ThreadTurn("conversation", reply_text),
    )
    silence = changes["silence"] if "silence" in changes else state.silence
    proposal = changes["proposal"] if "proposal" in changes else state.proposal
    return ConversationState(silence=silence, thread=thread, proposal=proposal)  # type: ignore[arg-type]


def _silenced(job: str | None) -> str:
    return f"{_job_label(job)} is silenced in this conversation. Its page is still there."


def _without(proposal: OpenProposal, product_id: int) -> OpenProposal | None:
    remaining = tuple(item for item in proposal.items if item.product_id != product_id)
    if not remaining:
        return None
    return OpenProposal(job=proposal.job, items=remaining)


async def _act(
    message: SellerMessage,
    state: ConversationState,
    jobs: ConversationJobs,
) -> ConversationResult:
    act = message.act
    assert act is not None
    seller = message.text or act.kind
    proposal: object = _KEEP
    silence: object = _KEEP

    if act.kind == "silence" and act.silence is not None:
        text = "Silence saved for this shop."
        silence = act.silence
    elif act.kind == "decline":
        text = _DECLINED
    elif act.kind == "handoff":
        text = _silenced("website") if state.silence.website else _PUBLISH_ON_THE_PAGE
    elif act.kind == "accept" and state.proposal is not None and state.proposal.job == "website":
        text = _PUBLISH_ON_THE_PAGE
    elif act.kind == "accept":
        item = _proposal_item(state.proposal, act.product_id)
        if state.proposal is None or item is None or item.proposal is None:
            text = _ONE_ACCEPT
        elif state.silence.job_silenced(state.proposal.job):
            text = _silenced(state.proposal.job)
        else:
            outcome = await jobs.accept(
                state.proposal.job,
                item.product_id,
                dict(item.proposal),
                confirm_overflow=act.confirm_overflow,
            )
            if outcome.needs_overflow_confirm or outcome.error:
                text = outcome.error or "overflow_confirm_required"
            else:
                text = _SAVED
                proposal = _without(state.proposal, item.product_id)
    elif act.kind == "dismiss":
        if state.proposal is None or act.product_id is None:
            text = "There is no proposal to dismiss."
        else:
            await jobs.dismiss(state.proposal.job, act.product_id)
            text = "That proposal is dismissed."
            proposal = _without(state.proposal, act.product_id)
    elif act.kind == "regenerate":
        item = _proposal_item(state.proposal, act.product_id)
        if state.proposal is None or item is None:
            text = "There is no proposal to regenerate."
        elif state.silence.job_silenced(state.proposal.job):
            text = _silenced(state.proposal.job)
        else:
            outcome = await jobs.regenerate(state.proposal.job, item.product_id, item.queries)
            text = outcome.error or f"Product {item.product_id}: proposal ready."
            if outcome.items:
                proposal = _replace_item(state.proposal, outcome.items[0])
    else:
        text = _ON_THE_PRODUCT_PAGE

    changes: dict[str, object] = {}
    if proposal is not _KEEP:
        changes["proposal"] = proposal
    if silence is not _KEEP:
        changes["silence"] = silence
    return ConversationResult(reply=text, state=_append(state, seller, text, **changes))


def _proposal_item(proposal: OpenProposal | None, product_id: int | None) -> ProposalItem | None:
    if proposal is None or product_id is None:
        return None
    return next((item for item in proposal.items if item.product_id == product_id), None)


def _replace_item(proposal: OpenProposal, replacement: ProposalItem) -> OpenProposal:
    items = tuple(
        replacement if item.product_id == replacement.product_id else item
        for item in proposal.items
    )
    return OpenProposal(job=proposal.job, items=items)


async def reply(
    message: SellerMessage,
    state: ConversationState,
    *,
    shop_connected: bool,
    model: ConversationModel,
    jobs: ConversationJobs,
) -> ConversationResult:
    if not shop_connected:
        text = _CONNECT_REPLY
        return ConversationResult(
            reply=text,
            state=_append(state, message.text, text),
            connect=ConnectInstruction(),
        )
    if message.act is not None:
        return await _act(message, state, jobs)
    decision = await model.decide(_context(message, state))
    proposal: object = _KEEP
    if decision.intent == "adjust":
        text = _STOCK_UNCHANGED
    elif decision.intent == "inventory":
        text = _on_hand_reply(await jobs.read_inventory())
    elif decision.intent == "offer":
        if state.silence.offers or state.silence.job_silenced(decision.job):
            text = "Ask when you want a job started."
        else:
            text = f"Job offer: {_job_label(decision.job)}. It has not started."
    elif decision.intent == "decline":
        text = _DECLINED
    elif decision.intent == "accept":
        text = _ONE_ACCEPT
    elif decision.intent == "handoff":
        text = _PUBLISH_ON_THE_PAGE
    elif decision.intent == "claim":
        text = "Opening a shop is not available from this conversation."
    elif decision.intent in _PAGE_INTENTS:
        product_id = decision.product_ids[0] if decision.product_ids else None
        text = (
            f"That stays on the product page: /product/{product_id}"
            if product_id is not None
            else _ON_THE_PRODUCT_PAGE
        )
    elif decision.intent == "start" and state.silence.job_silenced(decision.job):
        text = _silenced(decision.job)
    elif decision.intent == "start":
        text, proposal = await _start(decision, jobs)
    else:
        text = decision.reply
    changes: dict[str, object] = {}
    if proposal is not _KEEP:
        changes["proposal"] = proposal
    return ConversationResult(
        reply=text, state=_append(state, message.text, text, **changes)
    )


def state_for_shop(
    state: ConversationState, stored_domain: str | None, shop_domain: str | None
) -> ConversationState:
    """A different connected shop does not keep the previous shop's thread."""
    if shop_domain and stored_domain and shop_domain != stored_domain:
        return ConversationState()
    return state


def dump_state(state: ConversationState) -> dict[str, Any]:
    proposal = None
    if state.proposal is not None:
        proposal = {
            "job": state.proposal.job,
            "items": [
                {
                    "product_id": item.product_id,
                    "error": item.error,
                    "proposal": None if item.proposal is None else dict(item.proposal),
                    "queries": list(item.queries),
                }
                for item in state.proposal.items
            ],
        }
    return {
        "silence": {
            "offers": state.silence.offers,
            "bulk_seo": state.silence.bulk_seo,
            "listing_copy_refresh": state.silence.listing_copy_refresh,
            "website": state.silence.website,
        },
        "thread": [{"role": turn.role, "text": turn.text} for turn in state.thread],
        "proposal": proposal,
    }


def load_state(stored: Mapping[str, Any] | None) -> ConversationState:
    if not stored:
        return ConversationState()
    silence_raw = stored.get("silence") if isinstance(stored.get("silence"), Mapping) else {}
    thread_raw = stored.get("thread") if isinstance(stored.get("thread"), list) else []
    proposal_raw = stored.get("proposal")
    silence = Silence(
        offers=bool(silence_raw.get("offers")),
        bulk_seo=bool(silence_raw.get("bulk_seo")),
        listing_copy_refresh=bool(silence_raw.get("listing_copy_refresh")),
        website=bool(silence_raw.get("website")),
    )
    thread = tuple(
        ThreadTurn(str(turn.get("role") or "conversation"), str(turn.get("text") or ""))
        for turn in thread_raw
        if isinstance(turn, Mapping)
    )
    proposal = None
    if isinstance(proposal_raw, Mapping) and isinstance(proposal_raw.get("job"), str):
        items: list[ProposalItem] = []
        raw_items = proposal_raw.get("items")
        for item in raw_items if isinstance(raw_items, list) else []:
            if not isinstance(item, Mapping):
                continue
            raw_proposal = item.get("proposal")
            queries = item.get("queries") if isinstance(item.get("queries"), list) else []
            product_id = item.get("product_id")
            items.append(
                ProposalItem(
                    product_id=int(product_id) if isinstance(product_id, int) else 0,
                    error=item.get("error") if isinstance(item.get("error"), str) else None,
                    proposal=dict(raw_proposal) if isinstance(raw_proposal, Mapping) else None,
                    queries=tuple(str(query) for query in queries),
                )
            )
        proposal = OpenProposal(job=proposal_raw["job"], items=tuple(items))
    return ConversationState(silence=silence, thread=thread, proposal=proposal)
