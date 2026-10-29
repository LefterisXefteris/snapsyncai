"""Generate, then Accept. Seam: `ask`. The page's generate and Accept are the jobs."""

from app.services.chat import MemoryThreadStore, ModelStep, ask
from app.services.chat_listing import Kept, Proposal, Shown, pack_thread, unpack_thread
from app.services.listing_copy_generate import proposal_from_completion
from tests.test_chat_product import SHIRT

LINEN = Proposal(
    title="Blue linen shirt",
    description="A breezy linen shirt for warm days.",
    tags=("linen", "shirt"),
    seo_title="Blue linen shirt",
    seo_description="A breezy linen shirt.",
    aeo_faqs=(("Is it linen?", "Yes."),),
)

SHOWN = """\
Title
Blue linen shirt

Description
A breezy linen shirt for warm days.

SEO Keywords
linen, shirt

Page title
Blue linen shirt

Meta description
A breezy linen shirt.

AEO FAQ Pairs
Is it linen?
Yes."""


class Listing:
    def __init__(self, proposal: Proposal | str = LINEN) -> None:
        self.proposal = proposal
        self.generated: list[int] = []
        self.kept: list[tuple[int, Proposal]] = []
        self.refusal: str | None = None
        self.credits = 1

    async def generate(self, product_id: int) -> Proposal | str:
        self.generated.append(product_id)
        return self.proposal

    async def accept(self, product_id: int, proposal: Proposal, **_extra: object) -> Kept:
        if self.refusal:
            return Kept(credits_spent=0, refused=self.refusal)
        self.kept.append((product_id, proposal))
        return Kept(credits_spent=self.credits)


async def test_write_the_listing_shows_the_proposal_fields_the_page_shows() -> None:
    listing = Listing()

    async def model(_ctx) -> ModelStep:
        return ModelStep(
            text="Writing the listing.",
            act="generate",
            product="Blue linen shirt",
            done=False,
        )

    result = await ask(
        MemoryThreadStore(),
        user_id="user_seller",
        shop_domain="tees.myshopify.com",
        message="Write the listing.",
        model=model,
        products=(SHIRT,),
        listing=listing,
    )

    assert listing.generated == [SHIRT.id]
    assert listing.kept == []
    assert result.credits_spent == 0
    assert result.shop_changed is False
    assert [text for _, text in result.thread] == ["Write the listing.", SHOWN]


async def test_accept_in_that_same_message_does_not_run() -> None:
    listing = Listing()
    calls: list[int] = []

    async def model(ctx) -> ModelStep:
        calls.append(ctx.calls_made)
        if ctx.calls_made == 0:
            return ModelStep(act="generate", product="Blue linen shirt", done=False)
        if ctx.calls_made == 1:
            return ModelStep(act="accept", done=False)
        return ModelStep(act="push")

    result = await ask(
        MemoryThreadStore(),
        user_id="user_seller",
        shop_domain="tees.myshopify.com",
        message="Write the listing, accept it, and put it live.",
        model=model,
        products=(SHIRT,),
        listing=listing,
    )

    assert calls == [0]
    assert listing.kept == []
    assert result.credits_spent == 0
    assert result.shop_changed is False
    assert result.thread[-1] == ("chat", SHOWN)


async def test_a_later_message_accepts_spends_one_credit_and_does_not_push() -> None:
    store = MemoryThreadStore()
    listing = Listing()
    calls: list[int] = []

    async def generate(_ctx) -> ModelStep:
        return ModelStep(act="generate", product="Blue linen shirt")

    async def accept(ctx) -> ModelStep:
        calls.append(ctx.calls_made)
        if ctx.calls_made == 0:
            return ModelStep(act="accept", product="Blue linen shirt", done=False)
        return ModelStep(act="push", product="Blue linen shirt")

    await ask(
        store,
        user_id="user_seller",
        shop_domain="tees.myshopify.com",
        message="Write the listing.",
        model=generate,
        products=(SHIRT,),
        listing=listing,
    )
    result = await ask(
        store,
        user_id="user_seller",
        shop_domain="tees.myshopify.com",
        message="Accept it.",
        model=accept,
        products=(SHIRT,),
        listing=listing,
    )

    assert listing.kept == [(SHIRT.id, LINEN)]
    assert result.credits_spent == 1
    assert result.shop_changed is False
    assert calls == [0]
    assert result.undos == ()
    assert result.thread[-1] == ("chat", "Accepted.")


