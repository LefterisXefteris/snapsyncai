# Phase 10: Pricing Model Update (COMPLETE PIVOT) - Research

**Researched:** 2026-04-19
**Domain:** Stripe billing, pricing migration, weekly subscription caps, credit system removal
**Confidence:** HIGH (Stripe API verified via official docs; codebase directly read)

---

## Summary

The existing app has a monthly/annual subscription model (£9/mo, £79/yr) plus a per-product credit system (3 packs: Starter 10 credits £4.50, Growth 50 credits £17.50, Pro 150 credits £3.95). The new model replaces everything with a single weekly subscription (£4/week, 30 products/week cap) plus an annual option (2 months free). The credit system is removed entirely.

Stripe natively supports `interval: 'week'` for recurring prices — no workarounds needed. Migrating existing subscribers requires iterating `subscriptions.update()` with the new price ID and `proration_behavior: 'none'` so they pay the old price until their next billing date. The codebase already has a working migration route pattern (`/api/subscription/migrate-to-new-price`) that can be adapted directly.

The credit system spans: `userCredits` table (schema.ts), `storage.ts` methods (`getUserCredits`, `addCredits`, `deductCredits`, `claimAndGrantCredits`), server routes (`/api/credits/*`), hooks (`useCreditsBalance`, `usePurchaseCredits`, `useVerifyCredits`), and UI in `Home.tsx` (sidebar credit counter, "Buy more" button, Pricing/Credits dialog at line 1339) and `Landing.tsx` (credit packs section, full pricing section). The `paymentStatus` column on the `images` table and the `unlock-images` endpoint are the access gate that needs rethinking under the weekly cap model.

**Primary recommendation:** Add a weekly product count check (query `images` table for `createdAt >= monday_utc AND paymentStatus = 'paid'` per user), replace credit deduction with this cap check, remove all credit UI and routes, and run a migration endpoint to move existing subscribers to the new weekly price.

---

## Standard Stack

### Core (already in project — no new dependencies needed)
| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| stripe | latest (API `2025-08-27.basil`) | Stripe API client | In use — `stripeClient.ts` |
| drizzle-orm | current | Database ORM + query builder | In use — `schema.ts`, `db.ts` |
| drizzle-zod | current | Schema validation | In use |

All required capabilities (weekly billing, subscription updates, refunds, price archival) exist in the Stripe SDK already imported. No new packages needed.

---

## Architecture Patterns

### Stripe Weekly Price — Confirmed Native Support

Stripe natively supports `interval: 'week'`. Valid `recurring.interval` values: `day`, `week`, `month`, `year`. The `interval_count` parameter allows multiples (e.g., every 2 weeks).

```typescript
// Source: https://docs.stripe.com/api/prices/create
const price = await stripe.prices.create({
  product: productId,
  unit_amount: 400,        // £4.00 in pence
  currency: 'gbp',
  recurring: { interval: 'week' },
});
```

### Annual Price (2 months free)

Two modelling options:

**Option A — Discounted unit_amount on `interval: 'year'` (RECOMMENDED)**
```typescript
// £4/week * 50 weeks = £200 → round to £173 (saves £27 vs paying weekly for 52 weeks)
const price = await stripe.prices.create({
  product: productId,
  unit_amount: 17300,   // £173.00 in pence
  currency: 'gbp',
  recurring: { interval: 'year' },
});
```

**Option B — Coupon on weekly price** — not recommended. Coupon management adds complexity to checkout flow. Option A is how the existing annual plan is already modelled in the codebase.

### Existing Subscriber Migration Pattern

The codebase already has a working migration endpoint at `/api/subscription/migrate-to-new-price` (routes.ts line 1645). Pattern:
1. Protected by `MIGRATION_SECRET` env var
2. Fetches all active subscriptions from DB (`storage.getAllActiveSubscriptions()`)
3. Calls `stripe.subscriptions.update()` with `items: [{ id: subItem.id, price: newPriceId }]` and `proration_behavior: 'none'`

`proration_behavior: 'none'` means subscribers continue paying their current price until their next billing date, then the new weekly price kicks in. No surprise charges at migration time.

```typescript
// Source: routes.ts line 1669 — reuse this exact pattern
await stripe.subscriptions.update(sub.stripeSubscriptionId, {
  items: [{ id: subItem.id, price: newWeeklyPriceId }],
  proration_behavior: 'none',
});
```

### Price Archival Pattern

