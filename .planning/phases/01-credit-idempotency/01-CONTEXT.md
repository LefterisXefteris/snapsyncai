# Phase 1: Credit Idempotency - Context

**Gathered:** 2026-03-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Make `POST /api/credits/verify` and the Stripe webhook (`checkout.session.completed`) idempotent — credits are granted exactly once per Stripe checkout session regardless of how many times either path fires. Both paths independently check and set `paidSessions.used` atomically. No new capabilities, no UI changes beyond the existing success page behavior.

</domain>

<decisions>
## Implementation Decisions

### Verify endpoint response (duplicate calls)
- Return `200 OK` — fully idempotent, client cannot tell whether this was the first or a duplicate call
- Minimal response: just return success status; credit balance is fetched separately by existing TanStack Query
- No logging on duplicates — silent is fine; duplicate verify calls are expected behavior

### Webhook duplicate handling
- Return `200 OK` to Stripe when the session was already processed — prevents Stripe from retrying
- Fix applied to **both** paths independently: both verify and webhook check `paidSessions.used` before calling `addCredits()` — either can run first, both are safe
- No canonical source of truth — the idempotency check makes both paths safe to race

### User-facing feedback on reload
- **Nothing changes** — UI behaves exactly the same on reload as on first load
- No toast, no banner, no special state for "already credited"
- The existing success page display is sufficient

### Claude's Discretion
- Exact atomic mechanism (UPDATE WHERE used = false vs SELECT FOR UPDATE — choose what's safest for PostgreSQL + Drizzle)
- Whether to use a DB transaction wrapping the check + grant
- Response body shape for the 200 (keep consistent with current shape)

</decisions>

<specifics>
## Specific Ideas

- The `paidSessions.used` column already exists in the schema — no migration needed for the idempotency flag
- The bug is confirmed actively exploited in production: users reload the Stripe success page and receive duplicate credits each time
- Both `POST /api/credits/verify` (`server/routes.ts` lines 1047–1075) and `server/webhookHandlers.ts` (lines 32–43) call `storage.addCredits()` — both must be patched
- The fix must handle the concurrent race (verify + webhook fire at nearly the same moment) — the atomic check is the critical part

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-credit-idempotency*
*Context gathered: 2026-03-31*
