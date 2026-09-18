**Status:** done

# Plan and Allowance

## Problem Statement

I pay £4 every week and still hit a wall at 30 products. Quiet months I pay for weeks I do not list. Busy weekends I cannot finish a drop. Credits are gone, but the workspace still treats each product as something to “unlock.” I want a fairer price: use the workspace without a card, pay when SnapSync writes listing copy or builds a website, and keep going if I run past the included amount — not a weekly ration.

## Solution

I get the workspace free: catalogue, New listing, confirmed facts, Import, Inventory, and push of listing copy I typed. When I want SnapSync to write listing copy, run listing copy refresh, or hand off a website, I take one **Plan** (£19/month or £190/year). Each calendar month I get **20 Allowance uses**. One use is one product’s listing-copy write (first generate, or listing copy refresh I accept) or one website handoff. Extra uses are **£1.50** on the invoice. Unused uses expire at month end. Regenerating stale listing copy does not spend. A failed generate does not spend. Legal facts are never an Allowance use. Existing £4/week billing stays only if I already have it, until I cancel or switch.

## User Stories

1. As a seller without a Plan, I want to use the catalogue, New listing, confirmed facts, Import, and Inventory without a card, so that the workspace is real before I pay.
2. As a seller without a Plan, I want to type listing copy myself and push it, so that I am not paying to publish my own words.
3. As a seller without a Plan, I want Generate, listing copy refresh, Bulk SEO, and website disabled with a reason that I need a Plan, so that I know what money buys.
4. As a seller, I want not to see “unlock analysis” or “Pro,” so that billing matches Plan and Allowance.
5. As a seller, I want Settings to show Plan, Allowance used of 20 this calendar month, and overage this month, so that I can see what I will be billed.
6. As a seller without a Plan, I want Subscribe in Settings to offer monthly £19 and annual £190, so that I am choosing a Plan, not a weekly cap.
7. As a seller, I want checkout to send me back to the workspace origin after Stripe, so that verify runs on the app I use, not the API host.
8. As a seller who completes checkout, I want the Plan active without a second “unlock” step, so that I can Generate on the next product.
9. As a seller with a Plan, I want 20 Allowance uses each calendar month, so that a normal drop is included.
10. As a seller on annual billing, I still want 20 uses each calendar month, so that paying yearly is a discount, not 240 uses in one bucket.
11. As a seller who used 5 of 20, I want the other 15 gone at month end, so that unused Allowance is not a credit bank.
12. As a seller who used 20 and keeps generating, I want the job to run and £1.50 extra per use on the Plan invoice, so that a photoshoot weekend is not a wall.
13. As a seller, I want first Generate that persists listing copy to spend one use, so that writing listing copy is what I pay for.
14. As a seller who starts Generate and the model fails, I want no use spent, so that I am not billed for a write that did not land.
15. As a seller who streams Generate and never accepts, I want no use spent, so that a preview cannot bill me.
16. As a seller with stale listing copy who regenerates from facts, I want no use spent, so that confirming facts is not a tax.
17. As a seller who edits listing copy by hand, I want no use spent, so that typing is free.
18. As a seller who regenerates one field on existing listing copy that is not stale, I want no use spent, so that a title tweak is not a listing-copy write.
19. As a seller who Generates again on a product that already has listing copy and is not stale, I want that persist to spend one use, so that a full rewrite I asked for is a write.
20. As a seller, I want listing copy refresh start and proposal regenerate not to spend, so that looking at search demand is not a bill.
21. As a seller who accepts a listing copy refresh, I want one use spent, so that a demand rewrite I take is a write.
22. As a seller who dismisses a listing copy refresh, I want no use spent, so that a rejected proposal is free.
23. As a seller who accepts refresh a second time later, I want another use spent, so that each taken rewrite is counted.
24. As a seller, I want one website handoff that succeeds to spend one use, so that the website job is in the Allowance, not a second product.
25. As a seller whose website handoff is refused (no shop, no eligible products), I want no use spent, so that a blocked handoff is not a bill.
26. As a seller, I want several photos of one product to count as one write when listing copy persists once, so that grouping is not a meter.
27. As a seller of a textile product, I want confirming fibre composition, care, and GPSR to never spend, so that legal facts are not for sale.
28. As a seller, I want no “compliance check” product or charge, so that SnapSync does not pretend to certify EU law.
29. As a seller, I want product-facts gates unchanged, so that listing copy still waits on confirmed facts even when I have Allowance left.
30. As a seller without a Plan, I want facts and classification still to run on New listing, so that free is not an empty upload bin.
31. As a seller, I want push to Shopify to require listing copy present, not a paid unlock flag, so that typed copy can ship and generated copy can ship the same way.
32. As a seller pushing products with no listing copy, I want a reason about missing listing copy, not “subscribe to unlock,” so that the next job is Generate or typing.
33. As a seller, I want Inventory Autopilot not to spend Allowance, so that stock jobs stay in the workspace.
34. As a seller, I want Import not to spend Allowance, so that fetching the catalogue is free.
35. As a seller, I want New listing photos not to spend Allowance, so that I pay for writes, not pixels.
36. As a seller at 19 of 20, I want the next write to use the last included use, so that overage starts at 21.
37. As a seller at 20 of 20, I want the next successful write to record overage, so that the invoice can charge £1.50.
38. As a seller, I want website and listing-copy writes to share the same 20 and the same £1.50, so that I am not learning two meters.
39. As a seller, I want Bulk SEO, when it exists later, to spend one use per product whose listing copy actually changes, so that the Plan module already knows that job kind.
40. As a seller looking at the landing page, I want £19/month, £190/year, 20 writes per month, and £1.50 extra, so that marketing matches Settings.
41. As a seller looking at the landing page, I want “start free” to mean the workspace without generate, not 30 products per week, so that I am not sold the old cap.
42. As a seller with a Plan, I want a Pro-style badge replaced by Plan or used of 20, so that chrome matches the glossary.
43. As a seller, I want to cancel the Plan and keep it until period end, so that cancel still means cancel at period end.
44. As a seller on leftover £4/week billing, I want that price to continue until I cancel or switch to a Plan, so that I am not silent-migrated onto overage.
45. As a seller on leftover weekly billing, I want 30 listing-copy writes per UTC week with a hard stop and no £1.50 overage, so that what I already bought does not change under me.
46. As a seller on leftover weekly billing, I want Settings to offer switch to the Plan, so that I can leave weekly on purpose.
47. As a new checkout, I want only Plan prices created, so that nobody new can buy weekly £4.
48. As a seller recovering a checkout by session or email, I want a Plan linked if I paid for a Plan, so that verify still heals a missed webhook.
49. As a seller whose webhook arrives first, I want status already subscribed before I return from Stripe, so that I am not stuck waiting on verify.
50. As a local developer with auth bypass, I want Generate and website to run without Stripe, so that `npm run dev` is still a full workspace.
51. As a future agent, I want whether a job may run and whether it spends decided in one Plan module, so that Generate, refresh, website, and HTTP cannot drift.
52. As a future agent, I want Stripe and the database behind adapters on that module, so that tests do not call Stripe or invent a second gate in the SPA.
53. As a seller, I want the SPA to disable Plan jobs from server outcomes, so that the page cannot invent a different Allowance than the API.
54. As a seller without a Plan who opens Generate, I want the same blocked reason the API would return, so that I am not surprised after click.
55. As a seller with a Plan and unconfirmed facts, I want Generate still blocked on facts, not on Allowance, so that pay cannot skip ADR 0002.
56. As a seller, I want upload not to mark products paid or unpaid as a commercial state, so that `payment_status` is not the Plan.
57. As a seller, I want catalogue cards not to say preview-mode subscribe, so that missing listing copy points at facts or Plan, whichever is true.
58. As a seller, I want selling fields (price, SKU, barcode) never to spend Allowance, so that data entry in this spec stays listing copy.
59. As a seller, I want one Plan only, not quiet/busy tiers, so that fairness is free vs Plan plus overage.
60. As a seller in a second Shopify shop, I want v1 still one Plan per SnapSync user, so that we do not invent multi-shop billing yet.
61. As a seller, I want overage not sold as a pack of uses, so that credits do not return.
62. As a seller, I want a calendar month in UTC, so that Allowance refill is the same everywhere.
63. As a seller who hits Stripe down during overage reporting, I want the write still persisted if the job succeeded, with overage retried, so that a meter glitch does not delete listing copy.
64. As a seller, I want status to say whether I am free, Plan, leftover weekly, or local bypass, so that Settings copy can be honest.
65. As a seller whose generate persist is rejected (facts, missing photo), I want no use spent, so that a refused write is free.
66. As a seller, I want listing copy refresh still blocked when facts, missing copy, stale copy, or search demand would block it, even if I have Allowance, so that Plan is not a back door around ADR 0012.
67. As a seller, I want website eligibility unchanged (pushed products with listing copy), with Plan as an extra gate before handoff, so that ADR 0010 stays the snapshot rules.
68. As a seller, I want the weekly 30-product cap and weekly price gone from payments config for new Plans, so that clients cannot display £4/week as current.
69. As a seller, I want unlock-images not to be the way I get listing copy, so that paying cannot bypass the facts gate (existing product-facts story).
70. As a seller who already has listing copy from before this change, I want that copy still pushable, so that grandfathered words are not trapped behind a Plan.

