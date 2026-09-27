"""Listing-copy trace module — one model call in, one stored trace out."""

from app.services.listing_copy_trace import (
    ListingCopyCall,
    MemoryTraceStore,
    current_bulk_trace,
    current_generated_trace,
    current_refresh_trace,
    mark_bulk_accept,
    mark_generated_field,
    mark_refresh,
    record_listing_copy_call,
)


def test_generate_stores_prompt_completion_and_product_identity() -> None:
    store = MemoryTraceStore()
    recorded = record_listing_copy_call(
        store,
        ListingCopyCall(
            job="listing_copy_generate",
            messages=[
                {"role": "system", "content": "Write listing copy."},
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "Category: Tee"},
                        {
                            "type": "image_url",
                            "image_url": {"url": "data:image/jpeg;base64,AAAA-PHOTO"},
                        },
                    ],
                },
            ],
            completion='{"title": "Everyday Tee"}',
            error=None,
            model="gpt-5.2",
            latency_ms=1200,
            input_tokens=100,
            output_tokens=40,
            product_id=7,
            group_id="group-1",
        ),
    )

    assert recorded is not None
    assert recorded.job == "listing_copy_generate"
    assert recorded.prompt == "Write listing copy.\nCategory: Tee"
    assert "AAAA-PHOTO" not in recorded.prompt
    assert recorded.completion == '{"title": "Everyday Tee"}'
    assert recorded.model == "gpt-5.2"
    assert recorded.latency_ms == 1200
    assert recorded.input_tokens == 100
    assert recorded.output_tokens == 40
    assert recorded.product_id == 7
    assert recorded.group_id == "group-1"
    assert recorded.error is None
    assert store.for_product(7) == [recorded]


def _call(**overrides: object) -> ListingCopyCall:
    completion = (
        '{"title": "Everyday Tee", "description": "Soft cotton.", '
        '"seoKeywords": ["cotton", "tee"], "seoTitle": "Tee", '
        '"seoDescription": "A tee.", "aeoFaqs": [{"q": "Wash?", "a": "Cold."}]}'
    )
    values: dict = {
        "job": "listing_copy_generate",
        "messages": [{"role": "system", "content": "Write listing copy."}],
        "completion": completion,
        "error": None,
        "model": "gpt-5.2",
        "latency_ms": 10,
        "input_tokens": 1,
        "output_tokens": 1,
        "product_id": 7,
    }
    values.update(overrides)
    return ListingCopyCall(**values)


def test_field_regenerate_supersedes_only_that_field() -> None:
    store = MemoryTraceStore()
    record_listing_copy_call(store, _call())
    regenerated = record_listing_copy_call(
        store,
        _call(job="listing_copy_regenerate", field="description", completion="Crisp linen."),
    )

    assert current_generated_trace(store, 7, "description") == regenerated
    assert current_generated_trace(store, 7, "title").job == "listing_copy_generate"


class _DownStore(MemoryTraceStore):
    def add(self, trace) -> None:
        raise RuntimeError("langfuse down")


def test_a_down_store_drops_the_trace_and_still_returns() -> None:
    assert record_listing_copy_call(_DownStore(), _call()) is None


def test_a_missing_store_records_nothing() -> None:
    assert record_listing_copy_call(None, _call()) is None


def test_a_model_error_keeps_the_partial_completion() -> None:
    store = MemoryTraceStore()
    recorded = record_listing_copy_call(
        store,
        _call(
            completion="Everyday", error="Generation failed", input_tokens=None, output_tokens=None
        ),
    )
    assert recorded is not None
    assert recorded.error == "Generation failed"
    assert recorded.completion == "Everyday"
    assert recorded.input_tokens is None
    assert recorded.output_tokens is None


def test_refresh_regenerate_supersedes_the_refresh_and_leaves_generate() -> None:
    store = MemoryTraceStore()
    generated = record_listing_copy_call(store, _call())
    first = record_listing_copy_call(store, _call(job="listing_copy_refresh", completion="pack-1"))
    second = record_listing_copy_call(store, _call(job="listing_copy_refresh", completion="pack-2"))

    assert current_refresh_trace(store, 7) == second
    assert first.superseded is True
    assert current_generated_trace(store, 7, "title") == generated


