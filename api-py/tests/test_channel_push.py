"""Channel push gates on listing copy present, not paid unlock."""

from types import SimpleNamespace

from app.schemas.image import with_facts_outcomes
from app.services.listing_copy_refresh import listing_copy_from_image
from app.services.product_facts import listing_copy_present


def _photo(**fields):
    values = {
        "title": None,
        "description": None,
        "tags": None,
        "seo_title": None,
        "seo_description": None,
        "aeo_snippet": None,
        "aeo_faqs": None,
        "payment_status": "unpaid",
    }
    values.update(fields)
    return SimpleNamespace(**values)


def test_typed_title_counts_as_listing_copy_even_when_unlock_is_unpaid() -> None:
    assert listing_copy_present(listing_copy_from_image(_photo(title="Merino crew"))) is True


def test_empty_product_has_no_listing_copy() -> None:
    assert listing_copy_present(listing_copy_from_image(_photo())) is False


def test_payload_exposes_listing_copy_present_for_the_catalogue() -> None:
    from app.models.image import Image

    image = Image(
        id=1,
        original_name="crew.jpg",
        mime_type="image/jpeg",
        size=10,
        session_id="user_1",
        title="Merino crew",
        payment_status="unpaid",
    )
    payload = with_facts_outcomes(image).model_dump(by_alias=True)
    assert payload["listingCopyPresent"] is True
    assert payload["paymentStatus"] == "unpaid"