## Implementation Decisions

- One **Plan** module is the seam. Generate persist, listing copy refresh accept, website handoff, subscription HTTP, and webhooks are adapters. Tests call the module. The SPA does not re-encode Allowance, leftover weekly, or free vs Plan (ADR 0007).
- Module interface: entitlement of the seller (free, Plan, leftover weekly, local bypass); remaining included uses for the current UTC calendar month; whether a named job may start; record a successful spend (included vs overage) or record that a job did not spend; Plan status for Settings (used, included, overage count, period end, checkout URLs are not the module — Stripe checkout stays an adapter).
- Job kinds the module understands: listing-copy persist from Generate (spends unless listing copy was stale), listing copy refresh accept (spends), website handoff success (spends), Bulk SEO persist per product (spends when that job exists). Does not spend: confirm facts, typed listing copy save, stale regenerate, failed or unaccepted Generate, refresh start/dismiss/proposal regenerate, refused website, Inventory, Import, New listing photos, per-field regenerate when listing copy exists and is not stale.
- Product facts module remains the generate/stale/present gate. The Plan module does not duplicate those rules. Callers check facts first, then Plan (or the HTTP adapter does both and copies both blocked reasons).
- Listing copy refresh module calls Plan only on accept, after its own accept rules succeed. Start/regenerate/dismiss do not call spend. Website handoff calls Plan only after a successful snapshot URL is produced.
- Spend is recorded in the same persistence transaction as the listing-copy or handoff success. SSE start does not spend. If Stripe overage report fails after persist, retry the report; do not roll back listing copy.
- Persistence: a ledger of spends per seller (job kind, product id when it applies, time, included vs overage). Count included uses in the current UTC calendar month. Included cap is 20 for Plan. Leftover weekly: 30 uses per UTC week (Monday 00:00), hard stop, no overage. Local bypass: may run, never bills, does not require Stripe.
- Stripe adapter: new checkouts create only Plan prices — £19.00/month and £190.00/year GBP, plus metered overage at £1.50 per extra use. Do not create new weekly £4 prices. Checkout success and cancel URLs use the workspace origin (`APP_BASE_URL`), not the API host. Webhooks still upsert Plan from `checkout.session.completed` and subscription updated/deleted. Overage is reported through the same adapter (metered subscription item or equivalent); tests fake it.
- Leftover weekly: existing Stripe subscriptions on the old weekly interval keep billing as they are. Entitlement stays leftover weekly until cancel or the seller starts a Plan checkout. New `create-checkout` only starts a Plan.
- Public payments config returns Plan monthly pence (1900), annual pence (19000), monthly Allowance (20), overage pence (150). It does not advertise weekly pence or a 30-product weekly limit as current.
- Subscription status returns entitlement class, subscribed/plan-active, Allowance used, included, overage this month, period end. `subscribed: true` means Plan or leftover weekly or local bypass — not “unlock paid products.”
- Push to Channel: require listing copy present (same notion product facts already uses). Do not require `payment_status === paid`. SPA push copy follows the server; replace “unpaid / subscribe to unlock” with missing listing copy.
- Stop using unlock-images and upload paid/preview modes as the commercial gate. Unlock-images must not write listing copy (already true) and must not be the seller path to a Plan. Upload must not set commercial paid/unpaid from subscription.
- FastAPI only (ADR 0001). Do not add Express billing.
- Schema: add a spend ledger (and whatever Stripe customer/subscription fields the Plan already has). Do not use `user_credits`. Leave unused credit rows alone rather than a drive-by drop unless a later ticket owns it.
- Landing and Settings copy use Plan, Allowance, £19 / £190 / 20 / £1.50. Avoid Pro, credits, unlock, weekly product limit, compliance check, agentic SEO.

