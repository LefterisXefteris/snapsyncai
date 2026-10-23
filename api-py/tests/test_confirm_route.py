"""POST /api/images/{id}/product-facts/confirm — maps the Product module's outcome to HTTP.

The confirm rules are tested in `test_product.py` and `test_product_facts.py`.
"""

from tests import seed
from tests.seed import OTHER_SELLER


async def test_confirmed_coffee_facts_open_listing_copy_generation(db, api) -> None:
    """Live path: seller confirms Coffee product facts → may generate listing copy."""
    bag = await seed.product(db, listed=False)

    response = await api(
        f"/api/images/{bag}/product-facts/confirm",
        {
            "productKind": "coffee",
            "coffeeForm": "beans",
            "roastLevel": "medium",
            "netWeight": "250 g",
            "coffeeOriginChoice": "skip",
            "ingredientsList": "coffee beans",
            "allergenStatement": "none",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == bag
    assert body["mayGenerateListingCopy"] is True
    assert body["productFacts"]["confirmed"]["productKind"] == "coffee"


async def test_legacy_not_a_textile_confirm_is_rejected(db, api) -> None:
    tee = await seed.product(db, listed=False)

    response = await api(
        f"/api/images/{tee}/product-facts/confirm",
        {"isTextile": False, "gpsrChoice": "skip"},
    )

    assert response.status_code == 400
    assert response.json() == {"detail": "Product kind is required."}


async def test_invalid_textile_facts_are_a_bad_request(db, api) -> None:
    tee = await seed.product(db, listed=False)

    response = await api(
        f"/api/images/{tee}/product-facts/confirm",
        {"productKind": "textile", "isTextile": True, "gpsrChoice": "skip"},
    )

    assert response.status_code == 400
    assert response.json() == {
        "detail": "Fibre composition is required to confirm a textile product."
    }


async def test_another_sellers_product_is_not_found(db, api) -> None:
    theirs = await seed.product(db, owner=OTHER_SELLER, listed=False)

    response = await api(
        f"/api/images/{theirs}/product-facts/confirm",
        {
            "productKind": "coffee",
            "coffeeForm": "beans",
            "roastLevel": "medium",
            "netWeight": "250 g",
            "coffeeOriginChoice": "skip",
            "ingredientsList": "coffee beans",
            "allergenStatement": "none",
        },
    )

    assert response.status_code == 404
    assert response.json() == {"detail": "Image not found"}
