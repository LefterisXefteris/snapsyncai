# 02 — SPA remote API origin

**Parent:** `.scratch/fastapi-backend-cutover/spec.md`

**What to build:** The SPA can target a remote API origin through one helper. Unset, fetches stay relative `/api` (local Vite proxy and current production Express). Set to `https://api.snapsyncai.co.uk`, fetches go there with credentials. FastAPI allows CORS from `www` with credentials. The API service is Railway-deployable. Production origin env stays unset.

**Blocked by:** None — can start immediately (parallel with local FastAPI-only).

**Status:** done

- [x] All SPA `/api` fetches go through one origin helper
- [x] Tests: unset → relative path; set → prefixed with `https://api.snapsyncai.co.uk`
- [x] FastAPI TestClient shows CORS allowing `https://www.snapsyncai.co.uk` with credentials when the allow list is configured
- [x] Repo config is sufficient to deploy FastAPI to Railway (Fly is not the target)
- [x] Production is unchanged: origin env unset, Vercel still routes `/api` to Express

## Comments

Closed to match git (`20a4699`). The keep-production-on-Express criterion was true for this ticket; tickets 04–05 later pointed production at `api.` and removed Express.
