# 03 — Checkout is a Plan, return to the workspace

**Parent:** `.scratch/plan-allowance/spec.md`

**What to build:** Subscribe in Settings starts a monthly or annual Plan only. After Stripe, the seller returns to the workspace origin and the Plan is active (webhook or verify/recover). Cancel still ends at period end. Nobody new can buy weekly £4.

**Blocked by:** 02 — Plan module, status, and Settings meter

**Status:** done

- [x] create-checkout uses Plan monthly/annual prices (£19 / £190), not weekly £4
- [x] success and cancel URLs use the workspace origin (APP_BASE_URL), not the API host
- [x] Webhook, verify, and recover still attach an active Plan
- [x] Cancel at period end unchanged
- [x] Stripe SDK is faked in tests; no live Checkout in CI
