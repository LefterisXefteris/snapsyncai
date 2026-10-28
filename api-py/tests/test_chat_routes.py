"""Chat HTTP contract — auth, and the model never sees the token or the cookie.

Seam: `/api/chat`. Behaviour of a turn lives in `tests/test_chat.py`.
"""

import httpx
from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import create_app
from app.routers.chat import get_chat_model
from app.services.chat import ModelContext, ModelStep
from tests.seed import SELLER, shop

BASE_ENV = {
    "DATABASE_URL": "postgresql://u:p@localhost:5432/db",
    "CLERK_SECRET_KEY": "sk_test_fake",
}


def _client(monkeypatch) -> TestClient:
    for key, value in BASE_ENV.items():
        monkeypatch.setenv(key, value)
    monkeypatch.setenv("DEV_BYPASS_AUTH", "false")
    get_settings.cache_clear()
    return TestClient(create_app(), raise_server_exceptions=False)


def test_chat_requires_auth(monkeypatch) -> None:
    client = _client(monkeypatch)
    try:
        assert client.get("/api/chat").status_code == 401
        assert client.get("/api/chat").json() == {"detail": "Unauthenticated"}
        posted = client.post("/api/chat", json={"message": "What's on hand?"})
        assert posted.status_code == 401
        assert posted.json() == {"detail": "Unauthenticated"}
    finally:
        get_settings.cache_clear()


