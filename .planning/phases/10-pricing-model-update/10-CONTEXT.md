# Phase 10: Pricing Model Update - Context

**Gathered:** 2026-04-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the entire pricing model with a flat weekly subscription — no credit system, no tiers, single price point. Weekly subscribers get up to 30 products per week. An annual option is available at a discount (2 months free). All credit-related code, UI, and Stripe products are removed.

**NOTE:** This replaces the prior Phase 10 scope (£9/month + credits migration). The new model is a full pivot away from credits entirely.

</domain>

<decisions>
## Implementation Decisions

### Pricing structure
- **Weekly plan:** £4/week, 30 products max per week
- **Annual plan:** 2 months free — annual price ≈ £4 × 52 × (10/12) ≈ £173/year (exact figure to be confirmed during planning — round to a clean number)
- No credit packs, no tiers, no per-product pricing — one plan, two billing intervals

### Weekly product cap
- 30 products max per week per subscriber
- Cap enforcement details (hard block vs soft warning, rolling 7-day vs calendar week reset) left to Claude's discretion during planning

### Credits removal — existing balances
- Users with existing credit balances are **refunded** to their payment method
- Refund logic must run before credits UI is removed

### Credits removal — purchases
- Credit pack purchases **disabled immediately** on launch — removed from UI and Stripe at the same time the new plan goes live
- No sunset period, no grace window

### Credits removal — UI
- Credits UI **completely removed**: sidebar credit count, top-up dialogs, credit history, credit pack purchase flows
- No hidden/disabled state — clean delete throughout the codebase

### Existing subscribers
- Migration approach not explicitly discussed — Claude to plan the safest path (auto-migrate to weekly equivalent or notify and let them choose)

### Claude's Discretion
- Exact annual price (round to £169, £170, or £173 — whatever feels cleanest)
- Weekly cap reset logic (rolling 7-day vs calendar week)
- How to surface the 30/week limit in the UI (counter, progress bar, tooltip)
- Existing subscriber migration mechanics

</decisions>

<specifics>
## Specific Ideas

- "No credits no nothing" — maximum simplicity. One price, one plan (weekly or annual billing).
- The 30/week cap is the only usage constraint. No upsell path, no overage charges.

</specifics>

<deferred>
## Deferred Ideas

- None raised during discussion.

</deferred>

---

*Phase: 10-pricing-model-update*
*Context gathered: 2026-04-19*
