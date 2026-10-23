"""BudgetGuard: sole OpenAI seam for the issue-triage script (ADR 0045)."""

from __future__ import annotations

import os
from typing import Any, Protocol

DEFAULT_MODEL = "gpt-6-luna"
DEFAULT_MAX_STEPS = 10
DEFAULT_MAX_TOKENS = 50_000
# Conservative chars-per-token for pre-call projection when usage is not yet known.
_CHARS_PER_TOKEN = 4
# Reserve for unknown completion size on the next call.
_COMPLETION_RESERVE = 512
_FORBIDDEN_MODEL = "Astra"


class BudgetExceeded(Exception):
    """Fail-closed ceiling trip; message is a single-line reason."""


class _Completions(Protocol):
    def create(self, **kwargs: Any) -> Any: ...


class _Chat(Protocol):
    completions: _Completions


class _OpenAIClient(Protocol):
    chat: _Chat


def _resolve_model(explicit: str | None) -> str:
    if explicit is not None:
        model = explicit
    else:
        model = os.environ.get("OPENAI_MODEL", DEFAULT_MODEL)
    if model == _FORBIDDEN_MODEL:
        raise BudgetExceeded("Astra is not an allowed model id for this script")
    return model


def _estimate_message_tokens(messages: list[dict[str, Any]]) -> int:
    total_chars = 0
    for message in messages:
        content = message.get("content", "")
        if isinstance(content, str):
            total_chars += len(content)
        elif isinstance(content, list):
            total_chars += sum(len(str(part)) for part in content)
        else:
            total_chars += len(str(content))
    return max(1, total_chars // _CHARS_PER_TOKEN) + _COMPLETION_RESERVE


def _usage_tokens(response: Any) -> int:
    usage = getattr(response, "usage", None)
    if usage is None:
        return 0
    prompt = int(getattr(usage, "prompt_tokens", 0) or 0)
    completion = int(getattr(usage, "completion_tokens", 0) or 0)
    return prompt + completion


def _build_openai_client() -> _OpenAIClient:
    """Construct the real client — only BudgetGuard may do this."""
    from openai import OpenAI

    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise BudgetExceeded("OPENAI_API_KEY is required")
    return OpenAI(api_key=api_key)


class BudgetGuard:
    """Only construct or invoke the OpenAI client through this guard."""

    def __init__(
        self,
        *,
        client: _OpenAIClient | None = None,
        model: str | None = None,
        max_steps: int = DEFAULT_MAX_STEPS,
        max_tokens: int = DEFAULT_MAX_TOKENS,
    ) -> None:
        # Resolve model before building a client so Astra fails without HTTP.
        self.model = _resolve_model(model)
        self._client = client if client is not None else _build_openai_client()
        self.max_steps = max_steps
        self.max_tokens = max_tokens
        self._call_count = 0
        self._tokens_used = 0

    @property
    def call_count(self) -> int:
        return self._call_count

    @property
    def tokens_used(self) -> int:
        return self._tokens_used

    def complete(self, *, messages: list[dict[str, Any]], **kwargs: Any) -> Any:
        if self._call_count >= self.max_steps:
            raise BudgetExceeded(f"max_steps {self.max_steps} reached")

        estimate = _estimate_message_tokens(messages)
        projected = self._tokens_used + estimate
        if projected > self.max_tokens:
            raise BudgetExceeded(
                f"token ceiling {self.max_tokens} would be exceeded (projected {projected})"
            )

        response = self._client.chat.completions.create(
            model=self.model,
            messages=messages,
            **kwargs,
        )
        self._call_count += 1
        used = _usage_tokens(response)
        # Spec: when usage is unknown, keep the conservative pre-call estimate (fail closed).
        self._tokens_used += used if used > 0 else estimate
        return response
