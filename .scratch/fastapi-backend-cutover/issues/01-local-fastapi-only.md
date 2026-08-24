## Parent

lisai-app-3p3

## What to build

A developer running the normal local command gets Vite and FastAPI only. Every `/api` request from the SPA hits FastAPI. Express is not started. Express source remains in the repo so production Vercel still has an API handler.

## Acceptance criteria

- [ ] The default local command starts Vite and FastAPI, not Express
- [ ] Every `/api` path from the SPA is proxied to FastAPI (no Express fallback)
- [ ] `/api/health` through the Vite origin returns FastAPI’s health payload
- [ ] Express source is still present so a Vercel production build still has an API
- [ ] The old Express-embedded Vite command is not the documented local path

## Blocked by

None — can start immediately.
