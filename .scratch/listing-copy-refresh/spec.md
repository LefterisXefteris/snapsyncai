**Status:** ready-for-agent

# Listing copy refresh from search demand

## Problem Statement

I already confirmed product facts and generated listing copy once. Search demand moves, and other shops rank for queries my tags and description do not use. I have no way to look at what people actually type and get a proposal for better tags, description, page title, and meta — without inventing fibre or safety claims, scraping competitors, or publishing behind my back.

## Solution

On Product Details, inside Listing copy, I start a **listing copy refresh**. SnapSync looks at **search demand** for this product (a real query source, plus this shop’s performance when it exists) and proposes new **tags**, **description**, **SEO title**, and **meta description**, plus the queries it aimed at. I accept, dismiss, or regenerate.

Refresh does not run when facts are unconfirmed, listing copy does not exist, listing copy is stale, no query source is configured, or the source returns no queries. The control stays visible and is disabled with the real reason. Accept persists only those four fields. It does not write or push on its own, does not clear stale listing copy, does not change product title or AEO, and rejects a proposal whose description no longer contains the current product-facts block verbatim.

## User Stories

1. As a seller, I want to start a listing copy refresh on one product, so that tags and search copy can follow search demand without waiting on Bulk SEO.
2. As a seller, I want that control inside Listing copy on Product Details, so that I am not learning a second SEO product on the page.
3. As a seller, I want refresh to propose tags, description, SEO title, and meta description, so that the SERP unit is rewritten together.
4. As a seller, I want the proposal to include the queries it aimed at, so that I can see what “ahead” meant this time.
5. As a seller, I want to accept a proposal, so that those four fields persist without a silent save.
6. As a seller, I want to dismiss a proposal, so that nothing on the product changes.
7. As a seller, I want to regenerate a proposal, so that I can try different words against the same demand.
8. As a seller who regenerates, I want the same search-demand snapshot, so that I am comparing copy, not a moving query list.
9. As a seller who starts refresh again, I want demand fetched again, so that a new look at queries is an explicit new job.
10. As a seller, I want refresh not to run just because I opened the product page, so that I am not billed or surprised by a rewrite I did not ask for.
11. As a seller, I want refresh not to run on a schedule, so that catalogue-wide timing stays a Bulk SEO job later.
12. As a seller, I want one pack, not a score, so that I am not chasing a number that is not the product.
13. As a seller with unconfirmed product facts, I want refresh disabled with that reason, so that demand-shaped copy cannot invent facts.
14. As a seller with no listing copy yet, I want refresh disabled and first generate still the path, so that refresh is not a back door around the facts gate.
15. As a seller with stale listing copy, I want refresh disabled and regenerate-from-facts still the path, so that demand is not applied on top of facts that already drifted.
16. As a seller whose query source is not configured, I want refresh disabled with that reason, so that I do not think the model is seeing Google.
17. As a seller whose query source returns no queries for this product, I want refresh disabled with that reason, so that empty demand is not filled with guesses.
18. As a seller, I want those blocked reasons to come from the server, so that the page cannot invent a different gate than Generate already uses.
19. As a seller, I want the control still visible when it is disabled, so that a missing source looks like a missing source, not a missing feature.
20. As a seller, I want refresh to look at search demand, so that the rewrite aims at queries people type for this kind of product.
21. As a seller with shop performance available, I want that folded into the same snapshot, so that what already works in my shop can steer the rewrite.
22. As a seller without shop performance, I want refresh still possible if the query source is configured, so that analytics wiring is not the gate.
23. As a seller, I want refresh not to scrape other sellers’ listings, so that I do not copy their claims or fibre lies.
24. As a seller, I want refresh not to read fashion-season media, so that “linen is in” cannot invent a fabric I did not confirm.
25. As a seller, I want the model not to invent queries when demand is missing, so that ordinary generate cannot be renamed search demand.
26. As a seller, I want “ahead of competition” to mean ranking for queries this product should win given confirmed facts, so that denser rival copy is not the goal.
27. As a seller, I want a rising or season word used only when it is still true of this product, so that “organic” cannot appear on a garment that is not organic.
28. As a seller, I want words that are not true of confirmed facts dropped, so that v1 does not interview me for new facts under an SEO button.
29. As a seller, I want tags in a refresh to use only confirmed fibre names, so that SEO tags cannot contradict composition.
30. As a seller, I want the proposed description to keep the current product-facts block verbatim, so that fibre, care, and GPSR English is not rewritten as marketing.
31. As a seller, I want accept to be rejected if that block is missing or changed, so that a bad rewrite cannot persist.
32. As a seller, I want accept not to stamp a new facts block onto the proposal, so that I am accepting the words I saw, not a silent mutation.
33. As a seller, I want accept not to clear stale listing copy, so that refresh cannot pretend to be description Accept after generate.
34. As a seller, I want product title left alone, so that a demand rewrite does not rename the product.
35. As a seller, I want AEO left alone, so that unused FAQ and snippet work is not smuggled into this job.
36. As a seller who accepts, I want Push still a separate action, so that trend-shaped copy cannot publish to Shopify without me.
37. As a seller who accepts, I want ordinary Save still not to assemble fact blocks or clear stale, so that refresh accept is not confused with generate Accept.
38. As a seller, I want SEO title still max 70 characters and meta still max 320, so that refresh matches the limits I already edit on the page.
39. As a seller, I want queries seeded from confirmed facts and the current title and tags, in the language of the existing listing copy, so that v1 needs no locale picker.
40. As a seller of a textile product, I want listing-copy constraints from product facts still applied to the rewrite, so that skipped care or GPSR cannot be invented in the demand pass.
41. As a seller of a non-textile product, I want refresh still available once listing copy exists and is not stale, so that a mug can follow search demand without a fibre pack.
42. As a seller, I want generate and per-field regenerate unchanged, so that first listing copy is still the facts-gated generate I already have.
43. As a future agent, I want whether refresh may run decided in one listing-copy-refresh module, so that HTTP and the SPA cannot drift on the gate.
44. As a future agent, I want search demand behind an adapter, so that tests can fake queries and production can use a configured source.
45. As a seller, I want a missing query source to be a blocked refresh, not a stub page, so that this job lives on the product, not on Bulk SEO.
46. As a seller, I want Bulk SEO still the stub for many products, so that this spec does not pretend the catalogue loop exists.
47. As a seller whose listing copy is only a title, I want that to count as listing copy present, so that I can still refresh tags and SEO fields.
48. As a seller who dismisses and later saves other edits, I want the dismissed proposal gone, so that a preview cannot leak onto Save.
49. As a seller who accepts, I want the next website snapshot to pick up the new listing copy as it already does, so that Website is not a second publish path.
50. As a seller, I want Shopify push of SEO title and meta unchanged after I accept, so that native shop SEO fields still receive what I stored.
51. As a seller, I want AEO still not pushed to Shopify by this job, so that unpublished FAQs are not “fixed” as a side effect.
52. As a seller looking at a blocked control, I want the reason to name facts, missing copy, stale copy, missing source, or empty demand, so that I know which job to do next.
53. As a seller who confirmed facts but never generated, I want first generate, not refresh, so that there is a current description for the facts block to sit in.
54. As a seller who changed facts after generate, I want to regenerate listing copy from facts before refresh, so that demand cannot polish stale claims.
55. As a seller, I want regenerate of a proposal not to persist until I accept, so that a worse pass cannot overwrite the product.
56. As a seller, I want the demand snapshot not stored as a new product fact, so that leaving the page is just starting fresh next time.
57. As a seller, I want no competitor names, scraped titles, or “vs other shops” copy in the proposal, so that the job cannot smuggle competitor listings back in.
58. As a seller, I want no fashion-editorial tone that asserts a season fabric I did not confirm, so that search demand cannot become merchandising.
59. As an unpaid or paid seller, I want the same refresh gate, so that billing cannot bypass search demand or facts.
60. As a seller, I want this page still not to grow Shopify admin SEO chrome (scores, crawl reports, handle editors), so that Product Details stays the SnapSync product.