The codebase has `/api/subscription/archive-old-price` (routes.ts line 1690):
```typescript
await stripe.prices.update(oldPrice.id, { active: false });
```
Archiving (`active: false`) prevents new subscriptions from using the price. **Existing subscriptions on that price continue billing normally** — they are not affected. Must archive after migrating all subscribers. Both old monthly (900 pence) and old annual (7900 pence) prices need archiving, plus all 3 credit pack prices.

### Weekly Product Cap — Implementation

**No new DB column needed.** The `images` table already has `createdAt` (timestamp), `sessionId` (userId), `paymentStatus`, and `productGroupId`.

**Critical detail:** Count unique products, not image rows. A product with 3 images = 3 rows but = 1 product. Use `DISTINCT COALESCE(productGroupId, CAST(id AS text))`.

**Week boundary:** ISO week = UTC Monday 00:00:00. Consistent, timezone-predictable.

```typescript
// Add to storage.ts or inline in routes.ts
async function getWeeklyProductCount(userId: string): Promise<number> {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setUTCHours(0, 0, 0, 0);
  const day = weekStart.getUTCDay(); // 0=Sun, 1=Mon
  const diff = day === 0 ? -6 : 1 - day; // Roll to Monday
  weekStart.setUTCDate(weekStart.getUTCDate() + diff);

  const [result] = await db
    .select({
      count: sql<number>`count(distinct coalesce(${images.productGroupId}, cast(${images.id} as text)))`
    })
    .from(images)
    .where(
      and(
        eq(images.sessionId, userId),
        eq(images.paymentStatus, 'paid'),
        sql`${images.createdAt} >= ${weekStart}`
      )
    );
  return Number(result?.count ?? 0);
}
```

### Subscription Schema — Current State

```typescript
// shared/schema.ts line 151
export const subscriptions = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  stripeCustomerId: text("stripe_customer_id").notNull(),
  stripeSubscriptionId: text("stripe_subscription_id").notNull(),
  status: text("status").notNull().default("active"),
  currentPeriodEnd: timestamp("current_period_end"),
  createdAt: timestamp("created_at").defaultNow(),
});
```

No `billingInterval` column exists. To show "Renews weekly" vs "Renews annually" in UI, either add a column or derive from Stripe at status-check time. Adding a `billingInterval` column is cleaner.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Weekly billing | Custom recurring logic | `stripe.prices.create({ recurring: { interval: 'week' } })` | Stripe handles all billing natively |
| Subscriber migration | Custom price swap logic | Adapt existing `/api/subscription/migrate-to-new-price` route | Already battle-tested in this codebase |
| Price archival | Delete old prices | `stripe.prices.update(id, { active: false })` | Prices are immutable records; deletion not supported |
| Refund credit balances | Manual bank transfers | `stripe.refunds.create({ payment_intent: pi_xxx, amount: N })` | Stripe Refunds API handles automatically |
| Weekly product count | Counter column + reset job | Query `images` table with `createdAt >= weekStart` | Data already exists; no extra state to maintain |

---

## Common Pitfalls

### Pitfall 1: Migrating Without proration_behavior: 'none'
**What goes wrong:** Default is `create_prorations`, which charges/credits the difference immediately. A subscriber on £9/month moved to £4/week mid-period gets an unexpected charge.
**How to avoid:** Always use `proration_behavior: 'none'` in bulk migration. Old price until next billing date, then new price.
**Warning signs:** Unexpected invoices generated at migration time.

### Pitfall 2: Counting Weekly Products Incorrectly
**What goes wrong:** Counting `images` rows instead of unique products. A 3-image grouped product = 3 rows = 1 product. User hits cap at 10 products if you count rows.
**How to avoid:** Use `DISTINCT COALESCE(productGroupId, CAST(id AS text))`.
**Warning signs:** Users report cap triggering too early.

### Pitfall 3: Archiving Prices Before Migrating Subscribers
**What goes wrong:** Archiving a price doesn't affect existing subscriptions, but if you archive before migrating, the migration code looking for the old price by `unit_amount` will still find it (archive lookup uses `active: false`). However, the existing archive endpoint specifically lists only `active: true` prices when searching.
**How to avoid:** Run migration first, then archive. Keep the sequence documented.

### Pitfall 4: paymentStatus Under New Model
**What goes wrong:** Under credits model, images start `paymentStatus: 'unpaid'` and get set to `'paid'` when credits are spent. Under new model, subscriber uploads should be `'paid'` immediately if within cap.
**How to avoid:** At upload time (`/api/images/upload`), check subscription active AND weekly count < 30. If so, set `paymentStatus: 'paid'`. If cap exceeded, either block the upload (hard block) or set `'unpaid'` (soft). The existing `hasActiveSubscription` path already sets `'paid'` — extend this with the cap check.

