"""Listing-copy traces. Callers pass a store; Langfuse is one store, tests use memory."""

from __future__ import annotations

import json
import logging
import uuid
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from typing import Any, Protocol

logger = logging.getLogger(__name__)

JOB_GENERATE = "listing_copy_generate"
JOB_REGENERATE = "listing_copy_regenerate"
JOB_REFRESH = "listing_copy_refresh"
JOB_BULK = "bulk_seo"


@dataclass
class ListingCopyCall:
    job: str
    messages: list
    completion: str | None
    error: str | None
    model: str
    latency_ms: int | None
    input_tokens: int | None
    output_tokens: int | None
    product_id: int
    group_id: str | None = None
    field: str | None = None
    pack_id: str | None = None


@dataclass
class FieldMark:
    outcome: str
    accepted_text: str | None = None


@dataclass
class StoredTrace:
    id: str
    job: str
    prompt: str
    completion: str | None
    error: str | None
    model: str
    latency_ms: int | None
    input_tokens: int | None
    output_tokens: int | None
    product_id: int
    group_id: str | None
    field: str | None
    pack_id: str | None
    superseded: bool = False
    superseded_fields: frozenset[str] = field(default_factory=frozenset)
    marks: dict[str, FieldMark] = field(default_factory=dict)


class TraceStore(Protocol):
    def add(self, trace: StoredTrace) -> None: ...

    def replace(self, trace: StoredTrace) -> None: ...

    def for_product(self, product_id: int) -> list[StoredTrace]: ...

    def get(self, trace_id: str) -> StoredTrace | None: ...


class MemoryTraceStore:
    def __init__(self) -> None:
        self._traces: list[StoredTrace] = []

    def add(self, trace: StoredTrace) -> None:
        self._traces.append(trace)

    def replace(self, trace: StoredTrace) -> None:
        self._traces = [trace if item.id == trace.id else item for item in self._traces]

    def for_product(self, product_id: int) -> list[StoredTrace]:
        return [item for item in self._traces if item.product_id == product_id]

    def get(self, trace_id: str) -> StoredTrace | None:
        for item in self._traces:
            if item.id == trace_id:
                return item
        return None


def record_listing_copy_call(store: TraceStore | None, call: ListingCopyCall) -> StoredTrace | None:
    if store is None:
        return None
    try:
        return _record(store, call)
    except Exception:
        logger.exception("listing copy trace export failed")
        return None


def mark_generated_field(
    store: TraceStore | None,
    *,
    product_id: int,
    field: str,
    accepted: Any,
    trace_id: str | None = None,
) -> StoredTrace | None:
    if store is None:
        return None
    try:
        field_name = _canonical_field(field)
        trace = (
            _stored(store, trace_id)
            if trace_id
            else current_generated_trace(store, product_id, field_name)
        )
        if trace is None:
            return None
        model_value = _model_field(trace, field_name)
        if _same(field_name, model_value, accepted):
            trace.marks[field_name] = FieldMark("unchanged")
        else:
            trace.marks[field_name] = FieldMark("edited", _accepted_text(accepted))
        store.replace(trace)
        return trace
    except Exception:
        logger.exception("listing copy trace export failed")
        return None


def mark_refresh(
    store: TraceStore | None,
    *,
    product_id: int,
    outcome: str,
    trace_id: str | None = None,
) -> StoredTrace | None:
    if store is None:
        return None
    try:
        trace = _stored(store, trace_id) if trace_id else current_refresh_trace(store, product_id)
        if trace is None:
            return None
        trace.marks["proposal"] = FieldMark(outcome)
        store.replace(trace)
        return trace
    except Exception:
        logger.exception("listing copy trace export failed")
        return None


def mark_bulk_accept(
    store: TraceStore | None,
    *,
    product_id: int,
    pack_id: str,
    trace_id: str | None = None,
) -> StoredTrace | None:
    if store is None:
        return None
    try:
        trace = (
            _stored(store, trace_id) if trace_id else current_bulk_trace(store, product_id, pack_id)
        )
        if trace is None:
            return None
        trace.marks["proposal"] = FieldMark("accepted")
        store.replace(trace)
        return trace
    except Exception:
        logger.exception("listing copy trace export failed")
        return None


