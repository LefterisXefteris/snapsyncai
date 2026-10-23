"""BudgetGuard seam: ceilings, model env, fail-closed — never real OpenAI HTTP."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

import pytest
from budget import DEFAULT_MODEL, BudgetExceeded, BudgetGuard


@dataclass
class FakeUsage:
    prompt_tokens: int
    completion_tokens: int


@dataclass
class FakeMessage:
    content: str = "ok"


@dataclass
class FakeChoice:
    message: FakeMessage = field(default_factory=FakeMessage)


@dataclass
class FakeResponse:
    usage: FakeUsage
    choices: list[FakeChoice] = field(default_factory=lambda: [FakeChoice()])


class FakeCompletions:
    def __init__(self, usages: list[FakeUsage] | None = None) -> None:
        self.usages = list(usages or [FakeUsage(100, 50)])
        self.calls: list[dict[str, Any]] = []

    def create(self, **kwargs: Any) -> FakeResponse:
        self.calls.append(kwargs)
        if not self.usages:
            raise AssertionError("unexpected OpenAI call")
        usage = self.usages.pop(0)
        return FakeResponse(usage=usage)


class FakeChat:
    def __init__(self, completions: FakeCompletions) -> None:
        self.completions = completions


class FakeOpenAI:
    def __init__(self, completions: FakeCompletions) -> None:
        self.chat = FakeChat(completions)


def _guard(
    usages: list[FakeUsage] | None = None,
    **kwargs: Any,
) -> tuple[BudgetGuard, FakeCompletions]:
    completions = FakeCompletions(usages)
    guard = BudgetGuard(client=FakeOpenAI(completions), **kwargs)
    return guard, completions


def test_default_model_is_gpt_6_luna(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("OPENAI_MODEL", raising=False)
    guard, completions = _guard()
    assert guard.model == DEFAULT_MODEL
    assert DEFAULT_MODEL == "gpt-6-luna"
    guard.complete(messages=[{"role": "user", "content": "hi"}])
    assert completions.calls[0]["model"] == "gpt-6-luna"


def test_openai_model_env_sets_model(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("OPENAI_MODEL", "gpt-test-model")
    guard, completions = _guard()
    assert guard.model == "gpt-test-model"
    guard.complete(messages=[{"role": "user", "content": "hi"}])
    assert completions.calls[0]["model"] == "gpt-test-model"


def test_astra_as_model_is_refused(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("OPENAI_MODEL", "Astra")
    completions = FakeCompletions()
    with pytest.raises(BudgetExceeded, match="Astra"):
        BudgetGuard(client=FakeOpenAI(completions))
    assert completions.calls == []


def test_eleventh_model_turn_is_refused() -> None:
    usages = [FakeUsage(10, 5) for _ in range(10)]
    guard, completions = _guard(usages=usages)
    messages = [{"role": "user", "content": "hi"}]
    for _ in range(10):
        guard.complete(messages=messages)
    assert len(completions.calls) == 10
    with pytest.raises(BudgetExceeded, match="max_steps|10"):
        guard.complete(messages=messages)
    assert len(completions.calls) == 10


def test_token_ceiling_refuses_next_call_before_client() -> None:
    # First call burns most of the 50k budget; second projected call would exceed.
    guard, completions = _guard(
        usages=[FakeUsage(40_000, 9_000)],
        max_tokens=50_000,
    )
    guard.complete(messages=[{"role": "user", "content": "x" * 8000}])
    assert len(completions.calls) == 1
    with pytest.raises(BudgetExceeded, match="token|50"):
        guard.complete(messages=[{"role": "user", "content": "y" * 8000}])
    assert len(completions.calls) == 1


def test_ceiling_reason_is_one_line() -> None:
    guard, completions = _guard(usages=[FakeUsage(1, 1)], max_steps=1)
    guard.complete(messages=[{"role": "user", "content": "hi"}])
    with pytest.raises(BudgetExceeded) as exc_info:
        guard.complete(messages=[{"role": "user", "content": "again"}])
    reason = str(exc_info.value)
    assert reason
    assert "\n" not in reason
    assert len(completions.calls) == 1


def test_missing_usage_uses_estimate_not_zero() -> None:
    """Unknown usage must not fail open (spec: conservative estimate when unknown)."""

    @dataclass
    class NoUsageResponse:
        usage: None = None

    class OneShotCompletions:
        def __init__(self) -> None:
            self.calls: list[dict[str, Any]] = []

        def create(self, **kwargs: Any) -> NoUsageResponse:
            self.calls.append(kwargs)
            return NoUsageResponse()

    completions = OneShotCompletions()
    client = FakeOpenAI(completions)  # duck-typed: create returns NoUsageResponse
    guard = BudgetGuard(client=client, max_tokens=1200)
    guard.complete(messages=[{"role": "user", "content": "z" * 400}])
    assert guard.tokens_used > 0
    with pytest.raises(BudgetExceeded, match="token"):
        guard.complete(messages=[{"role": "user", "content": "z" * 4000}])
    assert len(completions.calls) == 1