### Pitfall 5: Weekly Reset Timezone Ambiguity
**What goes wrong:** "Week starts Monday" means different times for different users.
**How to avoid:** Define reset as UTC Monday 00:00:00. Document this for users ("resets every Monday at midnight UTC").

### Pitfall 6: Credit Balance Refunds Are Not Automatic
**What goes wrong:** Users who purchased credits but have remaining balance are owed money. Silently removing the credit system without refunding is a legal/trust issue.
**How to avoid:** Before removing credit routes, identify users with `userCredits.balance > 0`. Refund via Stripe. See credit refund flow section below.

### Pitfall 7: Webhook Handler Still Processing Credit Purchases
**What goes wrong:** `webhookHandlers.ts` line 32-48 handles `checkout.session.completed` with `mode === 'payment'` to grant credits. After credits are removed, this code path becomes dead but harmless — unless Stripe sends a webhook for an old credit purchase.
**How to avoid:** Remove the credit webhook handler branch, but only after all in-flight credit purchases have resolved.

---

## Credit Refund Flow (Critical Path)

**Data available:** `userCredits.balance` (remaining credits), `userCredits.lifetimeCredits`, `paidSessions` table (has `checkoutSessionId`, `amountPaid` in pence).

**To issue a Stripe refund, need `payment_intent` ID.** `paidSessions` stores Stripe checkout session IDs (`cs_xxx`), not payment intents. Bridge:
```typescript
const session = await stripe.checkout.sessions.retrieve(checkoutSessionId);
const paymentIntentId = session.payment_intent; // pi_xxx
```

**Refund flow:**
```typescript
// Source: https://docs.stripe.com/api/refunds/create
await stripe.refunds.create({
  payment_intent: paymentIntentId,
  amount: refundAmountPence, // partial refund — pence value of remaining credits
});
```

**Complication:** Users may have bought multiple packs (multiple `paidSessions` rows). Need to calculate partial refunds across multiple payment intents. Recommendation: **build an admin endpoint that returns a list of users with balances and estimated refund amounts; process refunds via Stripe Dashboard manually or approve them one by one**. Do not automate fully in Phase 10 — this is an operator task.

**Credit pack prices (for refund calculation):**
- Starter: 10 credits = £4.50 → 45p/credit
- Growth: 50 credits = £17.50 → 35p/credit
- Pro: 150 credits = £39.50 → ~26p/credit

Since we don't know which pack each remaining credit came from, use the lowest rate (26p/credit) for conservative refund, or the highest (45p/credit) for user-favorable refund. User-favorable is the right call legally.

---

## Code Examples

### New Weekly Price Creation
```typescript
// Source: Stripe API docs — https://docs.stripe.com/api/prices/create
const SUBSCRIPTION_WEEKLY_PRICE_PENCE = 400; // £4.00
let cachedWeeklyPriceId: string | null = null;

async function getOrCreateWeeklySubscriptionPriceId(): Promise<string> {
  if (cachedWeeklyPriceId) return cachedWeeklyPriceId;
  const stripe = await getUncachableStripeClient();
  const products = await stripe.products.list({ active: true, limit: 100 });
  const existingProduct = products.data.find(p => p.metadata?.type === 'weekly_subscription');

  if (existingProduct) {
    const prices = await stripe.prices.list({ product: existingProduct.id, active: true, limit: 10 });
    const match = prices.data.find(
      p => p.unit_amount === SUBSCRIPTION_WEEKLY_PRICE_PENCE
        && p.type === 'recurring'
        && (p.recurring as any)?.interval === 'week'
    );
    if (match) { cachedWeeklyPriceId = match.id; return match.id; }
  }

  let productId: string;
  if (existingProduct) {
    productId = existingProduct.id;
  } else {
    const product = await stripe.products.create({
      name: 'SnapSync AI',
      description: 'Up to 30 AI-powered product listings per week',
      metadata: { type: 'weekly_subscription' },
    });
    productId = product.id;
  }

  const price = await stripe.prices.create({
    product: productId,
    unit_amount: SUBSCRIPTION_WEEKLY_PRICE_PENCE,
    currency: 'gbp',
    recurring: { interval: 'week' },
  });
  cachedWeeklyPriceId = price.id;
  return cachedWeeklyPriceId;
}
```

