# Deploying FastAPI to Railway

Production API traffic will terminate here at `https://api.snapsyncai.co.uk`.
The SPA stays on Vercel (`www`). Do not add Vercel rewrites to this host — the
SPA will call the subdomain directly after cutover.

`vercel.json` is **deliberately unchanged**. Production `/api` still runs on
Express until Railway is live, DNS/webhooks/OAuth point at `api.`, and
`VITE_API_ORIGIN` is set on the Vercel SPA. Fly is not the deploy target
(`fly.toml` is leftover).

## Local

`npm run dev` starts Postgres, FastAPI (`:8000`), and Vite (`:5001`). Every
`/api` request from the SPA is proxied to FastAPI. Express is not started.

```bash
curl -s http://localhost:5001/api/health
# {"status":"ok","service":"snapsyncai-api"}
```

## 1. Deploy

Create a Railway service with **root directory `api-py`**. It builds from
`Dockerfile` (`railway.toml`).

Set these on the service (same production values Express uses today):

```text
DATABASE_URL
CLERK_SECRET_KEY
CLERK_PUBLISHABLE_KEY
STRIPE_SECRET_KEY
STRIPE_PUBLISHABLE_KEY
STRIPE_WEBHOOK_SECRET
APP_BASE_URL=https://www.snapsyncai.co.uk
CORS_ALLOW_ORIGINS=https://www.snapsyncai.co.uk,https://snapsyncai.co.uk
SENTRY_DSN
SUPABASE_URL
SUPABASE_ANON_KEY
AI_INTEGRATIONS_OPENAI_API_KEY
SHOPIFY_API_KEY
SHOPIFY_API_SECRET
CONNECTION_ENCRYPTION_KEY
ENVIRONMENT=production
```

`DATABASE_URL` must be the **same database Express uses**.

`APP_BASE_URL` is load-bearing: it becomes Clerk's `authorized_parties`. Use the
**www** form — production canonicalises there. `app/config.py` accepts both
spellings regardless.

`CORS_ALLOW_ORIGINS` is required once the SPA calls `api.` from `www` with
credentials. Comma-separated or JSON list.

Do **not** set `VITE_API_ORIGIN` on Vercel until cutover (ticket lisai-app-3p3.4).

## 2. Verify before routing any traffic

```bash
curl https://api.snapsyncai.co.uk/api/health     # {"status":"ok","service":"snapsyncai-api"}
curl https://api.snapsyncai.co.uk/api/health/db  # proves database connectivity
```

DNS, Stripe webhook URL, and Shopify OAuth redirect must point at `api.` at
cutover or those flows break even if the SPA origin is correct. That dashboard
work is ticket lisai-app-3p3.3.

## Behaviour change to accept at cutover: 401 instead of 307

Verified against live production:

```
GET https://www.snapsyncai.co.uk/api/shopify/status   (no cookie)
  Express  ->  307, Location: /
  FastAPI  ->  401, {"detail":"Unauthenticated"}
```

401 is what `queryClient.ts` is written for. The SPA should treat it as signed
out instead of choking on HTML from a redirect.

## 3. Cut over the SPA

Set `VITE_API_ORIGIN=https://api.snapsyncai.co.uk` on the Vercel SPA build
(ticket lisai-app-3p3.4). Until that env is set, fetches stay relative `/api`
and production Express keeps receiving traffic.

## 4. Rollback

Unset `VITE_API_ORIGIN` on Vercel and redeploy. Traffic returns to Express.
No data migration, nothing to undo.
