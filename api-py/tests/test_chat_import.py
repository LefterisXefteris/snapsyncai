"""Import from Chat. Seam: `ask`. Import stays the page's Import."""

import asyncio

from app.services.chat import MemoryThreadStore, ModelStep, ask
from app.services.import_catalogue import ImportFailure, ImportResult

USER = "user_seller"
SHOP = "tees.myshopify.com"
RUNNING = "Import is in progress."


class ImportJob:
    """The page's Start. A second call while the first is running is refused."""

    def __init__(self, result: ImportResult) -> None:
        self.result = result
        self.starts = 0
        self.done: asyncio.Future[ImportResult] | None = None
        self.refusal: str | None = None

    async def start(self) -> ImportResult | object:
        from app.services.chat_import import ImportBegun

        if self.refusal:
            return ImportResult(blocked_reason=self.refusal)
        if self.done is not None and not self.done.done():
            return ImportResult(blocked_reason="An Import is already in progress.")
        self.starts += 1
        self.done = asyncio.get_running_loop().create_future()
        return ImportBegun(self.done)


def _model(calls: list[str]):
    async def model(_ctx) -> ModelStep:
        calls.append("import" if not calls else "later")
        if calls[-1] == "later":
            return ModelStep(act="push", done=True, text="Pushed.")
        return ModelStep(act="import", done=False, text="Starting.")

    return model


async def test_import_starts_and_the_turn_ends_once_it_has_started() -> None:
    job = ImportJob(ImportResult(created=2, skipped=1, failed=0))
    calls: list[str] = []
    result = await ask(
        MemoryThreadStore(),
        user_id=USER,
        shop_domain=SHOP,
        message="Import the shop.",
        model=_model(calls),
        importer=job,
    )

    assert job.starts == 1
    assert calls == ["import"]
    assert result.credits_spent == 0
    assert result.undos == ()
    assert result.thread[-1] == ("chat", RUNNING)
    assert job.done is not None
    job.done.set_result(job.result)
    await asyncio.sleep(0)


async def _when_recorded(store: MemoryThreadStore, needle: str):
    for _ in range(50):
        thread = await store.load(USER, SHOP)
        if any(needle in text for _, text in thread):
            return thread
        await asyncio.sleep(0.01)
    raise AssertionError(await store.load(USER, SHOP))


async def test_the_thread_records_the_result_when_import_completes() -> None:
    job = ImportJob(
        ImportResult(
            created=1,
            skipped=2,
            failed=1,
            failures=(ImportFailure("gid://shopify/Product/bad", "media failed"),),
        )
    )
    store = MemoryThreadStore()
    await ask(
        store,
        user_id=USER,
        shop_domain=SHOP,
        message="Import the shop.",
        model=_model([]),
        importer=job,
    )
    assert job.done is not None
    job.done.set_result(job.result)
    await asyncio.sleep(0)

    thread = await _when_recorded(store, "Created 1")
    assert thread[-1] == (
        "chat",
        "Created 1 · skipped 2 · failed 1\ngid://shopify/Product/bad: media failed",
    )


async def test_a_second_start_is_refused_while_import_is_in_progress() -> None:
    job = ImportJob(ImportResult(created=1, skipped=0, failed=0))
    store = MemoryThreadStore()
    calls: list[str] = []
    await ask(
        store,
        user_id=USER,
        shop_domain=SHOP,
        message="Import the shop.",
        model=_model(calls),
        importer=job,
    )
    calls.clear()
    second = await ask(
        store,
        user_id=USER,
        shop_domain=SHOP,
        message="Import again.",
        model=_model(calls),
        importer=job,
    )

    assert job.starts == 1
    assert calls == ["import"]
    assert second.credits_spent == 0
    assert second.thread[-1] == ("chat", "An Import is already in progress.")
    assert job.done is not None
    job.done.set_result(job.result)
    await asyncio.sleep(0)


async def test_import_does_not_ask_which_product() -> None:
    from app.services.chat import NamedProduct

    job = ImportJob(ImportResult(created=0, skipped=0, failed=0))

    async def model(_ctx) -> ModelStep:
        return ModelStep(act="import", product="no such shirt", done=False)

    result = await ask(
        MemoryThreadStore(),
        user_id=USER,
        shop_domain=SHOP,
        message="Import the shop.",
        model=model,
        products=(NamedProduct(id=1, title="Other"),),
        importer=job,
    )

    assert job.starts == 1
    assert result.thread[-1] == ("chat", RUNNING)
    assert job.done is not None
    job.done.set_result(job.result)
    await asyncio.sleep(0)


async def test_import_without_a_shop_uses_the_page_refusal() -> None:
    job = ImportJob(ImportResult())
    job.refusal = "Connect Shopify in Settings before you Import."
    calls: list[str] = []
    result = await ask(
        MemoryThreadStore(),
        user_id=USER,
        shop_domain=None,
        message="Import the shop.",
        model=_model(calls),
        importer=job,
    )

    assert job.starts == 0
    assert calls == ["import"]
    assert result.credits_spent == 0
    assert result.thread[-1] == ("chat", "Connect Shopify in Settings before you Import.")
