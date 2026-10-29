"""Push, Go live, and Trendyol International. Seam: `ask`. The page's sends stay the sends."""

import json
from decimal import Decimal

import httpx

from app.services.chat import MemoryThreadStore, ModelStep, ask, model_from
from app.services.chat_channel import Sent
from tests.test_chat_product import DRESS, SHIRT

PRICE = "This product needs a price greater than zero."


class Channels:
    def __init__(self, refusal: str | None = None, stock_not_set: bool = False) -> None:
        self.lived: list[int] = []
        self.shopify: list[int] = []
        self.trendyol: list[int] = []
        self.refusal = refusal
        self.stock_not_set = stock_not_set

    async def go_live(self, product_id: int) -> Sent:
        self.lived.append(product_id)
        return Sent(refused=self.refusal, stock_not_set=self.stock_not_set)

    async def push_shopify(self, product_id: int) -> Sent:
        self.shopify.append(product_id)
        return Sent(refused=self.refusal)

    async def push_trendyol(self, product_id: int) -> Sent:
        self.trendyol.append(product_id)
        return Sent(refused=self.refusal)


def _ask(model, channels: Channels, **extra):
    return ask(
        MemoryThreadStore(),
        user_id="user_seller",
        shop_domain="tees.myshopify.com",
        message=extra.pop("message", "Put it live."),
        model=model,
        products=extra.pop("products", (SHIRT, DRESS)),
        channels=channels,
        **extra,
    )


async def test_put_it_live_is_go_live() -> None:
    channels = Channels()

    async def model(_ctx) -> ModelStep:
        return ModelStep(act="go_live", product="Blue linen shirt")

    result = await _ask(model, channels)

    assert channels.lived == [SHIRT.id]
    assert channels.shopify == []
    assert channels.trendyol == []
    assert result.credits_spent == 0
    assert result.shop_changed is False
    assert result.undos == ()
    assert result.thread[-1] == ("chat", "It's on the Online Store.")


async def test_go_live_says_when_available_stock_was_not_set() -> None:
    channels = Channels(stock_not_set=True)

    async def model(_ctx) -> ModelStep:
        return ModelStep(act="go_live", product="Blue linen shirt")

    result = await _ask(model, channels)

    assert channels.lived == [SHIRT.id]
    assert result.thread[-1] == (
        "chat",
        "It's on the Online Store. Available stock was not set.",
    )


async def test_a_push_with_no_channel_asks_and_sends_nothing() -> None:
    channels = Channels()
    calls: list[int] = []

    async def model(ctx) -> ModelStep:
        calls.append(ctx.calls_made)
        if ctx.calls_made == 0:
            return ModelStep(act="push", product="Blue linen shirt", done=False)
        return ModelStep(act="go_live", product="Blue linen shirt")

    result = await _ask(model, channels, message="Push it.")

    assert calls == [0]
    assert channels.lived == []
    assert channels.shopify == []
    assert channels.trendyol == []
    assert result.shop_changed is False
    assert result.thread[-1] == (
        "chat",
        "Which Channel — Shopify or Trendyol International?",
    )


async def test_a_named_shopify_push_is_not_go_live() -> None:
    channels = Channels()

    async def model(_ctx) -> ModelStep:
        return ModelStep(act="push", channel="Shopify", product="Blue linen shirt")

    result = await _ask(model, channels, message="Push it to Shopify.")

    assert channels.shopify == [SHIRT.id]
    assert channels.lived == []
    assert channels.trendyol == []
    assert result.undos == ()
    assert result.thread[-1] == ("chat", "Pushed to Shopify.")


async def test_a_refused_product_keeps_the_page_reason_and_stops() -> None:
    channels = Channels(refusal=PRICE)
    calls: list[int] = []

    async def model(ctx) -> ModelStep:
        calls.append(ctx.calls_made)
        if ctx.calls_made == 0:
            return ModelStep(act="go_live", product="Blue linen shirt", done=False)
        return ModelStep(act="push", channel="Trendyol International", product="Wool dress")

    result = await _ask(
        model, channels, message="Put the shirt live, then the dress on Trendyol International."
    )

    assert calls == [0]
    assert channels.lived == [SHIRT.id]
    assert channels.trendyol == []
    assert result.thread[-1] == ("chat", PRICE)


