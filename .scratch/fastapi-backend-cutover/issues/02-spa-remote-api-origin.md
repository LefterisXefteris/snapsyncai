## Parent

lisai-app-3p3

## What to build

The SPA can target a remote API origin through one helper. Unset, fetches stay relative `/api` (local Vite proxy and current production Express). Set to `https://api.snapsyncai.co.uk`, fetches go there with credentials. FastAPI allows CORS from `www` with credentials. The API service is Railway-deployable. Production origin env stays unset.

## Acceptance criteria

- [ ] All SPA `/api` fetches go through one origin helper
- [ ] Tests: unset → relative path; set → prefixed with `https://api.snapsyncai.co.uk`
- [ ] FastAPI TestClient shows CORS allowing `https://www.snapsyncai.co.uk` with credentials when the allow list is configured
- [ ] Repo config is sufficient to deploy FastAPI to Railway (Fly is not the target)
- [ ] Production is unchanged: origin env unset, Vercel still routes `/api` to Express

## Blocked by

None — can start immediately (parallel with local FastAPI-only).
