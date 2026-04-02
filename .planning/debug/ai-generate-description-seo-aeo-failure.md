---
status: awaiting_human_verify
trigger: "AI silently fails to generate description, SEO and AEO tags when user clicks the generate button"
created: 2026-03-31T00:00:00Z
updated: 2026-03-31T21:45:00Z
symptoms_prefilled: true
---

## Current Focus

hypothesis: CONFIRMED AND FIXED
test: Applied fix to server/routes.ts unlock-images route
expecting: User with 10 credits and 15 unpaid products should now get 10 products analyzed instead of 403
next_action: Human verification — test "Analyze All" with credits < unpaid product count

## Symptoms

expected: Clicking the AI generate button produces description, SEO tags, and AEO tags for the listing
actual: Silent failure — nothing generates, no content is produced; UAT reports 403 "Insufficient credits" with 10 credits present
errors: "403: {message: 'Insufficient credits'}" — shown as "Analysis Failed" toast
reproduction: Click the AI generate button (Analyze All) when unpaid products > credit balance
started: Was working before, broke recently after a recent change

## Eliminated

- hypothesis: Model gpt-5.2 is invalid
  evidence: Tested via OpenAI API — gpt-5.2 exists and supports vision + JSON mode successfully
  timestamp: 2026-03-31T21:00:00Z

- hypothesis: userId mismatch between balance display and deductCredits
  evidence: Both use getUserId(req) which returns Clerk auth.userId; same userId
  timestamp: 2026-03-31T21:05:00Z

- hypothesis: claimAndGrantCredits broke the credits flow
  evidence: UAT test 1 passed (normal purchase works) and test 2 passed (no double-credit on reload)
  timestamp: 2026-03-31T21:10:00Z

## Evidence

- timestamp: 2026-03-31T21:00:00Z
  checked: server/routes.ts — unlock-images route
  found: Route deducts credits for ALL unpaid unique products atomically. If creditCost > balance, returns 403.
  implication: User with 10 credits and 15 unpaid products → 15 credit cost → 403 even though they have credits

- timestamp: 2026-03-31T21:05:00Z
  checked: client/src/pages/Home.tsx — handleUnlockAll
  found: Sends ALL unpaid image IDs without checking if credits cover all of them
  implication: Frontend doesn't cap request to affordable subset — relies on server to handle this correctly

- timestamp: 2026-03-31T21:10:00Z
  checked: OpenAI model gpt-5.2
  found: Model exists, supports vision + json_object response format, works fine
  implication: Not the cause of AI failures

- timestamp: 2026-03-31T21:15:00Z
  checked: loadImageBuffer + storageUrl flow
  found: If in-memory cache is evicted AND storageUrl fetch fails, returns null → image gets paid status with no content (silent failure path 2)
  implication: Secondary issue, not the primary cause reported in UAT

- timestamp: 2026-03-31T21:20:00Z
  checked: UAT report (.planning/phases/01-credit-idempotency/01-UAT.md)
  found: "credits are there but i have 10 credits but it fails to analyze it gives me analysis fail 403 error"
  implication: Confirms root cause — credit count is insufficient for all unpaid products

- timestamp: 2026-03-31T21:30:00Z
  checked: deductCredits SQL logic
  found: UPDATE...WHERE balance >= amount — returns 0 rows (false) if balance < amount
  implication: With 10 credits and 15 unpaid products (cost=15), deductCredits returns false → 403

## Resolution

root_cause: The unlock-images route tries to deduct credits for ALL unpaid products in the request atomically. The atomic deduction (balance >= amount) fails with 0 rows returned if the user has fewer credits than unpaid unique products. With 10 credits and 15+ unpaid products, creditCost=15 > balance=10, so deductCredits returns false and the route returns 403 "Insufficient credits". The frontend shows an "Analysis Failed" toast. Since credits exist but the bulk cost exceeds them, every click fails — no products get analyzed.

fix: Modified server/routes.ts unlock-images route to:
  1. Read available credit balance before building the product set
  2. Cap the set of images to process to only those belonging to the first N unique product groups (N = available credits)
  3. Deduct only for the affordable subset (always succeeds since cost = min(groups, balance))
  4. Run AI analysis only on the affordable subset
  The 403 fallback remains for edge cases (race conditions), but the normal path with credits present will always succeed.

verification: Fix implemented in server/routes.ts lines ~1414-1454
files_changed: [server/routes.ts]
