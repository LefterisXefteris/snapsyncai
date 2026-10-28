"""One thread per shop. The model sees the message, the thread, the shop, and the product.
It does not see a Shopify token or a session cookie.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable, Mapping, Sequence
from dataclasses import dataclass
from typing import Protocol

import httpx

from app.services.chat_catalogue import _holds, shop_act
from app.services.chat_channel import ChannelSends, channel_act
from app.services.chat_import import IMPORT, import_act, watch_import
from app.services.chat_inputs import (
    TYPED,
    copy_update,
    fact_kwargs,
    facts_from_payload,
    quote_from_payload,
)
from app.services.chat_listing import ListingCopy, Proposal, Shown, listing_act
from app.services.chat_records import (
    SHOP_GPSR,
    PageRecords,
    gpsr_from_payload,
    publications_from_payload,
    quantity_from_payload,
    reason_from_payload,
    record_act,
    selling_from_payload,
)
from app.services.chat_store import (
    MemoryThreadStore as MemoryThreadStore,
)
from app.services.chat_store import (
    SqlThreadStore as SqlThreadStore,
)

MODEL_CALL_LIMIT = 10
STOPPED = "Stopped after 10 steps."
UNAVAILABLE = "Chat is not available right now."
CONFIRMED = "Those facts are confirmed."
CONFIRM_FACTS = "confirm_facts"
TYPE_COPY = "type_listing_copy"

# These stay in the browser. Chat records that, and does not perform them.
BROWSER_ACTS = {
    "buy_credits": "Buying Credits stays on the page.",
    "connect_channel": "Connecting a Channel stays on the page.",
    "disconnect_channel": "Disconnecting a Channel stays on the page.",
    "claim_shop": "Claiming a shop stays on the page.",
    "cancel_plan": "Cancelling a Plan stays on the page.",
    "choose_photos": "Choosing photos stays on the page.",
}


@dataclass(frozen=True)
class NamedProduct:
    """One product. `title` is the name on the product list. Each photo keeps its own name."""

    id: int
    title: str
    photo_ids: tuple[int, ...] = ()
    photo_names: tuple[tuple[int, str], ...] = ()


@dataclass(frozen=True)
class ModelContext:
    message: str
    thread: tuple[tuple[str, str], ...]
    shop_domain: str | None
    calls_made: int
    open_product: NamedProduct | None = None
    product: NamedProduct | None = None


@dataclass(frozen=True)
class ModelStep:
    text: str = ""
    act: str | None = None
    done: bool = True
    product: str | None = None
    facts: Mapping[str, object] | None = None
    quote_field: str | None = None
    quote_words: str | None = None
    products: tuple[str, ...] = ()
    field: str | None = None
    channel: str | None = None
    quantity: int | None = None
    reason: str | None = None
    selling: Mapping[str, str] | None = None
    publications: tuple[str, ...] = ()
    gpsr: Mapping[str, object] | None = None


@dataclass(frozen=True)
class Asked:
    thread: tuple[tuple[str, str], ...]
    credits_spent: int
    shop_changed: bool
    product: NamedProduct | None = None


Model = Callable[[ModelContext], Awaitable[ModelStep]]


class ProductWriter(Protocol):
    """The page's confirm. A string is the refusal, and that call saved nothing."""

    async def confirm(self, product_id: int, facts: Mapping[str, object]) -> str | None: ...

    async def type_listing_copy(
        self, product_id: int, updates: Mapping[str, object]
    ) -> str | None: ...


class ThreadStore(Protocol):
    def exclusive(self, user_id: str, shop_domain: str | None):
        """Hold this shop's turn until the next message may start."""

    async def load(self, user_id: str, shop_domain: str | None) -> tuple[tuple[str, str], ...]: ...

    async def shown(self, user_id: str, shop_domain: str | None) -> tuple[Shown, ...]: ...

    async def save(
        self,
        user_id: str,
        shop_domain: str | None,
        thread: tuple[tuple[str, str], ...],
        shown: tuple[Shown, ...] = (),
    ) -> None: ...


