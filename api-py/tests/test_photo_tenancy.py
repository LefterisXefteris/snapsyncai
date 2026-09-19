"""A seller only loads their own photos. SnapSync storage stays off the catalogue JSON."""

import pytest

from types import SimpleNamespace

from app.models.image import Image
from app.schemas.image import with_facts_outcomes
from app.services.images import get_image
from app.services.supabase_storage import (
    SIGNED_URL_TTL_SECONDS,
    is_snapsync_storage_url,
    media_original_source,
    stored_object_url,
)


@pytest.mark.asyncio
async def test_get_image_refuses_lookup_without_a_seller() -> None:
    with pytest.raises(ValueError, match="sessionId"):
        await get_image(None, 1, "")  # type: ignore[arg-type]


def test_catalogue_json_omits_storage_url_and_seller_id() -> None:
    image = Image(
        id=1,
        original_name="tee.jpg",
        mime_type="image/jpeg",
        size=10,
        session_id="seller_1",
        storage_url="https://abc.supabase.co/storage/v1/object/public/product-images/1/x.jpg",
        title="Tee",
    )
    payload = with_facts_outcomes(image, list_item=True).model_dump(by_alias=True)
    assert payload["title"] == "Tee"
    assert "storageUrl" not in payload
    assert "sessionId" not in payload


def _storage_settings(**overrides):
    values = dict(
        supabase_url="https://abc.supabase.co",
        supabase_storage_bucket="product-images",
        supabase_service_role_key="service-role",
    )
    values.update(overrides)
    return SimpleNamespace(**values)


SNAPSYNC_PHOTO = (
    "https://abc.supabase.co/storage/v1/object/public/product-images/14/99.jpg"
)
CHANNEL_PHOTO = "https://cdn.shopify.com/s/files/1/tee.jpg"


def test_snapsync_bucket_urls_are_detected_and_channel_urls_are_not() -> None:
    settings = _storage_settings()
    assert is_snapsync_storage_url(SNAPSYNC_PHOTO, settings) is True
    assert is_snapsync_storage_url(CHANNEL_PHOTO, settings) is False


def test_new_uploads_are_stored_as_authenticated_locators_not_public_urls() -> None:
    url = stored_object_url(_storage_settings(), "14/99.jpg")
    assert url == (
        "https://abc.supabase.co/storage/v1/object/authenticated/product-images/14/99.jpg"
    )
    assert "/object/public/" not in url
    assert is_snapsync_storage_url(url, _storage_settings()) is True


def test_push_uses_the_channel_photo_url_as_is() -> None:
    assert media_original_source(CHANNEL_PHOTO, _storage_settings()) == CHANNEL_PHOTO


def test_push_mints_a_short_lived_signed_url_for_snapsync_photos(monkeypatch) -> None:
    from app.services import supabase_storage as storage

    class FakeBucket:
        def create_signed_url(self, path: str, expires_in: int):
            assert path == "14/99.jpg"
            assert expires_in == SIGNED_URL_TTL_SECONDS
            return {"signedURL": "https://abc.supabase.co/storage/v1/object/sign/product-images/14/99.jpg?token=t"}

    class FakeStorage:
        def from_(self, _bucket: str):
            return FakeBucket()

    class FakeClient:
        storage = FakeStorage()

    monkeypatch.setattr(storage, "_client", lambda: FakeClient())
    assert (
        media_original_source(SNAPSYNC_PHOTO, _storage_settings())
        == "https://abc.supabase.co/storage/v1/object/sign/product-images/14/99.jpg?token=t"
    )


def test_file_route_proxies_snapsync_photos_instead_of_redirecting(monkeypatch) -> None:
    from fastapi.testclient import TestClient

    from app.auth.clerk import DEV_USER_ID
    from app.config import get_settings
    from app.db import get_session
    from app.main import create_app
    from app.services import images as store

    photo = Image(
        id=14,
        original_name="tee.jpg",
        mime_type="image/jpeg",
        size=4,
        session_id=DEV_USER_ID,
        storage_url=SNAPSYNC_PHOTO,
    )

    async def fake_get(_session, image_id: int, _session_id: str = ""):
        return photo if image_id == photo.id else None

    async def fake_bytes(_image):
        return b"JPEG"

    monkeypatch.setenv("DATABASE_URL", "postgresql://u:p@localhost:5432/db")
    monkeypatch.setenv("CLERK_SECRET_KEY", "sk_test_fake")
    monkeypatch.setenv("DEV_BYPASS_AUTH", "true")
    monkeypatch.setenv("SUPABASE_URL", "https://abc.supabase.co")
    get_settings.cache_clear()
    app = create_app()

    async def _no_db():
        yield None

    app.dependency_overrides[get_session] = _no_db
    monkeypatch.setattr(store, "get_image", fake_get)
    monkeypatch.setattr(store, "load_image_bytes", fake_bytes)
    client = TestClient(app, raise_server_exceptions=False)
    try:
        response = client.get("/api/images/14/file")
        assert response.status_code == 200
        assert response.content == b"JPEG"
        assert "abc.supabase.co" not in (response.headers.get("location") or "")
    finally:
        get_settings.cache_clear()
