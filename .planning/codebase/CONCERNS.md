# Codebase Concerns

**Analysis Date:** 2026-03-31

## Tech Debt

**Massive monolithic routes file:**
- Issue: All API route handlers live in a single 3,070-line file with zero separation of concerns
- Files: `server/routes.ts`
- Impact: Very hard to navigate, test, or refactor individual features; high merge conflict risk; all route logic intermixed with business logic and third-party API calls
- Fix approach: Split into domain-scoped routers (e.g., `server/routes/images.ts`, `server/routes/shopify.ts`, `server/routes/payments.ts`, `server/routes/instagram.ts`)

**Pervasive `any` typing:**
- Issue: Hundreds of `any` casts throughout server-side code — `let parsed: any`, `image: any`, `(image as any).storageUrl`, `error: any` in every catch block
- Files: `server/routes.ts` (~80+ occurrences), `server/storage.ts`, `server/stripeClient.ts`, `client/src/hooks/use-images.ts`
- Impact: TypeScript provides zero type safety for the most critical paths (AI response parsing, Stripe objects, Shopify payloads); runtime errors escape the type system
- Fix approach: Define typed interfaces for AI responses, Stripe session payloads, and external API responses; replace `any` casts with proper types

**Unused variable in stripeClient:**
- Issue: `let connectionSettings: any` declared at module scope (line 3) but never used
- Files: `server/stripeClient.ts`
- Impact: Minor — dead code, suggests this file was partially refactored and the variable was not cleaned up
- Fix approach: Remove the declaration

**Mixed model versions for AI calls:**
- Issue: Most AI calls use `gpt-5.2` but the description rewrite endpoint uses `gpt-4-turbo-preview` with a different parameter style (`max_tokens` vs `max_completion_tokens`)
- Files: `server/routes.ts` lines 2881, 3054
- Impact: Inconsistent AI quality and cost; `gpt-4-turbo-preview` is a deprecated model name
- Fix approach: Standardize all OpenAI calls to the same current model; create a shared helper for OpenAI calls

**Replit-specific library in production:**
- Issue: `stripe-replit-sync` and `REPLIT_DOMAINS` env var are used in production server startup code, not just development
- Files: `server/index.ts` lines 7, 38-51; `package.json` line 91
- Impact: Stripe webhook setup silently skips on Vercel (because `REPLIT_DOMAINS` is not set) with only a `console.warn`; Stripe sync backfill also fires in the background on every cold start
- Fix approach: Extract webhook setup into a separate mechanism that works with Vercel (use `VERCEL_URL` or a configured `APP_URL` env var); decouple stripe-replit-sync from the production boot path

**`bgEditBuffers` has no eviction policy:**
- Issue: The `bgEditBuffers` Map inside `registerRoutes` accumulates AI-generated image buffers in memory with no size cap or TTL eviction. Only `imageBuffers` has a 500-entry LRU cap.
- Files: `server/routes.ts` lines 2917, 2962
- Impact: Memory leak under sustained use — each background edit adds a ~1MB+ buffer that is never freed unless the server restarts
- Fix approach: Apply the same LRU cap pattern as `imageBuffers`, or store results in Supabase Storage and return a persistent URL instead of an in-memory key

**`apply-image` writes base64 back to DB:**
- Issue: When a user applies an edited background, the new image is stored as a `base64` string in the `imageData` DB column rather than being uploaded to Supabase Storage
- Files: `server/routes.ts` lines 3009-3014
- Impact: DB rows balloon in size; `storageUrl` is not set so the CDN fast-path is bypassed; Supabase Storage is the intended persistence layer but is not used here
- Fix approach: Upload the edited buffer to Supabase Storage, store the resulting URL in `storageUrl`, and clear `imageData`

**Instagram import writes base64 to DB:**
- Issue: Instagram-imported images are stored as base64 in `imageData` (lines 2548, 2575) rather than being uploaded to Supabase Storage
- Files: `server/routes.ts` lines 2484-2585
- Impact: Same DB bloat issue as above; inconsistent with the primary upload flow which uses Supabase
- Fix approach: Run `uploadImageToStorage` after downloading each Instagram image, same as the main upload path

**`upsertShopifyConnection` uses a read-then-write pattern (non-atomic):**
- Issue: `upsertShopifyConnection` (and all other platform `upsert*Connection` methods) do a `SELECT` then either `UPDATE` or `INSERT` in two separate queries with no transaction
- Files: `server/storage.ts` lines 150-160, 172-183, 195-206, 217-227
- Impact: Race condition under concurrent requests could create duplicate rows or lose a write
- Fix approach: Use Postgres `INSERT ... ON CONFLICT DO UPDATE` (same as `addCredits` already does correctly)

---

## Known Bugs / Reliability Issues

