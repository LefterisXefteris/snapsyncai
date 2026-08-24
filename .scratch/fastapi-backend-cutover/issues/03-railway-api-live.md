## Parent

lisai-app-3p3

## What to build

FastAPI is running on Railway at `https://api.snapsyncai.co.uk`. Health checks succeed. Secrets match production (database, Clerk, Stripe, Shopify, encryption, webhook secret, CORS origins). This is dashboard and DNS work, not application code.

## Acceptance criteria

- [ ] `GET https://api.snapsyncai.co.uk/api/health` succeeds
- [ ] `GET https://api.snapsyncai.co.uk/api/health/db` succeeds
- [ ] Railway has the production secrets the API needs
- [ ] DNS for `api.snapsyncai.co.uk` points at Railway
- [ ] CORS origin `https://www.snapsyncai.co.uk` is set on the service

## Blocked by

Ticket 2 (SPA remote API origin / Railway-deployable repo).
