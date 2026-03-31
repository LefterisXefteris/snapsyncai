---
phase: 01-credit-idempotency
plan: "01"
subsystem: server/storage
tags: [idempotency, payments, credits, postgresql, transactions]
dependency_graph:
  requires: []
  provides: [claimAndGrantCredits]
  affects: [server/routes.ts, Stripe webhook handler]
tech_stack:
  added: []
  patterns: [db.transaction, INSERT ON CONFLICT DO NOTHING, UPDATE WHERE RETURNING]
key_files:
  created: []
  modified:
    - server/storage.ts
decisions:
  - "Use INTEGER comparison eq(paidSessions.used, 0) not boolean — schema column is integer"
  - "INSERT ON CONFLICT DO NOTHING before the UPDATE ensures a missing paidSessions row is never silently treated as already-used"
  - "All three steps (insert, update, credit upsert) wrapped in a single db.transaction() so credit failure rolls back the claim"
metrics:
  duration: "~10 minutes"
  completed: "2026-03-31"
  tasks_completed: 1
  files_modified: 1
---

# Phase 01 Plan 01: Add claimAndGrantCredits Atomic Storage Method Summary

**One-liner:** PostgreSQL transaction-based atomic claim primitive using INSERT ON CONFLICT DO NOTHING + UPDATE WHERE used=0 RETURNING to guarantee credits are granted exactly once per Stripe checkout session.

## What Was Built

Added `claimAndGrantCredits(checkoutSessionId, userId, credits, amountPaid)` to both the `IStorage` interface and `DatabaseStorage` class in `server/storage.ts`.

The method implements the core idempotency primitive for Phase 1:

1. **INSERT ON CONFLICT DO NOTHING** — creates the `paidSessions` row if it does not yet exist (credit purchase flow never pre-creates it), while being a no-op if the row already exists.
2. **UPDATE WHERE used=0 RETURNING** — atomic claim: PostgreSQL's row-level locking means only one concurrent caller can flip `used` from 0 to 1 and receive a row back. All subsequent callers get an empty result and return `false` without granting credits.
3. **Inline credit upsert** — runs inside the same transaction. If the `userCredits` upsert throws, the entire transaction rolls back including the `paidSessions.used=1` update, preventing permanent credit loss.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add claimAndGrantCredits to IStorage and DatabaseStorage | 9a76cfc | server/storage.ts |

## Verification

- `npx tsc --noEmit` produces zero errors in `server/storage.ts`
- Pre-existing TypeScript errors in `client/`, `server/replit_integrations/`, and `server/routes.ts` are unrelated to this plan and were present before execution
- IStorage interface contains the correct method signature
- DatabaseStorage implementation uses `db.transaction()` with all three steps
- No existing methods were modified

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — no UI-facing stubs introduced. The method has no callers yet; that is intentional (Plan 01-02 will wire it into the Stripe webhook handler).

## Self-Check: PASSED

- [x] `server/storage.ts` file exists and contains `claimAndGrantCredits`
- [x] Commit `9a76cfc` exists in git log
- [x] IStorage interface updated at line 80
- [x] DatabaseStorage implementation added starting at line 330
- [x] `npx tsc --noEmit` — no errors in storage.ts
