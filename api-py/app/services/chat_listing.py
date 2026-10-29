"""The proposal the page shows. Generate puts it in the thread. Accept is a later message."""

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Protocol

GENERATE = "generate"
ACCEPT = "accept"
ACCEPTED = "Accepted."
WRITE_FIRST = "Write the listing first. The proposal has to be in the thread before Accept."


@dataclass(frozen=True)
class Proposal:
    """The fields the product page shows for a generate proposal."""

    title: str
    description: str
    tags: tuple[str, ...]
    seo_title: str
    seo_description: str
    aeo_faqs: tuple[tuple[str, str], ...]


@dataclass(frozen=True)
class Shown:
    product_id: int
    proposal: Proposal
    kind: str = "generate"
    trace_id: str | None = None
    pack_id: str | None = None


@dataclass(frozen=True)
class Kept:
    """Accept landed, or the page refused and saved nothing."""

    credits_spent: int = 0
    refused: str | None = None


class ListingCopy(Protocol):
    """The page's generate job and the page's Accept."""

    async def generate(self, product_id: int) -> Proposal | str:
        """A string is the page's refusal. Nothing was proposed."""

    async def accept(self, product_id: int, proposal: Proposal) -> Kept: ...


@dataclass(frozen=True)
class PreviousInventory:
    """The Inventory quantity before this reply set a new one."""

    item_id: int
    quantity: int


@dataclass(frozen=True)
class PreviousSelling:
    """The Selling fields this reply replaced. An empty string was empty."""

    product_id: int
    fields: Mapping[str, str]


@dataclass(frozen=True)
class PreviousCopy:
    """The words this reply replaced on one listing-copy field. An empty string was empty."""

    product_id: int
    field: str
    words: str


@dataclass(frozen=True)
class PreviousFacts:
    """The facts pack this reply replaced. An empty mapping was not confirmed."""

    product_id: int
    facts: Mapping[str, object]


@dataclass(frozen=True)
class PreviousPublications:
    """The publication ids this reply replaced. An empty tuple was none."""

    product_id: int
    publication_ids: tuple[str, ...]


@dataclass(frozen=True)
class PreviousGpsr:
    """The Shop GPSR identity this reply replaced. None was no identity."""

    identity: Mapping[str, object] | None


@dataclass(frozen=True)
class ListingReply:
    text: str
    shown: Shown | None = None
    credits_spent: int = 0
    shown_after: tuple[Shown, ...] | None = None
    continue_turn: bool = False
    before: PreviousInventory | PreviousSelling | PreviousPublications | PreviousGpsr | None = None


def proposal_text(proposal: Proposal) -> str:
    """The same fields, in the same order, as the product page."""
    blocks: list[str] = []
    title = proposal.title.strip()
    if title:
        blocks.append(f"Title\n{title}")
    description = proposal.description.strip()
    if description:
        blocks.append(f"Description\n{description}")
    tags = ", ".join(tag.strip() for tag in proposal.tags if tag.strip())
    if tags:
        blocks.append(f"SEO Keywords\n{tags}")
    seo_title = proposal.seo_title.strip()
    if seo_title:
        blocks.append(f"Page title\n{seo_title}")
    seo_description = proposal.seo_description.strip()
    if seo_description:
        blocks.append(f"Meta description\n{seo_description}")
    pairs = [
        f"{question.strip()}\n{answer.strip()}"
        for question, answer in proposal.aeo_faqs
        if question.strip() or answer.strip()
    ]
    if pairs:
        blocks.append("AEO FAQ Pairs\n" + "\n\n".join(pairs))
    return "\n\n".join(blocks)


def _photos(product_id: int, photo_ids: Sequence[int]) -> set[int]:
    return {*photo_ids, product_id}


def shown_for(
    shown: Sequence[Shown], product_id: int, photo_ids: Sequence[int] = ()
) -> Shown | None:
    """The proposal already in the thread for this product, including its other photos."""
    photos = _photos(product_id, photo_ids)
    found: Shown | None = None
    for item in shown:
        if item.product_id in photos:
            found = item
    return found


def _page_for(
    proposal: Proposal | None,
    open_product_id: int | None,
    product_id: int,
    photo_ids: Sequence[int],
) -> Proposal | None:
    if proposal is None or open_product_id is None or not proposal_text(proposal):
        return None
    if open_product_id not in _photos(product_id, photo_ids):
        return None
    return proposal


async def listing_act(
    *,
    act: str | None,
    listing: ListingCopy | None,
    product_id: int | None,
    name_it: str,
    shown: Sequence[Shown],
    page_proposal: Proposal | None,
    open_product_id: int | None,
    photo_ids: Sequence[int] = (),
) -> ListingReply | None:
    """Run generate or Accept. None means this act is not one of those jobs."""
    if listing is None or act not in (GENERATE, ACCEPT):
        return None
    if product_id is None:
        return ListingReply(name_it)
    if act == GENERATE:
        result = await listing.generate(product_id)
        if isinstance(result, str):
            return ListingReply(result)
        return ListingReply(proposal_text(result), Shown(product_id, result))
    current = shown_for(shown, product_id, photo_ids)
    if current is None:
        page = _page_for(page_proposal, open_product_id, product_id, photo_ids)
        if page is None or open_product_id is None:
            return ListingReply(WRITE_FIRST)
        return ListingReply(proposal_text(page), Shown(open_product_id, page))
    kept = await listing.accept(
        current.product_id,
        current.proposal,
        kind=current.kind,
        trace_id=current.trace_id,
        pack_id=current.pack_id or "",
    )
    if kept.refused:
        return ListingReply(kept.refused)
    return ListingReply(ACCEPTED, credits_spent=kept.credits_spent)


