"""Refresh and Bulk SEO. Seam: `ask`. The page's jobs stay the jobs."""

from app.services.bulk_seo import TOO_MANY_ELIGIBLE
from app.services.chat import MemoryThreadStore, ModelStep, NamedProduct, ask
from app.services.chat_catalogue import Started
from app.services.chat_listing import Proposal, Shown

SHIRT = NamedProduct(id=7, title="Blue linen shirt", photo_ids=(7,))
DRESS = NamedProduct(id=9, title="Wool dress", photo_ids=(9,))
SKIRT = NamedProduct(id=11, title="Silk skirt", photo_ids=(11,))

LINEN = Proposal(
    title="",
    description="A linen shirt cut for warm days.",
    tags=("linen shirt",),
    seo_title="Linen shirt",
    seo_description="A linen shirt for warm days.",
    aeo_faqs=(),
)
WOOL = Proposal(
    title="",
    description="A wool dress for cold mornings.",
    tags=("wool dress",),
    seo_title="Wool dress",
    seo_description="A wool dress.",
    aeo_faqs=(),
)
SILK = Proposal(
    title="",
    description="A silk skirt.",
    tags=("silk skirt",),
    seo_title="Silk skirt",
    seo_description="A silk skirt.",
    aeo_faqs=(),
)

LINEN_TEXT = """\
Description
A linen shirt cut for warm days.

SEO Keywords
linen shirt

Page title
Linen shirt

Meta description
A linen shirt for warm days."""


class Jobs:
    def __init__(self) -> None:
        self.refreshed: list[int] = []
        self.bulk: list[tuple[int, ...]] = []
        self.kept: list[tuple[int, str]] = []
        self.accepted: list[Proposal] = []
        self.dismissed: list[tuple[int, str]] = []
        self.fields: list[tuple[int, str]] = []
        self.refresh_result: Proposal | str = LINEN
        self.bulk_result: tuple | str = ()
        self.refusal: str | None = None
        self.refuse_at: int | None = None
        self.field_result: str = "Crisp linen."

    async def refresh(self, product_id: int) -> Proposal | str:
        self.refreshed.append(product_id)
        return self.refresh_result

    async def bulk_seo(self, product_ids: tuple[int, ...] | list[int]):
        ids = tuple(product_ids)
        self.bulk.append(ids)
        if isinstance(self.bulk_result, str):
            return self.bulk_result
        return self.bulk_result

    async def accept(self, product_id: int, proposal: Proposal, **extra: object):
        from app.services.chat_listing import Kept

        kind = extra.get("kind")
        kind_name = kind if isinstance(kind, str) else "generate"
        if self.refusal and (self.refuse_at is None or len(self.kept) + 1 == self.refuse_at):
            return Kept(credits_spent=0, refused=self.refusal)
        self.kept.append((product_id, kind_name))
        self.accepted.append(proposal)
        return Kept(credits_spent=1)

    async def dismiss(
        self, product_id: int, *, kind: str, trace_id: str | None = None
    ) -> str | None:
        self.dismissed.append((product_id, kind))
        return None

    async def regenerate_field(self, product_id: int, field: str):
        self.fields.append((product_id, field))
        if isinstance(self.field_result, str) and self.field_result.startswith("Unknown"):
            return self.field_result
        from app.services.chat_catalogue import Rewritten

        return Rewritten(field=field, text=self.field_result)

    async def generate(self, product_id: int) -> Proposal | str:
        return LINEN


def _ask(model, jobs: Jobs, **extra):
    return ask(
        extra.pop("store", MemoryThreadStore()),
        user_id="user_seller",
        shop_domain="tees.myshopify.com",
        message=extra.pop("message", "Refresh the listing."),
        model=model,
        products=extra.pop("products", (SHIRT, DRESS, SKIRT)),
        listing=jobs,
        **extra,
    )


async def test_refresh_shows_the_fields_the_page_shows_and_does_not_accept() -> None:
    jobs = Jobs()
    calls: list[int] = []

    async def model(ctx) -> ModelStep:
        calls.append(ctx.calls_made)
        if ctx.calls_made == 0:
            return ModelStep(act="refresh", product="Blue linen shirt", done=False)
        return ModelStep(act="accept", product="Blue linen shirt")

    result = await _ask(model, jobs)

    assert calls == [0]
    assert jobs.refreshed == [SHIRT.id]
    assert jobs.kept == []
    assert result.credits_spent == 0
    assert result.shop_changed is False
    assert result.thread[-1] == ("chat", LINEN_TEXT)


