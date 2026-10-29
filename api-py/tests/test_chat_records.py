"""Stock, Selling, publications, Shop GPSR, and delete. Seam: `ask`."""

from app.services.chat import (
    MemoryThreadStore,
    ModelStep,
    NamedProduct,
    Undo,
    ask,
    step_from_payload,
)
from app.services.chat_listing import PreviousGpsr, PreviousInventory

SHIRT = NamedProduct(id=7, title="Blue linen shirt", photo_ids=(7,))
DRESS = NamedProduct(id=9, title="Wool dress", photo_ids=(9,))

NAME_IT = "Which product? Open its page, or name it."
WHICH_QUANTITY = "What quantity?"
WHICH_REASON = "What reason?"
WHICH_SELLING = "Which selling field — price, compare-at price, cost, SKU, or barcode?"
WHICH_PUBLICATIONS = "Which publications?"
GPSR_INCOMPLETE = "GPSR identity is incomplete."
STOCK = "Stock adjusted."
SELLING = "That's the selling."
PUBLICATIONS = "Those publications are set."
GPSR_SAVED = "Shop GPSR identity saved."
DELETED = "Deleted."

MAKER = {
    "manufacturer": {
        "name": "Mill House",
        "postalAddress": "1 Loom Street",
        "email": "mill@example.com",
    },
    "manufacturerInEu": True,
}
EARLIER = {
    "manufacturer": {
        "name": "Old Mill",
        "postalAddress": "2 Loom Street",
        "email": "old@example.com",
    },
    "manufacturerInEu": True,
}


class Writes:
    def __init__(self) -> None:
        self.adjusted: list[tuple[int, int, str]] = []
        self.sold: list[tuple[int, dict]] = []
        self.published: list[tuple[int, tuple[str, ...]]] = []
        self.gpsr: list[dict] = []
        self.deleted: list[int] = []
        self.adjust_refusal: str | None = None
        self.selling_refusal: str | None = None
        self.publication_refusal: str | None = None
        self.publication_before: dict[int, tuple[str, ...]] | None = None
        self.publication_queue: list[tuple[str, ...]] = []
        self.gpsr_refusal: str | None = None
        self.gpsr_before: dict | None = None
        self.gpsr_before_known = False
        self.previous: PreviousInventory | None = None
        self.previous_queue: list[PreviousInventory] = []

    async def adjust_stock(
        self, product_id: int, quantity: int, reason: str
    ) -> str | PreviousInventory | None:
        if self.adjust_refusal:
            return self.adjust_refusal
        self.adjusted.append((product_id, quantity, reason))
        if self.previous_queue:
            return self.previous_queue.pop(0)
        return self.previous

    async def selling(self, product_id: int, fields: dict) -> str | dict | None:
        if self.selling_refusal:
            return self.selling_refusal
        self.sold.append((product_id, fields))
        before = getattr(self, "before", {}).get(product_id)
        if before is None:
            return None
        return {name: before.get(name, "") for name in fields}

    async def publications(
        self, product_id: int, names: tuple[str, ...]
    ) -> str | tuple[str, ...] | None:
        if self.publication_refusal:
            return self.publication_refusal
        self.published.append((product_id, names))
        if self.publication_queue:
            return self.publication_queue.pop(0)
        if self.publication_before is None or product_id not in self.publication_before:
            return None
        return self.publication_before[product_id]

    async def shop_gpsr(self, identity: dict) -> str | PreviousGpsr | None:
        if self.gpsr_refusal:
            return self.gpsr_refusal
        self.gpsr.append(identity)
        if not self.gpsr_before_known:
            return None
        return PreviousGpsr(self.gpsr_before)

    async def delete(self, product_id: int) -> str | None:
        self.deleted.append(product_id)
        return None


def _ask(model, writes: Writes, **extra):
    return ask(
        extra.pop("store", MemoryThreadStore()),
        user_id="user_seller",
        shop_domain="tees.myshopify.com",
        message=extra.pop("message", "Set the stock."),
        model=model,
        products=extra.pop("products", (SHIRT, DRESS)),
        records=writes,
        **extra,
    )


