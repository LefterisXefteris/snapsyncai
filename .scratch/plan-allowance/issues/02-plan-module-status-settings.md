# 02 — Plan module, status, and Settings meter

**Parent:** `.scratch/plan-allowance/spec.md`

**What to build:** The seller sees whether they are free, on a Plan, leftover weekly, or local bypass, and how many of 20 Allowance uses they have used this UTC calendar month (plus overage count). Payments config is £19/month, £190/year, 20 uses, £1.50 extra. Local bypass still has a full workspace without Stripe. Tests hit the Plan module with a fake clock; Stripe is not called.

**Blocked by:** None — can start immediately.

**Status:** done

- [x] Plan module: free cannot run Plan jobs; Plan has 20 included uses per UTC calendar month; unused do not carry over; 21st is overage and still allowed; leftover weekly is 30 per UTC week then a hard stop; local bypass is unlimited and unbilled
- [x] Spend ledger exists; module views it through an in-memory sequence in tests
- [x] GET subscription status returns entitlement, used, included, overage, period end
- [x] GET payments config returns Plan prices and Allowance, not weekly £4 / 30 products
- [x] Settings billing copy shows Plan / Allowance, not Pro unlock
- [x] Tests do not create Stripe Checkout sessions
