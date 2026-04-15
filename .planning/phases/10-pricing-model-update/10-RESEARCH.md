# Phase 10: Pricing Model Update - Research

**Researched:** 2026-04-15
**Domain:** Stripe billing / subscription pricing migration
**Confidence:** HIGH

---

## Summary

This phase replaces a single £19/month subscription with two plans (£9/month, £79/year), halves all three credit pack prices, auto-migrates existing £19/month subscribers to the new £9 plan, and updates pricing UI across the app.

The codebase is self-contained: all Stripe price IDs are resolved at runtime by searching the Stripe API for products by metadata type, then matching on `unit_amount` + `interval`. There are **no hardcoded Stripe price IDs** in environment variables. This means the migration requires updating the in-code constants and adding a new annual price lookup/create path rather than swapping env vars.

The key server-side operation for subscriber migration is `stripe.subscriptions.update(subId, { items: [{ id: subItem.id, price: newPriceId }], proration_behavior: 'none' })`. Setting `proration_behavior: 'none'` defers the price change to the next renewal — users are not charged immediately, which matches the spec ("migrated at their next renewal").

**Primary recommendation:** Update `SUBSCRIPTION_PRICE_PENCE`, `CREDIT_PACKS`, and `getOrCreateSubscriptionPriceId` in `server/routes.ts`; add a new `getOrCreateAnnualSubscriptionPriceId`; update `create-checkout` to accept a `billingInterval` body param; add a `/api/subscription/migrate-to-new-price` endpoint; update UI in `app-sidebar.tsx`, `Landing.tsx`, and `Home.tsx`.

---

## Standard Stack

No new libraries are needed. All Stripe operations use the existing `stripe` SDK (already installed) via `getUncachableStripeClient()`.

### Existing Infrastructure
| Component | File | Role |
|-----------|------|------|
| Stripe client | `server/stripeClient.ts` | Returns `new Stripe(secretKey, { apiVersion: '2025-08-27.basil' })` |
| Payment routes | `server/routes.ts` lines 284–383 | Price constants, `getOrCreate*` helpers, all `/api/subscription/*` and `/api/credits/*` routes |
| Webhook handler | `server/webhookHandlers.ts` | Handles `checkout.session.completed` (subscription + payment modes), `customer.subscription.updated/deleted` |
| Subscription schema | `shared/schema.ts` lines 151–167 | `subscriptions` table: `userId`, `stripeCustomerId`, `stripeSubscriptionId`, `status`, `currentPeriodEnd` |
| Payment config hook | `client/src/hooks/use-images.ts` line 25 | `usePaymentConfig()` fetches `/api/payments/config` → `{ publishableKey, subscriptionPricePence, creditPacks }` |
| Checkout hook | `client/src/hooks/use-images.ts` line 51 | `useCreateSubscriptionCheckout()` — currently sends empty body to `POST /api/subscription/create-checkout` |

---

## Architecture Patterns

### How Stripe Price IDs Are Resolved (Current)

The app does **not** use env-var price IDs. Instead, at checkout time it calls `getOrCreateSubscriptionPriceId()` or `getOrCreateCreditPackPriceId(packId)`. Each function:

1. Lists active Stripe products, finds one matching `metadata.type === 'monthly_subscription'` (or `'credit_pack'` + `packId`)
2. Lists prices for that product, finds one matching `unit_amount === PENCE_CONSTANT` and correct interval
3. Returns the price ID if found; otherwise creates the product+price and returns the new ID

This pattern must be replicated for the new annual price.

### Pattern 1: Add Annual Price Lookup/Create

