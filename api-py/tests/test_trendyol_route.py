"""The Trendyol route maps a missing connection, a named wait, and an accepted batch."""

from app.config import Settings
from app.services.trendyol_api import get_trendyol_account
from tests import seed
from tests.trendyol_memory import MemoryTrendyol

BARCODE = "8690000000011"
LISTING = {
    "categoryId": "11",
    "brandId": "22",
    "salePrice": "19.00",
    "listPrice": "25.00",
}


def _settings(db_settings: Settings) -> Settings:
    return Settings.model_construct(
        database_url=db_settings.database_url,
        environment="test",
        connection_encryption_key="test-key",
    )


async def _post(seller_app, db_settings, port, path: str, body: dict):
    seller_app.dependency_overrides[get_trendyol_account] = lambda: port

    async def settings():
        return _settings(db_settings)

    from app.config import get_settings

    seller_app.dependency_overrides[get_settings] = settings
    import httpx

    transport = httpx.ASGITransport(app=seller_app, raise_app_exceptions=False)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        return await client.post(path, json=body)


async def test_no_connection_is_400(db, seller_app, db_settings) -> None:
    pid = await seed.product(db, barcode=BARCODE, sku="TEE-1")
    response = await _post(
        seller_app, db_settings, MemoryTrendyol(), f"/api/trendyol/products/{pid}/push", LISTING
    )
    assert response.status_code == 400
    assert response.json() == {"detail": "Connect Trendyol International in Settings."}


async def test_a_named_wait_is_400(db, seller_app, db_settings) -> None:
    await seed.shop(db)
    pid = await seed.product(db, barcode=None, sku="TEE-1")
    port = MemoryTrendyol()
    from app.services.trendyol import connect

    await connect(
        db,
        _settings(db_settings),
        port,
        seed.SELLER,
        seller_id="501",
        api_key="key",
        api_secret="secret",
        storefront_code="DE",
        vat_rate=19,
    )
    response = await _post(
        seller_app, db_settings, port, f"/api/trendyol/products/{pid}/push", LISTING
    )
    assert response.status_code == 400
    assert response.json() == {"detail": "This product needs a barcode."}


async def test_an_accepted_batch_is_200(db, seller_app, db_settings) -> None:
    await seed.shop(db)
    pid = await seed.product(
        db, barcode=BARCODE, sku="TEE-1", storage_url="https://cdn.example/front.jpg"
    )
    port = MemoryTrendyol()
    from app.services.trendyol import connect

    await connect(
        db,
        _settings(db_settings),
        port,
        seed.SELLER,
        seller_id="501",
        api_key="key",
        api_secret="secret",
        storefront_code="DE",
        vat_rate=19,
    )
    response = await _post(
        seller_app, db_settings, port, f"/api/trendyol/products/{pid}/push", LISTING
    )
    assert response.status_code == 200
    body = response.json()
    assert body["approval"] == "waiting"
    assert body["pushWait"] is None
