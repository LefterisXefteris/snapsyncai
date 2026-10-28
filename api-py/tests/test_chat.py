"""Chat module — a question in, the thread out. The shop stays as it was.

Seam: `ask`. The model is a dependency. Jobs are not called from this slice.
"""

import asyncio

from app.services.chat import Asked, MemoryThreadStore, ModelContext, ModelStep, ask


async def test_a_question_is_answered_and_the_shop_stays_unchanged() -> None:
    store = MemoryThreadStore()
    seen: list[ModelContext] = []

    async def model(ctx: ModelContext) -> ModelStep:
        seen.append(ctx)
        return ModelStep(text="Four are on hand.")

    result = await ask(
        store,
        user_id="user_seller",
        shop_domain="tees.myshopify.com",
        message="What's on hand?",
        model=model,
    )

    assert result == Asked(
        thread=(
            ("seller", "What's on hand?"),
            ("chat", "Four are on hand."),
        ),
        credits_spent=0,
        shop_changed=False,
    )
    assert seen[0].message == "What's on hand?"
    assert seen[0].shop_domain == "tees.myshopify.com"
    assert [text for _, text in await store.load("user_seller", "tees.myshopify.com")] == [
        "What's on hand?",
        "Four are on hand.",
    ]


async def test_a_second_message_waits_until_the_turn_ends() -> None:
    store = MemoryThreadStore()
    first_in = asyncio.Event()
    release = asyncio.Event()
    order: list[str] = []

    async def model(ctx: ModelContext) -> ModelStep:
        order.append(ctx.message)
        if ctx.message == "First?":
            first_in.set()
            await release.wait()
        return ModelStep(text=f"Answer: {ctx.message}")

    first = asyncio.create_task(
        ask(
            store,
            user_id="user_seller",
            shop_domain="tees.myshopify.com",
            message="First?",
            model=model,
        )
    )
    await first_in.wait()
    second = asyncio.create_task(
        ask(
            store,
            user_id="user_seller",
            shop_domain="tees.myshopify.com",
            message="Second?",
            model=model,
        )
    )
    await asyncio.sleep(0.05)
    assert order == ["First?"]
    release.set()
    await first
    await second
    assert order == ["First?", "Second?"]
    assert [text for _, text in await store.load("user_seller", "tees.myshopify.com")] == [
        "First?",
        "Answer: First?",
        "Second?",
        "Answer: Second?",
    ]


async def test_the_eleventh_model_call_does_not_run() -> None:
    store = MemoryThreadStore()
    seen: list[int] = []

    async def model(ctx: ModelContext) -> ModelStep:
        seen.append(ctx.calls_made)
        if ctx.calls_made >= 10:
            return ModelStep(text="ELEVENTH")
        return ModelStep(text=f"step {ctx.calls_made + 1}", done=False)

    result = await ask(
        store,
        user_id="user_seller",
        shop_domain="tees.myshopify.com",
        message="Count these.",
        model=model,
    )

    texts = [text for _, text in result.thread]
    assert seen == list(range(10))
    assert "ELEVENTH" not in texts
    assert "step 1" in texts
    assert "step 10" in texts
    assert "Stopped after 10 steps." in texts
    assert result.credits_spent == 0
    assert result.shop_changed is False


async def test_browser_only_acts_do_nothing() -> None:
    stays = (
        ("buy_credits", "Buying Credits stays on the page."),
        ("connect_channel", "Connecting a Channel stays on the page."),
        ("disconnect_channel", "Disconnecting a Channel stays on the page."),
        ("claim_shop", "Claiming a shop stays on the page."),
        ("cancel_plan", "Cancelling a Plan stays on the page."),
        ("choose_photos", "Use Choose photos."),
    )
    store = MemoryThreadStore()

    async def model(ctx: ModelContext) -> ModelStep:
        act, _line = stays[ctx.calls_made]
        return ModelStep(text="I did it.", act=act, done=ctx.calls_made == len(stays) - 1)

    result = await ask(
        store,
        user_id="user_seller",
        shop_domain="tees.myshopify.com",
        message="Buy Credits, connect, and choose the photos.",
        model=model,
    )

    assert [text for role, text in result.thread if role == "chat"] == [line for _, line in stays]
    assert result.credits_spent == 0
    assert result.shop_changed is False