## Implementation Decisions

- One **listing copy refresh** module is the seam. HTTP, the SPA, the model, and the live query vendor are adapters. Tests call the module. Product Details does not re-encode the gate (ADR 0007).
- The module calls the existing **product facts** module for: whether listing copy may be generated, whether listing copy is present, whether listing copy is stale, description-block HTML, and listing-copy constraints. It does not duplicate those rules.
- Module interface: why refresh is blocked (or not); seed queries from confirmed facts plus current title and tags; rewrite constraints given a demand snapshot and current facts blocks; accept a proposal (persist the four fields, or reject). Demand fetch goes through a **search demand** adapter passed into the module.
- Blocked when any of: product facts would refuse generate; listing copy is not present; listing copy is stale; the search-demand adapter is not configured; a started refresh received an empty snapshot. Each reason is a distinct server string the SPA can show.
- HTTP copies module outcomes onto the product payload (`may` + blocked reason). The SPA disables the control from those outcomes. Do not add a TypeScript twin of the gate.
- Starting refresh: fetch a demand snapshot via the adapter (query source required; shop performance merged when that connection exists). Empty snapshot → conflict with the empty-demand reason; do not call the model.
- Proposal is one JSON pack, not a stream and not a score: tags, description, SEO title, meta description, and the queries in that snapshot. Product title and AEO are omitted.
- Regenerating a proposal sends the same snapshot back into the module and asks the model again. The module does not fetch. A new start is what fetches.
- The snapshot is held with the in-flight proposal only. It is not a new column on the product. Leaving the page drops it; the next start fetches again.
- Accept persists only tags, description, SEO title, and meta description. It does not change title or AEO. It does not set or clear stale listing copy. It does not call description-block stamping. If the current facts-block HTML is non-empty, the proposed description must contain that HTML verbatim or accept is a conflict.
- Rewrite constraints include existing listing-copy constraints, the snapshot queries, “drop claims not true of confirmed facts,” “keep the facts block unchanged,” and the SEO title / meta character limits already used on generate (70 / 320).
- Search-demand adapter: configured or refresh is blocked. Production uses a named query source from environment/settings. Tests use a fake adapter. The model is not an adapter for search demand (ADR 0012). Shop performance is an extra input to the same adapter snapshot, not a second gate.
- Query language is the language of the existing listing copy. No locale field in v1.
- FastAPI only. Do not add an Express implementation (ADR 0001).
- No schema change for this job: no new product-facts keys, no competitor tables, no SEO score column.
- Push, Website handoff, and Bulk SEO are unchanged. Accepting refresh updates listing copy the same way a seller edit of those four fields would; Push and a later website snapshot read what is stored.
- Product page chrome: one control inside Listing copy, same accept/dismiss/regenerate pattern as generate, no new section, no score sidebar, no Shopify SEO admin (ADR 0009).