def _turn_ends(step: ModelStep) -> bool:
    if step.act in BROWSER_ACTS or step.act in (CONFIRM_FACTS, TYPE_COPY):
        return step.done
    if step.act:
        return True
    return step.done


class _Photo(Protocol):
    id: int | None
    title: str | None
    original_name: str | None
    description: str | None
    product_group_id: str | None


def _text(value: object) -> str:
    return value.strip() if isinstance(value, str) else ""


def _visible(image: _Photo) -> str:
    return _text(image.title) or _text(image.original_name)


def products_from_images(images: Sequence[_Photo]) -> tuple[NamedProduct, ...]:
    """One product per group, named the way the product list names it."""
    groups: dict[str, list[_Photo]] = {}
    order: list[str] = []
    for image in images:
        if image.id is None:
            continue
        key = image.product_group_id or f"solo:{image.id}"
        if key not in groups:
            groups[key] = []
            order.append(key)
        groups[key].append(image)
    products: list[NamedProduct] = []
    for key in order:
        group = groups[key]
        primary = min(group, key=lambda image: (0 if image.description else 1, int(image.id or 0)))
        ordered = sorted(group, key=lambda image: int(image.id or 0))
        ids = tuple(int(image.id) for image in ordered if image.id is not None)
        names = tuple((int(image.id), _visible(image)) for image in ordered if image.id is not None)
        products.append(
            NamedProduct(
                id=int(primary.id or 0),
                title=_visible(primary),
                photo_ids=ids,
                photo_names=names,
            )
        )
    return tuple(products)


def _on_page(product: NamedProduct, photo_id: int) -> NamedProduct:
    title = next(
        (name for pid, name in product.photo_names if pid == photo_id and name.strip()),
        product.title,
    )
    return NamedProduct(
        id=photo_id,
        title=title,
        photo_ids=product.photo_ids,
        photo_names=product.photo_names,
    )


def _open_product(
    products: tuple[NamedProduct, ...], open_product_id: int | None
) -> NamedProduct | None:
    if open_product_id is None:
        return None
    for product in products:
        if open_product_id in product.photo_ids:
            return _on_page(product, open_product_id)
    return None


def _labels(product: NamedProduct) -> set[str]:
    raw = [product.title, *[name for _, name in product.photo_names]]
    return {name.casefold().strip() for name in raw if name.strip()}


def _named(name: str, products: tuple[NamedProduct, ...]) -> tuple[NamedProduct, ...]:
    needle = name.casefold().strip()
    if not needle:
        return ()
    return tuple(product for product in products if needle in _labels(product))


def _which(matches: tuple[NamedProduct, ...]) -> str:
    titles = [product.title for product in matches]
    if len({title.casefold() for title in titles}) == 1:
        count = "Two" if len(titles) == 2 else str(len(titles))
        return f"Which product? {count} are called {titles[0]}."
    if len(titles) == 2:
        return f"Which product — {titles[0]} or {titles[1]}?"
    listed = ", ".join(titles[:-1])
    return f"Which product — {listed}, or {titles[-1]}?"


NOT_SEEN = "Which product? I don't see that one."
NAME_IT = "Which product? Open its page, or name it."


def _resolve(
    name: str,
    products: tuple[NamedProduct, ...],
    open_product: NamedProduct | None,
) -> NamedProduct | str:
    """The one product, or the question to ask. A question means nothing runs."""
    if name.casefold().strip() == "this":
        if open_product is None:
            return NAME_IT
        return open_product
    matches = _named(name, products)
    if len(matches) == 1:
        return matches[0]
    if not matches:
        return NOT_SEEN
    return _which(matches)


