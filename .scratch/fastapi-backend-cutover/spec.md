## Problem Statement

The product still has two backends. FastAPI already implements the product API, but production `/api` still runs on Express (Vercel), and the usual local `dev` command still boots Express with Vite inside it. That leaves a TypeScript server in the path after the API has already been ported, and it blocks a clean FastAPI-only backend.

## Solution

FastAPI becomes the only backend. It runs on Railway and is reached at `https://api.snapsyncai.co.uk`. The SPA stays on Vercel (`www`). Locally, Vite plus FastAPI is the whole stack: every `/api` call is proxied to FastAPI and Express is not run.

Express stays in the repo until Railway is serving production traffic (health, then real `/api`), DNS and dashboard URLs point at `api.`, and the SPA’s API origin env is set. Only then is Express deleted, along with the shared Drizzle types the SPA currently imports. Until that cutover, production keeps the last Express deploy; this work must not ship an Express-less Vercel build.

Unauthenticated API calls return 401 (FastAPI), not Express’s redirect to `/`. Stripe uses FastAPI’s webhook plus `STRIPE_WEBHOOK_SECRET`. Replit Stripe-sync and Replit image/batch helpers are not ported.

## User Stories

1. As a merchant, I want the app’s API to keep working while the backend moves, so that I can still upload images, generate copy, and push to Shopify.
2. As a merchant, I want to stay signed in on `www` while the API lives on `api.`, so that I am not asked to log in twice.
3. As a merchant with an expired session, I want the API to return 401, so that the SPA can treat me as signed out instead of choking on HTML from a redirect.
4. As a merchant, I want image upload to keep accepting large batches, so that a 200-file drop still works after the API leaves Vercel.
5. As a merchant, I want listing generation and field regeneration to stream, so that I still see SSE progress after the API leaves Vercel.
6. As a merchant, I want Stripe checkout, subscription status, cancel, and recover to keep working, so that billing does not break at cutover.
7. As a merchant, I want Shopify connect, status, disconnect, OAuth, and push-to-Shopify to keep working, so that my store connection survives the move.
8. As a merchant who is not signed in, I want public config endpoints (Clerk publishable key, payments config) to still load, so that the SPA can boot.
9. As a developer, I want `npm run dev` to start only Vite and FastAPI, so that I am not running a backend we are deleting.
10. As a developer, I want every local `/api` request from the SPA to hit FastAPI, so that local behaviour matches the target backend.
11. As a developer, I want Postgres via compose and Alembic migrations to remain the local database path, so that I am not using Drizzle push as the source of truth.
12. As a developer, I want Express to remain deployable on Vercel until Railway is live, so that production does not 502 during the migration.
13. As a developer, I want the SPA to call relative `/api` until cutover, so that production Express keeps receiving traffic without a client change.
14. As a developer, I want a single API-origin helper, so that setting one env var at cutover points the SPA at `api.` without hunting fetch call sites.
15. As a developer, I want tests that prove unset origin stays relative and set origin prefixes `https://api.snapsyncai.co.uk`, so that cutover is a config change, not a guess.
16. As a developer, I want FastAPI to send CORS credentials for `https://www.snapsyncai.co.uk`, so that the browser will call `api.` with the Clerk cookie.
17. As an operator, I want FastAPI on Railway (always-on process), so that SSE and uploads are not subject to Vercel serverless limits or cold starts.
18. As an operator, I want `api.snapsyncai.co.uk` to terminate TLS on Railway, so that the SPA has a stable API host.
19. As an operator, I want `/api/health` and `/api/health/db` on Railway, so that I can prove the service is up before cutting traffic.
20. As an operator, I want Stripe’s webhook endpoint switched to `api.` at cutover, so that subscription events land in FastAPI.
21. As an operator, I want Shopify’s OAuth redirect and app URLs switched to `api.` at cutover, so that connect still completes.
22. As an operator, I want Clerk authorized parties to keep including `www` (and the apex spelling), so that session tokens are still accepted on the API.
23. As an operator, I want to delete Express, the Vercel API handler, Fly config, Express-only tests, and `shared/` only after production is on Railway, so that we do not remove the working production API first.
24. As a developer, I want SPA `Image` types and path helpers to live in the client once Express is gone, so that the frontend does not depend on Drizzle.
25. As a developer, I want Replit Stripe-sync and Replit image/batch helpers gone with Express, so that we do not carry a second Stripe path.
26. As a future agent, I want this migration recorded as an ADR, so that nobody “fixes” the subdomain back into a Vercel rewrite.

