# 05 — Delete Express

**Parent:** `.scratch/fastapi-backend-cutover/spec.md`

**What to build:** Express is gone. The TypeScript server, Vercel API handler, Fly config, Express-only tests, and `shared/` are removed. The SPA owns its `Image` type and path helpers. Vercel serves only the SPA. Local and production backends are FastAPI only.

**Blocked by:** 01 — Local FastAPI only; 04 — Production SPA uses API

**Status:** done

- [x] No Express process or Vercel `/api` serverless handler remains
- [x] SPA types and path helpers live in the client; `shared/` is gone
- [x] Fly is not referenced as a deploy target
- [x] Replit Stripe-sync and Replit image/batch helpers are gone
- [x] Local `dev` still runs Vite + FastAPI
- [x] Production `/api` is Railway only (Vercel no longer handles `/api`)

## Comments

Closed to match git (`26108a6`, `0e2443d`).