```typescript
// server/routes.ts
const SUBSCRIPTION_MONTHLY_PRICE_PENCE = 900;   // was 1900
const SUBSCRIPTION_ANNUAL_PRICE_PENCE  = 7900;

let cachedMonthlyPriceId: string | null = null;
let cachedAnnualPriceId:  string | null = null;

async function getOrCreateMonthlySubscriptionPriceId(): Promise<string> {
  if (cachedMonthlyPriceId) return cachedMonthlyPriceId;
  const stripe = await getUncachableStripeClient();
  const products = await stripe.products.list({ active: true, limit: 100 });
  const existingProduct = products.data.find(p => p.metadata?.type === 'monthly_subscription');
  if (existingProduct) {
    const prices = await stripe.prices.list({ product: existingProduct.id, active: true, limit: 10 });
    const match = prices.data.find(
      p => p.unit_amount === SUBSCRIPTION_MONTHLY_PRICE_PENCE
        && p.type === 'recurring'
        && (p.recurring as any)?.interval === 'month'
    );
    if (match) { cachedMonthlyPriceId = match.id; return match.id; }
  }
  // ... create product if needed, then:
  const price = await stripe.prices.create({
    product: productId,
    unit_amount: SUBSCRIPTION_MONTHLY_PRICE_PENCE,
    currency: 'gbp',
    recurring: { interval: 'month' },
  });
  cachedMonthlyPriceId = price.id;
  return price.id;
}

async function getOrCreateAnnualSubscriptionPriceId(): Promise<string> {
  if (cachedAnnualPriceId) return cachedAnnualPriceId;
  const stripe = await getUncachableStripeClient();
  const products = await stripe.products.list({ active: true, limit: 100 });
  const existingProduct = products.data.find(p => p.metadata?.type === 'monthly_subscription');
  // same product, different price interval
  if (existingProduct) {
    const prices = await stripe.prices.list({ product: existingProduct.id, active: true, limit: 10 });
    const match = prices.data.find(
      p => p.unit_amount === SUBSCRIPTION_ANNUAL_PRICE_PENCE
        && p.type === 'recurring'
        && (p.recurring as any)?.interval === 'year'
    );
    if (match) { cachedAnnualPriceId = match.id; return match.id; }
  }
  const price = await stripe.prices.create({
    product: productId,   // same product as monthly
    unit_amount: SUBSCRIPTION_ANNUAL_PRICE_PENCE,
    currency: 'gbp',
    recurring: { interval: 'year' },
  });
  cachedAnnualPriceId = price.id;
  return price.id;
}
```

### Pattern 2: Update Checkout to Accept billingInterval

```typescript
// server/routes.ts — POST /api/subscription/create-checkout
app.post("/api/subscription/create-checkout", requireAuth(), async (req, res) => {
  const { billingInterval } = req.body; // 'monthly' | 'annual', default 'monthly'
  const priceId = billingInterval === 'annual'
    ? await getOrCreateAnnualSubscriptionPriceId()
    : await getOrCreateMonthlySubscriptionPriceId();
  // ... rest unchanged
});
```

```typescript
// client/src/hooks/use-images.ts
export function useCreateSubscriptionCheckout() {
  return useMutation({
    mutationFn: async (billingInterval: 'monthly' | 'annual' = 'monthly') => {
      const res = await apiRequest("POST", "/api/subscription/create-checkout", { billingInterval });
      return res.json() as Promise<{ checkoutUrl: string; sessionId: string }>;
    },
  });
}
```

### Pattern 3: Migrate Existing Subscribers (Server-Side)

The migration endpoint must:
1. List all subscriptions in the local DB with status `active` or `trialing`
2. Retrieve the Stripe subscription for each; check `items.data[0].price.unit_amount`
3. If it equals the old price (1900 pence), update via `stripe.subscriptions.update`

```typescript
// Source: https://docs.stripe.com/api/subscriptions/update
// server/routes.ts — POST /api/subscription/migrate-to-new-price (admin/one-time endpoint)
const stripe = await getUncachableStripeClient();
const newMonthlyPriceId = await getOrCreateMonthlySubscriptionPriceId();

// Retrieve current sub to get the subscription item ID
const stripeSub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
const subItemId = stripeSub.items.data[0].id;
const currentPriceAmount = stripeSub.items.data[0].price.unit_amount;

if (currentPriceAmount === 1900) { // old £19 price
  await stripe.subscriptions.update(stripeSubscriptionId, {
    items: [{ id: subItemId, price: newMonthlyPriceId }],
    proration_behavior: 'none',   // change takes effect at next renewal, no immediate charge
  });
}
```

### Pattern 4: Archive the Old £19 Price

```typescript
// Source: https://docs.stripe.com/api/prices/update
// Run once after migration. Find the old price ID first:
const products = await stripe.products.list({ active: true, limit: 100 });
const subProduct = products.data.find(p => p.metadata?.type === 'monthly_subscription');
const oldPrices = await stripe.prices.list({ product: subProduct!.id, limit: 100 });
const oldPrice = oldPrices.data.find(p => p.unit_amount === 1900 && p.recurring?.interval === 'month');
if (oldPrice) {
  await stripe.prices.update(oldPrice.id, { active: false });
}
```

