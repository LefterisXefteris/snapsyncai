"""Confirm facts and typed listing copy. Seam: `ask`. The page's confirm is the writer."""

from app.services.chat import MemoryThreadStore, ModelStep, ask
from app.services.product_facts import ProductFacts, confirm_facts, stored_from_facts
from tests.test_chat_product import BACK, SHIRT

LINEN = {
    "product_kind": "textile",
    "is_textile": True,
    "composition": [
        {"name": "cotton", "percent": 80},
        {"name": "polyester", "percent": 20},
    ],
    "gpsr_choice": "skip",
    "care_choice": "skip",
}


class Catalogue:
    def __init__(self) -> None:
        self.facts: dict[int, dict] = {}
        self.copy: dict[int, dict] = {}

    async def confirm(self, product_id: int, facts: dict) -> str | None:
        result = confirm_facts(ProductFacts(), **facts)
        if not result.ok:
            return result.error
        self.facts[product_id] = stored_from_facts(result.facts)
        return None

    async def type_listing_copy(self, product_id: int, updates: dict) -> str | None:
        self.copy[product_id] = dict(updates)
        return None


def _confirmed(catalogue: Catalogue) -> dict:
    return catalogue.facts[SHIRT.id]["confirmed"]


async def test_a_complete_message_confirms_facts_including_an_explicit_skip() -> None:
    catalogue = Catalogue()

    async def model(_ctx) -> ModelStep:
        return ModelStep(
            text="I wrote the listing.",
            act="confirm_facts",
            product="Blue linen shirt",
            facts=LINEN,
        )

    result = await ask(
        MemoryThreadStore(),
        user_id="user_seller",
        shop_domain="tees.myshopify.com",
        message="Cotton 80, polyester 20. Skip care and GPSR.",
        model=model,
        products=(SHIRT,),
        writer=catalogue,
    )

    assert _confirmed(catalogue)["isTextile"] is True
    assert _confirmed(catalogue)["composition"] == [
        {"name": "cotton", "percent": 80},
        {"name": "polyester", "percent": 20},
    ]
    assert _confirmed(catalogue)["gpsrChoice"] == "skip"
    assert _confirmed(catalogue)["careChoice"] == "skip"
    assert result.credits_spent == 0
    assert result.shop_changed is False
    assert result.product == SHIRT
    assert [text for _, text in result.thread] == [
        "Cotton 80, polyester 20. Skip care and GPSR.",
        "Those facts are confirmed.",
    ]


async def test_a_missing_or_invalid_input_asks_and_saves_nothing() -> None:
    catalogue = Catalogue()
    calls = 0

    async def model(_ctx) -> ModelStep:
        nonlocal calls
        calls += 1
        if calls == 1:
            return ModelStep(
                text="Confirmed.",
                act="confirm_facts",
                product="Blue linen shirt",
                facts={
                    "product_kind": "textile",
                    "is_textile": True,
                    "composition": [{"name": "cotton", "percent": 80}],
                    "gpsr_choice": "skip",
                    "care_choice": "skip",
                },
                done=False,
            )
        return ModelStep(act="confirm_facts", product="Blue linen shirt", facts=LINEN)

    result = await ask(
        MemoryThreadStore(),
        user_id="user_seller",
        shop_domain="tees.myshopify.com",
        message="It's 80% cotton.",
        model=model,
        products=(SHIRT,),
        writer=catalogue,
    )

    assert catalogue.facts == {}
    assert calls == 1
    assert result.credits_spent == 0
    assert result.shop_changed is False
    assert [text for _, text in result.thread] == [
        "It's 80% cotton.",
        "Fibre percentages must be integers that sum to 100.",
    ]


async def test_a_missing_input_asks_and_saves_nothing() -> None:
    catalogue = Catalogue()

    async def model(_ctx) -> ModelStep:
        return ModelStep(
            act="confirm_facts",
            product="Blue linen shirt",
            facts={"product_kind": "textile", "is_textile": True, "gpsr_choice": "skip"},
        )

    result = await ask(
        MemoryThreadStore(),
        user_id="user_seller",
        shop_domain="tees.myshopify.com",
        message="It's a textile. Skip GPSR.",
        model=model,
        products=(SHIRT,),
        writer=catalogue,
    )

    assert catalogue.facts == {}
    assert [text for _, text in result.thread] == [
        "It's a textile. Skip GPSR.",
        "Fibre composition is required to confirm a textile product.",
    ]


async def test_a_confirm_with_no_product_asks_and_saves_nothing() -> None:
    catalogue = Catalogue()

    async def model(_ctx) -> ModelStep:
        return ModelStep(act="confirm_facts", facts=LINEN)

    result = await ask(
        MemoryThreadStore(),
        user_id="user_seller",
        shop_domain="tees.myshopify.com",
        message="Skip care and GPSR. Cotton 80, polyester 20.",
        model=model,
        products=(SHIRT,),
        writer=catalogue,
    )

    assert catalogue.facts == {}
    assert result.shop_changed is False
    assert [text for _, text in result.thread] == [
        "Skip care and GPSR. Cotton 80, polyester 20.",
        "Which product? Open its page, or name it.",
    ]


