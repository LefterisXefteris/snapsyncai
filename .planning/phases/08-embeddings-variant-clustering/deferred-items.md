# Deferred Items — Phase 08

## Pre-existing TypeScript errors (not caused by plan 08-01)

Discovered during `pnpm tsc --noEmit` while executing plan 08-01 Task 1. These errors exist in files unrelated to embeddings / variant clustering work and were present on `main` before this phase started. Out of scope per SCOPE BOUNDARY rule.

Affected files (not touched by this plan):
- `server/replit_integrations/audio/routes.ts` — `string | string[]` param mismatches (3)
- `server/replit_integrations/batch/utils.ts` — `pRetry.AbortError` property access (2)
- `server/replit_integrations/chat/routes.ts` — `string | string[]` param mismatches (3)
- `server/replit_integrations/chat/storage.ts` — missing `conversations`/`messages` exports from `@shared/schema`
- `server/replit_integrations/image/client.ts` — `response.data` possibly undefined (2)
- `server/replit_integrations/image/routes.ts` — `response.data` possibly undefined
- `server/routes.ts` — `Subscription.current_period_end` (5) + `string | string[]` (1)
- `server/webhookHandlers.ts` — `Subscription.current_period_end` (2)
- Drizzle Pool type mismatch (pre-existing drizzle/pg version drift)

Verification that new files are clean: `pnpm tsc --noEmit 2>&1 | grep -E "cohere-client|embedding-utils"` returns zero matches.