async def ask(
    store: ThreadStore,
    *,
    user_id: str,
    shop_domain: str | None,
    message: str,
    model: Model,
    products: tuple[NamedProduct, ...] = (),
    open_product_id: int | None = None,
    writer: ProductWriter | None = None,
    listing: ListingCopy | None = None,
    page_proposal: Proposal | None = None,
    bulk_ticks: tuple[int, ...] = (),
    channels: ChannelSends | None = None,
    records: PageRecords | None = None,
    importer=None,
) -> Asked:
    text = message.strip()
    pending = None
    async with store.exclusive(user_id, shop_domain):
        thread = list(await store.load(user_id, shop_domain))
        proposals = list(await store.shown(user_id, shop_domain))
        if not text:
            return Asked(tuple(thread), 0, False)
        thread.append(("seller", text))
        open_product = _open_product(products, open_product_id)
        resolved: NamedProduct | None = None
        credits = 0
        for calls_made in range(MODEL_CALL_LIMIT):
            step = await model(
                ModelContext(
                    message=text,
                    thread=tuple(thread),
                    shop_domain=shop_domain,
                    calls_made=calls_made,
                    open_product=open_product,
                    product=resolved,
                )
            )
            token = (step.product or "").strip()
            if (
                step.product
                and step.act != SHOP_GPSR
                and step.act != IMPORT
                and not _holds(step.act, token, step.products)
            ):
                found = _resolve(step.product, products, open_product)
                if isinstance(found, str):
                    thread.append(("chat", found))
                    resolved = None
                    break
                resolved = found
            outcome = await shop_act(
                act=step.act,
                listing=listing,
                product_id=None if resolved is None else resolved.id,
                photo_ids=() if resolved is None else resolved.photo_ids,
                token=step.product,
                names=step.products,
                field=step.field,
                shown=proposals,
                catalogue=products,
                bulk_ticks=bulk_ticks,
                resolve=lambda name: _resolve(name, products, open_product),
                name_it=NAME_IT,
            )
            if outcome is None:
                outcome = await listing_act(
                    act=step.act,
                    listing=listing,
                    product_id=None if resolved is None else resolved.id,
                    name_it=NAME_IT,
                    shown=proposals,
                    page_proposal=page_proposal,
                    open_product_id=None if open_product is None else open_product.id,
                    photo_ids=() if resolved is None else resolved.photo_ids,
                )
            if outcome is None:
                outcome = await channel_act(
                    act=step.act,
                    channels=channels,
                    product_id=None if resolved is None else resolved.id,
                    channel=step.channel,
                    name_it=NAME_IT,
                )
            if outcome is None:
                named = bool((step.product or "").strip())
                outcome = await record_act(
                    act=step.act,
                    records=records,
                    product_id=resolved.id if named and resolved is not None else None,
                    quantity=step.quantity,
                    reason=step.reason,
                    selling=step.selling,
                    publications=step.publications,
                    gpsr=step.gpsr,
                    name_it=NAME_IT,
                )
            if outcome is None:
                imported = await import_act(act=step.act, importer=importer)
                if imported is not None:
                    thread.append(("chat", imported.text))
                    pending = imported.done
                    break
            if outcome is not None:
                thread.append(("chat", outcome.text))
                if outcome.shown_after is not None:
                    proposals[:] = list(outcome.shown_after)
                elif outcome.shown is not None:
                    proposals.append(outcome.shown)
                credits += outcome.credits_spent
                if outcome.continue_turn and not step.done:
                    continue
                break
            if step.act == CONFIRM_FACTS:
                if resolved is None:
                    thread.append(("chat", NAME_IT))
                    break
                if writer is None:
                    thread.append(("chat", UNAVAILABLE))
                    break
                refused = await writer.confirm(resolved.id, fact_kwargs(step.facts))
                thread.append(("chat", refused or CONFIRMED))
                if refused:
                    break
            elif step.act == TYPE_COPY:
                if resolved is None:
                    thread.append(("chat", NAME_IT))
                    break
                update = copy_update(step.quote_field, step.quote_words)
                if isinstance(update, str):
                    thread.append(("chat", update))
                    break
                if writer is None:
                    thread.append(("chat", UNAVAILABLE))
                    break
                shown = (
                    open_product
                    if open_product is not None and open_product.id in resolved.photo_ids
                    else resolved
                )
                refused = await writer.type_listing_copy(shown.id, update)
                thread.append(("chat", refused or TYPED[next(iter(update))]))
                if refused:
                    break
            elif step.act in BROWSER_ACTS:
                thread.append(("chat", BROWSER_ACTS[step.act]))
            elif step.text:
                thread.append(("chat", step.text))
            if _turn_ends(step):
                break
        else:
            thread.append(("chat", STOPPED))
        saved = tuple(thread)
        await store.save(user_id, shop_domain, saved, tuple(proposals))
        asked = Asked(saved, credits_spent=credits, shop_changed=False, product=resolved)
    if pending is not None:
        watch_import(store, user_id, shop_domain, pending)
    return asked


