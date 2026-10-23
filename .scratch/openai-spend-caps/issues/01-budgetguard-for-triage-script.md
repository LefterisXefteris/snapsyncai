# 01 — BudgetGuard for the triage script

**Parent:** `.scratch/openai-spend-caps/spec.md`

**What to build:** Every OpenAI call from the future triage path must go through BudgetGuard: model from `OPENAI_MODEL` (default `gpt-6-luna`, never Astra), hard kill at 10 model turns or 50k tokens, fail closed with a one-line reason, mock-only in tests.

**Blocked by:** None — can start immediately.

**Status:** done

- [x] BudgetGuard is the only seam that may construct or invoke the OpenAI client for this script
- [x] Model id comes from `OPENAI_MODEL`, default `gpt-6-luna`; `Astra` is refused as `model=`
- [x] Eleventh model turn is refused before any client call
- [x] Next call is refused when projected run tokens would exceed 50k
- [x] Ceiling trip raises/returns a one-line reason; no further OpenAI call
- [x] Tests use an injected mock client (never real OpenAI HTTP)

## Comments

Implemented `scripts/issue-triage/budget.py` + `tests/test_budget.py` (6 passed). Entry/orchestration is ticket 02.