def _pack(*items: Started) -> tuple[Started, ...]:
    return items


async def test_named_products_start_bulk_seo_and_the_thread_shows_each_proposal() -> None:
    jobs = Jobs()
    jobs.bulk_result = _pack(Started(SHIRT.id, LINEN), Started(DRESS.id, WOOL))

    async def model(_ctx) -> ModelStep:
        return ModelStep(act="bulk_seo", products=("Blue linen shirt", "Wool dress"))

    result = await _ask(model, jobs, bulk_ticks=(SKIRT.id,), message="Refresh these two.")

    assert jobs.bulk == [(SHIRT.id, DRESS.id)]
    assert jobs.kept == []
    assert result.credits_spent == 0
    assert result.shop_changed is False
    text = result.thread[-1][1]
    assert text.startswith("Blue linen shirt\n\nDescription\nA linen shirt cut for warm days.")
    assert "Wool dress\n\nDescription\nA wool dress for cold mornings." in text


async def test_a_name_that_is_not_one_product_starts_nothing() -> None:
    jobs = Jobs()

    async def model(_ctx) -> ModelStep:
        return ModelStep(act="bulk_seo", products=("Blue linen shirt", "No such shirt"))

    result = await _ask(model, jobs, message="Refresh both.")

    assert jobs.bulk == []
    assert result.credits_spent == 0
    assert result.thread[-1] == ("chat", "Which product? I don't see that one.")


async def test_ticked_eligible_rows_are_the_bulk_seo_set() -> None:
    jobs = Jobs()
    jobs.bulk_result = _pack(Started(SHIRT.id, LINEN), Started(DRESS.id, WOOL))

    async def model(_ctx) -> ModelStep:
        return ModelStep(act="bulk_seo", product="these")

    result = await _ask(model, jobs, bulk_ticks=(SHIRT.id, DRESS.id), message="Start Bulk SEO.")

    assert jobs.bulk == [(SHIRT.id, DRESS.id)]
    assert result.credits_spent == 0
    assert result.shop_changed is False
    assert "Blue linen shirt" in result.thread[-1][1]
    assert "Wool dress" in result.thread[-1][1]


async def test_a_products_selection_is_not_a_bulk_seo_pick_or_a_push() -> None:
    jobs = Jobs()
    calls: list[int] = []

    async def model(ctx) -> ModelStep:
        calls.append(ctx.calls_made)
        if ctx.calls_made == 0:
            return ModelStep(act="bulk_seo", product="these", done=False)
        return ModelStep(act="push")

    result = await _ask(model, jobs, bulk_ticks=(), message="Refresh these and push them.")

    assert calls == [0]
    assert jobs.bulk == []
    assert result.credits_spent == 0
    assert result.shop_changed is False
    assert result.thread[-1] == (
        "chat",
        "Which products? Name them, or tick the eligible ones on Bulk SEO.",
    )


async def test_accept_all_three_is_three_accepts_in_order() -> None:
    jobs = Jobs()
    store = MemoryThreadStore()
    await store.save(
        "user_seller",
        "tees.myshopify.com",
        (),
        (
            Shown(SHIRT.id, LINEN, kind="bulk_seo"),
            Shown(DRESS.id, WOOL, kind="bulk_seo"),
            Shown(SKIRT.id, SILK, kind="bulk_seo"),
        ),
    )
    calls: list[int] = []

    async def model(ctx) -> ModelStep:
        calls.append(ctx.calls_made)
        if ctx.calls_made == 0:
            return ModelStep(act="accept", product="all", done=False)
        return ModelStep(act="push")

    result = await _ask(model, jobs, store=store, message="Accept all three.")

    assert calls == [0]
    assert jobs.kept == [
        (SHIRT.id, "bulk_seo"),
        (DRESS.id, "bulk_seo"),
        (SKIRT.id, "bulk_seo"),
    ]
    assert result.credits_spent == 3
    assert result.shop_changed is False
    assert result.thread[-1] == (
        "chat",
        "Blue linen shirt — Accepted.\n\nWool dress — Accepted.\n\nSilk skirt — Accepted.",
    )