async def test_stock_adjustment_uses_the_quantity_and_reason_and_spends_nothing() -> None:
    writes = Writes()

    async def model(_ctx) -> ModelStep:
        return ModelStep(
            act="adjust_stock",
            product="Blue linen shirt",
            quantity=4,
            reason="Stock count",
        )

    result = await _ask(model, writes)

    assert writes.adjusted == [(SHIRT.id, 4, "Stock count")]
    assert result.credits_spent == 0
    assert result.shop_changed is False
    assert result.thread[-1] == ("chat", STOCK)


async def test_a_landed_stock_adjustment_returns_the_previous_quantity_outside_the_thread() -> None:
    writes = Writes()
    writes.previous = PreviousInventory(item_id=3, quantity=12)
    store = MemoryThreadStore()

    async def model(_ctx) -> ModelStep:
        return ModelStep(
            act="adjust_stock",
            product="Blue linen shirt",
            quantity=4,
            reason="Stock count",
        )

    result = await _ask(model, writes, store=store)

    assert writes.adjusted == [(SHIRT.id, 4, "Stock count")]
    assert result.undos == (Undo(1, "inventory", item_id=3, quantity=12),)
    assert result.thread[-1] == ("chat", STOCK)
    assert all("12" not in text for _, text in result.thread)
    stored = await store.load("user_seller", "tees.myshopify.com")
    assert stored == result.thread


async def test_two_inventory_adjustments_in_one_message_each_keep_their_previous_quantity() -> None:
    writes = Writes()
    writes.previous_queue = [
        PreviousInventory(item_id=3, quantity=12),
        PreviousInventory(item_id=3, quantity=4),
    ]

    async def model(ctx) -> ModelStep:
        if ctx.calls_made == 0:
            return ModelStep(
                act="adjust_stock",
                product="Blue linen shirt",
                quantity=4,
                reason="Stock count",
                done=False,
            )
        return ModelStep(
            act="adjust_stock",
            product="Blue linen shirt",
            quantity=9,
            reason="Recount",
        )

    result = await _ask(model, writes)

    assert writes.adjusted == [
        (SHIRT.id, 4, "Stock count"),
        (SHIRT.id, 9, "Recount"),
    ]
    assert result.undos == (
        Undo(1, "inventory", item_id=3, quantity=12),
        Undo(2, "inventory", item_id=3, quantity=4),
    )
    assert all("12" not in text and "4" not in text for _, text in result.thread)


async def test_a_missing_quantity_or_a_short_reason_asks_and_writes_nothing() -> None:
    writes = Writes()
    steps = [
        ModelStep(act="adjust_stock", product="Blue linen shirt", reason="Stock count"),
        ModelStep(act="adjust_stock", product="Blue linen shirt", quantity=4, reason="no"),
        ModelStep(
            act="adjust_stock", product="Blue linen shirt", quantity=-1, reason="Stock count"
        ),
        ModelStep(act="adjust_stock", quantity=4, reason="Stock count"),
    ]

    async def model(ctx) -> ModelStep:
        return steps[ctx.calls_made]

    for expected in (WHICH_QUANTITY, WHICH_REASON, WHICH_QUANTITY, NAME_IT):
        writes.adjusted.clear()
        result = await _ask(model, writes, store=MemoryThreadStore())
        assert writes.adjusted == []
        assert result.credits_spent == 0
        assert result.undos == ()
        assert result.thread[-1] == ("chat", expected)
        steps.pop(0)


async def test_zero_quantity_is_a_quantity() -> None:
    writes = Writes()

    async def model(_ctx) -> ModelStep:
        return ModelStep(
            act="adjust_stock",
            product="this",
            quantity=0,
            reason="yes",
        )

    result = await _ask(model, writes, open_product_id=7)

    assert writes.adjusted == [(SHIRT.id, 0, "yes")]
    assert result.thread[-1] == ("chat", STOCK)


async def test_a_refused_adjustment_stops_the_later_act() -> None:
    writes = Writes()
    writes.adjust_refusal = "Inventory has no stock row for that SKU."
    calls: list[int] = []

    async def model(ctx) -> ModelStep:
        calls.append(ctx.calls_made)
        if ctx.calls_made == 0:
            return ModelStep(
                act="adjust_stock",
                product="Blue linen shirt",
                quantity=4,
                reason="Stock count",
                done=False,
            )
        return ModelStep(act="delete", product="Wool dress")

    result = await _ask(model, writes)

    assert calls == [0]
    assert writes.adjusted == []
    assert writes.deleted == []
    assert result.undos == ()
    assert result.thread[-1] == ("chat", "Inventory has no stock row for that SKU.")