async def test_a_question_keeps_the_token_and_cookie_off_the_model(seller_app, db) -> None:
    from app.services.connections import get_shopify

    await shop(db)
    connection = await get_shopify(db, SELLER)
    assert connection is not None
    connection.access_token = "shpat_live_secret"
    await db.flush()
    seen: list[ModelContext] = []

    async def model(ctx: ModelContext) -> ModelStep:
        seen.append(ctx)
        return ModelStep(text="Four are on hand.")

    seller_app.dependency_overrides[get_chat_model] = lambda: model
    transport = httpx.ASGITransport(app=seller_app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        posted = await client.post(
            "/api/chat",
            json={"message": "What's on hand?"},
            headers={"Cookie": "__session=cookie-secret-value"},
        )
        fetched = await client.get("/api/chat")

    body = {
        "thread": [
            {"role": "seller", "text": "What's on hand?"},
            {"role": "chat", "text": "Four are on hand."},
        ]
    }
    assert posted.status_code == 200
    assert posted.json() == body
    assert fetched.json() == body
    assert seen[0].shop_domain == "tees.myshopify.com"
    assert "shpat_live_secret" not in repr(seen[0])
    assert "cookie-secret-value" not in repr(seen[0])
    assert "shpat_live_secret" not in posted.text
    assert "cookie-secret-value" not in posted.text


async def test_this_is_this_sellers_open_product(seller_app, db) -> None:
    from tests.seed import OTHER_SELLER, product

    await shop(db)
    front = await product(db, title="Blue linen shirt", product_group_id="tee")
    back = await product(db, title=None, listed=False, product_group_id="tee")
    other = await product(db, owner=OTHER_SELLER, title="Silk scarf")
    seen: list[ModelContext] = []

    async def model(ctx: ModelContext) -> ModelStep:
        seen.append(ctx)
        if ctx.open_product is None:
            return ModelStep(product="this")
        return ModelStep(text="Blue linen shirt.", product="this")

    seller_app.dependency_overrides[get_chat_model] = lambda: model
    transport = httpx.ASGITransport(app=seller_app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        posted = await client.post(
            "/api/chat",
            json={"message": "What about this?", "openProductId": back},
        )
        foreign = await client.post(
            "/api/chat",
            json={"message": "And this one?", "openProductId": other},
        )

    assert posted.status_code == 200
    assert posted.json()["thread"][-1] == {"role": "chat", "text": "Blue linen shirt."}
    assert seen[0].open_product is not None
    assert seen[0].open_product.id == back
    assert seen[0].open_product.title == "tee.jpg"
    assert seen[0].open_product.id != front
    assert foreign.json()["thread"][-1] == {
        "role": "chat",
        "text": "Which product? Open its page, or name it.",
    }
    assert seen[1].open_product is None
    assert "Silk scarf" not in foreign.text


async def test_a_message_confirms_facts_the_product_page_reads(seller_app, db) -> None:
    from app.routers.chat import get_chat_model
    from app.services.chat import ModelStep
    from tests.seed import product, shop, spends

    await shop(db)
    image_id = await product(db, title="Blue linen shirt")

    async def model(_ctx) -> ModelStep:
        return ModelStep(
            act="confirm_facts",
            product="Blue linen shirt",
            facts={
                "product_kind": "textile",
                "is_textile": True,
                "composition": [
                    {"name": "cotton", "percent": 80},
                    {"name": "polyester", "percent": 20},
                ],
                "gpsr_choice": "skip",
                "care_choice": "skip",
            },
        )

    seller_app.dependency_overrides[get_chat_model] = lambda: model
    transport = httpx.ASGITransport(app=seller_app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        posted = await client.post(
            "/api/chat",
            json={"message": "Cotton 80, polyester 20. Skip care and GPSR."},
        )
        catalogue = await client.get("/api/images")

    assert posted.status_code == 200
    assert posted.json()["thread"][-1] == {"role": "chat", "text": "Those facts are confirmed."}
    row = next(item for item in catalogue.json() if item["id"] == image_id)
    assert row["mayGenerateListingCopy"] is True
    assert row["productFacts"]["confirmed"]["composition"] == [
        {"name": "cotton", "percent": 80},
        {"name": "polyester", "percent": 20},
    ]
    assert row["productFacts"]["confirmed"]["gpsrChoice"] == "skip"
    assert row["productFacts"]["confirmed"]["careChoice"] == "skip"
    assert await spends(db) == []


async def test_quoted_words_are_on_the_product_the_page_reads(seller_app, db) -> None:
    from app.routers.chat import get_chat_model
    from app.services.chat import ModelStep
    from tests.seed import product, shop, spends

    await shop(db)
    image_id = await product(db, title="Blue linen shirt")

    async def model(_ctx) -> ModelStep:
        return ModelStep(
            act="type_listing_copy",
            product="Blue linen shirt",
            quote_field="description",
            quote_words="It is organic cotton.",
        )

    seller_app.dependency_overrides[get_chat_model] = lambda: model
    transport = httpx.ASGITransport(app=seller_app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        posted = await client.post(
            "/api/chat",
            json={"message": 'Make the description say "It is organic cotton."'},
        )
        catalogue = await client.get("/api/images")

    assert posted.json()["thread"][-1] == {"role": "chat", "text": "That's the description."}
    row = next(item for item in catalogue.json() if item["id"] == image_id)
    assert row["description"] == "It is organic cotton."
    assert await spends(db) == []


async def test_an_invalid_confirm_leaves_the_product_page_unchanged(seller_app, db) -> None:
    from app.routers.chat import get_chat_model
    from app.services.chat import ModelStep
    from tests.seed import product, shop

    await shop(db)
    image_id = await product(db, title="Blue linen shirt")

    async def model(_ctx) -> ModelStep:
        return ModelStep(
            act="confirm_facts",
            product="Blue linen shirt",
            facts={"product_kind": "textile", "is_textile": True, "gpsr_choice": "skip"},
        )

    seller_app.dependency_overrides[get_chat_model] = lambda: model
    transport = httpx.ASGITransport(app=seller_app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        posted = await client.post("/api/chat", json={"message": "Skip GPSR."})
        catalogue = await client.get("/api/images")

    assert posted.json()["thread"][-1]["text"] == (
        "Fibre composition is required to confirm a textile product."
    )
    row = next(item for item in catalogue.json() if item["id"] == image_id)
    assert row["productFacts"] is None
    assert row["mayGenerateListingCopy"] is False


async def test_write_the_listing_uses_the_page_gate(seller_app, db) -> None:
    from app.routers.chat import get_chat_model
    from app.services.chat import ModelStep
    from tests.seed import product, shop

    await shop(db)
    image_id = await product(db, title="Blue linen shirt")

    async def model(_ctx) -> ModelStep:
        return ModelStep(act="generate", product="Blue linen shirt", done=False)

    seller_app.dependency_overrides[get_chat_model] = lambda: model
    transport = httpx.ASGITransport(app=seller_app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        posted = await client.post("/api/chat", json={"message": "Write the listing."})
        catalogue = await client.get("/api/images")

    assert posted.status_code == 200
    assert posted.json()["thread"][-1] == {
        "role": "chat",
        "text": "Confirm product facts before generating listing copy.",
    }
    row = next(item for item in catalogue.json() if item["id"] == image_id)
    assert row["title"] == "Blue linen shirt"
    assert row["mayGenerateListingCopy"] is False


async def test_a_page_proposal_is_accepted_on_a_later_message(seller_app, db) -> None:
    from app.routers.chat import get_chat_model
    from app.services.chat import ModelStep
    from tests.seed import confirmed_facts, product, shop, spends
    from tests.test_chat_listing import SHOWN

    await shop(db)
    image_id = await product(db, title="Cotton tee", facts=confirmed_facts(textile=True))

    async def model(_ctx) -> ModelStep:
        return ModelStep(act="accept", product="this")

    seller_app.dependency_overrides[get_chat_model] = lambda: model
    page = {
        "title": "Blue linen shirt",
        "description": "A breezy linen shirt for warm days.",
        "tags": ["linen", "shirt"],
        "seoTitle": "Blue linen shirt",
        "seoDescription": "A breezy linen shirt.",
        "aeoFaqs": [{"q": "Is it linen?", "a": "Yes."}],
    }
    transport = httpx.ASGITransport(app=seller_app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        shown = await client.post(
            "/api/chat",
            json={"message": "Accept it.", "openProductId": image_id, "pageProposal": page},
        )
        before = await client.get("/api/images")
        accepted = await client.post(
            "/api/chat",
            json={"message": "Accept it.", "openProductId": image_id},
        )
        after = await client.get("/api/images")

    assert shown.json()["thread"][-1] == {"role": "chat", "text": SHOWN}
    before_row = next(item for item in before.json() if item["id"] == image_id)
    after_row = next(item for item in after.json() if item["id"] == image_id)
    assert before_row["title"] == "Cotton tee"
    assert accepted.json()["thread"][-1] == {"role": "chat", "text": "Accepted."}
    assert after_row["title"] == "Blue linen shirt"
    assert len(await spends(db)) == 1
