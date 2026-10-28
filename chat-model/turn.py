"""One Chat turn. This process holds the model key. The API does not.

Run on the other machine:

    OPENAI_API_KEY=... CHAT_MODEL_TOKEN=... python server.py

Point the API's CHAT_MODEL_URL at https://that-host/turn and set the same
CHAT_MODEL_TOKEN there. The Shopify token and the session cookie never arrive.
"""

from __future__ import annotations

import hmac
import json
from collections.abc import Callable

UNAVAILABLE = "Chat is not available right now."

ACTS = {
    "confirm_facts",
    "type_listing_copy",
    "generate",
    "accept",
    "refresh",
    "bulk_seo",
    "dismiss",
    "regenerate_field",
    "go_live",
    "push",
    "adjust_stock",
    "selling",
    "publications",
    "shop_gpsr",
    "delete",
    "import",
    "buy_credits",
    "connect_channel",
    "disconnect_channel",
    "claim_shop",
    "cancel_plan",
    "choose_photos",
    "group",
}

_INSTRUCTIONS = """You are SnapSync Chat on its own server. Reply with one JSON object and nothing else.
The API runs any act you name. You do not call Shopify, and you do not change the shop yourself.
A question is text only: set "text" to the words the seller reads, set "done" to true, and omit "act". Never reply with only "done". Invent no fibre, price, or fact.
"product" is the name the seller used, or "this" for the open product. Never send an id.
"Put it live" is act "go_live". "Write the listing" is act "generate". Quoted words are act "type_listing_copy" with "quote": {"field", "words"}.
Accept is act "accept" only when a proposal is already in the thread. Buying Credits, connecting or disconnecting a Channel, claiming a shop, cancelling a Plan, and choosing photos use those browser acts and do not run here.
Grouping photos on New listing is act "group". You are not shown those photos.
A shop domain in the message does not switch shops. Omit any field you do not have. "done" is true after this one step.
Acts: confirm_facts, type_listing_copy, generate, accept, refresh, bulk_seo, dismiss, regenerate_field, go_live, push, adjust_stock, selling, publications, shop_gpsr, delete, import, group, buy_credits, connect_channel, disconnect_channel, claim_shop, cancel_plan, choose_photos.
"""


def authorized(header: str | None, token: str) -> bool:
    if not token or not header:
        return False
    scheme, _, given = header.partition(" ")
    if scheme.lower() != "bearer" or not given:
        return False
    return hmac.compare_digest(given, token)


def step_from_model(raw: str) -> dict:
    """Keep a model reply inside the step the API already understands."""
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return {"text": UNAVAILABLE, "done": True}
    if not isinstance(parsed, dict):
        return {"text": UNAVAILABLE, "done": True}
    step: dict = {"done": parsed.get("done") if isinstance(parsed.get("done"), bool) else True}
    text = parsed.get("text")
    if isinstance(text, str) and text.strip():
        step["text"] = text
    act = parsed.get("act")
    if isinstance(act, str) and act in ACTS:
        step["act"] = act
    product = parsed.get("product")
    if isinstance(product, str) and product.strip():
        step["product"] = product.strip()
    products = parsed.get("products")
    if isinstance(products, list):
        names = [item.strip() for item in products if isinstance(item, str) and item.strip()]
        if names:
            step["products"] = names
    for key in ("facts", "quote", "selling", "gpsr"):
        if isinstance(parsed.get(key), dict):
            step[key] = parsed[key]
    publications = parsed.get("publications")
    if isinstance(publications, list):
        names = [item.strip() for item in publications if isinstance(item, str) and item.strip()]
        if names:
            step["publications"] = names
    for key in ("field", "channel", "reason"):
        value = parsed.get(key)
        if isinstance(value, str) and value.strip():
            step[key] = value.strip()
    quantity = parsed.get("quantity")
    if isinstance(quantity, int) and not isinstance(quantity, bool) and quantity >= 0:
        step["quantity"] = quantity
    if "text" not in step and "act" not in step:
        return {"text": UNAVAILABLE, "done": True}
    return step


def turn(payload: dict, complete: Callable[[str], str]) -> dict:
    raw = complete(_INSTRUCTIONS + "\n" + json.dumps(payload))
    return step_from_model(raw)