async def test_quoted_words_are_typed_listing_copy_and_spend_no_credit() -> None:
    catalogue = Catalogue()

    async def model(_ctx) -> ModelStep:
        return ModelStep(
            text="I composed a new description about organic cotton.",
            act="type_listing_copy",
            product="Blue linen shirt",
            quote_field="description",
            quote_words="It is organic cotton.",
        )

    result = await ask(
        MemoryThreadStore(),
        user_id="user_seller",
        shop_domain="tees.myshopify.com",
        message='Make the description say "It is organic cotton."',
        model=model,
        products=(SHIRT,),
        writer=catalogue,
    )

    assert catalogue.copy == {SHIRT.id: {"description": "It is organic cotton."}}
    assert catalogue.facts == {}
    assert result.credits_spent == 0
    assert result.shop_changed is False
    assert [text for _, text in result.thread] == [
        'Make the description say "It is organic cotton."',
        "That's the description.",
    ]


async def test_a_quote_lands_on_the_open_photo_of_that_product() -> None:
    catalogue = Catalogue()

    async def model(_ctx) -> ModelStep:
        return ModelStep(
            act="type_listing_copy",
            product="Blue linen shirt",
            quote_field="description",
            quote_words="It is organic cotton.",
        )

    await ask(
        MemoryThreadStore(),
        user_id="user_seller",
        shop_domain="tees.myshopify.com",
        message='Make the description say "It is organic cotton."',
        model=model,
        products=(SHIRT,),
        open_product_id=8,
        writer=catalogue,
    )

    assert catalogue.copy == {BACK.id: {"description": "It is organic cotton."}}


async def test_a_quote_with_no_field_asks_and_saves_nothing() -> None:
    catalogue = Catalogue()

    async def model(_ctx) -> ModelStep:
        return ModelStep(
            act="type_listing_copy",
            product="Blue linen shirt",
            quote_words="It is organic cotton.",
        )

    result = await ask(
        MemoryThreadStore(),
        user_id="user_seller",
        shop_domain="tees.myshopify.com",
        message='Say "It is organic cotton."',
        model=model,
        products=(SHIRT,),
        writer=catalogue,
    )

    assert catalogue.copy == {}
    assert result.credits_spent == 0
    assert [text for _, text in result.thread] == [
        'Say "It is organic cotton."',
        "Which part of the listing copy — title, description, tags, SEO title, "
        "meta description, or AEO text?",
    ]


async def test_write_the_listing_does_not_confirm_or_type() -> None:
    catalogue = Catalogue()

    async def model(_ctx) -> ModelStep:
        return ModelStep(
            text="Writing the listing.",
            act="generate",
            product="Blue linen shirt",
            facts=LINEN,
            quote_field="description",
            quote_words="A breezy linen shirt for warm days.",
        )

    result = await ask(
        MemoryThreadStore(),
        user_id="user_seller",
        shop_domain="tees.myshopify.com",
        message="Write the listing.",
        model=model,
        products=(SHIRT,),
        writer=catalogue,
    )

    assert catalogue.facts == {}
    assert catalogue.copy == {}
    assert result.credits_spent == 0
    assert result.shop_changed is False
    assert [text for _, text in result.thread] == [
        "Write the listing.",
        "Writing the listing.",
    ]


async def test_an_explicit_coffee_origin_skip_confirms() -> None:
    catalogue = Catalogue()

    async def model(_ctx) -> ModelStep:
        return ModelStep(
            act="confirm_facts",
            product="Blue linen shirt",
            facts={
                "product_kind": "coffee",
                "coffee_form": "beans",
                "roast_level": "medium",
                "net_weight": "250 g",
                "coffee_origin_choice": "skip",
                "ingredients_list": "coffee beans",
                "allergen_statement": "none",
            },
        )

    await ask(
        MemoryThreadStore(),
        user_id="user_seller",
        shop_domain="tees.myshopify.com",
        message="Beans, medium, 250 g. Skip origin. Ingredients: coffee beans. Allergens: none.",
        model=model,
        products=(SHIRT,),
        writer=catalogue,
    )

    confirmed = catalogue.facts[SHIRT.id]["confirmed"]
    assert confirmed["productKind"] == "coffee"
    assert confirmed["coffeeOriginChoice"] == "skip"
    assert "coffeeOrigin" not in confirmed
    assert confirmed["ingredientsList"] == "coffee beans"
    assert confirmed["allergenStatement"] == "none"


async def test_the_model_reply_uses_the_page_inputs_and_drops_a_token() -> None:
    import json

    import httpx

    from app.services.chat import model_from

    catalogue = Catalogue()

    def handler(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        assert "shpat" not in json.dumps(body)
        return httpx.Response(
            200,
            json={
                "act": "confirm_facts",
                "product": "Blue linen shirt",
                "facts": {
                    "productKind": "textile",
                    "isTextile": True,
                    "composition": [
                        {"name": "cotton", "percent": 80},
                        {"name": "polyester", "percent": 20},
                    ],
                    "gpsrChoice": "skip",
                    "careChoice": "skip",
                    "shopifyToken": "shpat_live_secret",
                },
            },
        )

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    result = await ask(
        MemoryThreadStore(),
        user_id="user_seller",
        shop_domain="tees.myshopify.com",
        message="Cotton 80, polyester 20. Skip care and GPSR.",
        model=model_from("http://model.test/turn", client=client),
        products=(SHIRT,),
        writer=catalogue,
    )
    await client.aclose()

    assert "shpat_live_secret" not in json.dumps(catalogue.facts)
    assert _confirmed(catalogue)["gpsrChoice"] == "skip"
    assert result.thread[-1] == ("chat", "Those facts are confirmed.")