def pack_thread(thread: Sequence[tuple[str, str]], shown: Sequence[Shown]) -> list | dict:
    messages = [{"role": role, "text": text} for role, text in thread]
    if not shown:
        return messages
    return {"messages": messages, "shown": [_shown_dict(item) for item in shown]}


def unpack_thread(raw: object) -> tuple[tuple[tuple[str, str], ...], tuple[Shown, ...]]:
    if isinstance(raw, dict):
        return _turns(raw.get("messages")), _shown_from(raw.get("shown"))
    return _turns(raw), ()


def _turns(raw: object) -> tuple[tuple[str, str], ...]:
    if not isinstance(raw, list):
        return ()
    turns: list[tuple[str, str]] = []
    for item in raw:
        role = item.get("role") if isinstance(item, dict) else None
        text = item.get("text") if isinstance(item, dict) else None
        if isinstance(role, str) and isinstance(text, str):
            turns.append((role, text))
    return tuple(turns)


def _shown_dict(item: Shown) -> dict:
    return {
        "productId": item.product_id,
        "title": item.proposal.title,
        "description": item.proposal.description,
        "tags": list(item.proposal.tags),
        "seoTitle": item.proposal.seo_title,
        "seoDescription": item.proposal.seo_description,
        "aeoFaqs": [{"q": question, "a": answer} for question, answer in item.proposal.aeo_faqs],
        "kind": item.kind,
        "traceId": item.trace_id,
        "packId": item.pack_id,
    }


def _shown_from(raw: object) -> tuple[Shown, ...]:
    if not isinstance(raw, list):
        return ()
    shown: list[Shown] = []
    for item in raw:
        if not isinstance(item, dict) or not isinstance(item.get("productId"), int):
            continue
        tags = item.get("tags")
        faqs = item.get("aeoFaqs")
        kind = item.get("kind") if isinstance(item.get("kind"), str) else "generate"
        trace_id = item.get("traceId") if isinstance(item.get("traceId"), str) else None
        pack_id = item.get("packId") if isinstance(item.get("packId"), str) else None
        shown.append(
            Shown(
                product_id=item["productId"],
                proposal=Proposal(
                    title=item.get("title") if isinstance(item.get("title"), str) else "",
                    description=item.get("description")
                    if isinstance(item.get("description"), str)
                    else "",
                    tags=tuple(tag for tag in tags if isinstance(tag, str))
                    if isinstance(tags, list)
                    else (),
                    seo_title=item.get("seoTitle") if isinstance(item.get("seoTitle"), str) else "",
                    seo_description=item.get("seoDescription")
                    if isinstance(item.get("seoDescription"), str)
                    else "",
                    aeo_faqs=_faqs(faqs),
                ),
                kind=kind,
                trace_id=trace_id,
                pack_id=pack_id,
            )
        )
    return tuple(shown)


def copy_for_refresh(proposal: Proposal) -> dict:
    """The body the product page posts when it Accepts a refresh or Bulk SEO proposal."""
    return {
        "tags": [tag.strip() for tag in proposal.tags if tag.strip()],
        "description": proposal.description.strip(),
        "seoTitle": proposal.seo_title.strip(),
        "seoDescription": proposal.seo_description.strip(),
    }


def copy_for_accept(proposal: Proposal) -> dict:
    """The body the product page posts when it Accepts generated listing copy."""
    body: dict = {}
    if proposal.title.strip():
        body["title"] = proposal.title.strip()
    if proposal.description.strip():
        body["description"] = proposal.description.strip()
    tags = [tag.strip() for tag in proposal.tags if tag.strip()]
    if tags:
        body["tags"] = tags
    if proposal.seo_title.strip():
        body["seoTitle"] = proposal.seo_title.strip()
    if proposal.seo_description.strip():
        body["seoDescription"] = proposal.seo_description.strip()
    faqs = [
        {"question": question.strip(), "answer": answer.strip()}
        for question, answer in proposal.aeo_faqs
        if question.strip() or answer.strip()
    ]
    if faqs:
        body["aeoFaqs"] = faqs
    return body


def _faqs(raw: object) -> tuple[tuple[str, str], ...]:
    if not isinstance(raw, list):
        return ()
    pairs: list[tuple[str, str]] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        question = item.get("q") if isinstance(item.get("q"), str) else ""
        answer = item.get("a") if isinstance(item.get("a"), str) else ""
        pairs.append((question, answer))
    return tuple(pairs)