async def test_selling_saves_only_the_fields_the_message_names() -> None:
    writes = Writes()

    async def model(_ctx) -> ModelStep:
        return ModelStep(
            act="selling",
            product="Blue linen shirt",
            selling={"price": "19", "compareAtPrice": "24", "sku": "LINEN-1"},
        )

    result = await _ask(model, writes)

    assert writes.sold == [(SHIRT.id, {"price": "19", "compare_at_price": "24", "sku": "LINEN-1"})]
    assert result.credits_spent == 0
    assert result.thread[-1] == ("chat", SELLING)


async def test_setting_the_price_hands_the_previous_price_to_the_browser_and_not_the_thread() -> (
    None
):
    writes = Writes()
    writes.before = {SHIRT.id: {"price": "12.50"}}
    store = MemoryThreadStore()

    async def model(_ctx) -> ModelStep:
        return ModelStep(act="selling", product="Blue linen shirt", selling={"price": "19"})

    result = await _ask(model, writes, store=store, message="Set the price to 19")

    assert writes.sold == [(SHIRT.id, {"price": "19"})]
    assert result.credits_spent == 0
    assert result.thread[-1] == ("chat", SELLING)
    assert result.undos == (Undo(1, "selling", product_id=SHIRT.id, fields={"price": "12.50"}),)
    stored = await store.load("user_seller", "tees.myshopify.com")
    assert stored == result.thread
    assert "12.50" not in " ".join(text for _, text in stored)


async def test_an_empty_price_is_the_previous_selling() -> None:
    writes = Writes()
    writes.before = {SHIRT.id: {"price": ""}}

    async def model(_ctx) -> ModelStep:
        return ModelStep(act="selling", product="Blue linen shirt", selling={"price": "19"})

    result = await _ask(model, writes, message="Set the price to 19")

    assert result.undos == (Undo(1, "selling", product_id=SHIRT.id, fields={"price": ""}),)


async def test_one_reply_hands_back_every_selling_field_it_changed() -> None:
    writes = Writes()
    writes.before = {SHIRT.id: {"price": "12.50", "sku": ""}}

    async def model(_ctx) -> ModelStep:
        return ModelStep(
            act="selling",
            product="Blue linen shirt",
            selling={"price": "19", "sku": "LINEN-1"},
        )

    result = await _ask(model, writes, message="Price 19, SKU LINEN-1")

    assert writes.sold == [(SHIRT.id, {"price": "19", "sku": "LINEN-1"})]
    assert result.undos == (
        Undo(1, "selling", product_id=SHIRT.id, fields={"price": "12.50", "sku": ""}),
    )
    assert "12.50" not in " ".join(text for _, text in result.thread)


async def test_a_second_selling_reply_keeps_its_own_previous_fields() -> None:
    writes = Writes()
    writes.before = {SHIRT.id: {"price": "12.50"}, DRESS.id: {"sku": "WOOL"}}

    async def model(ctx) -> ModelStep:
        if ctx.calls_made == 0:
            return ModelStep(
                act="selling",
                product="Blue linen shirt",
                selling={"price": "19"},
                done=False,
            )
        return ModelStep(act="selling", product="Wool dress", selling={"sku": "WOOL-1"})

    result = await _ask(model, writes, message="Price 19 on the shirt, then the dress SKU")

    assert result.undos == (
        Undo(1, "selling", product_id=SHIRT.id, fields={"price": "12.50"}),
        Undo(2, "selling", product_id=DRESS.id, fields={"sku": "WOOL"}),
    )


async def test_selling_with_no_field_asks_and_writes_nothing() -> None:
    writes = Writes()

    async def model(_ctx) -> ModelStep:
        return ModelStep(act="selling", product="Blue linen shirt", selling={})

    result = await _ask(model, writes)

    assert writes.sold == []
    assert result.undos == ()
    assert result.thread[-1] == ("chat", WHICH_SELLING)


