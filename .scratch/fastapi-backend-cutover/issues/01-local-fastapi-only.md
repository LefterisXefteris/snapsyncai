# 01 — Local FastAPI only

**Parent:** `.scratch/fastapi-backend-cutover/spec.md`

**What to build:** A developer running the normal local command gets Vite and FastAPI only. Every `/api` request from the SPA hits FastAPI. Express is not started. Express source remains in the repo so production Vercel still has an API handler.

**Blocked by:** None — can start immediately.

**Status:** done

- [x] The default local command starts Vite and FastAPI, not Express
- [x] Every `/api` path from the SPA is proxied to FastAPI (no Express fallback)
- [x] `/api/health` through the Vite origin returns FastAPI’s health payload
- [x] Express source is still present so a Vercel production build still has an API
- [x] The old Express-embedded Vite command is not the documented local path

## Comments

Closed to match git (`20a4699`). The keep-Express criterion was true for this ticket; ticket 05 later removed Express.