async def test_a_trendyol_push_is_that_push_not_go_live() -> None:
    channels = Channels()

    def handler(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        assert "accessToken" not in body
        assert "cookie" not in body
        return httpx.Response(
            200,
            json={
                "act": "push",
                "channel": "Trendyol International",
                "product": "Wool dress",
                "done": True,
            },
        )

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    result = await _ask(
        model_from("http://model.test/turn", client=client),
        channels,
        message="Push the wool dress to Trendyol International.",
    )
    await client.aclose()

    assert channels.trendyol == [DRESS.id]
    assert channels.lived == []
    assert channels.shopify == []
    assert result.credits_spent == 0
    assert result.thread[-1] == ("chat", "Pushed to Trendyol International.")


async def test_several_sends_run_in_order_until_the_turn_ends() -> None:
    channels = Channels()

    async def model(ctx) -> ModelStep:
        if ctx.calls_made == 0:
            return ModelStep(act="go_live", product="Blue linen shirt", done=False)
        return ModelStep(act="push", channel="Trendyol International", product="Wool dress")

    result = await _ask(model, channels, message="Put the shirt live and push the dress.")

    assert channels.lived == [SHIRT.id]
    assert channels.trendyol == [DRESS.id]
    assert channels.shopify == []
    assert [text for role, text in result.thread if role == "chat"] == [
        "It's on the Online Store.",
        "Pushed to Trendyol International.",
    ]


async def test_put_it_live_lands_active_on_the_online_store(db, db_settings) -> None:
    from app.routers.chat import _Channels
    from app.services.chat import products_from_images
    from app.services.images import list_images
    from tests.seed import SELLER, product, shop
    from tests.shopify_shop import ONLINE_STORE, WAREHOUSE, ShopifyShop

    await shop(db, granted_scopes=["read_publications", "write_publications"])
    await product(db, title="Blue linen shirt", price=Decimal("24.00"), inventory_quantity=4)
    store = ShopifyShop(locations={WAREHOUSE: "Warehouse"})

    async def model(_ctx) -> ModelStep:
        return ModelStep(act="go_live", product="Blue linen shirt")

    result = await ask(
        MemoryThreadStore(),
        user_id=SELLER,
        shop_domain="tees.myshopify.com",
        message="Put it live.",
        model=model,
        products=products_from_images(await list_images(db, SELLER)),
        channels=_Channels(db, db_settings, SELLER, lambda _connection: store, None),
    )

    sent = store.only_product()
    assert sent.status == "ACTIVE"
    assert sent.publications == {ONLINE_STORE}
    assert store.stock(sent) == {WAREHOUSE: 4}
    assert result.thread[-1] == ("chat", "It's on the Online Store.")


async def test_trendyol_alone_asks_and_sends_nothing() -> None:
    channels = Channels()

    async def model(_ctx) -> ModelStep:
        return ModelStep(act="push", channel="Trendyol", product="Blue linen shirt", done=False)

    result = await _ask(model, channels, message="Push it.")

    assert channels.trendyol == []
    assert channels.shopify == []
    assert channels.lived == []
    assert result.thread[-1] == (
        "chat",
        "Which Channel — Shopify or Trendyol International?",
    )


async def test_put_it_live_without_listing_copy_uses_the_page_reason(db, db_settings) -> None:
    from app.routers.chat import _Channels
    from app.services.chat import products_from_images
    from app.services.images import list_images
    from tests.seed import SELLER, product, shop
    from tests.shopify_shop import ShopifyShop

    await shop(db, granted_scopes=["read_publications", "write_publications"])
    await product(db, listed=False, price=Decimal("24.00"))
    store = ShopifyShop(locations={})

    async def model(_ctx) -> ModelStep:
        return ModelStep(act="go_live", product="tee.jpg")

    result = await ask(
        MemoryThreadStore(),
        user_id=SELLER,
        shop_domain="tees.myshopify.com",
        message="Put it live.",
        model=model,
        products=products_from_images(await list_images(db, SELLER)),
        channels=_Channels(db, db_settings, SELLER, lambda _connection: store, None),
    )

    assert store.products == {}
    assert result.thread[-1] == ("chat", "This product needs listing copy.")


async def test_put_it_live_without_a_price_uses_the_page_reason(db, db_settings) -> None:
    from app.routers.chat import _Channels
    from app.services.chat import products_from_images
    from app.services.images import list_images
    from tests.seed import SELLER, product, shop
    from tests.shopify_shop import ShopifyShop

    await shop(db, granted_scopes=["read_publications", "write_publications"])
    await product(db, title="Blue linen shirt", price=None)
    store = ShopifyShop()

    async def model(_ctx) -> ModelStep:
        return ModelStep(act="go_live", product="Blue linen shirt", done=False)

    result = await ask(
        MemoryThreadStore(),
        user_id=SELLER,
        shop_domain="tees.myshopify.com",
        message="Put it live.",
        model=model,
        products=products_from_images(await list_images(db, SELLER)),
        channels=_Channels(db, db_settings, SELLER, lambda _connection: store, None),
    )

    assert store.products == {}
    assert result.thread[-1] == ("chat", "This product needs a price greater than zero.")


async def test_a_shopify_push_sends_the_stored_draft(db, db_settings) -> None:
    from app.routers.chat import _Channels
    from app.services.chat import products_from_images
    from app.services.images import list_images
    from tests.seed import SELLER, product, shop
    from tests.shopify_shop import ShopifyShop

    await shop(db, granted_scopes=["read_publications", "write_publications"])
    await product(db, title="Blue linen shirt", price=None, shopify_product_status="DRAFT")
    store = ShopifyShop()

    async def model(_ctx) -> ModelStep:
        return ModelStep(act="push", channel="Shopify", product="Blue linen shirt")

    result = await ask(
        MemoryThreadStore(),
        user_id=SELLER,
        shop_domain="tees.myshopify.com",
        message="Push it to Shopify.",
        model=model,
        products=products_from_images(await list_images(db, SELLER)),
        channels=_Channels(db, db_settings, SELLER, lambda _connection: store, None),
    )

    assert store.only_product().status == "DRAFT"
    assert store.only_product().publications == set()
    assert result.thread[-1] == ("chat", "Pushed to Shopify.")