async def test_selling_on_the_open_product_undoes_when_the_reply_does_not_name_it() -> None:
    writes = Writes()
    writes.before = {SHIRT.id: {"price": "12.50"}}

    async def model(_ctx) -> ModelStep:
        return ModelStep(act="selling", selling={"price": "19"})

    result = await _ask(model, writes, open_product_id=7, message="Set the price to 19")

    assert writes.sold == [(SHIRT.id, {"price": "19"})]
    assert result.undos == (Undo(1, "selling", product_id=SHIRT.id, fields={"price": "12.50"}),)
    assert result.thread[-1] == ("chat", SELLING)


async def test_a_selling_message_with_no_product_asks_and_writes_nothing() -> None:
    writes = Writes()
    writes.before = {SHIRT.id: {"price": "12.50"}}

    async def model(_ctx) -> ModelStep:
        return ModelStep(act="selling", selling={"price": "19"})

    result = await _ask(model, writes, message="19")

    assert writes.sold == []
    assert result.undos == ()
    assert result.thread[-1] == ("chat", NAME_IT)


async def test_a_refused_selling_write_has_no_undo() -> None:
    writes = Writes()
    writes.selling_refusal = "Invalid update data"
    writes.before = {SHIRT.id: {"price": "12.50"}}

    async def model(_ctx) -> ModelStep:
        return ModelStep(act="selling", product="Blue linen shirt", selling={"price": "19"})

    result = await _ask(model, writes)

    assert writes.sold == []
    assert result.undos == ()
    assert result.thread[-1] == ("chat", "Invalid update data")


async def test_publications_are_the_set_the_message_names() -> None:
    writes = Writes()

    async def model(_ctx) -> ModelStep:
        return ModelStep(
            act="publications",
            product="Blue linen shirt",
            publications=("Online Store", "Shop"),
        )

    result = await _ask(model, writes)

    assert writes.published == [(SHIRT.id, ("Online Store", "Shop"))]
    assert result.credits_spent == 0
    assert result.thread[-1] == ("chat", PUBLICATIONS)


async def test_a_landed_publications_change_returns_the_previous_set_outside_the_thread() -> None:
    writes = Writes()
    writes.publication_before = {SHIRT.id: ("gid://shopify/Publication/1",)}
    store = MemoryThreadStore()

    async def model(_ctx) -> ModelStep:
        return ModelStep(
            act="publications",
            product="Blue linen shirt",
            publications=("Online Store", "Shop"),
        )

    result = await _ask(model, writes, store=store)

    assert writes.published == [(SHIRT.id, ("Online Store", "Shop"))]
    assert result.credits_spent == 0
    assert result.undos == (
        Undo(
            1,
            "publications",
            product_id=SHIRT.id,
            publication_ids=("gid://shopify/Publication/1",),
        ),
    )
    assert result.thread[-1] == ("chat", PUBLICATIONS)
    assert all("Publication/1" not in text for _, text in result.thread)
    stored = await store.load("user_seller", "tees.myshopify.com")
    assert stored == result.thread


async def test_an_empty_publication_set_is_the_previous_set() -> None:
    writes = Writes()
    writes.publication_before = {SHIRT.id: ()}

    async def model(_ctx) -> ModelStep:
        return ModelStep(
            act="publications",
            product="Blue linen shirt",
            publications=("Online Store",),
        )

    result = await _ask(model, writes)

    assert result.undos == (Undo(1, "publications", product_id=SHIRT.id, publication_ids=()),)
    assert result.credits_spent == 0


async def test_two_publication_replies_each_keep_their_previous_set() -> None:
    writes = Writes()
    writes.publication_queue = [
        ("gid://shopify/Publication/1",),
        ("gid://shopify/Publication/3",),
    ]

    async def model(ctx) -> ModelStep:
        if ctx.calls_made == 0:
            return ModelStep(
                act="publications",
                product="Blue linen shirt",
                publications=("Shop",),
                done=False,
            )
        return ModelStep(
            act="publications",
            product="Wool dress",
            publications=("Online Store",),
        )

    result = await _ask(model, writes)

    assert result.undos == (
        Undo(
            1,
            "publications",
            product_id=SHIRT.id,
            publication_ids=("gid://shopify/Publication/1",),
        ),
        Undo(
            2,
            "publications",
            product_id=DRESS.id,
            publication_ids=("gid://shopify/Publication/3",),
        ),
    )
    assert result.credits_spent == 0