async def test_the_first_refusal_stops_the_rest() -> None:
    jobs = Jobs()
    jobs.refusal = "Buy Credits to Accept after your three free ones."
    jobs.refuse_at = 2
    store = MemoryThreadStore()
    await store.save(
        "user_seller",
        "tees.myshopify.com",
        (),
        (
            Shown(SHIRT.id, LINEN, kind="bulk_seo"),
            Shown(DRESS.id, WOOL, kind="bulk_seo"),
            Shown(SKIRT.id, SILK, kind="bulk_seo"),
        ),
    )

    async def model(_ctx) -> ModelStep:
        return ModelStep(act="accept", product="all", done=False)

    result = await _ask(model, jobs, store=store, message="Accept all three.")

    assert jobs.kept == [(SHIRT.id, "bulk_seo")]
    assert result.credits_spent == 1
    assert result.shop_changed is False
    assert result.thread[-1] == (
        "chat",
        "Blue linen shirt — Accepted.\n\nBuy Credits to Accept after your three free ones.",
    )


async def test_dismiss_is_the_page_dismiss_and_accept_does_not_keep_it() -> None:
    jobs = Jobs()
    store = MemoryThreadStore()
    await store.save(
        "user_seller",
        "tees.myshopify.com",
        (),
        (Shown(SHIRT.id, LINEN, kind="refresh"),),
    )

    async def dismiss(_ctx) -> ModelStep:
        return ModelStep(act="dismiss", product="Blue linen shirt")

    async def accept(_ctx) -> ModelStep:
        return ModelStep(act="accept", product="Blue linen shirt")

    dismissed = await _ask(dismiss, jobs, store=store, message="Dismiss it.")
    later = await _ask(accept, jobs, store=store, message="Accept it.")

    assert jobs.dismissed == [(SHIRT.id, "refresh")]
    assert dismissed.credits_spent == 0
    assert dismissed.shop_changed is False
    assert dismissed.thread[-1] == ("chat", "Dismissed.")
    assert jobs.kept == []
    assert later.thread[-1] == (
        "chat",
        "Write the listing first. The proposal has to be in the thread before Accept.",
    )


async def test_regenerate_a_field_shows_the_new_field_and_accept_keeps_it() -> None:
    jobs = Jobs()
    store = MemoryThreadStore()
    await store.save(
        "user_seller",
        "tees.myshopify.com",
        (),
        (Shown(SHIRT.id, LINEN),),
    )

    async def rewrite(_ctx) -> ModelStep:
        return ModelStep(act="regenerate_field", product="Blue linen shirt", field="description")

    async def accept(_ctx) -> ModelStep:
        return ModelStep(act="accept", product="Blue linen shirt")

    shown = await _ask(rewrite, jobs, store=store, message="Regenerate the description.")
    kept = await _ask(accept, jobs, store=store, message="Accept it.")

    assert jobs.fields == [(SHIRT.id, "description")]
    assert shown.credits_spent == 0
    assert shown.shop_changed is False
    assert shown.thread[-1] == ("chat", "Description\nCrisp linen.")
    assert kept.credits_spent == 1
    assert jobs.accepted[-1].description == "Crisp linen."


async def test_a_missing_field_is_asked_and_nothing_runs() -> None:
    jobs = Jobs()

    async def model(_ctx) -> ModelStep:
        return ModelStep(act="regenerate_field", product="Blue linen shirt", done=False)

    result = await _ask(model, jobs, message="Regenerate a field.")

    assert jobs.fields == []
    assert result.credits_spent == 0
    assert result.shop_changed is False
    assert result.thread[-1] == ("chat", "Which field?")


async def test_bulk_seo_start_above_25_products_refuses() -> None:
    jobs = Jobs()
    jobs.bulk_result = TOO_MANY_ELIGIBLE
    products = tuple(
        NamedProduct(id=i, title=f"Shirt {i}", photo_ids=(i,)) for i in range(1, 27)
    )

    async def model(_ctx) -> ModelStep:
        return ModelStep(act="bulk_seo", products=tuple(product.title for product in products))

    result = await _ask(
        model, jobs, products=products, message="Start Bulk SEO for all of them."
    )

    assert jobs.bulk == [tuple(range(1, 27))]
    assert jobs.kept == []
    assert result.credits_spent == 0
    assert result.shop_changed is False
    assert result.thread[-1] == ("chat", TOO_MANY_ELIGIBLE)
