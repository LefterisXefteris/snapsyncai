"""POST /api/images/{id}/product-facts/confirm — maps the Product module's outcome to HTTP.

The confirm rules are tested in `test_product.py` and `test_product_facts.py`.
"""

from tests import seed
from tests.seed import OTHER_SELLER


async def test_confirmed_facts_open_listing_copy_generation(db, api) -> None:
    tee = await seed.product(db, listed=False)

    response = await api(
        f"/api/images/{tee}/product-facts/confirm", {"isTextile": False, "gpsrChoice": "skip"}
    )

    assert response.status_code == 200
    assert response.json()["id"] == tee
    assert response.json()["mayGenerateListingCopy"] is True


async def test_invalid_facts_are_a_bad_request(db, api) -> None:
    tee = await seed.product(db, listed=False)

    response = await api(
        f"/api/images/{tee}/product-facts/confirm", {"isTextile": True, "gpsrChoice": "skip"}
    )

    assert response.status_code == 400
    assert response.json() == {
        "detail": "Fibre composition is required to confirm a textile product."
    }


async def test_another_sellers_product_is_not_found(db, api) -> None:
    theirs = await seed.product(db, owner=OTHER_SELLER, listed=False)

    response = await api(
        f"/api/images/{theirs}/product-facts/confirm", {"isTextile": False, "gpsrChoice": "skip"}
    )

    assert response.status_code == 404
    assert response.json() == {"detail": "Image not found"}
