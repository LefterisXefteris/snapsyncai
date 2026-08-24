## Parent

lisai-app-3p3

## What to build

Production browser traffic uses `api.`. The SPA origin env on Vercel is `https://api.snapsyncai.co.uk`. Stripe webhook and Shopify OAuth URLs point at `api.`. A signed-in merchant can complete a real flow (upload or generate) against Railway. Express remains on Vercel as rollback until the delete ticket.

## Acceptance criteria

- [ ] Vercel production has `VITE_API_BASE_URL=https://api.snapsyncai.co.uk` and a rebuilt SPA
- [ ] Stripe webhook URL is `https://api.snapsyncai.co.uk/api/stripe/webhook`
- [ ] Shopify OAuth redirect/app URLs use `api.`
- [ ] A signed-in production session can upload or generate against Railway
- [ ] Unauthenticated API calls return 401, not a redirect to `/`

## Blocked by

Ticket 2 (origin helper) and ticket 3 (Railway live on `api.`).
