---
status: awaiting_human_verify
trigger: "clerk-prod-upload-failure: User switched Clerk from dev to production keys. Now ALL image uploads fail (14 of 14 groups)."
created: 2026-04-12T00:00:00Z
updated: 2026-04-12T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED - All .env files contain Clerk dev keys (pk_test_/sk_test_ pointing to equipped-roughy-16.clerk.accounts.dev). If the Clerk dashboard instance was switched to production mode, these keys are invalidated.
test: Verified all 3 .env files; decoded publishable key; confirmed DEV_BYPASS_AUTH not set
expecting: User must provide production Clerk keys (pk_live_/sk_live_) from their Clerk dashboard
next_action: CHECKPOINT — need user to provide production Clerk keys from dashboard, OR confirm they want to revert to dev mode

## Symptoms

expected: Images upload successfully to Supabase storage and appear in workspace
actual: All uploads fail. Images show in sidebar with red borders and "Retry" buttons. Toast says "14 of 14 groups failed"
errors: "Some uploads failed" toast. Need to check server logs and upload API route for auth errors.
reproduction: Drop any images into the upload area - all fail
started: Started immediately after switching Clerk from development to production mode

## Eliminated

## Evidence

- timestamp: 2026-04-12
  checked: All .env files (.env, .env.vercel.prod, .vercel/.env.production.local)
  found: ALL contain pk_test_ and sk_test_ prefixed Clerk keys. No pk_live_ or sk_live_ keys anywhere.
  implication: If Clerk instance was switched to production mode on dashboard, these dev keys are now invalid. Clerk production mode requires pk_live_/sk_live_ keys.

- timestamp: 2026-04-12
  checked: server/routes.ts upload route (/api/images/upload)
  found: Route uses requireAuth() which calls clerkRequireAuth() from @clerk/express. clerkMiddleware() is applied globally (line 1170). All upload requests must pass Clerk auth.
  implication: If Clerk keys are wrong, clerkMiddleware will reject the session token, and requireAuth will return 401 before the upload handler runs.

- timestamp: 2026-04-12
  checked: client/src/hooks/use-images.ts useUploadImages hook
  found: Uses fetch with credentials:"include" to /api/images/upload. On non-ok response, throws error with message.
  implication: A 401 from the server would cause the mutation to throw, marking every group as failed.

- timestamp: 2026-04-12
  checked: Decoded VITE_CLERK_PUBLISHABLE_KEY base64 payload
  found: Decodes to "equipped-roughy-16.clerk.accounts.dev" — a Clerk DEVELOPMENT instance domain.
  implication: These are definitively dev-mode keys. Production keys would have pk_live_/sk_live_ prefix.

- timestamp: 2026-04-12
  checked: DEV_BYPASS_AUTH in .env
  found: Not set — Clerk auth is fully active.
  implication: All protected routes go through clerkMiddleware() + requireAuth(). Invalid keys = 401 on everything.

## Resolution

root_cause: All .env files (.env, .env.vercel.prod, .vercel/.env.production.local) contain Clerk DEVELOPMENT keys (pk_test_/sk_test_ for "equipped-roughy-16.clerk.accounts.dev"). The user switched their Clerk instance to production mode on the Clerk dashboard, which invalidates development keys. Since DEV_BYPASS_AUTH is not set, all API routes go through clerkMiddleware() and requireAuth(), which fail to validate the session token because the secret key no longer matches the instance. This causes every /api/images/upload request to return 401, which the client catches and reports as "14 of 14 groups failed."
fix: User must obtain production API keys (pk_live_/sk_live_) from their Clerk dashboard and update all 4 locations: (1) .env VITE_CLERK_PUBLISHABLE_KEY, (2) .env CLERK_PUBLISHABLE_KEY, (3) .env CLERK_SECRET_KEY, (4) Vercel environment variables for production deployment. Then restart the dev server.
verification:
files_changed: []
