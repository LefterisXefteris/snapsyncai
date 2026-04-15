# Phase 10: Pricing Model Update - Context

**Gathered:** 2026-04-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the £19/month subscription with a £9/month + £79/year plan. Halve all credit pack prices. Auto-migrate existing £19/month subscribers to the new £9 plan. Update all pricing UI across the app.

This phase covers pricing changes and subscriber migration only — it does not add new subscription tiers, change what features subscribers get, or redesign the credit system structure.

</domain>

<decisions>
## Implementation Decisions

### Subscription pricing
- New monthly price: £9/month (900 pence) — replaces £19/month
- New annual price: £79/year (7900 pence) — 2 months free vs monthly
- Both plans grant identical unlimited access (same feature set as old £19/month)
- The old £19/month Stripe price must be archived so no new subscribers can use it

### Annual billing
- Annual is a second Stripe price on the same product (interval: year)
- Checkout and verify flows must handle both `monthly` and `annual` billing intervals
- Subscription status endpoint must correctly reflect both interval types
- UI shows both options side-by-side so users can choose at checkout

### Existing subscriber migration
- All existing £19/month subscribers are auto-migrated to £9/month at their next renewal
- Migration is done server-side via Stripe API: update the subscription's price to the new £9 price
- No user action required — migration runs silently (or with an in-app banner confirming the price drop)
- Migration script/endpoint must be idempotent: running it twice doesn't double-downgrade

### Credit pack pricing (halved)
- Starter: 10 credits → £4.50 (450 pence), was £9
- Growth: 50 credits → £17.50 (1750 pence), was £35
- Pro: 150 credits → £39.50 (3950 pence), was £79
- Pack structure (names, credit counts, 3 tiers) stays the same
- Credits and subscription remain independent — subscribers can still buy credit packs

### Claude's Discretion
- Whether to run the migration automatically on deploy vs via a one-time admin endpoint
- Exact Stripe API calls needed to update existing subscription prices
- Whether to show users a "Good news — your price dropped to £9/month" in-app notification

</decisions>

<specifics>
## Specific Ideas

- The annual plan should feel like a natural "save 2 months" value prop — standard SaaS positioning
- Migration should be invisible to users (price just gets cheaper), not feel like a disruption

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 10-pricing-model-update*
*Context gathered: 2026-04-15*
