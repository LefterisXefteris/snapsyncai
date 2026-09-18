# 06 — Overage on the invoice, leftover weekly unchanged

**Parent:** `.scratch/plan-allowance/spec.md`

**What to build:** The 21st Plan use in a calendar month still runs and is billed £1.50 on the Plan invoice (listing-copy writes and website share that meter). If Stripe meter report lags, listing copy still persists. Existing £4/week subscribers keep 30 writes per UTC week with a hard stop and no overage until they cancel or switch to a Plan. New checkouts stay Plan-only.

**Blocked by:** 03 — Checkout is a Plan, return to the workspace; 04 — Generate and listing copy refresh spend; 05 — Website handoff spends

**Status:** done

- [x] 21st successful Plan job is allowed and marked overage
- [x] Overage is reported through the Stripe adapter; tests fake the adapter
- [x] Persist succeeds even if overage report fails (retry later)
- [x] Leftover weekly: 30 per UTC week, then hard stop, no £1.50; Settings can switch to a Plan
- [x] No silent migration of weekly subscribers onto £19 + overage
