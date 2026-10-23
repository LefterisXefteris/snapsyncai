"""Read-only issue triage: trim, prompt shape, draft labels/comment (ADR 0045)."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Protocol

from budget import BudgetGuard

BODY_CHAR_LIMIT = 500
TOOL_RESULT_FULL_KEEP = 3

# Fixed prefix — must precede changing data so the stable portion can cache.
SYSTEM_INSTRUCTIONS = (
    "You triage one GitHub issue for SnapSync operators. "
    "Suggest draft labels and a draft comment only. "
    "Do not claim to post or apply anything. "
    "Use only the provided tools: get_issue and list_labels."
)

TOOL_SCHEMAS: list[dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "get_issue",
            "description": "Read the single GitHub issue under triage (trimmed fields).",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_labels",
            "description": "List repository labels available for triage.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
]

ALLOWED_TOOL_NAMES = frozenset({"get_issue", "list_labels"})


@dataclass(frozen=True)
class RawIssue:
    title: str
    labels: list[str]
    url: str
    body: str


@dataclass(frozen=True)
class TrimmedIssue:
    title: str
    labels: list[str]
    url: str
    body: str


@dataclass(frozen=True)
class Draft:
    labels: list[str]
    comment: str


@dataclass(frozen=True)
class ToolResult:
    name: str
    content: str


class GitHubRead(Protocol):
    """Read-only GitHub surface for v1 — no write endpoints."""

    def get_issue(self, number: int) -> RawIssue: ...

    def list_labels(self) -> list[str]: ...


def trim_issue(raw: RawIssue) -> TrimmedIssue:
    return TrimmedIssue(
        title=raw.title,
        labels=list(raw.labels),
        url=raw.url,
        body=raw.body[:BODY_CHAR_LIMIT],
    )


def _fixed_system_content() -> str:
    schemas = json.dumps(TOOL_SCHEMAS, separators=(",", ":"))
    return f"{SYSTEM_INSTRUCTIONS}\n\nTool schemas:\n{schemas}"


def _issue_user_content(issue: TrimmedIssue) -> str:
    labels = ", ".join(issue.labels)
    return (
        f"Issue title: {issue.title}\n"
        f"Labels: {labels}\n"
        f"URL: {issue.url}\n"
        f"Body:\n{issue.body}"
    )


def build_messages(
    *,
    issue: TrimmedIssue,
    tool_history: list[ToolResult],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Fixed system + tool schemas first; changing issue (and history) last."""
    messages: list[dict[str, Any]] = [
        {"role": "system", "content": _fixed_system_content()},
    ]
    # Tool history sits between fixed prefix and the latest changing issue payload
    # so the issue fields remain last (cache-friendly prefix).
    for entry in format_tool_history(tool_history):
        messages.append({"role": "tool", "content": entry})
    messages.append({"role": "user", "content": _issue_user_content(issue)})
    return messages, list(TOOL_SCHEMAS)


def format_tool_history(
    results: list[ToolResult],
    *,
    keep_full: int = TOOL_RESULT_FULL_KEEP,
) -> list[str]:
    """Last `keep_full` results in full; older ones become one-line summaries."""
    if not results:
        return []
    out: list[str] = []
    cutoff = max(0, len(results) - keep_full)
    for i, result in enumerate(results):
        if i < cutoff:
            first_line = result.content.splitlines()[0] if result.content else ""
            out.append(f"{result.name}: {first_line}")
        else:
            out.append(result.content)
    return out


def _parse_draft(content: str) -> Draft:
    data = json.loads(content)
    labels = data.get("labels") or []
    if not isinstance(labels, list):
        raise ValueError("draft labels must be a list")
    comment = data.get("comment") or ""
    if not isinstance(comment, str):
        raise ValueError("draft comment must be a string")
    return Draft(labels=[str(x) for x in labels], comment=comment)


def _tool_calls_from_response(response: Any) -> list[Any]:
    choices = getattr(response, "choices", None) or []
    if not choices:
        return []
    message = getattr(choices[0], "message", None)
    if message is None:
        return []
    return list(getattr(message, "tool_calls", None) or [])


def _message_content(response: Any) -> str:
    choices = getattr(response, "choices", None) or []
    if not choices:
        return ""
    message = getattr(choices[0], "message", None)
    if message is None:
        return ""
    content = getattr(message, "content", None)
    return content if isinstance(content, str) else ""


def _execute_tool(
    *,
    name: str,
    arguments: str,
    github: GitHubRead,
    issue_number: int,
) -> ToolResult:
    if name not in ALLOWED_TOOL_NAMES:
        return ToolResult(name=name, content=f"refused: tool {name!r} is not allowed")
    if name == "list_labels":
        labels = github.list_labels()
        return ToolResult(name=name, content=json.dumps(labels))
    # get_issue — always the issue under triage (one-issue tool surface).
    raw = github.get_issue(issue_number)
    trimmed = trim_issue(raw)
    payload = {
        "title": trimmed.title,
        "labels": trimmed.labels,
        "url": trimmed.url,
        "body": trimmed.body,
    }
    return ToolResult(name=name, content=json.dumps(payload))


def run_draft(
    *,
    issue_number: int,
    github: GitHubRead,
    guard: BudgetGuard,
    output_path: Path | None = None,
) -> Draft:
    """Run a draft-only triage loop. Never posts comments or sets labels."""
    raw = github.get_issue(issue_number)
    issue = trim_issue(raw)
    tool_history: list[ToolResult] = []

    while True:
        messages, tools = build_messages(issue=issue, tool_history=tool_history)
        response = guard.complete(messages=messages, tools=tools)
        tool_calls = _tool_calls_from_response(response)
        if tool_calls:
            for call in tool_calls:
                fn = getattr(call, "function", None)
                name = getattr(fn, "name", "") if fn is not None else ""
                arguments = getattr(fn, "arguments", "{}") if fn is not None else "{}"
                tool_history.append(
                    _execute_tool(
                        name=name,
                        arguments=arguments or "{}",
                        github=github,
                        issue_number=issue_number,
                    )
                )
            continue

        content = _message_content(response)
        draft = _parse_draft(content)
        if output_path is not None:
            output_path.write_text(
                json.dumps(
                    {"labels": draft.labels, "comment": draft.comment},
                    indent=2,
                )
                + "\n",
                encoding="utf-8",
            )
        return draft
