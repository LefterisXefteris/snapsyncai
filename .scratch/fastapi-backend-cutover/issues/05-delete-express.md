## Parent

lisai-app-3p3

## What to build

Express is gone. The TypeScript server, Vercel API handler, Fly config, Express-only tests, and `shared/` are removed. The SPA owns its `Image` type and path helpers. Vercel serves only the SPA. Local and production backends are FastAPI only.

## Acceptance criteria

- [ ] No Express process or Vercel `/api` serverless handler remains
- [ ] SPA types and path helpers live in the client; `shared/` is gone
- [ ] Fly is not referenced as a deploy target
- [ ] Replit Stripe-sync and Replit image/batch helpers are gone
- [ ] Local `dev` still runs Vite + FastAPI
- [ ] Production `/api` is Railway only (Vercel no longer handles `/api`)

## Blocked by

Ticket 1 (local FastAPI-only) and ticket 4 (production SPA uses `api.`).
