"""Which product a Chat turn means. Seam: `ask`. The model names one; Chat resolves it."""

import json

import httpx

from app.services.chat import (
    MemoryThreadStore,
    ModelContext,
    ModelStep,
    NamedProduct,
    ask,
    model_from,
    products_from_images,
)

SHIRT = NamedProduct(
    id=7,
    title="Blue linen shirt",
    photo_ids=(7, 8),
    photo_names=((7, "Blue linen shirt"), (8, "tee-back.jpg")),
)
BACK = NamedProduct(
    id=8,
    title="tee-back.jpg",
    photo_ids=(7, 8),
    photo_names=((7, "Blue linen shirt"), (8, "tee-back.jpg")),
)
DRESS = NamedProduct(id=9, title="Wool dress", photo_ids=(9,))
LONGER = NamedProduct(id=11, title="Blue linen shirt dress", photo_ids=(11,))
SAME = NamedProduct(id=12, title="Blue linen shirt", photo_ids=(12,))


async def test_this_is_the_product_page_that_was_open() -> None:
    seen: list[ModelContext] = []

    async def model(ctx: ModelContext) -> ModelStep:
        seen.append(ctx)
        return ModelStep(text="That is the back.", product="this")

    result = await ask(
        MemoryThreadStore(),
        user_id="user_seller",
        shop_domain="tees.myshopify.com",
        message="What about this?",
        model=model,
        products=(SHIRT, DRESS),
        open_product_id=8,
    )

    assert result.product == BACK
    assert result.credits_spent == 0
    assert result.shop_changed is False
    assert seen[0].open_product == BACK
    assert [text for _, text in result.thread] == ["What about this?", "That is the back."]


async def test_a_product_named_clearly_is_that_product() -> None:
    async def model(_ctx: ModelContext) -> ModelStep:
        return ModelStep(text="The blue linen shirt.", product="Blue linen shirt")

    result = await ask(
        MemoryThreadStore(),
        user_id="user_seller",
        shop_domain="tees.myshopify.com",
        message="The blue linen shirt.",
        model=model,
        products=(SHIRT, LONGER, DRESS),
        open_product_id=9,
    )

    assert result.product == SHIRT
    assert result.shop_changed is False
    assert result.credits_spent == 0


async def test_a_photo_name_is_still_that_product() -> None:
    seen: list[ModelContext] = []

    async def model(ctx: ModelContext) -> ModelStep:
        seen.append(ctx)
        if ctx.product is None:
            return ModelStep(product="tee-back.jpg", done=False)
        return ModelStep(text="Blue linen shirt.")

    result = await ask(
        MemoryThreadStore(),
        user_id="user_seller",
        shop_domain="tees.myshopify.com",
        message="The back photo.",
        model=model,
        products=(SHIRT, DRESS),
    )

    assert result.product == SHIRT
    assert seen[1].product == SHIRT
    assert [text for _, text in result.thread] == ["The back photo.", "Blue linen shirt."]


async def test_a_partial_name_asks_and_runs_nothing() -> None:
    async def model(_ctx: ModelContext) -> ModelStep:
        return ModelStep(text="I'll take the dress.", product="Blue linen shirt")

    result = await ask(
        MemoryThreadStore(),
        user_id="user_seller",
        shop_domain="tees.myshopify.com",
        message="The blue linen shirt.",
        model=model,
        products=(LONGER,),
    )

    assert result.product is None
    assert result.shop_changed is False
    assert result.credits_spent == 0
    assert [text for _, text in result.thread] == [
        "The blue linen shirt.",
        "Which product? I don't see that one.",
    ]