### Recommended Project Structure (No Changes)

No new files needed beyond `server/routes.ts` edits. The migration endpoint can live in the same file as the other subscription routes.

### Anti-Patterns to Avoid

- **Deleting Stripe prices:** Stripe prices cannot be deleted, only archived (set `active: false`). Attempting to delete will error.
- **Changing `unit_amount` on existing price:** Stripe prices are immutable after creation. You must create a new price object.
- **`proration_behavior: 'always_invoice'` for migration:** This would immediately charge (or credit) subscribers for the price difference. Use `'none'` so the change takes effect at renewal.
- **Running migration via a webhook trigger:** Migration is a one-off admin operation, not an event-driven flow. Use an authenticated endpoint called once.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Subscription item ID lookup | Custom DB tracking of sub item IDs | `stripe.subscriptions.retrieve(subId).items.data[0].id` | Stripe's items array is the source of truth |
| Price idempotency | Hash/cache logic | Existing `getOrCreate*` pattern already handles this | Already in codebase |
| Proration calculation | Custom billing math | Stripe `proration_behavior: 'none'` | Stripe handles all billing cycle math |

---

## Common Pitfalls

### Pitfall 1: Old Price ID Still Cached
**What goes wrong:** `cachedPriceId` (module-level variable in `server/routes.ts` line 340) caches the old £19 price ID for the lifetime of the server process. After migration, if a server instance still has the old ID cached, new checkouts would fail (Stripe rejects archived prices for new sessions).
**Why it happens:** The `getOrCreateSubscriptionPriceId` function checks `cachedPriceId !== null` first and returns immediately without re-querying Stripe.
**How to avoid:** Rename the cached variable (`cachedMonthlyPriceId`) and reset it to `null` when the constants change. Since the constant changes from 1900 to 900, the `unit_amount === PENCE_CONSTANT` match will naturally fail and force creation of a new price. But any warm server process with the old ID in cache must restart. In practice this is fine — a deploy restarts the server.
**Warning signs:** Checkout session creation failing with "price has been archived" Stripe error after deploy.

### Pitfall 2: Missing billingInterval Handling in verify/webhook
**What goes wrong:** The `/api/subscription/verify` and webhook handler (`webhookHandlers.ts`) store `currentPeriodEnd` but do not store or check the billing interval. For annual subscriptions, `currentPeriodEnd` will be ~12 months out, which is fine. But the sidebar shows "Renews [date]" which works correctly for both intervals — no code change needed for the status display itself.
**Why it happens:** The `subscriptions` schema has no `billingInterval` column.
**How to avoid:** No schema change required. The `currentPeriodEnd` field communicates the right information to the UI regardless of interval. However, if a future feature needs to show "billed annually" vs "billed monthly", a `billingInterval` column would need to be added to the `subscriptions` table. For this phase, no schema migration is needed.

### Pitfall 3: Landing.tsx CREDIT_PACKS is Hardcoded Locally
**What goes wrong:** `Landing.tsx` has its own `CREDIT_PACKS` array (lines 73–105) with hardcoded prices (`£9`, `£35`, `£79`). This is separate from the server's `CREDIT_PACKS` constant and separate from the `paymentConfig` API endpoint. Changes to the server constant do NOT automatically update the landing page.
**Why it happens:** Landing page is a static marketing page that doesn't fetch live pricing. It hardcodes display values.
**How to avoid:** Update `Landing.tsx` CREDIT_PACKS array manually as part of this phase. Also update the `perCredit` strings, FAQ answer text, and the JSON-LD `offers` array in `softwareJsonLd`.

### Pitfall 4: Home.tsx Credits Dialog Fallback Values Are Hardcoded
**What goes wrong:** The credits dialog in `Home.tsx` (line 1366) has inline fallback values `[{ id: 'starter', pricePence: 900 }, { id: 'growth', pricePence: 3500 }, { id: 'pro', pricePence: 7900 }]`. These are the OLD prices and will display incorrectly if `paymentConfig` fails to load.
**Why it happens:** Defensive fallback in case the API is down. The fallback never updated.
**How to avoid:** Update the fallback values in `Home.tsx` to the new pences (450, 1750, 3950).