async def test_a_missing_set_or_an_unknown_publication_writes_nothing_and_has_no_undo() -> None:
    missing = Writes()

    async def no_set(_ctx) -> ModelStep:
        return ModelStep(act="publications", product="Wool dress")

    unknown = Writes()
    unknown.publication_refusal = "Which publication? I don't see Shop."
    unknown.publication_before = {SHIRT.id: ("gid://shopify/Publication/1",)}

    async def not_on_the_shop(_ctx) -> ModelStep:
        return ModelStep(
            act="publications",
            product="Blue linen shirt",
            publications=("Shop",),
        )

    asked = await _ask(no_set, missing)
    refused = await _ask(not_on_the_shop, unknown)

    assert missing.published == []
    assert asked.undos == ()
    assert asked.thread[-1] == ("chat", WHICH_PUBLICATIONS)
    assert unknown.published == []
    assert refused.undos == ()
    assert refused.thread[-1] == ("chat", "Which publication? I don't see Shop.")


async def test_a_landed_shop_gpsr_save_returns_the_previous_identity_outside_the_thread() -> None:
    writes = Writes()
    writes.gpsr_before_known = True
    writes.gpsr_before = EARLIER
    store = MemoryThreadStore()

    async def model(_ctx) -> ModelStep:
        return ModelStep(act="shop_gpsr", gpsr=MAKER)

    result = await _ask(model, writes, store=store)

    assert writes.gpsr == [MAKER]
    assert result.credits_spent == 0
    assert result.undos == (Undo(1, "gpsr", identity=EARLIER),)
    assert result.thread[-1] == ("chat", GPSR_SAVED)
    assert all("Old Mill" not in text for _, text in result.thread)
    stored = await store.load("user_seller", "tees.myshopify.com")
    assert stored == result.thread


async def test_an_empty_shop_gpsr_identity_is_the_previous_identity() -> None:
    writes = Writes()
    writes.gpsr_before_known = True

    async def model(_ctx) -> ModelStep:
        return ModelStep(act="shop_gpsr", gpsr=MAKER)

    result = await _ask(model, writes)

    assert result.undos == (Undo(1, "gpsr", identity=None),)
    assert result.credits_spent == 0


async def test_a_publications_reply_and_a_shop_gpsr_reply_each_keep_their_previous_value() -> None:
    writes = Writes()
    writes.publication_before = {SHIRT.id: ("gid://shopify/Publication/1",)}
    writes.gpsr_before_known = True
    writes.gpsr_before = EARLIER

    async def model(ctx) -> ModelStep:
        if ctx.calls_made == 0:
            return ModelStep(
                act="publications",
                product="Blue linen shirt",
                publications=("Shop",),
                done=False,
            )
        return ModelStep(act="shop_gpsr", gpsr=MAKER)

    result = await _ask(model, writes)

    assert result.undos == (
        Undo(
            1,
            "publications",
            product_id=SHIRT.id,
            publication_ids=("gid://shopify/Publication/1",),
        ),
        Undo(2, "gpsr", identity=EARLIER),
    )
    assert result.credits_spent == 0
    assert all("Old Mill" not in text and "Publication/1" not in text for _, text in result.thread)


async def test_an_incomplete_shop_gpsr_identity_writes_nothing_and_has_no_undo() -> None:
    missing = Writes()
    incomplete = Writes()
    incomplete.gpsr_refusal = GPSR_INCOMPLETE
    incomplete.gpsr_before_known = True
    incomplete.gpsr_before = EARLIER

    async def no_identity(_ctx) -> ModelStep:
        return ModelStep(act="shop_gpsr")

    async def half(_ctx) -> ModelStep:
        return ModelStep(act="shop_gpsr", gpsr={"manufacturer": {"name": "Mill House"}})

    asked = await _ask(no_identity, missing)
    refused = await _ask(half, incomplete)

    assert missing.gpsr == []
    assert asked.undos == ()
    assert asked.thread[-1] == ("chat", GPSR_INCOMPLETE)
    assert incomplete.gpsr == []
    assert refused.undos == ()
    assert refused.thread[-1] == ("chat", GPSR_INCOMPLETE)


