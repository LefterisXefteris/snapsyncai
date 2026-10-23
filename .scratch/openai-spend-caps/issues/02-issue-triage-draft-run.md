# 02 — Issue-triage draft run (read-only GitHub → draft)

**Parent:** `.scratch/openai-spend-caps/spec.md`

**What to build:** Operator can run triage on one issue: trimmed GitHub fields, last-3 tool results / one-line summaries, fixed prompt prefix + changing data last, draft labels/comment only (no post). Default mock; no live API without an explicit ask.

**Blocked by:** 01 — BudgetGuard for the triage script

**Status:** done

- [x] GitHub issue data trimmed to title, labels, URL, and first 500 characters of body before the model
- [x] Fixed system instructions and tool schemas precede changing data in the prompt
- [x] Only the last three tool results kept in full; older ones are one-line summaries
- [x] Tools limited to reading one issue and the repo label list
- [x] v1 output is draft only (stdout or file); no GitHub write endpoints
- [x] Tests assert prompt shape and draft path; no real OpenAI or GitHub HTTP

## Comments

Implemented `scripts/issue-triage/triage.py` + `__main__.py` (mock fixture CLI) + `tests/test_triage.py` (6 cases). BudgetGuard remains the only OpenAI seam. No live GitHub/OpenAI HTTP in v1. `get_issue` is locked to the run’s issue number.