### Pitfall 5: `usePaymentConfig` Return Type Missing Annual Price
**What goes wrong:** `usePaymentConfig()` in `use-images.ts` (line 31) types the return as `{ publishableKey, subscriptionPricePence, creditPacks }` — single price. If the sidebar needs to know both prices, the API response needs updating too.
**Why it happens:** Currently only one subscription price exists.
**How to avoid:** Update `/api/payments/config` to return `{ subscriptionMonthlyPricePence, subscriptionAnnualPricePence, creditPacks, ... }` and update the TypeScript type in `usePaymentConfig`.

### Pitfall 6: Sidebar Subscribe Button Shows Single Price
**What goes wrong:** `app-sidebar.tsx` line 33 computes `subscriptionPrice` from `paymentConfig.subscriptionPricePence`. The subscribe button label is "Subscribe - £{subscriptionPrice}/mo". With two plans, this must show a plan-selection UI (monthly vs annual toggle) before redirecting to checkout.
**Why it happens:** Current design assumes one price.
**How to avoid:** Add a `billingInterval` state (`'monthly' | 'annual'`) to `AppSidebar`. The subscribe dialog needs two radio/toggle options. Pass the selected interval to `createSubscriptionCheckout.mutate(billingInterval)`.

---

## All Files That Need to Change

| File | What Changes |
|------|-------------|
| `server/routes.ts` | (1) Rename `SUBSCRIPTION_PRICE_PENCE` → `SUBSCRIPTION_MONTHLY_PRICE_PENCE = 900`, add `SUBSCRIPTION_ANNUAL_PRICE_PENCE = 7900`. (2) Update `CREDIT_PACKS` pricePence: starter 450, growth 1750, pro 3950. (3) Rename `cachedPriceId` → `cachedMonthlyPriceId`, add `cachedAnnualPriceId`. (4) Rename `getOrCreateSubscriptionPriceId` → `getOrCreateMonthlySubscriptionPriceId`, add `getOrCreateAnnualSubscriptionPriceId`. (5) Update `create-checkout` to accept `billingInterval` body param and call the appropriate helper. (6) Update `GET /api/payments/config` to return `subscriptionMonthlyPricePence` and `subscriptionAnnualPricePence`. (7) Add `POST /api/subscription/migrate-to-new-price` endpoint (admin, requires auth). (8) Add `POST /api/subscription/archive-old-price` endpoint (admin, run once). |
| `server/webhookHandlers.ts` | No changes needed. The webhook already handles `checkout.session.completed` for subscription mode and stores `currentPeriodEnd` from the retrieved subscription — this works correctly for both monthly and annual. |
| `shared/schema.ts` | No changes needed. The `subscriptions` table does not need a `billingInterval` column for this phase. |
| `client/src/hooks/use-images.ts` | (1) Update `useCreateSubscriptionCheckout` mutationFn to accept `billingInterval: 'monthly' | 'annual'` and pass it in the request body. (2) Update `usePaymentConfig` return type to include `subscriptionMonthlyPricePence` and `subscriptionAnnualPricePence`. |
| `client/src/components/app-sidebar.tsx` | (1) Add `billingInterval` state. (2) Update subscribe dialog to show monthly vs annual toggle. (3) Update button label. (4) Pass `billingInterval` to `createSubscriptionCheckout.mutate()`. |
| `client/src/pages/Landing.tsx` | (1) Update `CREDIT_PACKS` array: Starter £4.50, Growth £17.50, Pro £39.50, update `perCredit` strings. (2) Update `softwareJsonLd` offers prices. (3) Update FAQ answer text for "How much does SnapSync AI cost?". (4) Add subscription pricing section (monthly £9 / annual £79) to the pricing section or add a subscription card — currently the landing page only shows credit packs and no subscription option. |
| `client/src/pages/Home.tsx` | (1) Update fallback values in credits dialog (line 1366) to new pences. |

---

## Code Examples

### Retrieve Subscription Item ID (Required for Migration)

