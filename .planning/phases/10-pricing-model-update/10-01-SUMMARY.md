---
phase: 10
plan: 01
subsystem: pricing-engine
tags: [stripe, pricing, weekly-subscription, credit-removal, server]
one_liner: "Replace monthly/credit pricing engine with weekly (£4) + annual (£173) Stripe helpers, 30/week product cap enforcement, and zero credit-system server code"

dependency_graph:
  requires: []
  provides:
    - "getOrCreateWeeklySubscriptionPriceId — Stripe price helper for £4/week"
    - "getOrCreateAnnualSubscriptionPriceId — updated to use weekly_subscription product type"
    - "GET /api/payments/config — returns subscriptionWeeklyPricePence, subscriptionAnnualPricePence, weeklyProductLimit"
    - "POST /api/subscription/create-checkout — defaults to weekly price"
    - "POST /api/subscription/unlock-images — 30/week cap enforcement with partial cap"
    - "POST /api/subscription/migrate-to-weekly — MIGRATION_SECRET-protected admin endpoint"
    - "POST /api/subscription/archive-old-prices — archives non-weekly sub prices + all credit pack prices"
    - "IStorage interface — zero credit method signatures"
    - "DatabaseStorage — zero credit method implementations"
    - "WebhookHandlers — only subscription checkout handler, no payment/credit handler"
  affects:
    - "10-02 (credits UI removal) — server endpoints are now correct and clean"
    - "10-03 (subscription UI + Landing.tsx) — weekly pricing shape ready for UI"

tech_stack:
  added: []
  patterns:
    - "getWeeklyProductCount — drizzle query with count(distinct coalesce(productGroupId, cast(id as text))) for week-boundary product counting"
    - "getWeekStartUTC / nextMondayUTC — pure UTC date helpers, no timezone library"
    - "Partial weekly cap — cappedImages splice pattern limits unlock to remaining allowance"

key_files:
  created: []
  modified:
    - server/routes.ts
    - server/storage.ts
    - server/webhookHandlers.ts
    - client/src/components/app-sidebar.tsx
    - client/src/pages/Home.tsx

decisions:
  - id: "10-01-D1"
    description: "weekly_subscription product type used for both weekly and annual Stripe prices — annual price lives on the same product as weekly"
    alternatives: ["separate annual product"]
    rationale: "Cleaner Stripe dashboard, simpler archive-old-prices logic (one product to scan)"
  - id: "10-01-D2"
    description: "getWeeklyProductCount uses count(distinct coalesce(productGroupId, cast(id as text))) — counts product groups as single unit, singles as individual"
    alternatives: ["count all paid images"]
    rationale: "Correct semantics: one grouped product = 1 slot regardless of image count"
  - id: "10-01-D3"
    description: "paidSessions table import kept in storage.ts — still referenced by createPaidSession, getPaidSession, markPaidSessionUsed"
    alternatives: ["remove paidSessions"]
    rationale: "These methods serve the subscription verify flow, not credits; only userCredits removed"

metrics:
  duration: "~20 min"
  completed: "2026-04-19"
  tasks_completed: 2
  files_changed: 5
---

# Phase 10 Plan 01: Pricing Engine Server Replacement Summary

Replace the entire server-side pricing engine: delete all credit system code, add weekly (£4) and annual (£173) Stripe price helpers, replace credit-deduction unlock logic with a 30/week product cap, and add migrate-to-weekly and archive-old-prices admin endpoints.

## What Was Built

### Task 1 — routes.ts pricing engine replacement

**Deleted:**
- `SUBSCRIPTION_MONTHLY_PRICE_PENCE`, `SUBSCRIPTION_ANNUAL_PRICE_PENCE` (old 7900p value), `CREDIT_PACKS` constant
- `cachedCreditPriceIds` Map, `getOrCreateCreditPackPriceId()` function
- `cachedMonthlyPriceId`, `getOrCreateMonthlySubscriptionPriceId()` function
- `/api/credits/balance`, `/api/credits/purchase`, `/api/credits/verify` routes
- Credit-deduction block in `/api/subscription/unlock-images`