### Weekly Cap Check in unlock-images Endpoint
```typescript
// Replaces the credit deduction block (routes.ts lines 1741-1780)
const WEEKLY_PRODUCT_LIMIT = 30;

const weeklyCount = await getWeeklyProductCount(userId);
const remaining = WEEKLY_PRODUCT_LIMIT - weeklyCount;

if (remaining <= 0) {
  return res.status(403).json({
    message: "Weekly limit reached",
    detail: `You've used all ${WEEKLY_PRODUCT_LIMIT} products for this week. Your limit resets on Monday.`,
    weeklyLimit: WEEKLY_PRODUCT_LIMIT,
    used: weeklyCount,
    resetsAt: nextMondayUTC(),
  });
}

// If partial unlock needed (more unpaid images than remaining cap):
const imagesToUnlock = unpaidImages.slice(0, remaining);
// Process imagesToUnlock, not all unpaidImages
```

### Subscription Migration to Weekly (adapt existing endpoint)
```typescript
// POST /api/subscription/migrate-to-weekly
// Protected by MIGRATION_SECRET

const newWeeklyPriceId = await getOrCreateWeeklySubscriptionPriceId();
const allSubs = await storage.getAllActiveSubscriptions();
let migrated = 0, skipped = 0;

for (const sub of allSubs) {
  const stripeSub = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId);
  const subItem = stripeSub.items.data[0];
  if (!subItem) { skipped++; continue; }

  // Skip if already on weekly price
  if ((subItem.price.recurring as any)?.interval === 'week') { skipped++; continue; }

  await stripe.subscriptions.update(sub.stripeSubscriptionId, {
    items: [{ id: subItem.id, price: newWeeklyPriceId }],
    proration_behavior: 'none',
  });
  migrated++;
}

