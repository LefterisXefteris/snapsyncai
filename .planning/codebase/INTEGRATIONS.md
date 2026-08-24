# External Integrations

**Analysis Date:** 2026-03-31

## APIs & External Services

**AI / Machine Learning:**
- OpenAI (via Replit AI Integrations proxy) — Product listing generation and SEO copy
  - SDK/Client: `openai` npm package (`server/replit_integrations/image/client.ts`, `server/routes.ts`)
  - Auth: `AI_INTEGRATIONS_OPENAI_API_KEY` + `AI_INTEGRATIONS_OPENAI_BASE_URL`
  - Models used: `gpt-5.2` (product text generation)

**E-commerce Marketplaces:**
- Shopify — Publish product listings directly to a store via Shopify Admin API
  - Auth: OAuth access token stored per-session in `shopify_connections` table
  - Connection: `/api/shopify/connect`, `/api/images/push-to-shopify`
  - Schema: `shared/schema.ts` `shopifyConnections` table

## Data Storage

**Databases:**
- PostgreSQL (Supabase-hosted)
  - Connection: `DATABASE_URL` env var
  - Client: Drizzle ORM + `pg` Pool (`server/db.ts`)
  - Pool config: max 10 connections, 30s idle timeout, 10s connection timeout, SSL enabled when URL contains "supabase"
  - Schema managed by Drizzle Kit at `shared/schema.ts`, migrations in `migrations/`
  - Tables: `images`, `shopify_connections`, `paid_sessions`, `subscriptions`, `user_credits`
  - Runtime migrations run on startup via `server/index.ts` `runAppMigrations()`

**File Storage:**
- Supabase Storage — Persistent storage for uploaded product images
  - Client: `@supabase/supabase-js` (`server/supabaseClient.ts`)
  - Auth: `SUPABASE_URL` + `SUPABASE_ANON_KEY` (anon key, open RLS policies for server-side uploads)
  - Bucket: `product-images`
  - Path pattern: `{imageId}/{timestamp}.{ext}`
  - Fallback chain: in-memory buffer → base64 DB column (`image_data`) → Supabase public URL (`storage_url`)

**Caching:**
- In-process memory cache (`imageBuffers` Map in `server/routes.ts`) — LRU-style, max 500 entries, for image Buffer objects
- `memoizee` — In-process memoization for hot server-side lookups

## Authentication & Identity

**Auth Provider:**
- Clerk — Full user auth (sign-up, sign-in, session management)
  - Server SDK: `@clerk/express` (`server/routes.ts` — `clerkMiddleware`, `clerkRequireAuth`, `getAuth`, `clerkClient`)
  - Client SDK: `@clerk/clerk-react` (`client/src/App.tsx` — `ClerkProvider`, `SignedIn`, `SignedOut`, `useUser`)
  - Publishable key served from `CLERK_PUBLISHABLE_KEY` env var (server) or `VITE_CLERK_PUBLISHABLE_KEY` (Vite build)
  - Fallback: client fetches key from `/api/auth/clerk-config` if Vite env var is absent
  - Dev bypass: `DEV_BYPASS_AUTH=true` / `VITE_DEV_BYPASS_AUTH=true` skips all auth gates with a fixed `dev_local_user` ID
  - Dark theme applied via `@clerk/themes` `dark`

## Payments & Billing

**Payment Processor:**
- Stripe — Credit packs (one-time) and subscriptions (recurring)
  - SDK: `stripe` 20.0.0 (`server/stripeClient.ts`)
  - Auth: `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`
  - Sync helper: `stripe-replit-sync` 1.0.0 — Manages Stripe schema migrations and webhook registration
  - API version: `2025-08-27.basil`
  - Credit packs: Starter (10 credits / 900p), Growth (50 credits / 3500p), Pro (150 credits / 7900p)
  - Subscription: 1900p/period
  - Webhook endpoint: `POST /api/stripe/webhook` (raw body, verified via `stripe-signature` header)
  - Webhook events handled: `checkout.session.completed` (credits + subscriptions), `customer.subscription.updated`, `customer.subscription.deleted`

## Monitoring & Observability

**Error Tracking:**
- Not detected (no Sentry, Datadog, or similar SDK)

**Logs:**
- `console.log` / `console.error` with a custom timestamp formatter (`log()` in `server/index.ts`)
- All `/api` requests logged with method, path, status, duration, and truncated response body

## CI/CD & Deployment

**Hosting:**
- Vercel — Production deployment
  - Config: `vercel.json` (install: `pnpm install --no-frozen-lockfile`, build: `npm run build`, output: `dist/public`)
  - Serverless function entry: `api/index.js` (imports `dist/index.cjs`)
  - Max function duration: 60 seconds (set in `api/index.js`)
  - SPA fallback rewrite: all non-API routes → `/index.html`

**CI Pipeline:**
- Not detected (no GitHub Actions, CircleCI, or similar config files)

## Webhooks & Callbacks

**Incoming:**
- `POST /api/stripe/webhook` — Stripe payment and subscription events; body must be raw Buffer, registered before `express.json()` middleware

**Outgoing:**
- Shopify Admin REST API — product creation and image upload requests
- OpenAI API — AI text generation requests

## OAuth Flows

**Shopify:**
- Custom OAuth exchange: store domain + access token stored in `shopify_connections`
- Route: `POST /api/shopify/connect` / `GET /api/shopify/oauth/start`

## Environment Configuration

**Required env vars:**
- `DATABASE_URL` — PostgreSQL connection string
- `SUPABASE_URL` — Supabase project URL
- `SUPABASE_ANON_KEY` — Supabase anon key for storage uploads
- `STRIPE_SECRET_KEY` — Stripe secret key
- `STRIPE_PUBLISHABLE_KEY` — Stripe publishable key
- `CLERK_PUBLISHABLE_KEY` — Clerk publishable key (server-side)
- `VITE_CLERK_PUBLISHABLE_KEY` — Clerk publishable key (baked into Vite client build)
- `AI_INTEGRATIONS_OPENAI_API_KEY` — OpenAI API key (via Replit proxy)
- `AI_INTEGRATIONS_OPENAI_BASE_URL` — OpenAI base URL (Replit AI proxy endpoint)

**Optional env vars:**
- `DEV_BYPASS_AUTH` — Set `true` to skip Clerk auth on server
- `VITE_DEV_BYPASS_AUTH` — Set `true` to skip Clerk auth on client
- `PORT` — Override server port (defaults to 5001)
- `REPLIT_DOMAINS` — Auto-register Stripe managed webhook when running on Replit

**Secrets location:**
- Local: `.env` file (gitignored)
- Vercel: `.env.vercel.local` (local preview) and `.env.vercel.prod` (production)

---

*Integration audit: 2026-03-31*