async def test_an_empty_credit_balance_refuses_accept() -> None:
    store = MemoryThreadStore()
    listing = Listing()
    listing.refusal = "Buy Credits to Accept after your three free ones."

    async def generate(_ctx) -> ModelStep:
        return ModelStep(act="generate", product="Blue linen shirt")

    async def accept(_ctx) -> ModelStep:
        return ModelStep(act="accept", product="Blue linen shirt", done=False)

    await ask(
        store,
        user_id="user_seller",
        shop_domain="tees.myshopify.com",
        message="Write the listing.",
        model=generate,
        products=(SHIRT,),
        listing=listing,
    )
    result = await ask(
        store,
        user_id="user_seller",
        shop_domain="tees.myshopify.com",
        message="Accept it.",
        model=accept,
        products=(SHIRT,),
        listing=listing,
    )

    assert listing.kept == []
    assert result.credits_spent == 0
    assert result.shop_changed is False
    assert result.thread[-1] == ("chat", "Buy Credits to Accept after your three free ones.")


async def test_a_page_proposal_is_shown_before_accept() -> None:
    store = MemoryThreadStore()
    listing = Listing()
    calls: list[int] = []

    async def first(ctx) -> ModelStep:
        calls.append(ctx.calls_made)
        if ctx.calls_made == 0:
            return ModelStep(act="accept", product="this", done=False)
        return ModelStep(act="push")

    async def second(_ctx) -> ModelStep:
        return ModelStep(act="accept", product="this")

    shown = await ask(
        store,
        user_id="user_seller",
        shop_domain="tees.myshopify.com",
        message="Accept it.",
        model=first,
        products=(SHIRT,),
        open_product_id=8,
        listing=listing,
        page_proposal=LINEN,
    )
    accepted = await ask(
        store,
        user_id="user_seller",
        shop_domain="tees.myshopify.com",
        message="Accept it.",
        model=second,
        products=(SHIRT,),
        open_product_id=8,
        listing=listing,
    )

    assert calls == [0]
    assert listing.generated == []
    assert listing.kept == [(8, LINEN)]
    assert shown.credits_spent == 0
    assert shown.thread[-1] == ("chat", SHOWN)
    assert accepted.credits_spent == 1
    assert accepted.shop_changed is False


async def test_naming_the_product_still_shows_the_open_page_proposal() -> None:
    store = MemoryThreadStore()
    listing = Listing()

    async def accept(_ctx) -> ModelStep:
        return ModelStep(act="accept", product="Blue linen shirt")

    shown = await ask(
        store,
        user_id="user_seller",
        shop_domain="tees.myshopify.com",
        message="Accept the blue linen shirt.",
        model=accept,
        products=(SHIRT,),
        open_product_id=8,
        listing=listing,
        page_proposal=LINEN,
    )
    accepted = await ask(
        store,
        user_id="user_seller",
        shop_domain="tees.myshopify.com",
        message="Accept it.",
        model=accept,
        products=(SHIRT,),
        open_product_id=8,
        listing=listing,
    )

    assert shown.credits_spent == 0
    assert shown.thread[-1] == ("chat", SHOWN)
    assert listing.kept == [(8, LINEN)]
    assert accepted.credits_spent == 1
    assert accepted.shop_changed is False


def test_a_shown_proposal_is_still_there_after_the_thread_is_stored() -> None:
    stored = pack_thread(
        (("seller", "Write the listing."), ("chat", SHOWN)),
        (Shown(SHIRT.id, LINEN),),
    )

    turns, shown = unpack_thread(stored)

    assert turns == (("seller", "Write the listing."), ("chat", SHOWN))
    assert shown == (Shown(SHIRT.id, LINEN),)
    assert unpack_thread([{"role": "seller", "text": "What's on hand?"}]) == (
        (("seller", "What's on hand?"),),
        (),
    )


def test_the_generate_job_reads_the_fields_the_page_shows() -> None:
    raw = """```json
{
  "title": "Blue linen shirt",
  "description": "A breezy linen shirt for warm days.",
  "seoKeywords": ["linen", "shirt"],
  "seoTitle": "Blue linen shirt",
  "seoDescription": "A breezy linen shirt.",
  "aeoFaqs": [{"q": "Is it linen?", "a": "Yes."}]
}
```"""

    assert proposal_from_completion(raw) == LINEN
