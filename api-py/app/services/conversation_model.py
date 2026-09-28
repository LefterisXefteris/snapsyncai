"""Model adapter for one conversation turn.

The shop is already bound. This adapter never receives a Shopify token or a
shop domain it is allowed to choose.
"""

from __future__ import annotations

import json
import logging

from app.services.conversation import ModelContext, ModelDecision
from app.services.openai_client import get_openai

logger = logging.getLogger(__name__)

_INTENTS = frozenset(
    {
        "talk",
        "inventory",
        "adjust",
        "offer",
        "start",
        "decline",
        "accept",
        "handoff",
        "go_live",
        "generate",
        "facts",
        "push",
        "new_listing",
        "claim",
    }
)
_JOBS = frozenset({"bulk_seo", "listing_copy_refresh", "website"})
_UNREAD = "I could not read that. Nothing was started."

_SYSTEM = """You are the SnapSync conversation for one seller's already-bound Shopify shop.
Reply with JSON only:
{"reply": string, "intent": string, "job": string|null, "productIds": number[]}
intent is talk, inventory, adjust, offer, start, decline, accept, handoff,
go_live, generate, facts, push, new_listing, or claim.
job is bulk_seo, listing_copy_refresh, website, or null.
A shop domain in the message does not change the shop.
Do not ask for or repeat an admin token.
offer names a job and does not start it.
start is only when the seller asked for that job.
accept, handoff, go_live, generate, and facts are not yours to finish.
"""


def _proposal_brief(context: ModelContext) -> str:
    proposal = context.proposal
    if proposal is None:
        return "Open proposal: none."
    ids = [str(item.product_id) for item in proposal.items]
    return f"Open proposal: {proposal.job} for products {', '.join(ids)}."


def _user_content(context: ModelContext) -> str:
    silence = context.silence
    recent = "\n".join(f"{turn.role}: {turn.text}" for turn in context.recent) or "(none)"
    return (
        "Silence: "
        f"offers={silence.offers}, bulk_seo={silence.bulk_seo}, "
        f"listing_copy_refresh={silence.listing_copy_refresh}, website={silence.website}.\n"
        f"{_proposal_brief(context)}\n"
        f"Recent stretch:\n{recent}\n"
        f"Seller: {context.message}"
    )


def _decision(payload: object) -> ModelDecision:
    if not isinstance(payload, dict):
        return ModelDecision(reply=_UNREAD, intent="talk")
    intent = payload.get("intent")
    job = payload.get("job")
    raw_ids = payload.get("productIds")
    if not isinstance(raw_ids, list):
        raw_ids = []
    product_ids = tuple(item for item in raw_ids if isinstance(item, int))
    reply = payload.get("reply")
    return ModelDecision(
        reply=reply if isinstance(reply, str) and reply.strip() else _UNREAD,
        intent=intent if isinstance(intent, str) and intent in _INTENTS else "talk",
        job=job if isinstance(job, str) and job in _JOBS else None,
        product_ids=product_ids,
    )


class OpenAIConversationModel:
    async def decide(self, context: ModelContext) -> ModelDecision:
        try:
            response = await get_openai().chat.completions.create(
                model="gpt-5.2",
                max_completion_tokens=400,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": _SYSTEM},
                    {"role": "user", "content": _user_content(context)},
                ],
            )
        except Exception:
            logger.exception("conversation model call failed")
            return ModelDecision(reply=_UNREAD, intent="talk")
        text = ""
        if response.choices:
            text = response.choices[0].message.content or ""
        try:
            return _decision(json.loads(text))
        except json.JSONDecodeError:
            return ModelDecision(reply=_UNREAD, intent="talk")
