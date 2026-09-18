# 04 — Production SPA uses API

**Parent:** `.scratch/fastapi-backend-cutover/spec.md`

**What to build:** Production browser traffic uses `api.`. The SPA origin env on Vercel is `https://api.snapsyncai.co.uk`. Stripe webhook and Shopify OAuth URLs point at `api.`. A signed-in merchant can complete a real flow (upload or generate) against Railway. Express remains on Vercel as rollback until the delete ticket.

**Blocked by:** 02 — SPA remote API origin; 03 — Railway API live

**Status:** done

- [x] Vercel production has `VITE_API_BASE_URL=https://api.snapsyncai.co.uk` and a rebuilt SPA
- [x] Stripe webhook URL is `https://api.snapsyncai.co.uk/api/stripe/webhook`
- [x] Shopify OAuth redirect/app URLs use `api.`
- [x] A signed-in production session can upload or generate against Railway
- [x] Unauthenticated API calls return 401, not a redirect to `/`

## Comments

Closed as the implied predecessor of Express deletion (`26108a6`). Dashboard cutover is not re-verified from this close.
