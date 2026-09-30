"""POST /api/images/{id}/generate-content — listing copy stays gated on facts and photo bytes."""

from fastapi.testclient import TestClient

from app.config import get_settings
from app.db import get_session
from app.main import create_app
from app.routers.ai import FIELD_PROMPTS, GENERATE_CONTENT_SYSTEM
from app.schemas.ai import RegenerateFieldBody
from app.services import images as store
from tests import seed


def _client(monkeypatch) -> TestClient:
    monkeypatch.setenv("DATABASE_URL", "postgresql://u:p@localhost:5432/db")
    monkeypatch.setenv("CLERK_SECRET_KEY", "sk_test_fake")
    monkeypatch.setenv("DEV_BYPASS_AUTH", "true")
    get_settings.cache_clear()
    app = create_app()

    async def _no_db():
        yield None

    app.dependency_overrides[get_session] = _no_db
    return TestClient(app, raise_server_exceptions=False)


async def test_generate_content_tells_the_seller_to_reupload_a_missing_photo(
    db, api, monkeypatch
) -> None:
    await seed.plan(db)
    photo_id = await seed.product(db, facts=seed.confirmed_facts(), listed=False)

    async def no_bytes(_image):
        return None

    monkeypatch.setattr(store, "load_image_bytes", no_bytes)
    response = await api(
        f"/api/images/{photo_id}/generate-content",
        {"category": "", "styleTone": "professional", "audience": ""},
    )
    assert response.status_code == 400
    assert response.json() == {
        "message": "This photo's file is missing. Re-upload it before generating listing copy."
    }


def test_upload_refuses_when_photo_storage_is_not_configured(monkeypatch) -> None:
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_SERVICE_ROLE_KEY", raising=False)
    client = _client(monkeypatch)
    try:
        response = client.post(
            "/api/images/upload",
            files=[("images", ("shirt.jpg", b"not-a-real-jpeg", "image/jpeg"))],
        )
        assert response.status_code == 503
        assert response.json() == {
            "message": (
                "Photo storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY "
                "for this environment."
            )
        }
    finally:
        get_settings.cache_clear()


def test_generate_listing_copy_asks_for_seo_title_and_meta_description() -> None:
    assert '"seoTitle"' in GENERATE_CONTENT_SYSTEM
    assert '"seoDescription"' in GENERATE_CONTENT_SYSTEM


def test_a_seller_can_regenerate_seo_title_and_meta_description() -> None:
    assert RegenerateFieldBody(field="seoTitle").field == "seoTitle"
    assert RegenerateFieldBody(field="seoDescription").field == "seoDescription"
    assert "seoTitle" in FIELD_PROMPTS
    assert "seoDescription" in FIELD_PROMPTS