```typescript
// Source: https://docs.stripe.com/api/subscriptions/update
const stripe = await getUncachableStripeClient();
const stripeSub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
const subItemId = stripeSub.items.data[0].id;          // 'si_xxxx'
const currentAmount = stripeSub.items.data[0].price.unit_amount; // 1900 for old £19 price

await stripe.subscriptions.update(stripeSubscriptionId, {
  items: [{ id: subItemId, price: newPriceId }],
  proration_behavior: 'none',  // defers to next renewal
});
```

### Archive a Price

```typescript
// Source: https://docs.stripe.com/api/prices/update
await stripe.prices.update(oldPriceId, { active: false });
```

### Create Annual Stripe Price

```typescript
// Source: https://docs.stripe.com/api/prices/create
const price = await stripe.prices.create({
  product: productId,          // same product as monthly
  unit_amount: 7900,           // £79.00 in pence
  currency: 'gbp',
  recurring: { interval: 'year' },
});
```

### Annual Checkout Session

```typescript
// Source: https://docs.stripe.com/api/checkout/sessions/create
const session = await stripe.checkout.sessions.create({
  payment_method_types: ['card'],
  line_items: [{ price: annualPriceId, quantity: 1 }],
  mode: 'subscription',
  success_url: `${appUrl}/?subscription=success&checkout_session_id={CHECKOUT_SESSION_ID}`,
  cancel_url: `${appUrl}/?subscription=cancelled`,
  metadata: { userId },
});
// Returning subscriber verify flow is identical — no change to /api/subscription/verify
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Single monthly price constant | Two price constants (monthly + annual) | Doubles the `getOrCreate` helpers; minor complexity increase |
| Single cached price ID | Two cached price IDs | Add one module-level variable |
| No billing interval in checkout | `billingInterval` body param | One-line addition to hook + route |
| No migration logic | Admin endpoint + Stripe `subscriptions.update` | New endpoint ~25 lines |

---

## Open Questions

1. **Landing page subscription section**
   - What we know: The landing page currently shows NO subscription plan — only credit packs. The pricing section header says "No subscriptions." This is a major copy/design change.
   - What's unclear: Should a new subscription pricing section replace the "No subscriptions" hero copy, or sit alongside the credit packs section?
   - Recommendation: Add a subscription card above or separate from credit packs. Update copy to reflect the new "both options available" model.

2. **Migration endpoint authentication**
   - What we know: The decisions doc says "admin endpoint" vs "automatic on deploy." No admin auth middleware currently exists.
   - What's unclear: How to protect the migration endpoint so only the developer can call it.
   - Recommendation: Protect with a hardcoded secret token in the request body checked against a `MIGRATION_SECRET` env var. Simple and sufficient for a one-time operation.

3. **`usePaymentConfig` field naming**
   - What we know: Current field is `subscriptionPricePence`. The sidebar references `paymentConfig?.subscriptionPricePence`.
   - What's unclear: Whether to keep backward compat (`subscriptionPricePence` = monthly) or rename to `subscriptionMonthlyPricePence`.
   - Recommendation: Add `subscriptionMonthlyPricePence` and `subscriptionAnnualPricePence` as new fields. Keep `subscriptionPricePence` as an alias pointing to monthly for backward compat — though the sidebar will be rewritten anyway, so this is low stakes.

---

## Sources

### Primary (HIGH confidence)
- Stripe API docs — `https://docs.stripe.com/api/subscriptions/update` — subscriptions.update with items + proration_behavior
- Stripe API docs — `https://docs.stripe.com/api/prices/update` — prices.update with active: false for archiving
- Stripe API docs — `https://docs.stripe.com/billing/subscriptions/change-price` — change price flow for existing subs
- Direct code inspection of `server/routes.ts`, `server/webhookHandlers.ts`, `server/stripeClient.ts`, `shared/schema.ts`, `client/src/hooks/use-images.ts`, `client/src/components/app-sidebar.tsx`, `client/src/pages/Landing.tsx`, `client/src/pages/Home.tsx`

### Secondary (MEDIUM confidence)
- Stripe manage prices docs — `https://docs.stripe.com/products-prices/manage-prices` — archiving behavior

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all existing, no new deps
- Architecture: HIGH — code inspected directly, patterns verified against Stripe docs
- Pitfalls: HIGH — all identified from direct code reading
- Stripe API calls: HIGH — verified against official docs

**Research date:** 2026-04-15
**Valid until:** 2026-05-15 (Stripe API is stable; 30-day window appropriate)
