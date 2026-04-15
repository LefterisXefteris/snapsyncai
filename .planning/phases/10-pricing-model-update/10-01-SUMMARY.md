---
phase: 10-pricing-model-update
plan: 01
subsystem: payments
tags: [stripe, typescript, react-query, subscriptions, pricing, billing]

# Dependency graph
requires:
  - phase: 01-credit-idempotency
    provides: subscription storage layer and Stripe client infrastructure
provides:
  - SUBSCRIPTION_MONTHLY_PRICE_PENCE = 900 and SUBSCRIPTION_ANNUAL_PRICE_PENCE = 7900 server constants
  - getOrCreateMonthlySubscriptionPriceId and getOrCreateAnnualSubscriptionPriceId helpers
  - create-checkout endpoint routing by billingInterval param
  - /api/payments/config returns both monthly and annual price fields
  - POST /api/subscription/migrate-to-new-price admin endpoint (MIGRATION_SECRET protected)
  - POST /api/subscription/archive-old-price admin endpoint (MIGRATION_SECRET protected)
  - getAllActiveSubscriptions() in IStorage and DatabaseStorage
  - useCreateSubscriptionCheckout accepts billingInterval: 'monthly' | 'annual'
  - usePaymentConfig typed with subscriptionMonthlyPricePence + subscriptionAnnualPricePence
affects: [10-02, 10-03, any UI plans wiring up subscription checkout or pricing display]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Dual Stripe price helper pattern: separate cached functions per billing interval, lazy-create on same product
    - MIGRATION_SECRET guard: env var checked before any admin mutation, 403 on mismatch
    - Backward-compat alias: subscriptionPricePence kept alongside new named fields in config response

key-files:
  created: []
  modified:
    - server/routes.ts
    - server/storage.ts
    - client/src/hooks/use-images.ts

key-decisions:
  - "billingInterval defaults to 'monthly' in mutationFn — zero breaking change for existing callers"
  - "Annual price uses same Stripe product (metadata.type = 'monthly_subscription') with interval: year — no new product needed"
  - "migrate-to-new-price is idempotent: skips any sub not on OLD_PRICE_PENCE = 1900, safe to run multiple times"
  - "subscriptionPricePence kept as backward-compat alias in config response to avoid breaking callers not yet updated"

patterns-established:
  - "Dual price cache vars (cachedMonthlyPriceId / cachedAnnualPriceId) pattern for per-interval price ID caching"
  - "MIGRATION_SECRET env var guard on admin mutation endpoints"

# Metrics
duration: 12min
completed: 2026-04-15
---

# Phase 10 Plan 01: Pricing Model Update — Server Foundation Summary

**£9/month + £79/year dual billing with halved credit pack prices, MIGRATION_SECRET-protected subscriber migration and price archive endpoints, and billingInterval-aware checkout hook**

## Performance

- **Duration:** 12 min
- **Started:** 2026-04-15T00:00:00Z
- **Completed:** 2026-04-15T00:12:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Replaced single £19/month subscription constant with separate monthly (£9) and annual (£79) constants and lazy-create Stripe price helpers
- Halved all credit pack prices: Starter 450p, Growth 1750p, Pro 3950p
- Added admin migration + archive endpoints protected by MIGRATION_SECRET env var, with getAllActiveSubscriptions() storage method to drive the migration loop
- Updated client checkout hook and payment config types for dual billing interval support

## Task Commits

Each task was committed atomically:

1. **Task 1: Update server/routes.ts — price constants, dual helpers, checkout, config, migration, archive endpoints** - `0006a4e` (feat)
2. **Task 2: Update client/src/hooks/use-images.ts — billingInterval checkout hook + updated usePaymentConfig type** - `e521e5f` (feat)

**Plan metadata:** (docs commit follows this summary)

## Files Created/Modified

- `server/routes.ts` - Updated price constants, split getOrCreateSubscriptionPriceId into monthly/annual, updated payments/config response, added billingInterval routing in create-checkout, added migrate-to-new-price and archive-old-price endpoints
- `server/storage.ts` - Added getAllActiveSubscriptions() to IStorage interface and DatabaseStorage implementation
- `client/src/hooks/use-images.ts` - useCreateSubscriptionCheckout accepts billingInterval param, usePaymentConfig return type includes both price fields

## Decisions Made

- billingInterval defaults to 'monthly' in mutationFn so all existing callers continue to work unchanged
- Annual Stripe price is created on the same product (metadata.type = 'monthly_subscription') with interval: year — avoids a second product and keeps price lookups scoped to one product
- migrate-to-new-price checks subItem.price.unit_amount === 1900 before updating, making it idempotent — safe to run twice
- subscriptionPricePence retained as backward-compat alias in /api/payments/config response so any callers not yet updated to the new field names continue to work

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Pre-existing TypeScript errors in server/routes.ts (Stripe Subscription type missing `current_period_end`, lines 1360–1492) and unrelated files (replit_integrations, db.ts, client components) were present before this plan executed. None were introduced by our changes and none are in the files we modified.

## User Setup Required

**MIGRATION_SECRET env var must be provisioned before running the migration or archive endpoints.** Without it, both endpoints return 403 Forbidden. Set in Vercel dashboard as `MIGRATION_SECRET=<random-secret>`.

## Next Phase Readiness

- Server-side dual pricing is complete — UI plans (10-02 sidebar, 10-03 Landing.tsx) can wire directly to `useCreateSubscriptionCheckout(billingInterval)` and `usePaymentConfig().data.subscriptionMonthlyPricePence / subscriptionAnnualPricePence`
- Migration endpoint ready to run post-deploy: `POST /api/subscription/migrate-to-new-price` with `{ migrationSecret: "..." }` body
- No blockers for downstream UI plans

---
*Phase: 10-pricing-model-update*
*Completed: 2026-04-15*