def test_bulk_seo_shares_a_pack_and_regenerate_supersedes_one_product() -> None:
    store = MemoryTraceStore()
    first = record_listing_copy_call(
        store, _call(job="bulk_seo", pack_id="pack-9", completion="one")
    )
    other = record_listing_copy_call(
        store, _call(job="bulk_seo", product_id=8, pack_id="pack-9", completion="two")
    )
    again = record_listing_copy_call(
        store, _call(job="bulk_seo", pack_id="pack-9", completion="one-again")
    )

    assert first.pack_id == "pack-9"
    assert other.pack_id == "pack-9"
    assert current_bulk_trace(store, 7, "pack-9") == again
    assert current_bulk_trace(store, 8, "pack-9") == other
    assert first.superseded is True


def test_an_exact_field_accept_is_unchanged() -> None:
    store = MemoryTraceStore()
    record_listing_copy_call(store, _call())
    marked = mark_generated_field(store, product_id=7, field="title", accepted="Everyday Tee")
    assert marked is not None
    assert marked.marks["title"].outcome == "unchanged"
    assert marked.marks["title"].accepted_text is None


def test_an_edited_field_stores_the_accepted_text() -> None:
    store = MemoryTraceStore()
    record_listing_copy_call(store, _call())
    marked = mark_generated_field(store, product_id=7, field="description", accepted="Crisp linen.")
    assert marked is not None
    assert marked.marks["description"].outcome == "edited"
    assert marked.marks["description"].accepted_text == "Crisp linen."


def test_tags_match_as_a_list() -> None:
    store = MemoryTraceStore()
    record_listing_copy_call(store, _call())
    same = mark_generated_field(store, product_id=7, field="tags", accepted=["cotton", "tee"])
    assert same is not None
    assert same.marks["tags"].outcome == "unchanged"
    changed = mark_generated_field(store, product_id=7, field="tags", accepted=["linen"])
    assert changed is not None
    assert changed.marks["tags"].outcome == "edited"
    assert changed.marks["tags"].accepted_text == '["linen"]'


def test_aeo_pairs_match_when_the_seller_keeps_the_answers() -> None:
    store = MemoryTraceStore()
    record_listing_copy_call(store, _call())
    marked = mark_generated_field(
        store,
        product_id=7,
        field="aeoFaqs",
        accepted=[{"question": "Wash?", "answer": "Cold."}],
    )
    assert marked is not None
    assert marked.marks["aeoFaqs"].outcome == "unchanged"


def test_a_facts_block_that_is_not_in_the_accept_input_does_not_count_as_an_edit() -> None:
    store = MemoryTraceStore()
    record_listing_copy_call(store, _call())
    marked = mark_generated_field(store, product_id=7, field="description", accepted="Soft cotton.")
    assert marked is not None
    assert marked.marks["description"].outcome == "unchanged"


def test_an_unparsable_generate_field_is_edited_with_the_accepted_text() -> None:
    store = MemoryTraceStore()
    record_listing_copy_call(store, _call(completion="not-json"))
    marked = mark_generated_field(store, product_id=7, field="title", accepted="Everyday Tee")
    assert marked is not None
    assert marked.marks["title"].outcome == "edited"
    assert marked.marks["title"].accepted_text == "Everyday Tee"


def test_refresh_accept_and_dismiss_mark_the_current_trace() -> None:
    store = MemoryTraceStore()
    record_listing_copy_call(store, _call(job="listing_copy_refresh", completion="pack"))
    accepted = mark_refresh(store, product_id=7, outcome="accepted")
    assert accepted is not None
    assert accepted.marks["proposal"].outcome == "accepted"

    store = MemoryTraceStore()
    record_listing_copy_call(store, _call(job="listing_copy_refresh", completion="pack"))
    dismissed = mark_refresh(store, product_id=7, outcome="dismissed")
    assert dismissed is not None
    assert dismissed.marks["proposal"].outcome == "dismissed"
    assert dismissed.marks["proposal"].accepted_text is None