res.json({ migrated, skipped, total: allSubs.length });
```

---

## Complete Credits UI Removal Inventory

All locations to delete (clean delete, not hidden):

**server/routes.ts**
- Line 284: `SUBSCRIPTION_MONTHLY_PRICE_PENCE` constant — replace with `SUBSCRIPTION_WEEKLY_PRICE_PENCE`
- Lines 287-291: `CREDIT_PACKS` constant — delete
- Lines 293-338: `cachedCreditPriceIds` + `getOrCreateCreditPackPriceId()` — delete
- Lines 344-385: `getOrCreateMonthlySubscriptionPriceId()` — delete (replaced by weekly)
- Line 1238-1241: `/api/payments/config` response — remove `subscriptionPricePence`, `subscriptionMonthlyPricePence`, `creditPacks`; add `subscriptionWeeklyPricePence`, `weeklyProductLimit`
- Lines 1249-1318: All `/api/credits/balance`, `/api/credits/purchase`, `/api/credits/verify` routes — delete

**server/storage.ts**
- Lines 78-81 (interface): `getUserCredits`, `addCredits`, `deductCredits`, `claimAndGrantCredits` — remove from interface
- Lines 312-398 (implementation): All four credit methods — delete

**server/webhookHandlers.ts**
- Lines 32-48: `checkout.session.completed` with `mode === 'payment'` handler — delete this branch

**client/src/hooks/use-images.ts**
- Line 36: `creditPacks` from `usePaymentConfig` return type — remove
- Lines 840-884: `useCreditsBalance`, `usePurchaseCredits`, `useVerifyCredits` — delete all three

**client/src/pages/Home.tsx**
- Line 8: Remove `useCreditsBalance`, `usePurchaseCredits`, `useVerifyCredits` from import
- Lines 62-64: Remove `creditsData`, `purchaseCredits`, `verifyCredits` declarations
- Line 66: Remove `showPricingDialog` state
- Lines 136-141: Remove `creditsParam` URL handling block
- Lines 677-688: Remove credit balance display in left panel footer
- Lines 709-723: Remove "unanalyzed items" / credits banner
- Lines 1339-1393: Delete entire "Pricing / Credits Dialog"

**client/src/pages/Landing.tsx**
- Lines 77-103: `creditPacks` array
- Lines 113-131: FAQ answers referencing credits (questions 2, 3, 4, 5 touch credits)
- Lines 711-796: "Or buy credits" section + all credit pack buttons
- Lines 241-245: Schema.org credit pack offers in JSON-LD
- Lines 342, 852: "Credits never expire" copy strings
- All inline "credits" references in feature descriptions (lines ~154-167)

**client/src/components/app-sidebar.tsx**
- Line 31: `billingInterval` state is `'monthly' | 'annual'` — change to `'weekly' | 'annual'`
- Lines 34-35: Price calculations from `paymentConfig` — update to weekly pricing
- Lines 136, 194, 207: Monthly price display strings — update to weekly

---

## State of the Art

| Old Approach | New Approach | Impact |
|--------------|--------------|--------|
| Monthly subscription (£9/mo, `interval: month`) | Weekly subscription (£4/wk, `interval: week`) | Stripe `interval: 'week'` — fully supported natively |
| Annual subscription (£79/yr = £7900 pence) | Annual subscription (~£173/yr = 2 months free) | Same `interval: 'year'` model, new price amount |
| Credit packs (pay-per-product, one-time checkout) | Removed entirely | All credit routes, UI, DB methods deleted |
| Unlimited products for subscribers | 30 products/week cap | Weekly count query on existing `images` table |
| paymentStatus gate (paid/unpaid via credit deduction) | paymentStatus gate (paid/unpaid via weekly cap) | Replaces `deductCredits` with cap check in unlock flow |

**Deprecated/outdated after this phase:**
- `CREDIT_PACKS` constant: Remove
- `getOrCreateCreditPackPriceId`: Remove
- `getOrCreateMonthlySubscriptionPriceId`: Remove (replace with weekly)
- `userCredits` table: Deprecate (keep data, stop writing)
- `claimAndGrantCredits` storage method: Remove

---

## Open Questions

1. **Annual price exact figure**
   - What we know: 2 months free at £4/week = 50 weeks = £200 value; round to clean number
   - Recommendation: £173 (saves £27 vs full 52 weeks at £4; clean number)

2. **Weekly reset — calendar week vs subscription anniversary**
   - What we know: Calendar Monday UTC is simpler; subscription anniversary is fairer
   - Recommendation: Calendar Monday UTC for Phase 10 (simpler, well-understood)

3. **Hard block vs soft warning at cap**
   - What we know: TBD during planning
   - Recommendation: Hard block at upload time — cleaner, prevents users from uploading and discovering they can't unlock

4. **Existing subscriber migration timing**
   - What we know: Migration endpoint is a manual trigger via HTTP POST with secret
   - Recommendation: Run manually by operator after deploy; not auto-triggered on startup

5. **Credit balance refunds — automated vs manual**
   - What we know: Requires `payment_intent` lookup from `paidSessions`; multi-pack users complicate partial refunds
   - Recommendation: Build admin endpoint that lists users with balance > 0 and estimated refund amounts; operator processes via Stripe Dashboard

6. **`billingInterval` column in subscriptions table**
   - What we know: No column exists; UI shows "Renews" date but not interval label
   - Recommendation: Add `billingInterval text` column; set it during subscription verify webhook

7. **`paidSessions` table — remove or keep**
   - What we know: Used for idempotency in credit granting; holds historical payment records
   - Recommendation: Keep table in DB (historical records), remove storage methods

---

## Sources

### Primary (HIGH confidence)
- Stripe API docs (WebFetch `https://docs.stripe.com/api/prices/create`): confirmed `interval: 'week'` is a valid recurring interval
- Stripe API docs (WebFetch `https://docs.stripe.com/api/refunds/create`): refund via `payment_intent` param, partial refund via `amount`
- Stripe API docs (WebFetch `https://docs.stripe.com/api/subscriptions/update`): `items` + `proration_behavior` parameters
- Stripe docs (WebFetch `https://docs.stripe.com/billing/subscriptions/change-price`): subscriber migration pattern
- Codebase direct reads: `server/routes.ts`, `shared/schema.ts`, `server/storage.ts`, `server/webhookHandlers.ts`, `client/src/pages/Home.tsx`, `client/src/pages/Landing.tsx`, `client/src/components/app-sidebar.tsx`, `client/src/hooks/use-images.ts`

### Secondary (MEDIUM confidence)
- Stripe WebSearch: confirmed archiving prices does not cancel existing subscriptions
- Stripe WebSearch: confirmed `interval: 'week'` in subscription schedule duration parameter

---

## Metadata

**Confidence breakdown:**
- Stripe weekly interval support: HIGH — verified via official API docs
- Subscription migration pattern: HIGH — working code already exists in codebase at routes.ts:1645
- Price archival behavior: HIGH — Stripe docs confirm existing subs unaffected
- Weekly cap implementation: HIGH — `images` table has all required columns
- Credit refund flow: MEDIUM — payment_intent lookup confirmed, multi-pack edge cases complex
- Credits UI inventory: HIGH — all locations confirmed via direct file reads with line numbers

**Research date:** 2026-04-19
**Valid until:** 2026-05-19