def current_generated_trace(
    store: TraceStore, product_id: int, field_name: str
) -> StoredTrace | None:
    wanted = _canonical_field(field_name)
    found: StoredTrace | None = None
    for trace in store.for_product(product_id):
        if trace.job == JOB_REGENERATE and trace.field == wanted and not trace.superseded:
            found = trace
        elif (
            trace.job == JOB_GENERATE
            and wanted not in trace.superseded_fields
            and not trace.superseded
        ):
            found = trace
    return found


def current_refresh_trace(store: TraceStore, product_id: int) -> StoredTrace | None:
    found: StoredTrace | None = None
    for trace in store.for_product(product_id):
        if trace.job == JOB_REFRESH and not trace.superseded:
            found = trace
    return found


def current_bulk_trace(store: TraceStore, product_id: int, pack_id: str) -> StoredTrace | None:
    found: StoredTrace | None = None
    for trace in store.for_product(product_id):
        if trace.job == JOB_BULK and trace.pack_id == pack_id and not trace.superseded:
            found = trace
    return found


def _record(store: TraceStore, call: ListingCopyCall) -> StoredTrace:
    trace = StoredTrace(
        id=uuid.uuid4().hex,
        job=call.job,
        prompt=_prompt_text(call.messages),
        completion=call.completion,
        error=call.error,
        model=call.model,
        latency_ms=call.latency_ms,
        input_tokens=call.input_tokens,
        output_tokens=call.output_tokens,
        product_id=call.product_id,
        group_id=call.group_id,
        field=_canonical_field(call.field) if call.field else None,
        pack_id=call.pack_id,
    )
    _supersede_previous(store, trace)
    store.add(trace)
    return trace


def _supersede_previous(store: TraceStore, trace: StoredTrace) -> None:
    previous: StoredTrace | None = None
    if trace.job == JOB_REGENERATE and trace.field:
        previous = current_generated_trace(store, trace.product_id, trace.field)
        if previous is not None and previous.job == JOB_GENERATE:
            previous.superseded_fields = previous.superseded_fields | {trace.field}
            store.replace(previous)
            return
    elif trace.job == JOB_REFRESH:
        previous = current_refresh_trace(store, trace.product_id)
    elif trace.job == JOB_BULK and trace.pack_id:
        previous = current_bulk_trace(store, trace.product_id, trace.pack_id)
    if previous is None:
        return
    previous.superseded = True
    store.replace(previous)


def _canonical_field(name: str) -> str:
    if name == "seoKeywords":
        return "tags"
    return name


def _model_field(trace: StoredTrace, field_name: str) -> Any:
    if trace.job == JOB_REGENERATE:
        if field_name in ("tags", "aeoFaqs"):
            return _json_or_none(trace.completion)
        return trace.completion
    parsed = _json_or_none(trace.completion)
    if not isinstance(parsed, dict):
        return None
    key = "seoKeywords" if field_name == "tags" else field_name
    return parsed.get(key)


def _json_or_none(text: str | None) -> Any:
    try:
        return json.loads(text or "")
    except json.JSONDecodeError:
        return None


def _same(field_name: str, model_value: Any, accepted: Any) -> bool:
    if field_name == "tags":
        return isinstance(model_value, list) and model_value == accepted
    if field_name == "aeoFaqs":
        return _faq_pairs(model_value) == _faq_pairs(accepted) and _faq_pairs(accepted) is not None
    return isinstance(model_value, str) and model_value == accepted


def _faq_pairs(value: Any) -> list[tuple[str, str]] | None:
    if not isinstance(value, list):
        return None
    pairs: list[tuple[str, str]] = []
    for item in value:
        if not isinstance(item, Mapping):
            return None
        question = item.get("q", item.get("question"))
        answer = item.get("a", item.get("answer"))
        if not isinstance(question, str) or not isinstance(answer, str):
            return None
        pairs.append((question, answer))
    return pairs


