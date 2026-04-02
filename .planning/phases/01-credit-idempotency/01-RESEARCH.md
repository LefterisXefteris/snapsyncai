# Phase 01: Credit Idempotency - Research

**Researched:** 2026-03-31
**Domain:** PostgreSQL atomic UPDATE, Drizzle ORM transactions, Express route idempotency
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- Return `200 OK` on duplicate verify calls — fully idempotent, client cannot tell whether this was the first or a duplicate call
- Minimal response: just return success status; credit balance is fetched separately by existing TanStack Query
- No logging on duplicates — silent is fine; duplicate verify calls are expected behavior
- Return `200 OK` to Stripe when the session was already processed — prevents Stripe from retrying
- Fix applied to **both** paths independently: both verify and webhook check `paidSessions.used` before calling `addCredits()` — either can run first, both are safe
- No canonical source of truth — the idempotency check makes both paths safe to race
- Nothing changes in the UI on reload — UI behaves exactly the same on reload as on first load
- No toast, no banner, no special state for "already credited"
- The `paidSessions.used` column already exists in the schema — no migration needed

### Claude's Discretion

- Exact atomic mechanism (UPDATE WHERE used = false vs SELECT FOR UPDATE — choose what's safest for PostgreSQL + Drizzle)
- Whether to use a DB transaction wrapping the check + grant
- Response body shape for the 200 (keep consistent with current shape)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PAY-01 | Stripe checkout session credit grant is idempotent — `paidSessions.used` is checked and set atomically before `addCredits()` is called; repeated calls with the same `checkoutSessionId` grant credits exactly once | Atomic UPDATE WHERE pattern documented in Architecture Patterns section; Drizzle `returning()` on UPDATE confirmed available |

</phase_requirements>

---

## Summary

The bug is a double-spend: both `POST /api/credits/verify` (routes.ts:1047–1075) and the Stripe webhook handler (webhookHandlers.ts:32–43) call `storage.addCredits()` directly without first checking whether credits were already granted. The `paidSessions.used` column (`integer`, default `0`) already exists in the schema and is tracked in `markPaidSessionUsed()` in storage.ts, but neither code path consults it before granting.

The correct fix is a single-statement atomic `UPDATE paidSessions SET used = 1 WHERE checkoutSessionId = $1 AND used = 0 RETURNING id`. PostgreSQL row-level locking guarantees that only one concurrent call will receive a non-empty `RETURNING` result; the other will get an empty array and must skip `addCredits()`. This eliminates the race without requiring an explicit `SELECT FOR UPDATE` or application-level locks. Drizzle ORM 0.39.3 (installed) supports `returning()` on `UPDATE` for PostgreSQL.

A `db.transaction()` wrapper is needed around the atomic claim + `addCredits()` call to ensure the credit row is not incremented if the `paidSessions` update rolls back. The `db` export from `server/db.ts` is a `NodePgDatabase` instance which has `.transaction()` available — confirmed by type inspection.

**Primary recommendation:** Add a new `storage.claimPaidSessionForCredits(checkoutSessionId)` method that executes the atomic `UPDATE ... WHERE used = 0 RETURNING id` inside a transaction with `addCredits()`. Both the verify route and the webhook handler call this single method instead of `addCredits()` directly.

---

## Standard Stack

### Core (already installed — no new dependencies needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | 0.39.3 | ORM / query builder | Already the project ORM; `returning()` on UPDATE is PostgreSQL-specific and fully supported |
| pg | 8.16.3 | PostgreSQL client (Pool) | Already the project DB driver |
| express | 5.0.1 | HTTP framework | Already the project framework |
| stripe | 20.0.0 | Stripe SDK | Already in use for checkout and webhooks |

**No new packages required.** This phase is purely a logic fix.

**Version verification:** All versions read directly from installed `node_modules` — no npm registry lookup needed.

---

## Architecture Patterns

### Recommended Change Surface

```
server/
├── storage.ts          — add claimPaidSessionForCredits() method to IStorage + DatabaseStorage
├── routes.ts           — replace addCredits() call in /api/credits/verify with claimPaidSessionForCredits()
└── webhookHandlers.ts  — replace addCredits() call in checkout.session.completed handler with claimPaidSessionForCredits()
```

No new files. No schema migrations. No new routes.

### Pattern 1: Atomic UPDATE WHERE — the idempotency claim

**What:** A single SQL `UPDATE` statement with a `WHERE used = 0` predicate and `RETURNING id`. PostgreSQL acquires a row-level lock before evaluating the WHERE clause, so only one concurrent UPDATE wins. The winner gets a non-empty result array; all other callers get an empty array and skip credit granting.

**When to use:** Whenever a row must transition from state A to state B exactly once, even under concurrent callers. No application-level locks or advisory locks needed — PostgreSQL row locking makes this safe.

**Drizzle implementation:**

```typescript
// Source: Drizzle ORM pg-core query-builders — returning() on UPDATE is verified available
async claimPaidSessionForCredits(checkoutSessionId: string): Promise<boolean> {
  return await db.transaction(async (tx) => {
    // Atomic claim: only one concurrent caller gets a row back
    const claimed = await tx
      .update(paidSessions)
      .set({ used: 1 })
      .where(
        and(
          eq(paidSessions.checkoutSessionId, checkoutSessionId),
          eq(paidSessions.used, 0)
        )
      )
      .returning({ id: paidSessions.id });

    if (claimed.length === 0) {
      // Already processed — duplicate call, do nothing
      return false;
    }

    return true;
  });
}
```

The caller then calls `storage.addCredits()` only when `claimPaidSessionForCredits()` returns `true`.

**Alternative considered:** `SELECT FOR UPDATE` inside a transaction.
- Requires two round-trips (SELECT then UPDATE).
- More verbose and not materially safer than single-statement UPDATE WHERE.
- Rejected in favour of single-statement UPDATE WHERE.

### Pattern 2: Verify endpoint — idempotent response

**Current code (routes.ts:1047–1075):**
- Fetches Stripe session, validates payment, calls `addCredits()` unconditionally.

**After fix:**
```typescript
// After Stripe validation succeeds and credits/userId are confirmed:
const claimed = await storage.claimPaidSessionForCredits(checkoutSessionId);
if (!claimed) {
  // Duplicate — return success anyway (fully idempotent)
  const row = await storage.getUserCredits(userId);
  return res.json({ verified: true, credits, balance: row?.balance ?? 0 });
}
await storage.addCredits(userId, credits);
const row = await storage.getUserCredits(userId);
res.json({ verified: true, credits, balance: row?.balance ?? credits });
```

Note: `claimPaidSessionForCredits` only checks the `paidSessions` record. The verify route must still do its own userId + credits extraction from Stripe (lines 1060–1065) before calling claim — claim does not know about `userId` or `credits`.

**Implication:** `paidSessions` record must exist before claim is called. The verify route needs to find or create the `paidSessions` row. The webhook path creates it implicitly (Stripe sends the event). The verify path calls `storage.getPaidSession()` — if the row doesn't exist, the verify path must handle that gracefully (create it, or use a fallback).

**Critical finding:** The verify endpoint does NOT currently create a `paidSessions` row — it only calls `addCredits()`. The webhook handler also only calls `addCredits()`. The `createPaidSession()` storage method exists but is called elsewhere (search needed).

### Pattern 3: Webhook handler — silent 200 on duplicate

**Current code (webhookHandlers.ts:32–43):**
- Calls `addCredits()` unconditionally on `checkout.session.completed` + `mode === 'payment'`.

**After fix:**
```typescript
if (type === 'checkout.session.completed' && data.mode === 'payment') {
  const userId = data.metadata?.userId;
  const credits = Number(data.metadata?.credits);
  const sessionId = data.id; // Stripe checkout session ID
  if (userId && credits > 0) {
    try {
      const claimed = await storage.claimPaidSessionForCredits(sessionId);
      if (claimed) {
        await storage.addCredits(userId, credits);
      }
      // If !claimed: already processed — return without error (Stripe gets 200)
    } catch (e) {
      console.error("Webhook: Error adding credits:", e);
    }
  }
}
```

### Anti-Patterns to Avoid

- **SELECT then UPDATE (two-phase check):** Any approach that does `getPaidSession()` and then checks `used` in JavaScript, then calls `markPaidSessionUsed()` in a separate statement — this is a classic TOCTOU race. Two concurrent callers both read `used = 0`, both proceed to grant. PostgreSQL row locking only helps when the check and the update are the same SQL statement.
- **Application-level mutex/in-memory lock:** Not viable on Vercel serverless — each invocation may be a different process. The lock must live in PostgreSQL.
- **Wrapping only `addCredits()` without the claim:** The atomicity guarantee must span the claim (`UPDATE paidSessions`) and the grant (`addCredits`) in the same transaction. If the transaction is omitted, `paidSessions.used` could be set to 1 while `addCredits` fails, permanently blocking legitimate credit grants.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Atomic claim under concurrency | Application mutex, Redis lock | Single `UPDATE WHERE used=0 RETURNING id` | PostgreSQL row-level locking handles this natively; no external dependency |
| Transaction management | Manual `BEGIN`/`COMMIT` via raw SQL | `db.transaction(async tx => {...})` | Drizzle 0.39.3 exposes `.transaction()` on `NodePgDatabase` — already confirmed available |
| Idempotency token storage | New table | Existing `paidSessions.used` column | Column already exists in schema — no migration |

**Key insight:** PostgreSQL's write-intent row lock is acquired at the UPDATE statement level, not at SELECT time. An `UPDATE ... WHERE used = 0` is the simplest and most correct atomic check-and-set available without advisory locks or separate locking tables.

---

## Common Pitfalls

### Pitfall 1: paidSessions row may not exist when verify fires first

**What goes wrong:** The verify endpoint fires before Stripe sends the webhook. `claimPaidSessionForCredits()` looks up the `paidSessions` row by `checkoutSessionId`. If the row doesn't exist, the UPDATE matches zero rows and returns empty — looks like "already used" — and credits are silently never granted.

**Why it happens:** `paidSessions` rows are created by a different code path (checkout session creation, not credit granting). Need to verify where `createPaidSession()` is called.

**How to avoid:** The claim method (or the caller) must handle "row not found" differently from "row found but already used". Options:
1. `INSERT ... ON CONFLICT DO NOTHING` to ensure row exists before UPDATE — but the row's `checkoutSessionId` uniqueness constraint means this is safe.
2. The verify route creates the `paidSessions` row if absent (using data from the Stripe session object already fetched) before calling claim.
3. Use an `INSERT ... ON CONFLICT (checkoutSessionId) DO UPDATE SET used=1 WHERE paidSessions.used=0 RETURNING id` — single-statement upsert-and-claim.

**Warning signs:** Credits never granted when user completes payment and hits the success page before the webhook fires.

**Recommended resolution for planner:** Investigate where `createPaidSession()` is called. If it's only called during the initial checkout session creation flow (not by the verify or webhook paths), the verify path needs to handle row creation. This must be clarified in the plan.

### Pitfall 2: `used` column is integer (0/1), not boolean

**What goes wrong:** Using Drizzle's `eq(paidSessions.used, false)` or comparing to `null` when the column holds `0`.

**Why it happens:** `schema.ts:139` defines `used: integer("used").default(0)`. TypeScript will accept `0` but JavaScript's falsy coercion means `used === 0` and `!used` are both true — however Drizzle ORM generates SQL with the literal value, so `eq(paidSessions.used, 0)` produces `WHERE used = 0` which is correct. `eq(paidSessions.used, false)` would produce `WHERE used = false` which PostgreSQL coerces but is non-idiomatic.

**How to avoid:** Use `eq(paidSessions.used, 0)` explicitly.

### Pitfall 3: Transaction omitted — claim and grant not atomic together

**What goes wrong:** `claimPaidSessionForCredits()` updates `paidSessions.used = 1` but `addCredits()` is called outside the transaction. If `addCredits()` throws, `paidSessions.used` is already 1 and credits are permanently lost.

**How to avoid:** The transaction must wrap both the UPDATE on `paidSessions` and the `addCredits()` INSERT/UPDATE on `userCredits`. Either put both inside `claimPaidSessionForCredits()` (requires passing userId and credits to the method) or keep them separate but ensure the caller handles rollback (harder). The cleanest design: `claimAndGrantCredits(checkoutSessionId, userId, credits)` — does both inside one transaction.

**Warning signs:** Users report "payment went through but no credits appeared" after a transient DB error.

### Pitfall 4: Webhook receives raw string session ID vs. Stripe session object field

**What goes wrong:** In `webhookHandlers.ts`, the checkout session data is `event.data.object`. The `checkoutSessionId` to use for the claim is `data.id` — the Stripe checkout session ID (e.g. `cs_live_...`). The verify endpoint receives it as `req.body.checkoutSessionId`, which the client sends after redirecting from Stripe's success URL. Both must refer to the same string. If the wrong field is used in either path, the claim check will always miss.

**How to avoid:** Confirm the `checkoutSessionId` stored in `paidSessions` is the same format (and value) that both paths use to look it up. The `paidSessions` table has `checkoutSessionId: text(...).unique()`.

---

## Code Examples

### Verified: Drizzle UPDATE with WHERE + RETURNING (PostgreSQL only)

```typescript
// Drizzle ORM 0.39.3 — pg-core UPDATE with RETURNING confirmed via type inspection
// Source: node_modules/drizzle-orm/pg-core/query-builders/update.d.ts
import { eq, and } from "drizzle-orm";
import { db } from "./db";
import { paidSessions } from "@shared/schema";

const claimed = await db
  .update(paidSessions)
  .set({ used: 1 })
  .where(and(eq(paidSessions.checkoutSessionId, checkoutSessionId), eq(paidSessions.used, 0)))
  .returning({ id: paidSessions.id });

const wasFirstClaim = claimed.length > 0;
```

### Verified: Drizzle transaction API

```typescript
// db.transaction() confirmed available on NodePgDatabase
// Source: node_modules/drizzle-orm/pg-core/db.d.ts line 277
await db.transaction(async (tx) => {
  const claimed = await tx
    .update(paidSessions)
    .set({ used: 1 })
    .where(and(eq(paidSessions.checkoutSessionId, checkoutSessionId), eq(paidSessions.used, 0)))
    .returning({ id: paidSessions.id });

  if (claimed.length === 0) return; // already used

  await tx
    .insert(userCredits)
    .values({ userId, balance: credits, lifetimeCredits: credits })
    .onConflictDoUpdate({
      target: userCredits.userId,
      set: {
        balance: sql`${userCredits.balance} + ${credits}`,
        lifetimeCredits: sql`${userCredits.lifetimeCredits} + ${credits}`,
        updatedAt: new Date(),
      },
    });
});
```

### Current markPaidSessionUsed (for reference — not atomic enough alone)

```typescript
// server/storage.ts:255-259 — current implementation (non-atomic, not safe for concurrency)
async markPaidSessionUsed(checkoutSessionId: string, usedCount: number): Promise<void> {
  await db.update(paidSessions)
    .set({ used: usedCount })
    .where(eq(paidSessions.checkoutSessionId, checkoutSessionId));
}
// Missing: WHERE used = 0 predicate — does not protect against concurrent calls
```

---

## Open Questions

1. **Where is `createPaidSession()` called?**
   - What we know: The method exists in `DatabaseStorage` and the `IStorage` interface. The verify route and webhook handler do NOT call it.
   - What's unclear: Is a `paidSessions` row always guaranteed to exist by the time either the verify endpoint or webhook fires? If not, the atomic UPDATE WHERE will silently no-op on the first legitimate call.
   - Recommendation: The planner must trace `createPaidSession()` call sites in `server/routes.ts` to confirm the row is created during checkout session creation. If not, the claim method must handle row creation.

2. **Design choice: single `claimAndGrantCredits()` vs. separate claim + grant**
   - What we know: A transaction must wrap both steps (claim on `paidSessions`, grant on `userCredits`) to avoid permanent credit loss on partial failure.
   - What's unclear: Whether the planner prefers a single combined method (simpler callers) or keeping claim and grant as separate storage methods (more composable, but callers must use `db.transaction()` themselves).
   - Recommendation: Single combined method `claimAndGrantCredits(checkoutSessionId, userId, credits): Promise<boolean>` returns `true` if credits were granted, `false` if duplicate. This simplifies both call sites identically.

---

## Environment Availability

Step 2.6: SKIPPED — this phase is a pure code/logic fix with no external dependencies beyond the existing PostgreSQL database and Stripe SDK, both already available and in use.

---

## Validation Architecture

### Test Framework

No test framework is installed in this project. There are zero `.test.ts` or `.spec.ts` files in the project source. Test dependencies are absent from `package.json`.

| Property | Value |
|----------|-------|
| Framework | None installed |
| Config file | None |
| Quick run command | `tsc --noEmit` (type check only) |
| Full suite command | `tsc --noEmit` (type check only) |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PAY-01 | First call grants credits; second call is no-op | manual-only | — | N/A |
| PAY-01 | Concurrent verify + webhook grant credits exactly once | manual-only | — | N/A |
| PAY-01 | Webhook after already-processed session returns 200 to Stripe | manual-only | — | N/A |

**Manual-only justification:** The project has no test framework. Integration tests for this behavior require a live PostgreSQL connection and Stripe test mode. Setting up a test framework is explicitly out of scope per REQUIREMENTS.md. Validation for this phase is by manual verification (curl duplicate POST to verify endpoint; check DB `paidSessions.used` value; check `userCredits.balance` incremented exactly once).

### Wave 0 Gaps

- [ ] No test framework — manual testing only. Install vitest + supertest + testcontainers-node if a test phase is approved separately.

*(Existing infrastructure: none. No Wave 0 test file setup is in scope for this phase.)*

---

## Sources

### Primary (HIGH confidence)

- `server/storage.ts` — DatabaseStorage class, `addCredits`, `getPaidSession`, `markPaidSessionUsed` implementations read directly
- `shared/schema.ts` — `paidSessions` table definition; `used: integer("used").default(0)` confirmed
- `server/routes.ts:1047–1075` — verify endpoint; current non-idempotent `addCredits()` call confirmed
- `server/webhookHandlers.ts:32–43` — webhook handler; current non-idempotent `addCredits()` call confirmed
- `server/db.ts` — `NodePgDatabase` instance with `Pool`; `db.transaction()` confirmed available via type inspection
- `node_modules/drizzle-orm/pg-core/db.d.ts:277` — `transaction<T>()` method type signature verified
- `node_modules/drizzle-orm/pg-core/query-builders/update.d.ts` — `returning()` method on UPDATE verified available

### Secondary (MEDIUM confidence)

- PostgreSQL documentation on row-level locking semantics: `UPDATE ... WHERE` acquires write-intent locks before evaluating WHERE, ensuring atomicity under concurrent DML

### Tertiary (LOW confidence)

- None

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all libraries read directly from installed `node_modules`
- Architecture: HIGH — atomic UPDATE WHERE pattern is standard PostgreSQL; Drizzle API verified by type inspection
- Pitfalls: HIGH — sourced from reading the actual code and schema; race condition analysis is fundamental PostgreSQL concurrency knowledge

**Research date:** 2026-03-31
**Valid until:** 2026-04-30 (stable domain — no library churn expected)
