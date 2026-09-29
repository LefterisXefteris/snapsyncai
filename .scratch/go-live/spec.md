**Status:** ready-for-agent

# Go live on the product page

## Problem Statement

I finish a product on the product page — listing copy, a price, photos, the quantity I have — and I still cannot put it on my Shopify storefront without knowing to switch Draft to Active and tick Online Store. Push is a small control inside the Shopify card, and it sends the last Save, not the page I am looking at. The quantity on the page never becomes available stock. I want one obvious action that puts the product on the Online Store properly.

## Solution

**Go live** is the header action beside Save until the product is Active on the Online Store. It writes the page as it stands, sets the product Active, includes Online Store (other publications already chosen stay chosen), and Push. After that, the header action is Sync updates, and it writes the page as it stands too. Save still only keeps work off Shopify.

The button stays visible and names what is missing. Any write that leaves the product Active on the Online Store needs listing copy and a price greater than zero. A Draft push needs only listing copy. Confirmed facts stay the rule for generating copy. Stale listing copy does not block the write.

The Shopify card keeps Draft or Active, the publication ticks, and the quieter Push, which sends those picks. Go live includes Online Store even when that tick is off.

When quantity is tracked, the first write that lands the product Active on the Online Store sets that available stock, including zero, on the single variant. The location is the Inventory location, or the shop’s only or first active location. A Draft push does not set stock. Later Sync does not change Shopify stock. Several variants, a missing location, or a failed stock write still go live, and the seller is told stock was not set. Products already on the Online Store are not backfilled. Catalogue bulk Push stays as it is.

## User Stories

1. As a seller, I want Go live in the product page header beside Save, so that putting the product on the storefront is the obvious action.
2. As a seller, I want Go live to show until the product is Active on the Online Store, so that I am not hunting for a second control.
3. As a seller whose product is already Active on the Online Store, I want the header action to be Sync updates, so that I am updating a live product rather than going live again.
4. As a seller, I want Go live to write the page as it stands and then Push, so that the price and listing copy I just typed are what Shopify receives.
5. As a seller, I want Push and Sync updates to write the page as it stands too, so that the same page cannot mean two different products depending on the button.
6. As a seller, I want Save to keep work off Shopify, so that I can leave a draft on the page without sending it.
7. As a seller, I want a failed save to stop the Shopify write, so that Shopify cannot receive a page that did not persist.
8. As a seller whose Shopify write fails after the page was saved, I want the page kept and the product not treated as live, so that I can try again.
9. As a seller, I want Go live to set the product Active and include Online Store, so that the product is actually on the storefront.
10. As a seller who already ticked Point of Sale or another publication, I want those ticks kept when I Go live, so that Online Store is added to my choice rather than replacing it.
11. As a seller who unticked Online Store, I want Go live to include it anyway, so that the header action cannot silently leave the product off the storefront.
12. As a seller, I want the quieter Push to send the Draft or Active and the ticks I picked, so that I can still send a Shopify draft.
13. As a seller, I want the Draft default and the publication ticks to stay, so that an unfinished product is not on the storefront.
14. As a seller with no listing copy, I want Go live visible and naming that gap, so that I know the next job is to write or generate copy.
15. As a seller with no price, or a price of zero, I want Go live visible and naming that gap, so that a placeholder is not a price.
16. As a seller, I want a write that leaves the product Active on the Online Store to require listing copy and a price greater than zero, whether I used Go live or Push, so that the gate is the end state.
17. As a seller sending a Draft, I want only listing copy required, so that a Shopify draft can leave before I have a price.
18. As a seller who typed listing copy without confirming facts, I want Go live to allow it, so that typed copy is not trapped behind the generate rule.
19. As a seller with stale listing copy, I want Go live and Sync still allowed, so that stale copy is not a publish gate.
20. As a seller who clears the price on a live product, I want Sync updates to stay visible and name the missing price, so that a storefront product cannot lose its price through Sync.
21. As a seller who switches a live product back to Draft, I want that Draft push to need only listing copy, so that leaving the storefront is not held to the storefront gate.
22. As a seller whose shop is not connected, I want Go live to name that and point at Settings, so that I am not offered a write that cannot run.
23. As a seller who must reconnect before publications can be chosen, I want Go live to name that, so that Online Store cannot be included without those scopes.
24. As a seller whose shop has no Online Store publication, I want Go live to name that, so that the button does not pretend the storefront exists.
25. As a seller with quantity tracking on, I want the first write that puts the product Active on the Online Store to set available stock to the number on the page, including zero, so that the storefront shows the stock I entered.
26. As a seller with quantity tracking off, I want that write not to set a quantity, so that an untracked product stays untracked.
27. As a seller sending a Draft, I want stock left unset, so that a draft is not given available stock by this job.
28. As a seller who Syncs after units have sold, I want Shopify’s available stock left unchanged, so that a stale page number cannot overwrite sales.
29. As a seller who leaves the Online Store and later lands Active on it again, I want that landing write to set available stock from the page, so that coming back onto the storefront is a new start.
30. As a seller with Inventory set up, I want stock written at that Inventory location, so that Go live uses the location I already chose.
31. As a seller without Inventory set up, and with one active location, I want stock written there, so that I do not have to open Inventory first.
32. As a seller without Inventory set up, and with several active locations, I want stock written at the first active location, so that Go live still has a place to put the number.
33. As a seller whose product has several variants, I want Go live to put it on the Online Store and tell me stock was not set, so that one quantity is not copied onto every size or color.
34. As a seller with a single variant, I want that one quantity to be that variant’s available stock, so that the page number and the storefront number are the same.
35. As a seller whose shop has no active location, I want the product still to go live and to be told stock was not set, so that a missing location is not a failed launch.
36. As a seller whose stock write fails, I want the product still Active on the Online Store and to be told stock was not set, so that a stock error is not a lost launch.
37. As a seller whose product was already Active on the Online Store before this, I want Sync not to rewrite stock, so that existing storefront products are not backfilled.
38. As a seller using catalogue bulk Push, I want that control unchanged, so that Go live stays the product page action.
39. As a seller, I want photos, listing copy, selling, and the existing Push fields to go with Go live, so that the storefront product is the page, not a status change alone.
40. As a seller, I want vendor, collections, shipping, weight, and theme template left in Shopify admin, so that the product page does not become channel admin.
41. As a seller, I want AEO left off the Shopify write, so that Go live does not invent a metafield this Push never sent.
42. As a seller on Wix or Vinted, I want this action not to appear for those channels, so that Go live stays the Shopify storefront.