def test_bulk_accept_marks_that_product() -> None:
    store = MemoryTraceStore()
    record_listing_copy_call(store, _call(job="bulk_seo", pack_id="pack-9"))
    marked = mark_bulk_accept(store, product_id=7, pack_id="pack-9")
    assert marked is not None
    assert marked.marks["proposal"].outcome == "accepted"


def test_a_mark_without_a_trace_is_dropped() -> None:
    store = MemoryTraceStore()
    assert mark_generated_field(store, product_id=7, field="title", accepted="Everyday Tee") is None
    assert mark_refresh(store, product_id=7, outcome="dismissed") is None


def test_a_keyword_regenerate_is_the_current_tags_trace() -> None:
    store = MemoryTraceStore()
    record_listing_copy_call(store, _call())
    regenerated = record_listing_copy_call(
        store,
        _call(job="listing_copy_regenerate", field="seoKeywords", completion='["linen"]'),
    )
    assert current_generated_trace(store, 7, "tags") == regenerated
    marked = mark_generated_field(store, product_id=7, field="tags", accepted=["linen"])
    assert marked is not None
    assert marked.marks["tags"].outcome == "unchanged"


def test_export_sends_the_text_prompt_and_not_the_photo() -> None:
    from app.services.listing_copy_trace import export_listing_copy_trace

    class _Observation:
        def __enter__(self):
            return self

        def __exit__(self, *_args: object) -> bool:
            return False

    class _Client:
        def __init__(self) -> None:
            self.kwargs: dict | None = None

        def start_as_current_observation(self, **kwargs: object) -> _Observation:
            self.kwargs = kwargs
            return _Observation()

    store = MemoryTraceStore()
    recorded = record_listing_copy_call(
        store,
        _call(
            messages=[
                {"role": "system", "content": "Write listing copy."},
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "Category: Tee"},
                        {
                            "type": "image_url",
                            "image_url": {"url": "data:image/jpeg;base64,AAAA-PHOTO"},
                        },
                    ],
                },
            ]
        ),
    )
    client = _Client()
    assert recorded is not None
    export_listing_copy_trace(client, recorded)
    assert client.kwargs is not None
    assert client.kwargs["name"] == "listing_copy_generate"
    assert client.kwargs["input"] == "Write listing copy.\nCategory: Tee"
    assert "AAAA-PHOTO" not in str(client.kwargs["input"])
    assert client.kwargs["model"] == "gpt-5.2"
    assert client.kwargs["trace_context"] == {"trace_id": recorded.id}


def test_the_same_langfuse_keys_reuse_one_store(monkeypatch) -> None:
    from types import SimpleNamespace

    from app.services.listing_copy_trace import (
        listing_copy_trace_store,
        reset_listing_copy_trace_store,
    )

    created: list[object] = []

    class _Client:
        def __init__(self, **_kwargs: object) -> None:
            created.append(self)

    monkeypatch.setattr("langfuse.Langfuse", _Client)
    settings = SimpleNamespace(
        langfuse_public_key="pk",
        langfuse_secret_key="sk",
        langfuse_base_url="https://langfuse.example",
    )
    reset_listing_copy_trace_store()
    try:
        first = listing_copy_trace_store(settings)
        second = listing_copy_trace_store(settings)
        assert first is second
        assert len(created) == 1
    finally:
        reset_listing_copy_trace_store()


def test_missing_langfuse_keys_do_not_build_a_store() -> None:
    from types import SimpleNamespace

    from app.services.listing_copy_trace import listing_copy_trace_store

    settings = SimpleNamespace(
        langfuse_public_key=None,
        langfuse_secret_key=None,
        langfuse_base_url=None,
    )
    assert listing_copy_trace_store(settings) is None