def _accepted_text(accepted: Any) -> str:
    if isinstance(accepted, str):
        return accepted
    return json.dumps(accepted)


def _stored(store: TraceStore, trace_id: str) -> StoredTrace | None:
    return store.get(trace_id)


def _prompt_text(messages: Sequence[Mapping[str, Any]]) -> str:
    parts: list[str] = []
    for message in messages:
        content = message.get("content")
        if isinstance(content, str):
            parts.append(content)
        elif isinstance(content, list):
            for block in content:
                if isinstance(block, Mapping) and block.get("type") == "text":
                    parts.append(str(block.get("text") or ""))
    return "\n".join(parts)


def export_listing_copy_trace(client: Any, trace: StoredTrace) -> None:
    metadata = {
        key: value
        for key, value in {
            "product_id": trace.product_id,
            "group_id": trace.group_id,
            "field": trace.field,
            "pack_id": trace.pack_id,
            "latency_ms": trace.latency_ms,
        }.items()
        if value is not None
    }
    usage: dict[str, int] = {}
    if trace.input_tokens is not None:
        usage["prompt_tokens"] = trace.input_tokens
    if trace.output_tokens is not None:
        usage["completion_tokens"] = trace.output_tokens
    kwargs: dict[str, Any] = {
        "as_type": "generation",
        "name": trace.job,
        "input": trace.prompt,
        "output": trace.completion,
        "model": trace.model,
        "metadata": metadata,
        "level": "ERROR" if trace.error else "DEFAULT",
        "status_message": trace.error,
        "trace_context": {"trace_id": trace.id},
    }
    if usage:
        kwargs["usage_details"] = usage
    with client.start_as_current_observation(**kwargs):
        return None


def export_listing_copy_marks(client: Any, trace: StoredTrace) -> None:
    for name, mark in trace.marks.items():
        client.create_score(
            trace_id=trace.id,
            name=f"listing_copy_{name}",
            value=mark.outcome,
            data_type="CATEGORICAL",
            comment=mark.accepted_text,
            score_id=f"{trace.id}-{name}",
        )


class LangfuseTraceStore:
    """In-process index plus a Langfuse export. A restart drops marks, not the need to list."""

    def __init__(self, client: Any) -> None:
        self._client = client
        self._memory = MemoryTraceStore()

    def add(self, trace: StoredTrace) -> None:
        from contextlib import nullcontext

        from langfuse import propagate_attributes

        session = propagate_attributes(session_id=trace.pack_id) if trace.pack_id else nullcontext()
        with session:
            export_listing_copy_trace(self._client, trace)
        self._memory.add(trace)

    def replace(self, trace: StoredTrace) -> None:
        export_listing_copy_marks(self._client, trace)
        self._memory.replace(trace)

    def for_product(self, product_id: int) -> list[StoredTrace]:
        return self._memory.for_product(product_id)

    def get(self, trace_id: str) -> StoredTrace | None:
        return self._memory.get(trace_id)


def listing_copy_trace_store(settings: Any) -> TraceStore | None:
    global _cached_store, _cached_key
    public = getattr(settings, "langfuse_public_key", None)
    secret = getattr(settings, "langfuse_secret_key", None)
    base_url = getattr(settings, "langfuse_base_url", None)
    if not public or not secret or not base_url:
        return None
    key = (str(public), str(secret), str(base_url))
    if _cached_store is not None and _cached_key == key:
        return _cached_store
    from langfuse import Langfuse

    _cached_store = LangfuseTraceStore(
        Langfuse(public_key=public, secret_key=secret, base_url=base_url)
    )
    _cached_key = key
    return _cached_store


_cached_store: LangfuseTraceStore | None = None
_cached_key: tuple[str, str, str] | None = None


def reset_listing_copy_trace_store() -> None:
    global _cached_store, _cached_key
    _cached_store = None
    _cached_key = None