async def test_two_matches_ask_and_run_nothing() -> None:
    calls = 0

    async def model(ctx: ModelContext) -> ModelStep:
        nonlocal calls
        calls += 1
        if ctx.calls_made == 0:
            return ModelStep(
                text="Updating both, product 999.",
                product="Blue linen shirt",
                act="refresh",
                done=False,
            )
        return ModelStep(text="ELEVENTH")

    result = await ask(
        MemoryThreadStore(),
        user_id="user_seller",
        shop_domain="tees.myshopify.com",
        message="The blue linen shirt.",
        model=model,
        products=(SHIRT, SAME),
    )

    assert calls == 1
    assert result.product is None
    assert result.credits_spent == 0
    assert result.shop_changed is False
    assert [text for _, text in result.thread] == [
        "The blue linen shirt.",
        "Which product? Two are called Blue linen shirt.",
    ]


async def test_no_match_asks_and_does_not_invent_a_product() -> None:
    async def model(_ctx: ModelContext) -> ModelStep:
        return ModelStep(text="The silk scarf, product 999.", product="999")

    result = await ask(
        MemoryThreadStore(),
        user_id="user_seller",
        shop_domain="tees.myshopify.com",
        message="The silk scarf.",
        model=model,
        products=(SHIRT,),
    )

    assert result.product is None
    assert result.shop_changed is False
    assert result.credits_spent == 0
    assert [text for _, text in result.thread] == [
        "The silk scarf.",
        "Which product? I don't see that one.",
    ]


async def test_this_off_the_product_page_asks_and_runs_nothing() -> None:
    seen: list[ModelContext] = []

    async def model(ctx: ModelContext) -> ModelStep:
        seen.append(ctx)
        return ModelStep(text="Sure, product 999.", product="this", done=False)

    result = await ask(
        MemoryThreadStore(),
        user_id="user_seller",
        shop_domain="tees.myshopify.com",
        message="Refresh this.",
        model=model,
        products=(SHIRT,),
        open_product_id=999,
    )

    assert seen[0].open_product is None
    assert result.product is None
    assert result.shop_changed is False
    assert [text for _, text in result.thread] == [
        "Refresh this.",
        "Which product? Open its page, or name it.",
    ]


async def test_the_model_is_told_the_open_page_and_not_an_id_it_sends() -> None:
    seen: list[dict] = []

    def handler(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        seen.append(body)
        if body["product"] is None:
            return httpx.Response(200, json={"product": "this", "productId": 999, "done": False})
        return httpx.Response(200, json={"text": "tee-back.jpg.", "done": True})

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    result = await ask(
        MemoryThreadStore(),
        user_id="user_seller",
        shop_domain="tees.myshopify.com",
        message="What about this?",
        model=model_from("http://model.test/turn", client=client),
        products=(SHIRT,),
        open_product_id=8,
    )
    await client.aclose()

    assert result.product == BACK
    assert result.shop_changed is False
    assert seen[0]["openProduct"] == {"id": 8, "title": "tee-back.jpg"}
    assert seen[0]["product"] is None
    assert seen[1]["product"] == {"id": 8, "title": "tee-back.jpg"}
    assert "999" not in json.dumps(seen)


class Photo:
    def __init__(
        self,
        id: int,
        title: str | None,
        original_name: str,
        description: str | None,
        product_group_id: str | None,
    ) -> None:
        self.id = id
        self.title = title
        self.original_name = original_name
        self.description = description
        self.product_group_id = product_group_id


def test_the_list_name_is_the_primary_photo_and_a_later_photo_keeps_its_name() -> None:
    products = products_from_images(
        [
            Photo(8, None, "tee-back.jpg", "<p>Old.</p>", "tee"),
            Photo(7, "Blue linen shirt", "front.jpg", None, "tee"),
            Photo(9, "Wool dress", "dress.jpg", None, None),
        ]
    )

    assert products == (
        NamedProduct(
            id=8,
            title="tee-back.jpg",
            photo_ids=(7, 8),
            photo_names=((7, "Blue linen shirt"), (8, "tee-back.jpg")),
        ),
        NamedProduct(
            id=9,
            title="Wool dress",
            photo_ids=(9,),
            photo_names=((9, "Wool dress"),),
        ),
    )