**Added:**
- `SUBSCRIPTION_WEEKLY_PRICE_PENCE = 400`, `SUBSCRIPTION_ANNUAL_PRICE_PENCE = 17300`, `WEEKLY_PRODUCT_LIMIT = 30`
- `getOrCreateWeeklySubscriptionPriceId()` — finds or creates weekly_subscription product + week-interval price
- Updated `getOrCreateAnnualSubscriptionPriceId()` — searches weekly_subscription product (not monthly_subscription)
- `getWeekStartUTC()`, `nextMondayUTC()` — pure UTC ISO-week helpers
- `getWeeklyProductCount(userId)` — counts distinct paid products since Monday midnight UTC
- `GET /api/payments/config` → `{ publishableKey, subscriptionWeeklyPricePence, subscriptionAnnualPricePence, weeklyProductLimit }`
- Subscription checkout defaults to `getOrCreateWeeklySubscriptionPriceId()` when billingInterval !== 'annual'
- `POST /api/subscription/migrate-to-weekly` — migrates all active subscribers not already on weekly; counts migrated/skipped/errors
- `POST /api/subscription/archive-old-prices` — archives non-weekly sub prices + all credit pack prices; both protected by `MIGRATION_SECRET`
- 30/week cap block in unlock-images: 403 with weeklyLimit/used/resetsAt when limit reached; partial cap splice when remaining < requested

### Task 2 — storage.ts and webhookHandlers.ts credit code removal

**storage.ts:**
- Removed `getUserCredits`, `addCredits`, `deductCredits`, `claimAndGrantCredits` from `IStorage` interface
- Deleted all four method implementations from `DatabaseStorage`
- Removed `userCredits` and `UserCredits` from schema import (paidSessions kept — still used by createPaidSession/getPaidSession/markPaidSessionUsed)

**webhookHandlers.ts:**
- Deleted the `checkout.session.completed` + `data.mode === 'payment'` block (credit grant handler)
- Subscription webhook block (`data.mode === 'subscription'`) untouched

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] app-sidebar.tsx and Home.tsx caused TypeScript build failures**

- **Found during:** Task 1 verification (`npx tsc --noEmit`)
- **Issue:** `app-sidebar.tsx` referenced `subscriptionMonthlyPricePence`, `subscriptionPricePence`, and `billingInterval: 'monthly'` which no longer exist on the new paymentConfig type. `Home.tsx` referenced `paymentConfig?.creditPacks` which was removed.
- **Fix:** Updated `app-sidebar.tsx` to use `weeklyPrice`, `billingInterval: 'weekly' | 'annual'`, and weekly UI copy. Updated `Home.tsx` credit packs map to use empty typed array (dead code — credits dialog is superseded by subscription model).
- **Files modified:** `client/src/components/app-sidebar.tsx`, `client/src/pages/Home.tsx`
- **Note:** These client files were scheduled for Plan 02/03, but the TypeScript type mismatch caused build failure on the server plan's verification step — fixing was required to unblock.

## Verification Results

All checks pass:
- `grep -rn "CREDIT_PACKS|creditPacks|getUserCredits|deductCredits|addCredits|claimAndGrantCredits" server/` → 0 matches
- `grep -n "SUBSCRIPTION_WEEKLY_PRICE_PENCE|WEEKLY_PRODUCT_LIMIT|getWeeklyProductCount" server/routes.ts` → multiple matches
- `grep -n "migrate-to-weekly|archive-old-prices" server/routes.ts` → both endpoints present
- `grep -n "api/credits" server/routes.ts` → 0 matches
- `grep -n "getAllActiveSubscriptions" server/storage.ts` → interface (line 75) + implementation (line 269)
- Pre-existing TypeScript errors (Stripe SDK `current_period_end` type, `server/replit_integrations`, `server/db.ts` Pool type) remain unchanged — confirmed pre-existing via git stash test

## Next Phase Readiness

Plan 02 (credits UI removal) and Plan 03 (subscription UI + Landing.tsx) can now proceed. The server exposes the correct weekly pricing shape and has zero credit endpoints.
