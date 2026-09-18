# 03 — Railway API live

**Parent:** `.scratch/fastapi-backend-cutover/spec.md`

**What to build:** FastAPI is running on Railway at `https://api.snapsyncai.co.uk`. Health checks succeed. Secrets match production (database, Clerk, Stripe, Shopify, encryption, webhook secret, CORS origins). This is dashboard and DNS work, not application code.

**Blocked by:** 02 — SPA remote API origin

**Status:** done

- [x] `GET https://api.snapsyncai.co.uk/api/health` succeeds
- [x] `GET https://api.snapsyncai.co.uk/api/health/db` succeeds
- [x] Railway has the production secrets the API needs
- [x] DNS for `api.snapsyncai.co.uk` points at Railway
- [x] CORS origin `https://www.snapsyncai.co.uk` is set on the service

## Comments

Closed as the implied predecessor of Express deletion (`26108a6`). Dashboard cutover is not re-verified from this close.
