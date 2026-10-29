"""Typed listing copy and confirmed facts Undo. Seam: `ask`."""

from app.services.chat import MemoryThreadStore, ModelStep, Undo, ask
from tests.test_chat_facts import LINEN, Catalogue
from tests.test_chat_product import SHIRT

WOOL = {
    "product_kind": "textile",
    "is_textile": True,
    "composition": [{"name": "wool", "percent": 100}],
    "gpsr_choice": "skip",
    "care_choice": "skip",
}


async def test_typed_listing_copy_hands_the_previous_words_to_the_browser() -> None:
    catalogue = Catalogue()
    catalogue.words[SHIRT.id] = {"description": "A linen shirt."}
    store = MemoryThreadStore()

    async def model(_ctx) -> ModelStep:
        return ModelStep(
            act="type_listing_copy",
            product="Blue linen shirt",
            quote_field="description",
            quote_words="It is organic cotton.",
        )

    result = await ask(
        store,
        user_id="user_seller",
        shop_domain="tees.myshopify.com",
        message='Make the description say "It is organic cotton."',
        model=model,
        products=(SHIRT,),
        writer=catalogue,
    )

    assert result.undos == (
        Undo(1, "copy", product_id=SHIRT.id, fields={"description": "A linen shirt."}),
    )
    assert result.credits_spent == 0
    assert all("A linen shirt." not in text for _, text in result.thread)
    stored = await store.load("user_seller", "tees.myshopify.com")
    assert stored == result.thread


async def test_a_first_confirm_saves_the_facts_and_shows_no_undo() -> None:
    catalogue = Catalogue()

    async def model(_ctx) -> ModelStep:
        return ModelStep(act="confirm_facts", product="Blue linen shirt", facts=LINEN)

    result = await ask(
        MemoryThreadStore(),
        user_id="user_seller",
        shop_domain="tees.myshopify.com",
        message="Cotton 80, polyester 20. Skip care and GPSR.",
        model=model,
        products=(SHIRT,),
        writer=catalogue,
    )

    assert catalogue.facts[SHIRT.id]["confirmed"]["isTextile"] is True
    assert result.undos == ()
    assert result.thread[-1] == ("chat", "Those facts are confirmed.")


async def test_a_confirm_hands_the_previous_pack_to_the_browser() -> None:
    catalogue = Catalogue()
    catalogue.packs[SHIRT.id] = dict(LINEN)
    store = MemoryThreadStore()

    async def model(_ctx) -> ModelStep:
        return ModelStep(
            act="confirm_facts",
            product="Blue linen shirt",
            facts=WOOL,
        )

    result = await ask(
        store,
        user_id="user_seller",
        shop_domain="tees.myshopify.com",
        message="Wool 100. Skip care and GPSR.",
        model=model,
        products=(SHIRT,),
        writer=catalogue,
    )

    assert result.undos == (Undo(1, "facts", product_id=SHIRT.id, facts=LINEN),)
    assert result.credits_spent == 0
    assert all("80" not in text for _, text in result.thread)
    stored = await store.load("user_seller", "tees.myshopify.com")
    assert stored == result.thread


async def test_a_quote_with_no_words_asks_and_saves_nothing() -> None:
    catalogue = Catalogue()

    async def model(_ctx) -> ModelStep:
        return ModelStep(
            act="type_listing_copy",
            product="Blue linen shirt",
            quote_field="description",
        )

    result = await ask(
        MemoryThreadStore(),
        user_id="user_seller",
        shop_domain="tees.myshopify.com",
        message="Change the description.",
        model=model,
        products=(SHIRT,),
        writer=catalogue,
    )

    assert catalogue.copy == {}
    assert result.undos == ()
    assert result.thread[-1] == ("chat", "What should it say?")


async def test_a_quote_and_a_confirm_each_keep_their_previous_value() -> None:
    catalogue = Catalogue()
    catalogue.words[SHIRT.id] = {"description": "Old copy."}
    catalogue.packs[SHIRT.id] = dict(LINEN)

    async def model(ctx) -> ModelStep:
        if ctx.calls_made == 0:
            return ModelStep(
                act="type_listing_copy",
                product="Blue linen shirt",
                quote_field="description",
                quote_words="New copy.",
                done=False,
            )
        return ModelStep(act="confirm_facts", product="Blue linen shirt", facts=WOOL)

    result = await ask(
        MemoryThreadStore(),
        user_id="user_seller",
        shop_domain="tees.myshopify.com",
        message='Description "New copy." Wool 100. Skip care and GPSR.',
        model=model,
        products=(SHIRT,),
        writer=catalogue,
    )

    assert result.undos == (
        Undo(1, "copy", product_id=SHIRT.id, fields={"description": "Old copy."}),
        Undo(2, "facts", product_id=SHIRT.id, facts=LINEN),
    )
    assert all("Old copy." not in text and "80" not in text for _, text in result.thread)


async def test_an_empty_description_is_the_previous_words() -> None:
    catalogue = Catalogue()

    async def model(_ctx) -> ModelStep:
        return ModelStep(
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

    assert result.undos == (Undo(1, "copy", product_id=SHIRT.id, fields={"description": ""}),)