## Implementation Decisions

- Two seams. The product page decision helper decides the header action, the missing reason, the publication set Go live sends, and whether the quieter Push is allowed. The page renders that decision and does not re-encode it. The Push route is the seam for the storefront gate and the stock write, so a caller that bypasses the page cannot skip them. Catalogue bulk Push keeps its own decision helper and is not this feature.
- Header action is Go live while the last sent state is not Active with Online Store included. Once that state has been sent, the header action is Sync updates. Local ticks do not swap the header back until a write sends a different end state. There is one header action, not a second Sync in the card.
- Go live’s publication set is the ticks already chosen, plus Online Store. The quieter Push sends the ticks and Draft or Active as picked. Both writes persist the page as it stands, then Push. Persist failure does not call Shopify. Shopify failure leaves the saved page and does not mark the product live.
- A storefront write is one whose resulting status is Active and whose publication set includes Online Store. The route refuses it unless listing copy is present and the price is a number greater than zero. The refusal names the gap and is not a Plan or Allowance refusal. A Draft write, or an Active write that does not include Online Store, keeps today’s listing-copy rule only. Stale listing copy and unconfirmed facts do not refuse.
- The product page shows the same gaps before the request: missing listing copy, missing or zero price, Shopify not connected, publications not ready, Online Store absent from the shop. The control stays visible.
- Online Store is the publication whose label is Online Store, using the same label rule the Available-on list already uses.
- Available stock is set only on a storefront write when the previous sent state was not already Active on the Online Store, tracking is on, and the product has one variant. The number is the page quantity, including zero. The location is the Inventory location when the seller has one; otherwise the shop’s only active location, or the first active location when there are several. A Draft write does not set stock. A later Sync of a product that is already Active on the Online Store does not set stock. Leaving and landing again does.
- When stock cannot be written — several variants, no active location, or the stock write fails — the product still becomes Active on the Online Store and the response tells the page that stock was not set. The page says so.
- The page quantity is the starting available stock. When Inventory is on, its ledger start for that product stays that same number. This write does not become a second stock quantity, and it does not restock after sales.
- No new product column. “Already on the Online Store” is the last sent status plus the last sent publication set. No backfill of products already in that state.
- The rest of the Shopify payload stays the current Push: photos, listing copy fields Push already sends, selling, Draft or Active, publications. Vendor, collections, shipping, weight, theme template, AEO, and metafields stay out (ADR 0009, ADR 0011, ADR 0003). Wix and Vinted are not on this page (ADR 0011).
- ADR 0023 is the decision. ADR 0011’s Draft default and publication ticks remain.

## Testing Decisions

- A good test asserts what the seller can observe: which header action is offered, which reason is named, which status and publications a write sends, whether the route refuses a storefront write, and whether available stock was set. It does not assert private call order or component layout.
- The product page decision helper is the client seam. Prior art is the existing product-editor decision tests. Cases that must exist: Go live while not Active on the Online Store; Sync updates once that state was sent; missing listing copy and a missing or zero price stay visible with a reason; Go live’s publication set adds Online Store and keeps other ticks; the quieter Push is allowed to send the picked Draft without a price; a storefront pick without a price is refused with a reason; stale listing copy is not a refusal; Shopify disconnected, publications not ready, and no Online Store publication each name their reason.
- The Push route is the server seam. Prior art is the existing publications route tests, with Shopify and Inventory locations faked. Cases that must exist: a storefront write with listing copy and a price greater than zero is Active and includes Online Store; a storefront write with no price or a zero price is refused and names the price, and is not an Allowance refusal; a Draft write with listing copy and no price is allowed and does not set stock; the first storefront write with tracking on and one variant sets available stock to the page quantity, including zero, at the Inventory location when present, otherwise the only or first active location; a later Sync of a product already Active on the Online Store does not change stock; landing again after a Draft does set stock; tracking off does not set a quantity; several variants, no active location, and a failed stock write still leave the product Active on the Online Store and report that stock was not set; a product already Active on the Online Store is not backfilled.
- Do not add a third seam that renders the page. Do not change the catalogue bulk Push tests except to show that helper is untouched.

## Out of Scope

- Catalogue bulk Push
- Backfill of available stock for products already Active on the Online Store
- Changing the Draft default, or ticking Online Store by default
- Restock, Inventory adjustments, and Sync overwriting sold units
- Editing variants, or copying one quantity onto every variant
- Archived status
- Vendor, collections, shipping, weight, theme template, AEO, and metafields
- Wix and Vinted
- A Plan or Allowance gate on Push

## Further Notes

- Glossary term is **Go live**. Avoid production, publish, and push production.
- ADR 0023 records why the Draft default stayed and why stock is written once.
- The first storefront landing sets stock. A later Sync of a product that is still on the Online Store does not. A later landing, after the product has left, does.