async def test_each_shop_keeps_its_own_thread(db) -> None:
    from app.services.chat import SqlThreadStore
    from app.services.connections import get_shopify
    from tests.seed import OTHER_SELLER, SELLER, shop

    await shop(db)
    connection = await get_shopify(db, SELLER)
    assert connection is not None
    connection.access_token = "shpat_live_secret"
    await db.flush()
    seen: list[ModelContext] = []

    async def model(ctx: ModelContext) -> ModelStep:
        seen.append(ctx)
        return ModelStep(text="Four are on hand.")

    store = SqlThreadStore(db)
    await ask(
        store,
        user_id=SELLER,
        shop_domain=connection.shop_domain,
        message="What's on hand?",
        model=model,
    )
    reloaded = await SqlThreadStore(db).load(SELLER, "tees.myshopify.com")
    assert [text for _, text in reloaded] == ["What's on hand?", "Four are on hand."]
    assert await store.load(OTHER_SELLER, "tees.myshopify.com") == ()

    await ask(
        store,
        user_id=SELLER,
        shop_domain="other.myshopify.com",
        message="Other shop?",
        model=model,
    )
    assert [text for _, text in await store.load(SELLER, "tees.myshopify.com")] == [
        "What's on hand?",
        "Four are on hand.",
    ]
    assert "shpat_live_secret" not in repr(seen)


async def test_a_missing_model_service_says_chat_is_unavailable() -> None:
    from app.services.chat import model_from

    model = model_from(None)
    step = await model(
        ModelContext(
            message="What's on hand?",
            thread=(),
            shop_domain=None,
            calls_made=0,
        )
    )
    assert step == ModelStep(text="Chat is not available right now.")


async def test_the_model_request_carries_the_message_not_a_secret() -> None:
    import json

    import httpx

    from app.services.chat import model_from

    seen: list[dict] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(json.loads(request.content))
        return httpx.Response(200, json={"text": "Four are on hand.", "done": True})

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    model = model_from("http://model.test/turn", client=client)
    step = await model(
        ModelContext(
            message="What's on hand?",
            thread=(("seller", "What's on hand?"),),
            shop_domain="tees.myshopify.com",
            calls_made=0,
        )
    )
    await client.aclose()
    assert step == ModelStep(text="Four are on hand.")
    assert seen == [
        {
            "message": "What's on hand?",
            "thread": [{"role": "seller", "text": "What's on hand?"}],
            "shopDomain": "tees.myshopify.com",
            "callsMade": 0,
            "openProduct": None,
            "product": None,
        }
    ]


async def test_the_model_call_sends_the_shared_token_and_not_in_the_body() -> None:
    import httpx

    from app.services.chat import model_from

    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(200, json={"text": "Four are on hand.", "done": True})

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    model = model_from("http://model.test/turn", token="model-secret", client=client)
    await model(
        ModelContext(
            message="What's on hand?",
            thread=(),
            shop_domain="tees.myshopify.com",
            calls_made=0,
        )
    )
    await client.aclose()
    assert seen[0].headers["Authorization"] == "Bearer model-secret"
    assert b"model-secret" not in seen[0].content


async def test_a_browser_act_without_reply_text_does_nothing() -> None:
    import httpx

    from app.services.chat import model_from

    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"act": "buy_credits", "done": True})

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    result = await ask(
        MemoryThreadStore(),
        user_id="user_seller",
        shop_domain="tees.myshopify.com",
        message="Buy Credits.",
        model=model_from("http://model.test/turn", client=client),
    )
    await client.aclose()
    assert [text for _, text in result.thread] == [
        "Buy Credits.",
        "Buying Credits stays on the page.",
    ]
    assert result.credits_spent == 0
    assert result.shop_changed is False


async def test_a_group_of_two_photos_is_stored_and_the_model_sees_no_ids() -> None:
    from app.services.chat import model_payload

    store = MemoryThreadStore()
    seen: list[ModelContext] = []

    async def model(ctx: ModelContext) -> ModelStep:
        seen.append(ctx)
        return ModelStep(act="group")

    result = await ask(
        store,
        user_id="user_seller",
        shop_domain="tees.myshopify.com",
        message="Group them.",
        model=model,
        draft_photo_ids=("draft-photo-1", "draft-photo-2"),
    )

    assert [text for role, text in result.thread if role == "chat"] == [
        "Those photos are one draft product."
    ]
    assert result.grouped_photo_ids == ("draft-photo-1", "draft-photo-2")
    assert result.credits_spent == 0
    assert result.shop_changed is False
    assert [text for _, text in await store.load("user_seller", "tees.myshopify.com")] == [
        "Group them.",
        "Those photos are one draft product.",
    ]
    assert model_payload(seen[0]) == {
        "message": "Group them.",
        "thread": [{"role": "seller", "text": "Group them."}],
        "shopDomain": "tees.myshopify.com",
        "callsMade": 0,
        "openProduct": None,
        "product": None,
    }


async def test_a_group_with_fewer_than_two_photos_asks_and_groups_nothing() -> None:
    store = MemoryThreadStore()

    async def model(_ctx: ModelContext) -> ModelStep:
        return ModelStep(act="group")

    result = await ask(
        store,
        user_id="user_seller",
        shop_domain="tees.myshopify.com",
        message="Group them.",
        model=model,
        draft_photo_ids=("draft-photo-1",),
    )

    assert [text for role, text in result.thread if role == "chat"] == [
        "Select at least two photos on New listing."
    ]
    assert result.grouped_photo_ids == ()
    assert result.credits_spent == 0
    assert result.shop_changed is False
