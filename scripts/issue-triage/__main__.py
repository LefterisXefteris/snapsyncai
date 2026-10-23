"""CLI entry for draft-only issue triage. Default is mock — no live HTTP in v1."""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from budget import BudgetExceeded, BudgetGuard
from triage import Draft, RawIssue, run_draft


@dataclass
class MockGitHub:
    issue: RawIssue
    repo_labels: list[str]

    def get_issue(self, number: int) -> RawIssue:
        return self.issue

    def list_labels(self) -> list[str]:
        return list(self.repo_labels)


class _MockCompletions:
    def __init__(self, draft: Draft) -> None:
        self._content = json.dumps({"labels": draft.labels, "comment": draft.comment})
        self.calls: list[dict[str, Any]] = []

    def create(self, **kwargs: Any) -> Any:
        self.calls.append(kwargs)

        class _Usage:
            prompt_tokens = 10
            completion_tokens = 10

        class _Msg:
            content = self._content
            tool_calls = None

        class _Choice:
            message = _Msg()

        class _Resp:
            usage = _Usage()
            choices = [_Choice()]

        return _Resp()


class _MockChat:
    def __init__(self, completions: _MockCompletions) -> None:
        self.completions = completions


class _MockClient:
    def __init__(self, completions: _MockCompletions) -> None:
        self.chat = _MockChat(completions)


def _load_fixture(path: Path) -> tuple[RawIssue, list[str]]:
    data = json.loads(path.read_text(encoding="utf-8"))
    issue = RawIssue(
        title=data["title"],
        labels=list(data.get("labels") or []),
        url=data["url"],
        body=data.get("body") or "",
    )
    repo_labels = list(data.get("repo_labels") or issue.labels)
    return issue, repo_labels


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Draft GitHub issue triage (mock OpenAI/GitHub; no writes).",
    )
    parser.add_argument("issue_number", type=int)
    parser.add_argument(
        "--fixture",
        type=Path,
        required=True,
        help="JSON fixture with title, labels, url, body, optional repo_labels",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=None,
        help="Write draft JSON to this file (also printed to stdout)",
    )
    args = parser.parse_args(argv)

    issue, repo_labels = _load_fixture(args.fixture)
    canned = Draft(
        labels=["needs-triage"],
        comment="Mock draft — live OpenAI/GitHub is out of v1.",
    )
    completions = _MockCompletions(canned)
    guard = BudgetGuard(client=_MockClient(completions))
    github = MockGitHub(issue=issue, repo_labels=repo_labels)

    try:
        draft = run_draft(
            issue_number=args.issue_number,
            github=github,
            guard=guard,
            output_path=args.output,
        )
    except BudgetExceeded as exc:
        print(str(exc), file=sys.stderr)
        return 1

    print(json.dumps({"labels": draft.labels, "comment": draft.comment}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
