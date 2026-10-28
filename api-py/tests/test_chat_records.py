"""Stock, Selling, publications, Shop GPSR, and delete. Seam: `ask`."""

from app.services.chat import MemoryThreadStore, ModelStep, NamedProduct, ask, step_from_payload

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


class Writes:
    def __init__(self) -> None:
        self.adjusted: list[tuple[int, int, str]] = []
        self.sold: list[tuple[int, dict]] = []
        self.published: list[tuple[int, tuple[str, ...]]] = []
        self.gpsr: list[dict] = []
        self.deleted: list[int] = []
        self.adjust_refusal: str | None = None

    async def adjust_stock(self, product_id: int, quantity: int, reason: str) -> str | None:
        if self.adjust_refusal:
            return self.adjust_refusal
        self.adjusted.append((product_id, quantity, reason))
        return None

    async def selling(self, product_id: int, fields: dict) -> str | None:
        self.sold.append((product_id, fields))
        return None

    async def publications(self, product_id: int, names: tuple[str, ...]) -> str | None:
        self.published.append((product_id, names))
        return None

    async def shop_gpsr(self, identity: dict) -> str | None:
        self.gpsr.append(identity)
        return None

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


async def test_a_missing_quantity_or_a_short_reason_asks_and_writes_nothing() -> None:
    writes = Writes()
    steps = [
        ModelStep(act="adjust_stock", product="Blue linen shirt", reason="Stock count"),
        ModelStep(act="adjust_stock", product="Blue linen shirt", quantity=4, reason="no"),
        ModelStep(act="adjust_stock", product="Blue linen shirt", quantity=-1, reason="Stock count"),
        ModelStep(act="adjust_stock", quantity=4, reason="Stock count"),
    ]

    async def model(ctx) -> ModelStep:
        return steps[ctx.calls_made]

    for expected in (WHICH_QUANTITY, WHICH_REASON, WHICH_QUANTITY, NAME_IT):
        writes.adjusted.clear()
        result = await _ask(model, writes, store=MemoryThreadStore())
        assert writes.adjusted == []
        assert result.credits_spent == 0
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

    assert writes.sold == [
        (SHIRT.id, {"price": "19", "compare_at_price": "24", "sku": "LINEN-1"})
    ]
    assert result.credits_spent == 0
    assert result.thread[-1] == ("chat", SELLING)


async def test_selling_with_no_field_asks_and_writes_nothing() -> None:
    writes = Writes()

    async def model(_ctx) -> ModelStep:
        return ModelStep(act="selling", product="Blue linen shirt", selling={})

    result = await _ask(model, writes)

    assert writes.sold == []
    assert result.thread[-1] == ("chat", WHICH_SELLING)


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


async def test_publications_with_no_set_ask_and_write_nothing() -> None:
    writes = Writes()

    async def model(_ctx) -> ModelStep:
        return ModelStep(act="publications", product="Wool dress")

    result = await _ask(model, writes)

    assert writes.published == []
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