## Testing Decisions

- Test external behaviour of the listing-copy-refresh module, not prompt wording, the live query vendor, OpenAI, or React layout.
- The module is the test surface. A good test puts product facts, listing copy, adapter configuration, and a fake snapshot in, and asserts blocked reason, seeded queries, accept updates, or accept conflict — without HTTP or a model.
- The search-demand adapter is faked at the module interface. Do not hit a real query API in CI. Do not let tests “fetch demand” by calling the model.
- Cases that must exist: unconfirmed facts cannot refresh; confirmed facts with no listing copy cannot refresh; stale listing copy cannot refresh; unconfigured adapter cannot refresh; configured adapter with empty snapshot cannot start a rewrite; listing copy present and not stale with a non-empty fake snapshot can start; accept writes the four fields and leaves stale as it was; accept with a mutated or missing facts block is rejected and persists nothing; accept does not stamp blocks; regenerate is given the same snapshot object the start returned; start with a new fake snapshot is a different snapshot; proposed tags cannot be accepted if they would violate confirmed-fibre constraints already owned by product facts (assert via reject or via constraints output — not via parsing the model); title and AEO are absent from accept updates.
- Thin HTTP tests are optional and are not a second seam: refresh refuses with the module’s reason when blocked; accept conflict when the facts block is missing. Prior art: product-facts module tests, plus the existing generate HTTP tests that assert gate/photo errors without calling the model.
- Do not test Express. Do not snapshot SERP preview layout or Shopify search-console HTML.

## Out of Scope

- Bulk SEO (many products, schedules, “when demand moves”)
- Product title and AEO in the proposal
- Auto-save, auto-push, or running refresh on product-page open
- Scraping competitor listings, fashion media, or social trends
- Model-invented queries when the source is missing or empty
- An SEO score, crawl report, or URL handle editor
- Asking the seller new product facts because demand likes a word (“is this organic?”)
- Locale picker or listing copy in a language other than the existing copy
- Wiring a specific commercial query vendor beyond “configured adapter or blocked”
- Shopify Search Console OAuth as a v1 gate (shop performance is extra when it exists)
- Publishing AEO to Shopify; Wix/Vinted push; metafields (ADR 0003)
- Changing the product-facts generate gate, stale rules, or description-block assembly except to call them
- Website handoff shape (it already snapshots listing copy)

## Further Notes

- Glossary: **listing copy refresh**, **search demand**, **listing copy**, **Bulk SEO**, **stale listing copy**, **confirmed facts**. Do not name this Agentic SEO.
- ADRs: 0002 (gate listing copy on facts), 0007 (rules on the server), 0009 (product page is not channel admin), 0012 (demand, not competitors or model guesses).
- v1 query language matches existing listing copy. Correct that only if the seller says otherwise.
- After this spec: split into tracer-bullet tickets with blocking edges (`/to-tickets`). Do not implement from this file in one shot if the work will span sessions.