## Testing Decisions

- Test external behaviour of the Plan module, not Stripe SDK internals, OpenAI, or React layout.
- The Plan module is the test surface. A good test puts entitlement, a fake clock (calendar month / UTC week), a ledger of prior spends, and a job kind in, and asserts may/blocked, spend vs no-spend, included vs overage — without HTTP and without Stripe.
- Stripe and clock are adapters. Fake them at the module interface. Do not create live Checkout sessions in CI.
- Cases that must exist: free cannot Generate/refresh-accept/website; Plan with 0 prior spends can; 20th included spend is included; 21st is overage and still allowed; unused included does not carry into the next month; annual entitlement still refills 20 on the next calendar month, not 240 at once; stale regenerate does not spend; failed/unaccepted generate does not spend; refresh accept spends, dismiss does not; website success spends, refused handoff does not; leftover weekly allows 30 per UTC week then hard-stops with no overage; local bypass may run with no ledger billing; facts-blocked generate does not reach spend; typed listing copy save does not spend; push decision is missing listing copy, not unpaid.
- Thin HTTP tests are optional and are not a second seam: payments config shape; create-checkout success URL host is the workspace origin; generate/refresh/website refuse with the module’s Plan reason when free. Prior art: product-facts module tests, listing-copy-refresh module tests, `test_billing.py` week helpers, webhook signature tests.
- Do not test Express. Do not assert unlock-images as the happy path.

## Out of Scope

- Building Bulk SEO (the job kind is reserved; the catalogue loop is not this spec)
- A second paid Plan tier, credit packs, or top-ups
- Silent-migrating leftover weekly subscribers onto £19 + overage
- Multi-shop or agency billing; Wix/Vinted billed extra
- A compliance-check product or legal certification
- Charging for legal facts, selling fields, Inventory, Import, or photos
- Dropping the `user_credits` table or `payment_status` column in the same breath unless a ticket is only a migration
- Changing product-facts rules, listing-copy-refresh demand rules, or website snapshot shape except to call Plan
- VAT display, invoices beyond Stripe’s, or non-GBP
- Implementing Express or Replit Stripe-sync

## Further Notes

- Glossary: **Plan**, **Allowance**, **listing copy**, **listing copy refresh**, **website**, **confirmed facts**, **legal facts**. Do not name this Pro, credits, unlock, agentic SEO, or compliance check.
- ADR 0014 is the commercial decision. Also 0002 (facts gate), 0005 (catalogue-first workspace), 0007 (rules on the server), 0010 (website snapshot), 0012 (listing copy refresh).
- After this spec: split into tracer-bullet tickets with blocking edges (`/to-tickets`). Do not implement from this file in one shot if the work will span sessions.