async def test_publications_with_no_set_ask_and_write_nothing() -> None:
    writes = Writes()

    async def model(_ctx) -> ModelStep:
        return ModelStep(act="publications", product="Wool dress")

    result = await _ask(model, writes)

    assert writes.published == []
    assert result.undos == ()
    assert result.thread[-1] == ("chat", WHICH_PUBLICATIONS)


async def test_shop_gpsr_saves_the_named_identity_without_a_product() -> None:
    writes = Writes()

    async def model(_ctx) -> ModelStep:
        return ModelStep(act="shop_gpsr", gpsr=MAKER)

    result = await _ask(model, writes)

    assert writes.gpsr == [MAKER]
    assert writes.deleted == []
    assert result.credits_spent == 0
    assert result.thread[-1] == ("chat", GPSR_SAVED)


async def test_shop_gpsr_without_an_identity_asks_and_writes_nothing() -> None:
    writes = Writes()

    async def model(_ctx) -> ModelStep:
        return ModelStep(act="shop_gpsr")

    result = await _ask(model, writes)

    assert writes.gpsr == []
    assert result.undos == ()
    assert result.thread[-1] == ("chat", GPSR_INCOMPLETE)


async def test_delete_removes_only_the_named_product() -> None:
    writes = Writes()

    async def model(ctx) -> ModelStep:
        if ctx.calls_made == 0:
            return ModelStep(
                act="adjust_stock",
                product="Blue linen shirt",
                quantity=4,
                reason="Stock count",
                done=False,
            )
        return ModelStep(act="delete", product="Wool dress")

    result = await _ask(model, writes)

    assert writes.adjusted == [(SHIRT.id, 4, "Stock count")]
    assert writes.deleted == [DRESS.id]
    assert result.credits_spent == 0
    assert result.undos == ()
    assert result.thread[-1] == ("chat", DELETED)


def test_the_model_payload_keeps_stock_selling_publications_and_shop_gpsr() -> None:
    step = step_from_payload(
        {
            "act": "adjust_stock",
            "product": "Blue linen shirt",
            "quantity": 4,
            "reason": "Stock count",
            "selling": {"price": "19", "compareAtPrice": "24"},
            "publications": ["Online Store"],
            "gpsr": MAKER,
        }
    )

    assert step.act == "adjust_stock"
    assert step.product == "Blue linen shirt"
    assert step.quantity == 4
    assert step.reason == "Stock count"
    assert step.selling == {"price": "19", "compareAtPrice": "24"}
    assert step.publications == ("Online Store",)
    assert step.gpsr == MAKER


async def test_a_later_act_does_not_reuse_the_product_named_earlier() -> None:
    writes = Writes()

    async def model(ctx) -> ModelStep:
        if ctx.calls_made == 0:
            return ModelStep(
                act="adjust_stock",
                product="Blue linen shirt",
                quantity=4,
                reason="Stock count",
                done=False,
            )
        return ModelStep(act="delete")

    result = await _ask(model, writes)

    assert writes.adjusted == [(SHIRT.id, 4, "Stock count")]
    assert writes.deleted == []
    assert result.thread[-1] == ("chat", NAME_IT)


async def test_a_reason_longer_than_the_page_allows_asks_and_writes_nothing() -> None:
    writes = Writes()

    async def model(_ctx) -> ModelStep:
        return ModelStep(
            act="adjust_stock",
            product="Blue linen shirt",
            quantity=4,
            reason="x" * 251,
        )

    result = await _ask(model, writes)

    assert writes.adjusted == []
    assert result.thread[-1] == ("chat", WHICH_REASON)


async def test_delete_without_a_product_asks_and_deletes_nothing() -> None:
    writes = Writes()

    async def model(_ctx) -> ModelStep:
        return ModelStep(act="delete")

    result = await _ask(model, writes)

    assert writes.deleted == []
    assert result.thread[-1] == ("chat", NAME_IT)
