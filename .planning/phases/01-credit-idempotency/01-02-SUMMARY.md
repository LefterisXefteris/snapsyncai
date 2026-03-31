---
phase: 01-credit-idempotency
plan: "02"
subsystem: payments
tags: [idempotency, payments, credits, stripe, webhook]

dependency_graph:
  requires:
    - phase: 01-credit-idempotency plan 01
      provides: claimAndGrantCredits atomic storage method
  provides:
    - Idempotent POST /api/credits/verify endpoint
    - Idempotent checkout.session.completed webhook handler
  affects: [payments, credits, stripe-webhook]

tech_stack:
  added: []
  patterns: [claimAndGrantCredits call site pattern, idempotent 200-always response]

key_files:
  created: []
  modified:
    - server/routes.ts
    - server/webhookHandlers.ts

key_decisions:
  - "Both verify and webhook return 200 on duplicate calls — fully idempotent, no error surfaced to client or Stripe"
  - "No logging on duplicate calls — per locked D-01 decision; webhook logs only when granted=true"
  - "amountPaid sourced from session.amount_total (routes) and data.amount_total (webhook), both with ?? 0 fallback"

patterns-established:
  - "Idempotent endpoint pattern: call claimAndGrantCredits, read balance, return 200 always"
  - "Webhook idempotency: only log when granted=true, silently return on duplicate"

requirements-completed: [PAY-01]

metrics:
  duration: "~15 minutes"
  completed: "2026-03-31"
  tasks_completed: 3
  files_modified: 2
---

# Phase 01 Plan 02: Wire claimAndGrantCredits into Both Payment Paths Summary

**Both Stripe payment paths (POST /api/credits/verify and checkout.session.completed webhook) now use claimAndGrantCredits, eliminating the double-grant bug via atomic PostgreSQL locking.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-31T12:15:00Z
- **Completed:** 2026-03-31T12:32:33Z
- **Tasks:** 3 (2 auto + 1 checkpoint:human-verify, approved)
- **Files modified:** 2

## Accomplishments

- Replaced `storage.addCredits()` in `POST /api/credits/verify` with `storage.claimAndGrantCredits()` — endpoint now returns `{ verified: true, credits, balance }` on both first and duplicate calls
- Replaced `storage.addCredits()` in the `checkout.session.completed` webhook block with `storage.claimAndGrantCredits()` — webhook returns 200 to Stripe on duplicates without granting credits a second time
- Full idempotency chain complete: either path can run first, the other becomes a no-op; concurrent callers are serialized by PostgreSQL row-level locking in the storage layer

## Task Commits

1. **Task 1: Make verify endpoint idempotent (routes.ts)** - `86ec107` (feat)
2. **Task 2: Make webhook handler idempotent (webhookHandlers.ts)** - `5293e3b` (feat)
3. **Task 3: Verify full idempotency fix is correct** - checkpoint:human-verify, approved by user

**Plan metadata:** (this commit)

## Files Created/Modified

- `server/routes.ts` - POST /api/credits/verify now calls claimAndGrantCredits; response is always 200 with { verified, credits, balance }
- `server/webhookHandlers.ts` - checkout.session.completed handler calls claimAndGrantCredits; logs only when granted=true

## Decisions Made

- Both paths return 200 on duplicates (no client-facing or Stripe-facing error) — per locked D-01 decision from planning
- Duplicate verify calls produce no console.log (removed); duplicate webhook events produce no console.log (conditional on granted)
- `amountPaid` passed as `session.amount_total ?? 0` in routes and `(data.amount_total as number | null) ?? 0` in webhook

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — both call sites are fully wired to the storage primitive. No placeholder or hardcoded values introduced.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- PAY-01 requirement fully satisfied: credits are granted exactly once per Stripe checkout session regardless of which path fires first or how many times each is called
- Phase 1 (Credit Idempotency) complete — both plans done
- Ready to proceed to Phase 2 when planned

## Self-Check: PASSED

- [x] `server/routes.ts` modified — claimAndGrantCredits wired in verify endpoint
- [x] `server/webhookHandlers.ts` modified — claimAndGrantCredits wired in webhook handler
- [x] Commit `86ec107` exists (Task 1)
- [x] Commit `5293e3b` exists (Task 2)
- [x] Task 3 checkpoint approved by user
- [x] `npx tsc --noEmit` — no errors (verified at checkpoint)