def _message_dicts(thread: tuple[tuple[str, str], ...]) -> list[dict[str, str]]:
    return [{"role": role, "text": body} for role, body in thread]


def _product_payload(product: NamedProduct | None) -> dict | None:
    if product is None:
        return None
    return {"id": product.id, "title": product.title}


def model_payload(ctx: ModelContext) -> dict:
    """What the model service is allowed to see. No token, no cookie, no invented id."""
    return {
        "message": ctx.message,
        "thread": _message_dicts(ctx.thread),
        "shopDomain": ctx.shop_domain,
        "callsMade": ctx.calls_made,
        "openProduct": _product_payload(ctx.open_product),
        "product": _product_payload(ctx.product),
    }


def _product_names(raw: object) -> tuple[str, ...]:
    """Names the message gave. An id is not a product."""
    if not isinstance(raw, list):
        return ()
    return tuple(item.strip() for item in raw if isinstance(item, str) and item.strip())


def _product_name(payload: dict) -> str | None:
    """A name or "this". An id the model sends is not a product."""
    raw = payload.get("product")
    if isinstance(raw, str) and raw.strip():
        return raw.strip()
    return None


def step_from_payload(payload: object) -> ModelStep:
    if not isinstance(payload, dict):
        return ModelStep(text=UNAVAILABLE)
    raw_text = payload.get("text")
    text = raw_text if isinstance(raw_text, str) else ""
    act = payload.get("act")
    if not isinstance(act, str):
        act = None
    done = payload.get("done", True)
    if not isinstance(done, bool):
        done = True
    product = _product_name(payload)
    facts = facts_from_payload(payload.get("facts"))
    quote_field, quote_words = quote_from_payload(payload.get("quote"))
    names = _product_names(payload.get("products"))
    field = payload.get("field")
    if not isinstance(field, str) or not field.strip():
        field = None
    else:
        field = field.strip()
    channel = payload.get("channel")
    if not isinstance(channel, str) or not channel.strip():
        channel = None
    else:
        channel = channel.strip()
    quantity = quantity_from_payload(payload.get("quantity"))
    reason = reason_from_payload(payload.get("reason"))
    selling = selling_from_payload(payload.get("selling"))
    publications = publications_from_payload(payload.get("publications"))
    gpsr = gpsr_from_payload(payload.get("gpsr"))
    if (
        not text
        and act is None
        and product is None
        and facts is None
        and quote_field is None
        and not names
        and field is None
        and quantity is None
        and reason is None
        and selling is None
        and not publications
        and gpsr is None
    ):
        return ModelStep(text=UNAVAILABLE)
    return ModelStep(
        text=text,
        act=act,
        done=done,
        product=product,
        facts=facts,
        quote_field=quote_field,
        quote_words=quote_words,
        products=names,
        field=field,
        channel=channel,
        quantity=quantity,
        reason=reason,
        selling=selling,
        publications=publications,
        gpsr=gpsr,
    )


def model_from(
    url: str | None,
    *,
    token: str | None = None,
    client: httpx.AsyncClient | None = None,
) -> Model:
    if not url:

        async def unavailable(_ctx: ModelContext) -> ModelStep:
            return ModelStep(text=UNAVAILABLE)

        return unavailable

    headers = {"Authorization": f"Bearer {token}"} if token else None

    async def call(ctx: ModelContext) -> ModelStep:
        http = client or httpx.AsyncClient(timeout=60)
        close = client is None
        try:
            response = await http.post(url, json=model_payload(ctx), headers=headers)
            response.raise_for_status()
            return step_from_payload(response.json())
        except (httpx.HTTPError, ValueError):
            return ModelStep(text=UNAVAILABLE)
        finally:
            if close:
                await http.aclose()

    return call
