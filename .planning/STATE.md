# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-31)

**Core value:** Users' data stays theirs, payments are credited exactly once, and no unauthenticated path reaches paid AI features.
**Current focus:** Phase 1 — Credit Idempotency

## Current Position

Phase: 1 of 4 (Credit Idempotency)
Plan: 0 of ? in current phase
Status: Ready to plan
Last activity: 2026-03-31 — Roadmap created; phases derived from security audit

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**
- Last 5 plans: —
- Trend: —

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Idempotency: Use `paidSessions.used` column (already in schema) — no new table needed
- Token encryption: Application-layer encryption (env var key), not pgcrypto — avoids DB migration complexity
- Instagram OAuth nonce: Store in DB (not Redis) — Vercel serverless has no shared memory
- Ownership checks: Inline guard pattern — consistent with existing `getUserId(req)` style in routes

### Pending Todos

None yet.

### Blockers/Concerns

- PAY-01 fix requires atomic read-modify-write on `paidSessions.used` — concurrent requests from verify + webhook must not both pass the check; implementation must use a single UPDATE WHERE or SELECT FOR UPDATE
- CRED-01–05 require a new `ENCRYPTION_KEY` env var to be provisioned in Vercel before Phase 3 deploys — deployment without it would break all platform connection writes

## Session Continuity

Last session: 2026-03-31
Stopped at: Roadmap written; STATE.md initialized; REQUIREMENTS.md traceability confirmed 8/8
Resume file: None
