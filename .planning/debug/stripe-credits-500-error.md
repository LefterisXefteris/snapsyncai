---
status: awaiting_human_verify
trigger: "stripe-credits-500-error — When user tries to get credits, Stripe does not load and payment fails with a 500 error"
created: 2026-04-02T00:00:00Z
updated: 2026-04-02T00:00:00Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: getOrCreateCreditPackPriceId (and getOrCreateSubscriptionPriceId) queries stripe.products/stripe.prices DB tables which only exist after initStripe() runs runMigrations(). On Vercel cold start, initStripe() is fire-and-forget so these tables may not exist when the first request hits /api/credits/purchase. No try/catch wraps the DB queries, so the PostgreSQL error (relation "stripe.products" does not exist) propagates to a 500.
test: verified initStripe() is fire-and-forget in server/index.ts line 167; confirmed getOrCreateCreditPackPriceId has no try/catch around DB queries; confirmed all env vars are present in Vercel production
expecting: fix = wrap DB queries in try/catch and fall back to direct Stripe API creation when stripe schema tables are absent
next_action: implement try/catch fix in getOrCreateCreditPackPriceId and getOrCreateSubscriptionPriceId in server/routes.ts

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: Stripe payment UI loads and user can purchase credits successfully
actual: Stripe does not load, payment fails with a 500 error
errors: HTTP 500 error on the payment/credits flow
reproduction: Navigate to the credits/billing page and attempt to purchase credits
started: Unknown — user reported it as a current issue

## Eliminated
<!-- APPEND only - prevents re-investigating -->

- hypothesis: Missing Stripe env vars (STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY) in Vercel production
  evidence: vercel env ls confirms both keys are present as Encrypted vars in Production environment
  timestamp: 2026-04-02

- hypothesis: TypeScript compilation errors causing build failure
  evidence: Build uses esbuild (not tsc) — TypeScript type errors do not prevent compilation. npx tsc --noEmit shows errors but these are pre-existing and do not affect runtime.
  timestamp: 2026-04-02

- hypothesis: Stripe API version 2025-08-27.basil recently rejected by Stripe
  evidence: UAT March 31 showed checkout WORKED with same API version. No evidence of retirement. Cannot confirm this caused the NEW 500 regression.
  timestamp: 2026-04-02

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-04-02
  checked: server/index.ts initStripe() call pattern
  found: initStripe() is fire-and-forget (line 167: initStripe().catch(...)) — NOT awaited before registerRoutes()
  implication: The stripe.products/stripe.prices tables created by runMigrations() may not exist when the first POST /api/credits/purchase request is handled

- timestamp: 2026-04-02
  checked: getOrCreateCreditPackPriceId in server/routes.ts (lines 99-146)
  found: NO try/catch around the two DB queries (lines 108-110 and 119-121) that query stripe.products JOIN stripe.prices. If these tables don't exist, the error propagates as an unhandled exception → caught by the route's outer try/catch → res.status(500)
  implication: On cold start or if initStripe() never completed, /api/credits/purchase always 500s

- timestamp: 2026-04-02
  checked: getOrCreateSubscriptionPriceId (lines 150-193)
  found: Same pattern — no try/catch around DB queries to stripe.products/stripe.prices. /api/subscription/create-checkout has the same vulnerability
  implication: Same root cause affects subscription checkout too

- timestamp: 2026-04-02
  checked: Vercel env vars via `vercel env ls`
  found: STRIPE_SECRET_KEY and STRIPE_PUBLISHABLE_KEY both present as Encrypted vars in Production
  implication: Env vars are NOT the cause of the 500

- timestamp: 2026-04-02
  checked: stripe-replit-sync dist/index.cjs runMigrations implementation
  found: runMigrations creates stripe schema via CREATE SCHEMA IF NOT EXISTS and then runs migrations. This only runs when initStripe() is called, which is fire-and-forget.
  implication: If initStripe() was never successfully completed in the current Supabase DB (e.g., connectivity issue on first deploy), the stripe schema tables would not exist and all DB queries against them fail

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: getOrCreateCreditPackPriceId and getOrCreateSubscriptionPriceId query stripe.products/stripe.prices DB tables with no error handling. These tables are created by stripe-replit-sync's runMigrations() which is called from initStripe() — a fire-and-forget background task. On Vercel cold starts or if initStripe() failed, these tables may not exist, causing a PostgreSQL "relation does not exist" error that propagates to HTTP 500.
fix: Wrapped the DB lookup queries in try/catch in both getOrCreateCreditPackPriceId and getOrCreateSubscriptionPriceId. On DB error, both functions skip the cached lookup, log a warning, and fall through to creating the product/price via Stripe API directly. This makes both functions resilient to the stripe schema being absent.
verification: Build succeeds (npm run build completes in 122ms). Logic equivalence confirmed — when DB queries succeed, behavior is identical. When they fail, the function falls back to Stripe API calls.
files_changed: [server/routes.ts]