**Credit double-grant on page reload:**
- Symptoms: `POST /api/credits/verify` adds credits on every call for the same `checkoutSessionId` — there is no idempotency check
- Files: `server/routes.ts` lines 1047-1075; `server/webhookHandlers.ts` lines 32-43
- Trigger: User reloads the success page, or the Stripe webhook fires AND the client polls `/verify`; both paths call `storage.addCredits` without checking if credits were already granted
- Workaround: Webhook and verify endpoint both call `addCredits`, making the race between them additive — but repeated verify calls will keep adding credits
- Fix approach: Mark checkout sessions as "processed" in `paidSessions.used` before granting credits; check `used > 0` before calling `addCredits`

**`/api/images/:id/bg/:key` endpoint has no ownership check:**
- Symptoms: Any authenticated (or unauthenticated) user can retrieve another user's AI-edited background image if they know the key
- Files: `server/routes.ts` lines 2972-2978
- Trigger: Route has no `requireAuth()` middleware and no `sessionId` ownership check; key is predictable in format `${id}-${style}-${Date.now()}`
- Fix approach: Add `requireAuth()` and verify that the `id` in the key belongs to the requesting user

**`/api/images/:id/rewrite-description` missing ownership check:**
- Symptoms: Route fetches image by ID but only checks `if (!image)` — does not verify `image.sessionId === getUserId(req)`
- Files: `server/routes.ts` lines 3026-3067
- Trigger: Any authenticated user can rewrite the description of another user's image if they know the numeric ID
- Fix approach: Add `image.sessionId !== getUserId(req)` ownership check (consistent with all other image endpoints)

**`/api/images/:id/generate-photoshoot` missing ownership check:**
- Symptoms: Same issue — route fetches image but does not check ownership before spending AI credits
- Files: `server/routes.ts` lines 2854-2909
- Trigger: Any authenticated user can trigger paid DALL-E calls on another user's image
- Fix approach: Add `image.sessionId !== getUserId(req)` check

---

## Security Considerations

**`DEV_BYPASS_AUTH` env var disables all authentication:**
- Risk: If `DEV_BYPASS_AUTH=true` is set in production (accidentally or via misconfigured env), all auth checks are bypassed and all requests run as `dev_local_user`
- Files: `server/routes.ts` lines 18-28; `client/src/hooks/use-images.ts` line 7
- Current mitigation: The flag must be explicitly set; not set by default
- Recommendations: Add a hard guard that throws if `DEV_BYPASS_AUTH=true` and `NODE_ENV=production`

**Third-party API credentials stored in plaintext DB columns:**
- Risk: Shopify access tokens and Instagram long-lived tokens are stored as plaintext text columns
- Files: `shared/schema.ts` lines 60-130; `server/storage.ts`
- Current mitigation: Access is scoped by `sessionId`; DB connection is over SSL
- Recommendations: Encrypt sensitive columns at rest; use Postgres `pgcrypto` or application-level encryption before storing tokens

**Stripe API version cast with `as any`:**
- Risk: `'2025-08-27.basil' as any` bypasses the Stripe SDK's compile-time version check; if this API version is unsupported or the string is typo'd, it fails silently at runtime
- Files: `server/stripeClient.ts` line 22
- Current mitigation: None
- Recommendations: Use a supported Stripe API version string that the SDK accepts without casting

**Supabase anon key used for server-side uploads:**
- Risk: `SUPABASE_ANON_KEY` is used in the server-side Supabase client instead of a service-role key; the comment says "bucket has open RLS policies" — meaning the bucket is publicly writable
- Files: `server/supabaseClient.ts` lines 4-5
- Current mitigation: Upload path is only reachable through authenticated server routes
- Recommendations: Use Supabase service-role key for server-side operations; lock down RLS policies on the storage bucket to prevent public writes

**Instagram OAuth state nonce not stored server-side:**
- Risk: The HMAC-signed state parameter is validated on callback, but the nonce is not stored/checked-off server-side. An attacker who obtains a valid signed state (e.g. by intercepting one request) could replay it within the 10-minute window.
- Files: `server/routes.ts` lines 2275-2330
- Current mitigation: 10-minute TTL on the state token
- Recommendations: Store the nonce in DB or Redis and invalidate it on first use (one-time tokens)

---

## Performance Bottlenecks

**`assign-group-batch` performs N individual DB queries in a loop:**
- Problem: For each image ID in the batch, a `getImage` + `updateImage` is called sequentially, resulting in 2×N DB round-trips
- Files: `server/routes.ts` lines 1752-1769
- Cause: Row-by-row loop rather than bulk update
- Improvement path: Use `WHERE id = ANY($1) AND session_id = $2` with a single `UPDATE` query; verify ownership in one pass with `getImagesByIds` then filter

**Instagram polling loop blocks request thread:**
- Problem: Instagram media container status is checked in a `while` loop with `await delay(2000)` up to 30 times (60 seconds max block)
- Files: `server/routes.ts` lines 2724-2736
- Cause: Synchronous polling inside a single HTTP request handler
- Improvement path: Return a job ID immediately and have the client poll for completion; or use a background worker

