---
phase: 10-pricing-model-update
plan: 02
subsystem: ui
tags: [react, stripe, payments, typescript, subscription]

# Dependency graph
requires:
  - phase: 10-pricing-model-update plan 01
    provides: server-side weekly/annual pricing model, /api/payments/config returning subscriptionWeeklyPricePence + weeklyProductLimit
provides:
  - Client fully purged of credits system — no hooks, no UI, no copy
  - use-images.ts usePaymentConfig typed to weekly pricing shape
  - useCreateSubscriptionCheckout accepts 'weekly' | 'annual'
  - app-sidebar.tsx weekly/annual toggle with billing-toggle-weekly data-testid
  - Home.tsx with no credits imports, state, URL handlers, or dialogs
  - Landing.tsx with no CREDIT_PACKS array, no credits FAQ, no credits copy
affects: [10-03-plan, 10-04-plan]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Delete-only migration: remove credit hooks, state, and UI entirely rather than conditionally hiding"
    - "Weekly pricing default: billingInterval state defaults to 'weekly' in sidebar"

key-files:
  created: []
  modified:
    - client/src/hooks/use-images.ts
    - client/src/pages/Home.tsx
    - client/src/components/app-sidebar.tsx
    - client/src/pages/Landing.tsx

key-decisions:
  - "billingInterval defaults to 'weekly' in useCreateSubscriptionCheckout mutationFn — breaking change from 'monthly' was intentional as credits are fully removed"
  - "Three-level fallback removed: weeklyPrice uses simple (subscriptionWeeklyPricePence ?? 400) / 100 since backward compat alias no longer needed"

patterns-established:
  - "Subscription-only UI: all credits UI deleted, no conditional rendering — simpler and safer"

requirements-completed: []

# Metrics
duration: 30min
completed: 2026-04-27
---

# Phase 10 Plan 02: Client Credits Purge Summary

**Deleted all credits code from the React client — hooks, Home.tsx state/UI/dialogs, Landing.tsx copy/FAQ — and updated sidebar + use-images.ts to weekly/annual subscription pricing**

## Performance

- **Duration:** ~30 min (includes verification of prior partial work)
- **Started:** 2026-04-27T00:00:00Z
- **Completed:** 2026-04-27T00:30:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Deleted `useCreditsBalance`, `usePurchaseCredits`, `useVerifyCredits` from `use-images.ts`; `usePaymentConfig` now returns `subscriptionWeeklyPricePence + weeklyProductLimit` shape
- Purged all credits imports, state, URL param handlers, credit balance display, unanalyzed items banner, and Pricing/Credits dialog from `Home.tsx`
- Updated `app-sidebar.tsx` to `'weekly' | 'annual'` billing toggle with `billing-toggle-weekly` data-testid and `£4/wk` display
- Removed `CREDIT_PACKS` array, "How do credits work?" FAQ entry, and all credits copy from `Landing.tsx`

## Task Commits

Each task was committed atomically:

1. **Task 1: Delete credit hooks, update payment config type and checkout hook** - `a40b1c9` (feat)
2. **Task 2: Purge credits from Home.tsx, update sidebar to weekly pricing, purge credits from Landing.tsx** - `0a9b8bc` (feat)

## Files Created/Modified
- `client/src/hooks/use-images.ts` - Removed 3 credit hooks (~53 lines), updated usePaymentConfig return type to weekly shape, updated useCreateSubscriptionCheckout to `'weekly' | 'annual'`
- `client/src/pages/Home.tsx` - Removed credit imports, state variables, URL param handler, credit balance sidebar footer, unanalyzed items banner (~60 lines deleted)
- `client/src/components/app-sidebar.tsx` - Changed billingInterval type to `'weekly' | 'annual'`, price derivation to weeklyPrice, all display labels and data-testids updated to weekly
- `client/src/pages/Landing.tsx` - Removed CREDIT_PACKS array (37 lines), removed credits FAQ entry, updated FAQ answers removing "buy credits" references

## Decisions Made
- `billingInterval` defaults to `'weekly'` (breaking from prior `'monthly'` default) — intentional since credits are fully removed and weekly is the primary offering
- Simple `?? 400` fallback for weeklyPrice instead of three-level chain — backward compat alias no longer needed post-purge

## Deviations from Plan

None - plan executed exactly as written. Task 1 was already committed before this execution session began (`a40b1c9`). Task 2 changes were staged as uncommitted working-tree diffs, committed in this session.

## Issues Encountered
- Plan noted that some 10-02 work was already committed. Confirmed via git log that `a40b1c9` covered Task 1 entirely. Task 2 changes (Home.tsx + Landing.tsx) were in the working tree as uncommitted diffs — committed in this session as `0a9b8bc`.
- Pre-existing TypeScript errors in `server/replit_integrations/` and Stripe type mismatches are unrelated to this plan and were present before execution.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Client is fully subscription-only — no credits code anywhere in `client/src/`
- Plan 10-03 can proceed: it handles server-side Stripe webhook and subscription verification for the new weekly product limit enforcement
- No blockers

---
*Phase: 10-pricing-model-update*
*Completed: 2026-04-27*
