# LisAI — Security Hardening Milestone

## What This Is

LisAI is a live production SaaS that uses AI (GPT vision) to generate product listings from uploaded images and pushes them to Shopify, Etsy, Amazon, and Instagram. Users purchase credit packs or subscriptions via Stripe. Auth is handled by Clerk. This milestone focuses exclusively on closing the security vulnerabilities and fraud vectors identified in the codebase audit — the app is live with real users and real payments.

## Core Value

Users' data stays theirs, payments are credited exactly once, and no unauthenticated path reaches paid AI features.

## Requirements

### Validated

- ✓ User can upload product images and receive AI-generated listings — existing
- ✓ User can connect Shopify, Etsy, Amazon, and Instagram and push listings — existing
- ✓ User can purchase credit packs and subscriptions via Stripe — existing
- ✓ User authenticates via Clerk; all API routes require a valid session — existing
- ✓ Images are stored in Supabase Storage with public CDN URLs — existing

### Active

- [ ] `DEV_BYPASS_AUTH=true` causes a hard error (not silent bypass) when `NODE_ENV=production`
- [ ] `GET /api/images/:id/bg/:key` requires authentication and ownership verification
- [ ] `POST /api/images/:id/rewrite-description` verifies the image belongs to the requesting user
- [ ] `POST /api/images/:id/generate-photoshoot` verifies the image belongs to the requesting user before spending credits
- [ ] Stripe checkout session credit grant is idempotent — repeated calls with the same `checkoutSessionId` grant credits exactly once
- [ ] Third-party OAuth tokens (Shopify, Etsy, Amazon, Instagram) are encrypted at rest before being written to the DB
- [ ] Stripe SDK is initialized with a supported API version string (no `as any` cast)
- [ ] Server-side Supabase client uses the service-role key; storage bucket RLS policies are locked down
- [ ] Instagram OAuth state nonce is stored server-side and invalidated on first use (one-time tokens)

### Out of Scope

- Splitting `server/routes.ts` or `client/src/pages/Home.tsx` into smaller files — separate refactor milestone
- Adding automated test coverage — separate milestone
- Fixing `bgEditBuffers` memory leak — not a security issue
- Migrating base64 image storage to Supabase Storage — not a security issue
- Making `upsertShopifyConnection` and siblings atomic — low severity, separate milestone
- Wrapping `migrateSession` in a transaction — separate milestone

## Context

- Stack: Express 5 + React 18 + TypeScript + Drizzle ORM + PostgreSQL + Supabase Storage + Clerk + Stripe + OpenAI
- Deployed on Vercel serverless; every request is a cold-startable function invocation
- `server/routes.ts` is a 3,070-line monolith — all fixes will be made in-place without restructuring
- The credit double-grant is confirmed actively happening in production; it is the highest-priority fix
- `DEV_BYPASS_AUTH` is currently only guarded by convention — there is no hard production check
- Supabase is currently using the anon key server-side with open RLS; the bucket is effectively publicly writable via direct API calls
- Third-party tokens are stored as plaintext `text` columns in `shopify_connections`, `etsy_connections`, `amazon_connections`, `instagram_connections`

## Constraints

- **Architecture**: No file restructuring — fix issues in-place; minimize blast radius
- **Deployment**: Vercel serverless — no in-process Redis or long-running workers available
- **Database**: PostgreSQL via Drizzle ORM; schema changes require a migration file
- **Auth**: Clerk is the auth provider — do not change the auth mechanism, only close gaps in its application

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Encrypt tokens at application layer (not pgcrypto) | Avoids DB migration complexity; keeps encryption key in env var alongside other secrets | — Pending |
| Use DB column (`paidSessions.used`) for credit idempotency | Already present in schema; no new table needed | — Pending |
| Store Instagram OAuth nonce in DB (not Redis) | Vercel serverless has no shared memory; DB is the only shared state available | — Pending |
| Fix ownership checks with inline guard (not new middleware) | Routes already use `getUserId(req)` pattern consistently; inline check is consistent with existing style | — Pending |

---
*Last updated: 2026-03-31 after initialization*
