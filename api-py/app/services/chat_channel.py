"""Go live, a Shopify Push, and a Trendyol International Push.

These are the page's sends. A Push that names no Channel asks, and nothing is sent.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from app.services.chat_listing import ListingReply

GO_LIVE = "go_live"
PUSH = "push"
LIVE = "It's on the Online Store."
PUSHED_SHOPIFY = "Pushed to Shopify."
PUSHED_TRENDYOL = "Pushed to Trendyol International."
WHICH_CHANNEL = "Which Channel — Shopify or Trendyol International?"
STOCK_NOT_SET = "Available stock was not set."


@dataclass(frozen=True)
class Sent:
    """The page's send. A refusal sent nothing."""

    refused: str | None = None
    stock_not_set: bool = False


class ChannelSends(Protocol):
    """The page's Go live, Shopify Push, and Trendyol International Push."""

    async def go_live(self, product_id: int) -> Sent: ...

    async def push_shopify(self, product_id: int) -> Sent: ...

    async def push_trendyol(self, product_id: int) -> Sent: ...


def _channel(name: str | None) -> str | None:
    folded = (name or "").casefold().strip()
    if folded == "shopify":
        return "shopify"
    if folded == "trendyol international":
        return "trendyol"
    return None


def _reply(sent: Sent, words: str) -> ListingReply:
    if sent.refused:
        return ListingReply(sent.refused)
    text = f"{words} {STOCK_NOT_SET}" if sent.stock_not_set else words
    return ListingReply(text, continue_turn=True)


async def channel_act(
    *,
    act: str | None,
    channels: ChannelSends | None,
    product_id: int | None,
    channel: str | None,
    name_it: str,
) -> ListingReply | None:
    """Run a send. None means this step is not one of them."""
    if act not in (GO_LIVE, PUSH):
        return None
    if channels is None:
        from app.services.chat import UNAVAILABLE

        return ListingReply(UNAVAILABLE)
    if product_id is None:
        return ListingReply(name_it)
    if act == GO_LIVE:
        return _reply(await channels.go_live(product_id), LIVE)
    kind = _channel(channel)
    if kind is None:
        return ListingReply(WHICH_CHANNEL)
    if kind == "shopify":
        return _reply(await channels.push_shopify(product_id), PUSHED_SHOPIFY)
    return _reply(await channels.push_trendyol(product_id), PUSHED_TRENDYOL)
