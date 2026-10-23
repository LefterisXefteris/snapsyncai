**Status:** ready-for-agent

# OpenAI spend caps

## Problem Statement

One intentional act can become many OpenAI calls. An operator issue-triage loop can resend history and fat GitHub JSON. Seller Bulk SEO and ungrouped upload already fire one model call per product or photo with no hard N. Seller **listing-copy write** billing does not stop SnapSync’s model bill. We need fail-closed operator rules and product job caps without inventing a second seller meter or putting engineering language in `CONTEXT.md`.

## Solution

Ship ADR 0045 as code and tests.

1. **Issue triage script** under `scripts/issue-triage/`: `budget.py` (**BudgetGuard**), triage entrypoint, tests with an OpenAI mock. Read-only GitHub issue + label list; trim before the model; draft labels/comment to stdout or a file only. No `--apply`, no shell, no repo walk in v1. Default mock; real API only after the operator asks in chat.
2. **Product caps** in `api-py`: refuse ungrouped upload analyzes above **20** files per act; refuse Bulk SEO Start above **25** eligible primaries. No BudgetGuard on `get_openai()`.

## User Stories

1. As the operator, I want every OpenAI call from the triage script to go through BudgetGuard, so that an unguarded client cannot bypass the ceiling.
2. As the operator, I want the model id from `OPENAI_MODEL` with default `gpt-6-luna`, so that Astra is never hardcoded as `model=`.
3. As the operator, I want a hard max of 10 model turns per run, so that a loop cannot climb toward dozens of calls.
4. As the operator, I want the next call refused when the run would exceed 50k tokens or 10 calls, so that spend fails closed.
5. As the operator, I want a ceiling trip to exit non-zero with a one-line reason and no further OpenAI call, so that “finish with another try” cannot reopen the loop.
6. As the operator, I want only the last three tool results kept in full and older ones summarized in one line, so that history does not grow without bound.
7. As the operator, I want GitHub issue data trimmed to title, labels, URL, and the first 500 characters of body before the model, so that raw JSON cannot inflate the prompt.
8. As the operator, I want fixed system instructions and tool schemas at the start of the prompt and changing data at the end, so that the stable prefix can cache across steps in one run.
9. As the operator, I want tools limited to reading one issue and the repo label list, so that the script is not a coding agent.
10. As the operator, I want v1 output to be a draft only (stdout or file), so that the script cannot post comments or set labels without a later decision.
11. As the operator, I want tests to use a mock OpenAI client, so that CI never hits the real API.
12. As the operator, I want those tests to assert call count, prompt shape (prefix, trim, last-three tools), and refuse-on-ceiling, so that the rules cannot rot.
13. As the operator, I want a live run against the real API only after I ask in chat, so that a default invocation stays mock/replay.
14. As a seller, I want an ungrouped upload of more than 20 files refused (or required to group-as-one), so that one upload act cannot fire hundreds of vision calls.
15. As a seller, I want Bulk SEO Start refused when more than 25 eligible primaries are selected, so that one Start cannot fan out without bound.
16. As a seller, I want that refusal to process none of the pack, so that a silent prefix does not look like success.
17. As a seller, I want listing-copy generate, refresh, Accept, and listing-copy write rules unchanged, so that operator spend caps are not a second seller bill.
18. As a future agent, I want product `get_openai()` left unwrapped by BudgetGuard, so that seller jobs stay on N-caps and Langfuse, not the agent loop guard.

## Implementation Decisions

- ADR 0045 is the decision record. This spec is the build checklist. Do not add terms to `CONTEXT.md`.
- Code for the script lives in `scripts/issue-triage/` (`budget.py`, entrypoint, tests). Spec and issues stay under `.scratch/openai-spend-caps/`.
- BudgetGuard is the only seam that may construct or invoke the OpenAI client for this script. Callers never hold a raw client.
- Token total is the sum of prompt and completion `usage` across the run, plus a conservative estimate for the next call before it is sent when usage is unknown.
- Product caps are enforced in the existing upload and Bulk SEO start paths in `api-py`, with clear error responses. This amends the “no second product cap” stance of ADR 0016 for OpenAI fan-out only.
- Listing-copy write (ADR 0040) and Langfuse traces (ADR 0024) are unchanged.
- `--apply` and `--live` CLI flags are out of v1.

## Testing Decisions

- Script tests never call the real OpenAI or GitHub HTTP APIs.
- Required cases: eleventh model turn is refused; projected token ceiling refuses the next call; fat issue body appears in the prompt at most 500 characters; system/tool prefix precedes changing data; older tool results are one-line summaries after three full results; draft path does not call GitHub write endpoints.
- Product cap tests: upload with 21 ungrouped files is refused; Bulk SEO Start with 26 eligible primaries is refused and performs zero propose calls; 20 and 25 still run.
- Do not assert exact prompt marketing prose beyond structural rules above.

## Out of Scope

- Wrapping `api-py` `get_openai()` in BudgetGuard
- Changing seller listing-copy write price or free-write count
- Auto-posting GitHub comments or labels
- Shell, repo file tools, or a general coding agent
- Moving product model off hardcoded `gpt-5.2`
- Explaining the Oct 22 gpt-5.2 usage spike beyond caps that bound fan-out

## Further Notes

- Grilled 2026-10-23: dual control (BudgetGuard vs job caps); “54 requests” unproven from the usage chart alone (one Oct 22 8:00 PM gpt-5.2 bucket ≈ 2.2K tokens).
- Related: ADR 0016 (Bulk SEO shape; product-cap amendment), ADR 0024 (traces), ADR 0040 (listing-copy write), ADR 0042 (Conversation removed).