**memoized AI functions hold up to 1,000 buffers in memory per function:**
- Problem: `quickPreviewImage` and `fullAnalyzeImage` each cache up to 1,000 image buffers (keyed by SHA-256 of the buffer content) with a 24-hour TTL
- Files: `server/routes.ts` lines 265-338, 341-444
- Cause: `memoizee` with `max: 1000` and `maxAge: 24h`; each cached entry holds a full image buffer (can be several MB each)
- Improvement path: Remove buffer from the memoize key (only hash metadata); store memoized results by content hash without retaining the buffer in the cache value

---

## Fragile Areas

**`Home.tsx` is a 1,230-line monolith:**
- Files: `client/src/pages/Home.tsx`
- Why fragile: All platform connect dialogs, upload logic, pricing UI, and selection state live in one component with 20+ `useState` calls; any change risks unintended interactions
- Safe modification: Extract each platform dialog into its own component; extract the pricing/credits modal
- Test coverage: None

**`use-images.ts` exports 30+ hooks from one file:**
- Files: `client/src/hooks/use-images.ts` (867 lines)
- Why fragile: All mutations for Shopify, Instagram, AI features, and payments are in one hook file; barrel-export makes tree-shaking ineffective
- Safe modification: Split into domain-specific hook files (`use-shopify.ts`, `use-instagram.ts`, `use-payments.ts`)
- Test coverage: None

**In-memory image buffer cache is not shared across server instances:**
- Files: `server/routes.ts` lines 38-48
- Why fragile: On Vercel serverless, each function invocation may have a cold `imageBuffers` Map; if `imageData` was not persisted to DB (new uploads set `imageData: null`) and `storageUrl` upload failed silently, the image is permanently inaccessible
- Safe modification: Always verify `storageUrl` was set after upload; add a fallback error state when both `imageData` and `storageUrl` are null

**Session migration is irreversible and untransactional:**
- Files: `server/storage.ts` lines 233-243
- Why fragile: `migrateSession` runs 5 separate `UPDATE` queries with no transaction wrapper; a partial failure leaves data split across two user IDs
- Safe modification: Wrap all five updates in a single `db.transaction()`
- Test coverage: None

---

## Scaling Limits

**In-memory image buffer store (imageBuffers):**
- Current capacity: 500 entries max (~500 × avg 3MB = ~1.5GB if all entries are large images)
- Limit: Vercel serverless functions have 1-3GB RAM per instance; Map is not shared across instances
- Scaling path: Remove reliance on in-memory buffer; always require `storageUrl` to be set

**bgEditBuffers has no cap:**
- Current capacity: Unbounded
- Limit: OOM crash if enough edits are made before server restart
- Scaling path: Apply a size cap or store results in Supabase Storage

**Sequential Shopify push:**
- Current capacity: Each product is pushed one at a time in a `for` loop
- Limit: At 10+ products the request takes 10+ seconds; Vercel serverless has a 10-second request timeout on hobby plans
- Scaling path: Use `runWithConcurrency` (already present in the codebase) for Shopify pushes the same way it's used for image analysis

---

## Dependencies at Risk

**`stripe-replit-sync` (v1.0.0):**
- Risk: This is a Replit-platform-specific package not designed for Vercel deployment; the managed webhook setup path is silently skipped when not on Replit; no alternative webhook registration runs
- Impact: Stripe webhooks may not be registered in production on Vercel, breaking credit grants and subscription activation if the client-side verify endpoint is not called
- Migration plan: Register webhooks via Stripe dashboard manually; replace `stripe-replit-sync` schema migration with a standard Drizzle migration; remove Replit-specific startup code

**`gpt-4-turbo-preview` model name:**
- Risk: This model alias is deprecated by OpenAI; calls may start failing or be silently redirected
- Impact: Description rewrite endpoint (`/api/images/:id/rewrite-description`) fails
- Migration plan: Update to `gpt-4o` or the same `gpt-5.2` used elsewhere

---

## Test Coverage Gaps

**Zero test files exist anywhere in the codebase:**
- What's not tested: All server routes, storage layer, credit deduction, subscription flows, webhook handlers, AI analysis, platform push operations
- Files: Entire `server/` and `client/src/` directory trees
- Risk: Any refactor or dependency upgrade can silently break payment flows, credit grants, or data ownership checks — none of which have regression coverage
- Priority: High — especially for `server/routes.ts` payment/credit logic and `server/storage.ts` `deductCredits` / `migrateSession`

**`/api/credits/verify` double-grant race is untested:**
- What's not tested: Concurrent calls to verify with the same `checkoutSessionId`
- Files: `server/routes.ts` lines 1047-1075; `server/webhookHandlers.ts` lines 32-43
- Risk: Users can receive double or triple credits silently
- Priority: High

---

*Concerns audit: 2026-03-31*
