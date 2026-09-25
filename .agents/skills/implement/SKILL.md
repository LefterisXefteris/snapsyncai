---
name: implement
description: "Implement a piece of work based on a spec or set of tickets."
disable-model-invocation: true
---

Implement the work described by the user in the spec or tickets.

Use /tdd where possible, at pre-agreed seams.

Run typechecking regularly, single test files regularly, and the full test suite once at the end.

Once done, use /code-review to review the work.

Before push to main, or before telling the user production has it, follow `.agents/skills/live-path/SKILL.md`. Commit to the current branch is allowed before that; shipped is not.
