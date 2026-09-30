"""The Product module on `db`: a product loaded, confirmed, and staled across its photos."""

from app.services import images as store
from app.services import product
from app.services.product_facts import facts_from_stored
from tests import seed
from tests.seed import OTHER_SELLER, SELLER

SHOP_GPSR = {
    "manufacturer": {
        "name": "Acme Ltd",
        "postalAddress": "1 Rue Example, Paris",
        "email": "acme@example.com",
    },
    "manufacturerInEu": True,
}


async def test_a_grouped_product_loads_the_facts_from_any_of_its_photos(db):
    await seed.shop(db, gpsr_identity=SHOP_GPSR)
    front = await seed.product(db, product_group_id="tee")
    await seed.product(db, product_group_id="tee", facts=seed.confirmed_facts())

    loaded = await product.load(db, SELLER, front)

    assert loaded is not None
    assert loaded.photo.id == front
    assert len(loaded.photos) == 2
    assert loaded.facts.confirmed is not None
    assert loaded.shop_gpsr == SHOP_GPSR


async def test_another_sellers_product_does_not_load(db):
    theirs = await seed.product(db, owner=OTHER_SELLER)

    assert await product.load(db, SELLER, theirs) is None


async def test_a_standalone_product_loads_its_own_photo_without_a_shop(db):
    tee = await seed.product(db, facts=seed.confirmed_facts())

    loaded = await product.load(db, SELLER, tee)

    assert loaded is not None
    assert [img.id for img in loaded.photos] == [tee]
    assert loaded.facts.confirmed is not None
    assert loaded.shop_gpsr is None
    assert loaded.listing_copy["title"] == "Cotton tee"


async def test_confirm_writes_the_facts_onto_every_photo_of_the_product(db):
    front = await seed.product(db, product_group_id="tee", listed=False)
    back = await seed.product(db, product_group_id="tee", listed=False)

    confirmed = await product.confirm(
        db, SELLER, front, is_textile=False, gpsr_choice="skip"
    )

    assert confirmed.refused is None
    assert confirmed.product is not None
    reloaded = await product.load(db, SELLER, back)
    assert reloaded is not None
    assert reloaded.facts.confirmed is not None
    assert reloaded.facts.confirmed.is_textile is False


async def test_confirm_refuses_a_textile_without_fibre_composition_and_writes_nothing(db):
    tee = await seed.product(db, listed=False)

    confirmed = await product.confirm(db, SELLER, tee, is_textile=True, gpsr_choice="skip")

    assert confirmed.refused == "invalid"
    assert confirmed.message
    reloaded = await product.load(db, SELLER, tee)
    assert reloaded is not None
    assert reloaded.facts.confirmed is None


async def test_confirm_refuses_another_sellers_product(db):
    theirs = await seed.product(db, owner=OTHER_SELLER)

    confirmed = await product.confirm(db, SELLER, theirs, is_textile=False, gpsr_choice="skip")

    assert confirmed.refused == "not_found"


async def test_changing_confirmed_facts_stales_listing_copy_held_on_another_photo(db):
    front = await seed.product(
        db, product_group_id="tee", listed=False, facts=seed.confirmed_facts()
    )
    await seed.product(db, product_group_id="tee", facts=seed.confirmed_facts())

    confirmed = await product.confirm(
        db,
        SELLER,
        front,
        is_textile=True,
        composition=[{"name": "cotton", "percent": 100}],
        gpsr_choice="skip",
        care_choice="skip",
    )

    assert confirmed.refused is None
    reloaded = await product.load(db, SELLER, front)
    assert reloaded is not None
    assert reloaded.facts.listing_copy_stale is True


async def test_grouping_carries_confirmed_facts_onto_the_new_photo(db):
    confirmed_tee = await seed.product(db, facts=seed.confirmed_facts())
    new_photo = await seed.product(db, listed=False)
    for photo_id in (confirmed_tee, new_photo):
        await store.update_image(db, photo_id, {"product_group_id": "tee"}, SELLER)

    await product.sync_facts_after_grouping(db, SELLER, new_photo)

    photo = await store.get_image(db, new_photo, SELLER)
    assert photo is not None
    assert facts_from_stored(photo.product_facts).confirmed is not None


async def test_saving_shop_gpsr_stales_only_listed_products_that_use_the_shop_default(db):
    await seed.shop(db, gpsr_identity=SHOP_GPSR)
    shop_default = await seed.product(db, listed=False)
    skipped = await seed.product(db, facts=seed.confirmed_facts())
    await product.confirm(db, SELLER, shop_default, is_textile=False, gpsr_choice="shop_default")
    await store.update_image(db, shop_default, seed.LISTED, SELLER)
    before = await product.load(db, SELLER, shop_default)
    assert before is not None and before.facts.listing_copy_stale is False

    await product.stale_shop_default_products(db, SELLER)

    staled = await product.load(db, SELLER, shop_default)
    untouched = await product.load(db, SELLER, skipped)
    assert staled is not None and staled.facts.listing_copy_stale is True
    assert untouched is not None and untouched.facts.listing_copy_stale is False


async def test_a_shop_gpsr_identity_that_is_not_a_record_is_ignored(db):
    await seed.shop(db, gpsr_identity=["not", "a", "record"])
    tee = await seed.product(db)

    loaded = await product.load(db, SELLER, tee)

    assert loaded is not None
    assert loaded.shop_gpsr is None
