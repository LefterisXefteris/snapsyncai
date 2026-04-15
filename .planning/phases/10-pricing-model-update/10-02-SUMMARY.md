---
phase: 10-pricing-model-update
plan: 02
subsystem: ui
tags: [react, typescript, stripe, subscriptions, pricing, billing, sidebar]

# Dependency graph
requires:
  - phase: 10-01
    provides: useCreateSubscriptionCheckout billingInterval param, usePaymentConfig subscriptionMonthlyPricePence + subscriptionAnnualPricePence types, and backward-compat subscriptionPricePence alias
provides:
  - app-sidebar.tsx billingInterval state and monthly/annual toggle cards in subscribe dialog
  - createSubscriptionCheckout.mutate(billingInterval) call wired to user selection
  - Home.tsx fallback credit pack prices updated to halved values (450, 1750, 3950 pence)
affects: [10-03, any UI plans showing subscription pricing or credit pack prices]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Billing interval toggle: two-button grid with border-primary/bg-primary/5 active state, data-testid billing-toggle-monthly/annual
    - Fallback price array collocated with paymentConfig nullish coalescing to ensure correct offline display

key-files:
  created: []
  modified:
    - client/src/components/app-sidebar.tsx
    - client/src/pages/Home.tsx

key-decisions:
  - "billingInterval state defaults to 'monthly' so first open shows the monthly option selected"
  - "monthlyPrice falls back to subscriptionPricePence then 900 — three-level graceful degradation via ??"
  - "annualPrice falls back to 7900 — matches SUBSCRIPTION_ANNUAL_PRICE_PENCE server constant"

patterns-established:
  - "Toggle card pattern: grid-cols-2 with per-card border-primary active class, data-testid on each option"

# Metrics
duration: 8min
completed: 2026-04-15
---

# Phase 10 Plan 02: Pricing Model Update — Sidebar UI Summary

**Monthly/annual billing interval toggle in subscribe dialog wired to Stripe checkout, with corrected Home.tsx fallback credit pack prices (450/1750/3950 pence)**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-15T00:12:00Z
- **Completed:** 2026-04-15T00:20:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Added `billingInterval` state to AppSidebar and replaced the static price card in the subscribe dialog with a two-button monthly/annual toggle
- Wired the selected billing interval directly into `createSubscriptionCheckout.mutate(billingInterval)` so the chosen plan is passed to Stripe Checkout
- Removed stale `subscriptionPrice` variable; derive `monthlyPrice` and `annualPrice` from `paymentConfig` with three-level graceful fallbacks
- Patched Home.tsx fallback credit pack prices to the new halved values (Starter 450p, Growth 1750p, Pro 3950p)

## Task Commits

Each task was committed atomically:

1. **Task 1: Update app-sidebar.tsx — billingInterval state + monthly/annual toggle in subscribe dialog** - `a71f1fd` (feat)
2. **Task 2: Update Home.tsx fallback credit pack prices** - `b3d81ab` (fix)

**Plan metadata:** (docs commit follows this summary)

## Files Created/Modified

- `client/src/components/app-sidebar.tsx` - Added billingInterval state, replaced static price card with two-button toggle grid (data-testid billing-toggle-monthly/annual), updated mutate call and button labels to reflect selected interval
- `client/src/pages/Home.tsx` - Updated fallback credit pack pricePence values from old prices (900, 3500, 7900) to halved prices (450, 1750, 3950)

## Decisions Made

- billingInterval state defaults to 'monthly' so the dialog always opens with monthly pre-selected — most common user choice
- monthlyPrice uses three-level ?? chain: subscriptionMonthlyPricePence ?? subscriptionPricePence ?? 900 — ensures correct display even if API returns the old field name
- annualPrice falls back to 7900 — matches the SUBSCRIPTION_ANNUAL_PRICE_PENCE server constant from Plan 01

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Pre-existing TypeScript errors in unrelated files (server/routes.ts Stripe Subscription type, replit_integrations, db.ts, client/src/components/review-queue-modal.tsx, shiny-button.tsx) were present before this plan executed. None introduced by our changes; none are in the two files we modified.

## User Setup Required

None - no external service configuration required for this UI plan.

## Next Phase Readiness

- Sidebar subscribe dialog now correctly passes `billingInterval` to Stripe Checkout — end-to-end monthly/annual selection is functional once STRIPE_SECRET_KEY and MIGRATION_SECRET are provisioned
- Home.tsx fallback prices are correct for the new pricing model
- Plan 10-03 (Landing.tsx) can reference `usePaymentConfig().data.subscriptionMonthlyPricePence` and `subscriptionAnnualPricePence` directly for marketing page pricing display

---
*Phase: 10-pricing-model-update*
*Completed: 2026-04-15*
