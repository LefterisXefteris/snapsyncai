"""Draft triage seam: trim, prompt shape, tool history, draft-only — no real HTTP."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from budget import BudgetGuard
from triage import (
    BODY_CHAR_LIMIT,
    SYSTEM_INSTRUCTIONS,
    TOOL_SCHEMAS,
    TOOL_RESULT_FULL_KEEP,
    RawIssue,
    ToolResult,
    build_messages,
    format_tool_history,
    run_draft,
    trim_issue,
)
from test_budget import FakeChoice, FakeCompletions, FakeMessage, FakeOpenAI, FakeResponse, FakeUsage


def test_fat_issue_body_trimmed_to_500_chars() -> None:
    raw = RawIssue(
        title="Spend caps",
        labels=["needs-triage"],
        url="https://github.com/org/repo/issues/1",
        body="B" * 800,
    )
    trimmed = trim_issue(raw)
    assert len(trimmed.body) == BODY_CHAR_LIMIT
    assert BODY_CHAR_LIMIT == 500
    assert trimmed.title == "Spend caps"
    assert trimmed.labels == ["needs-triage"]
    assert trimmed.url == "https://github.com/org/repo/issues/1"
    assert "B" * 500 == trimmed.body


def test_system_and_tools_precede_changing_data() -> None:
    trimmed = trim_issue(
        RawIssue(
            title="T",
            labels=["needs-triage"],
            url="https://example.com/1",
            body="changing body",
        )
    )
    messages, tools = build_messages(issue=trimmed, tool_history=[])
    assert tools == TOOL_SCHEMAS
    tool_names = {t["function"]["name"] for t in tools}
    assert tool_names == {"get_issue", "list_labels"}

    assert messages[0]["role"] == "system"
    system_text = messages[0]["content"]
    assert SYSTEM_INSTRUCTIONS in system_text
    # Tool schemas are part of the fixed prefix content (cacheable).
    assert "get_issue" in system_text
    assert "list_labels" in system_text

    last = messages[-1]
    assert last["role"] == "user"
    assert "changing body" in last["content"]
    assert trimmed.url in last["content"]
    assert trimmed.title in last["content"]

    serialized = "\n".join(str(m.get("content", "")) for m in messages)
    assert serialized.index(SYSTEM_INSTRUCTIONS) < serialized.index("changing body")
    assert serialized.index("get_issue") < serialized.index("changing body")


def test_older_tool_results_are_one_line_summaries() -> None:
    assert TOOL_RESULT_FULL_KEEP == 3
    results = [
        ToolResult(name="get_issue", content="full-1\nextra detail one"),
        ToolResult(name="list_labels", content="full-2\nextra detail two"),
        ToolResult(name="get_issue", content="full-3\nextra detail three"),
        ToolResult(name="list_labels", content="full-4\nextra detail four"),
        ToolResult(name="get_issue", content="full-5\nextra detail five"),
    ]
    formatted = format_tool_history(results)
    assert len(formatted) == 5
    # Oldest two are one-line summaries (name + first line only).
    assert formatted[0] == "get_issue: full-1"
    assert formatted[1] == "list_labels: full-2"
    assert "extra detail one" not in formatted[0]
    assert "extra detail two" not in formatted[1]
    # Last three kept in full.
    assert formatted[2] == "full-3\nextra detail three"
    assert formatted[3] == "full-4\nextra detail four"
    assert formatted[4] == "full-5\nextra detail five"

    trimmed = trim_issue(
        RawIssue(
            title="H",
            labels=["needs-triage"],
            url="https://example.com/2",
            body="issue-tail",
        )
    )
    messages, _tools = build_messages(issue=trimmed, tool_history=results)
    serialized = "\n".join(str(m.get("content", "")) for m in messages)
    assert "get_issue: full-1" in serialized
    assert "extra detail one" not in serialized
    assert "full-5\nextra detail five" in serialized
    assert serialized.index("get_issue: full-1") < serialized.index("issue-tail")


@dataclass
class SpyGitHub:
    """In-memory read surface; write spies must stay unused on the draft path."""

    issue: RawIssue
    repo_labels: list[str]
    reads: list[str] = field(default_factory=list)
    writes: list[str] = field(default_factory=list)

    def get_issue(self, number: int) -> RawIssue:
        self.reads.append(f"get_issue:{number}")
        return self.issue

    def list_labels(self) -> list[str]:
        self.reads.append("list_labels")
        return list(self.repo_labels)

    def create_comment(self, *_args: Any, **_kwargs: Any) -> None:
        self.writes.append("create_comment")

    def set_labels(self, *_args: Any, **_kwargs: Any) -> None:
        self.writes.append("set_labels")


def _draft_json(labels: list[str], comment: str) -> str:
    return json.dumps({"labels": labels, "comment": comment})


def test_draft_path_returns_draft_without_github_writes(tmp_path: Path) -> None:
    fat = RawIssue(
        title="Caps",
        labels=["needs-triage"],
        url="https://github.com/org/repo/issues/9",
        body="Z" * 900,
    )
    github = SpyGitHub(issue=fat, repo_labels=["needs-triage", "ready-for-agent"])
    out_file = tmp_path / "draft.json"
    draft_payload = _draft_json(["ready-for-agent"], "Looks ready.")

    completions = FakeCompletions(usages=[FakeUsage(20, 10)])
    original_create = completions.create

    def create_with_draft(**kwargs: Any) -> FakeResponse:
        response = original_create(**kwargs)
        response.choices[0].message = FakeMessage(content=draft_payload)
        return response

    completions.create = create_with_draft  # type: ignore[method-assign]
    guard = BudgetGuard(client=FakeOpenAI(completions))

    draft = run_draft(
        issue_number=9,
        github=github,
        guard=guard,
        output_path=out_file,
    )

    assert draft.labels == ["ready-for-agent"]
    assert draft.comment == "Looks ready."
    saved = json.loads(out_file.read_text(encoding="utf-8"))
    assert saved["labels"] == ["ready-for-agent"]
    assert saved["comment"] == "Looks ready."

    assert github.writes == []
    assert "get_issue:9" in github.reads
    assert len(completions.calls) == 1
    prompt_blob = json.dumps(completions.calls[0]["messages"])
    assert "Z" * 500 in prompt_blob
    assert "Z" * 501 not in prompt_blob
    assert completions.calls[0]["tools"] == TOOL_SCHEMAS


@dataclass
class _ToolCallFn:
    name: str
    arguments: str


@dataclass
class _ToolCall:
    id: str
    type: str
    function: _ToolCallFn


@dataclass
class _ToolMessage:
    content: str | None = None
    tool_calls: list[_ToolCall] | None = None


@dataclass
class _ToolChoice:
    message: _ToolMessage


@dataclass
class _ToolResponse:
    usage: FakeUsage
    choices: list[_ToolChoice]


class _TwoStepCompletions:
    """First turn: list_labels tool call; second turn: draft JSON."""

    def __init__(self) -> None:
        self.calls: list[dict[str, Any]] = []

    def create(self, **kwargs: Any) -> Any:
        self.calls.append(kwargs)
        if len(self.calls) == 1:
            return _ToolResponse(
                usage=FakeUsage(15, 5),
                choices=[
                    _ToolChoice(
                        message=_ToolMessage(
                            tool_calls=[
                                _ToolCall(
                                    id="1",
                                    type="function",
                                    function=_ToolCallFn(
                                        name="list_labels",
                                        arguments="{}",
                                    ),
                                )
                            ]
                        )
                    )
                ],
            )
        return FakeResponse(
            usage=FakeUsage(15, 5),
            choices=[
                FakeChoice(
                    message=FakeMessage(
                        content=_draft_json(["wontfix"], "Out of scope.")
                    )
                )
            ],
        )


def test_draft_path_executes_read_tools_only() -> None:
    issue = RawIssue(
        title="Tool loop",
        labels=["needs-triage"],
        url="https://github.com/org/repo/issues/3",
        body="short",
    )
    github = SpyGitHub(issue=issue, repo_labels=["needs-triage", "wontfix"])
    completions = _TwoStepCompletions()
    guard = BudgetGuard(client=FakeOpenAI(completions))

    draft = run_draft(issue_number=3, github=github, guard=guard)

    assert draft.labels == ["wontfix"]
    assert draft.comment == "Out of scope."
    assert github.writes == []
    assert "list_labels" in github.reads
    assert len(completions.calls) == 2
    second_blob = json.dumps(completions.calls[1]["messages"])
    assert "needs-triage" in second_blob or "wontfix" in second_blob


def test_get_issue_tool_stays_on_run_issue() -> None:
    issue = RawIssue(
        title="Only this",
        labels=["needs-triage"],
        url="https://github.com/org/repo/issues/7",
        body="body-7",
    )
    github = SpyGitHub(issue=issue, repo_labels=["needs-triage"])

    @dataclass
    class _Fn:
        name: str
        arguments: str

    @dataclass
    class _Call:
        id: str
        type: str
        function: _Fn

    @dataclass
    class _Msg:
        content: str | None = None
        tool_calls: list[_Call] | None = None

    @dataclass
    class _Choice:
        message: _Msg

    @dataclass
    class _Resp:
        usage: FakeUsage
        choices: list[_Choice]

    class Scripted:
        def __init__(self) -> None:
            self.calls: list[dict[str, Any]] = []

        def create(self, **kwargs: Any) -> Any:
            self.calls.append(kwargs)
            if len(self.calls) == 1:
                return _Resp(
                    usage=FakeUsage(10, 5),
                    choices=[
                        _Choice(
                            message=_Msg(
                                tool_calls=[
                                    _Call(
                                        id="1",
                                        type="function",
                                        function=_Fn(
                                            name="get_issue",
                                            arguments='{"number": 999}',
                                        ),
                                    )
                                ]
                            )
                        )
                    ],
                )
            return FakeResponse(
                usage=FakeUsage(10, 5),
                choices=[
                    FakeChoice(
                        message=FakeMessage(
                            content=_draft_json(["needs-triage"], "ok")
                        )
                    )
                ],
            )

    completions = Scripted()
    guard = BudgetGuard(client=FakeOpenAI(completions))
    run_draft(issue_number=7, github=github, guard=guard)
    assert github.reads.count("get_issue:7") >= 2
    assert "get_issue:999" not in github.reads