## Implementation Decisions

- SPA stays on Vercel. FastAPI is the only backend and runs on Railway behind `https://api.snapsyncai.co.uk`.
- Do not use Vercel rewrites to the API host. The SPA will call the subdomain directly after cutover (avoids SSE buffering and upload body limits on Vercel’s proxy).
- Fly is not the API host. Existing Fly config is leftover and is removed with Express, not used as the deploy target.
- Express remains the production `/api` handler until Railway is verified live and DNS, Stripe webhook, Shopify OAuth, and the SPA origin env all point at `api.`. Then Express is deleted in the same effort as `shared/` (client takes over types and path helpers). Do not delete `shared/` earlier: Express still imports it.
- Locally, stop running Express immediately. Vite proxies all `/api` to FastAPI. Express source stays so Vercel production still builds.
- API origin seam: one helper used by SPA fetches. Unset → relative `/api` (local Vite proxy and current production). Set to `https://api.snapsyncai.co.uk` → absolute URLs (cutover). `credentials: include` stays.
- FastAPI CORS allow list includes `https://www.snapsyncai.co.uk` (and the apex if needed). Cookie is parent-domain scoped.
- Unauthenticated product routes: 401 JSON, not a redirect to `/`.
- Stripe: FastAPI webhook + `STRIPE_WEBHOOK_SECRET` only. Do not port `stripe-replit-sync`, managed Replit webhooks, or mirror tables (they are not read).
- Do not port Replit image/batch integrations. Dead unmounted generate-image route dies with Express.
- Schema source of truth remains Alembic. Drizzle leaves with Express.
- Dashboard cutover (Railway project, secrets, DNS, Stripe webhook URL, Shopify OAuth URLs, Vercel origin env) is human-owned. Agents prepare repo config and the origin helper; they do not click the dashboards.
- Do not deploy an Express-less commit to Vercel before that cutover.

## Testing Decisions

- Test external behaviour, not Vite internals or Railway.
- Primary seam: the API origin helper. Cases: unset returns the relative path; set prefixes the Railway API origin; existing `/api` paths are unchanged. Callers (JSON fetch, query function, path builder) use the helper.
- Secondary, existing: FastAPI TestClient. Assert CORS allows `www` with credentials when the allow list is configured. Health remains the liveness check.
- Prior art: FastAPI tests already use TestClient against the app factory. There are no proxy unit tests; do not add tests for a path-splitter that is being removed.
- Do not test Express. After deletion, Express tests go away with it.
- Cutover itself is verified operationally (`/api/health`, `/api/health/db` on Railway, one authenticated SPA action on production) rather than by a new production test harness.

## Out of Scope

- Moving the SPA onto Railway
- Running FastAPI on Vercel
- Vercel `/api` rewrites to Railway or Fly
- Porting `stripe-replit-sync` or Replit image/batch
- Restoring Instagram, voice, or auto-group routes (absent from both backends)
- Generating client types from OpenAPI
- FastAPI serving the built SPA
- Changing Clerk, Stripe, or Shopify product behaviour beyond host URLs and 401 vs redirect

## Further Notes

ADR `0001` records Railway + `api.` vs Vercel rewrite vs Fly. Shopify OAuth and Stripe webhooks must target `api.` at cutover or those flows break even if the SPA origin is correct. Local `dev` that still embeds Vite in Express should be replaced so developers cannot accidentally exercise Express.
