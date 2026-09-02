**Status:** done

# Bulk SEO

## Problem Statement

I already refresh listing copy from search demand one product at a time. I cannot pick several catalogue products, see demand-shaped proposals together, and accept the ones that are good. I do not want an agent that scans rival shops, runs every week on its own, or publishes to a Channel when I say yes.

## Solution

I open **Bulk SEO**, tick catalogue products that already pass **listing copy refresh**, and Start. Each selected product gets its own **search demand** snapshot and a proposal for tags, description, SEO title, and meta. I accept or dismiss per product. Accept writes those four fields in SnapSync and spends one Allowance use when that write lands. Push stays a separate action, not on this page. One empty-demand or failed rewrite does not wipe the rest of the pack. Leaving the page drops in-flight proposals. One-product refresh on Product Details stays as it is.

## User Stories

1. As a seller, I want Bulk SEO to be the job of listing copy refresh for many products I pick, so that I am not learning a third SEO product.
2. As a seller, I want one-product listing copy refresh on Product Details unchanged, so that a single dress does not require a catalogue run.
3. As a seller, I want to pick products on Bulk SEO, so that this job has a destination the way Website already does.
4. As a seller, I want not to pick this run from the Products catalogue bar, so that Products stays the catalogue and Push.
5. As a seller, I want eligible products tickable, so that I only start products that would pass listing copy refresh.
6. As a seller, I want blocked products still listed with the same server reason refresh would show, so that I know whether to confirm facts, generate, regenerate stale copy, or wait on search demand.
7. As a seller, I want those reasons to come from the listing copy refresh module, so that Bulk SEO cannot invent a different gate.
8. As a seller whose search demand is not configured, I want Start disabled with that refresh reason, so that I do not think the model is seeing Google.
9. As a seller without a Plan, I want Start disabled with the Plan reason, so that looking at a catalogue pack is not a free rewrite farm.
10. As a seller with a Plan, I want Start to run without spending, so that a proposal I might dismiss is not a bill.
11. As a seller, I want Start to show how many Allowance uses accepting all ticked eligible products would spend, so that a large tick is a decision, not a surprise.
12. As a seller, I want no second product cap on Start, so that overage is the backstop the Plan already prices.
13. As a seller, I want Select all to mean all eligible products on this page, so that blocked rows are not silently included.
14. As a seller with an empty catalogue, I want an empty state, so that Bulk SEO is not a broken picker.
15. As a seller with a catalogue but nothing eligible, I want Start disabled and blocked reasons visible, so that the next job is facts or generate, not a pack.
16. As a seller, I want Start to fetch search demand per selected product, so that a linen dress and a mug do not share one query list.
17. As a seller, I want each proposal to include the queries that product aimed at, so that I can see what demand meant this time.
18. As a seller, I want a proposal for tags, description, SEO title, and meta description, so that the SERP unit is rewritten together.
19. As a seller, I want product title left alone, so that a catalogue pass does not rename SKUs.
20. As a seller, I want AEO left alone, so that unused FAQ copy is not smuggled into this job.
21. As a seller, I want accept to keep the current product-facts block verbatim, so that fibre, care, and GPSR English is not rewritten as marketing.
22. As a seller, I want accept rejected when that block is missing or changed, so that a bad rewrite cannot persist.
23. As a seller, I want accept not to stamp a new facts block onto the proposal, so that I am accepting the words I saw.
24. As a seller, I want accept not to clear stale listing copy, so that Bulk SEO cannot pretend to be generate Accept.
25. As a seller, I want SEO title still max 70 characters and meta still max 320, so that this job matches refresh limits.
26. As a seller, I want tags in a proposal to use only confirmed fibre names, so that SEO tags cannot contradict composition.
27. As a seller, I want listing-copy constraints from product facts still applied, so that skipped care or GPSR cannot be invented in the demand pass.
28. As a seller, I want no competitor names, scraped titles, or “vs other shops” copy, so that ADR 0012 is not reversed by a pack.
29. As a seller, I want the model not to invent queries when demand is missing, so that empty demand is a reason, not a guess.
30. As a seller whose one product returns empty demand, I want the rest of the pack still to return, so that one mug does not wipe nine dresses.
31. As a seller whose one product fails to parse a rewrite, I want that product to show a reason and the rest to stay, so that a model glitch is not all-or-nothing.
32. As a seller, I want a failed or empty product not to spend, so that a write that did not land is free.
33. As a seller, I want not to retry that product automatically, so that the agent does not come back.
34. As a seller, I want to accept per product, so that one bad dress does not block a good week.
35. As a seller who accepts, I want those four fields persisted in SnapSync, so that “done” means stored, not published.
36. As a seller who accepts, I want one Allowance use spent as Bulk SEO persist, so that the ledger can tell a pack accept from Product Details refresh.
37. As a seller who dismisses a product, I want nothing persisted and nothing spent, so that a rejected proposal is free.
38. As a seller who regenerates one product, I want a new rewrite against that product’s same demand snapshot, so that I am comparing copy, not a moving query list.
39. As a seller who regenerates, I want no spend until I accept, so that a worse pass cannot bill me.
40. As a seller who accepts a second time later on the same product, I want another use spent, so that each taken rewrite is counted.
41. As a seller who leaves Bulk SEO, I want in-flight proposals gone, so that a preview cannot leak onto a later Start.
42. As a seller who Starts again, I want demand fetched again per product, so that a new look at queries is an explicit new job.
43. As a seller, I want no shop-wide or week-cached demand snapshot, so that “weekly” cannot sneak back in as stale queries.
44. As a seller, I want no schedule and no cron, so that this job stays seller-started.
45. As a seller, I want no autonomous write, so that listing copy cannot change while I am away.
46. As a seller, I want no Push control on Bulk SEO, so that Channel publish stays on Products and Product Details.
47. As a seller who accepts then pushes later, I want Shopify to receive the stored tags and SEO fields the way a refresh accept already does, so that this page is not a second publish path.
48. As a seller, I want the next website snapshot to pick up accepted listing copy as it already does, so that Website is not involved in this job.
49. As a seller, I want Bulk SEO unmarked as a stub in the nav once it works, so that the page is the job, not “not available yet.”
50. As a seller, I want the page not to grow SEO scores, crawl reports, or handle editors, so that Bulk SEO is not channel admin.
51. As a seller, I want no LangGraph agent and no internet-browse tools, so that this pack cannot scrape shops.
52. As a seller, I want Langfuse not required to ship this job, so that tracing cannot block the catalogue loop.
53. As a seller of a non-textile product with listing copy present and not stale, I want it eligible the same way refresh allows, so that a mug can follow search demand without a fibre pack.
54. As a seller whose listing copy is only a title, I want that to count as listing copy present, so that I can still refresh tags and SEO fields in a pack.
55. As a seller with unconfirmed facts on one SKU, I want that row blocked and the others tickable, so that the pack is not all-or-nothing at pick time.
56. As a seller with stale listing copy on one SKU, I want that row to say regenerate from facts, so that demand cannot polish drifted claims.
57. As a seller who confirmed facts but never generated, I want that row to say generate first, so that refresh is not a back door around the facts gate.
58. As a seller, I want Plan leftover-weekly to allow pack accepts until the weekly 30, then hard-stop further accepts, so that what they already bought does not change under them.
59. As a seller on a Plan who already used 20 this month, I want further accepts to run as overage at the published per-use price, so that a photoshoot weekend is not a wall.
60. As a seller at leftover-weekly cap mid-pack, I want earlier accepts kept and later ones refused with the weekly reason, so that a wall is per accept, not a rollback.
61. As a local developer with auth bypass, I want Start and accept to run without Stripe, so that `npm run dev` can exercise the pack.
62. As a seller, I want the SPA to disable ticks, Start, and accept from server outcomes, so that the page cannot invent a different eligibility or Allowance than the API.
63. As a future agent, I want pack behaviour decided in one Bulk SEO module, so that HTTP and the SPA cannot drift on mixed success, spend count, or per-product accept.
64. As a future agent, I want that module to call listing copy refresh rather than copy its gate, four fields, or accept rules, so that a facts-block change is fixed once.
65. As a future agent, I want search demand still behind the refresh adapter, so that tests fake queries the same way refresh already does.
66. As a future agent, I want Plan called only when an accept lands, with job kind Bulk SEO persist, so that Start, regenerate, dismiss, and failed rewrites never spend.
67. As a seller, I want typed listing copy and Inventory and Import untouched by this page, so that Bulk SEO is not a second catalogue editor.
68. As a seller, I want no “Agentic SEO” or “SEO agent” copy, so that the glossary name is the product name.
69. As a seller looking at a successful proposal, I want accept and dismiss on that row, so that I am not forced into all-or-nothing.
70. As a seller who forges Start with a blocked product id, I want that item to return the refresh reason and the rest to continue, so that the pack cannot be used to bypass the gate.
71. As a seller who Starts with no ids, I want Start refused, so that an empty run is not a demand fetch.
72. As a seller, I want query language to stay the language of each product’s existing listing copy, so that v1 needs no locale picker.
73. As a seller, I want rising or season words used only when still true of confirmed facts, so that “organic” cannot appear on a garment that is not organic.
74. As a seller who accepts, I want ordinary Save on Product Details still not to assemble fact blocks, so that a later edit is not confused with this accept.
75. As a seller, I want several photos of one product to appear as one catalogue row, so that grouping is not a meter and not a duplicate rewrite.

## Implementation Decisions

- One **Bulk SEO** module is the seam. HTTP, the SPA, the model, and the live query vendor are adapters. Tests call the module. The Bulk SEO page does not re-encode eligibility, mixed-pack success, or Allowance (ADR 0007).
- The module calls the existing **listing copy refresh** module for: blocked reason, start (demand fetch + proposal constraints), regenerate against a given snapshot, and accept of the four fields. It does not duplicate those rules. It does not call the model or the query vendor except through the same adapters refresh already uses.
- The module calls the existing **Plan** module only on a successful accept, with job kind Bulk SEO persist. Start, regenerate, dismiss, empty demand, parse failure, and accept conflict do not spend. Plan leftover-weekly and overage behaviour stay in the Plan module.
- Module interface: catalogue rows (identity plus refresh eligibility); a page-level blocked reason when Start must not run (no Plan, or search demand not configured — using the existing Plan and refresh strings, not new twins); start a run for selected ids and return per-product outcomes (proposal and queries, or that product’s reason); proposed use count (eligible ticks before start; successful proposals after start); accept one product’s proposal (persist via refresh accept, then Plan spend, or reject). In-flight pack state is not a column; leaving the page is dropping client state the way refresh already does.
- Start with no ids is refused. A selected id that refresh would block returns that reason on that item and does not fail the pack. Empty demand or a failed rewrite is the same grain: that item errors, siblings continue, no silent retry.
- Proposal shape is refresh’s: tags, description, SEO title, meta, queries. Title and AEO are omitted. Accept persistence and facts-block verbatim rules are refresh’s.
- There is no extra product cap. The page shows how many uses accepting all would spend. Overage is Plan’s.
- Product picking lives only on Bulk SEO, in the same spirit as Website (list + tick + primary action). Do not add a send-to-Bulk-SEO action on Products.
- FastAPI only (ADR 0001). Do not add Express. Do not add a LangGraph graph for this job. Do not add Langfuse as a requirement.
- No schema change for the pack: no stored run, no week-cached demand, no competitor tables, no SEO score column.
- Nav: Bulk SEO is no longer a stub once the page is the job. Stub copy about “not available yet” goes away.
- Push, Website, and Product Details refresh are unchanged except that accepted listing copy is what they already read. No Push chrome on Bulk SEO (ADR 0009).
- Plan copy that lists paid jobs may name Bulk SEO in the existing need-a-Plan sentence so the reason is honest; do not invent a second entitlement string.

## Testing Decisions

- Test external behaviour of the Bulk SEO module, not prompt wording, the live query vendor, OpenAI, React layout, LangGraph, or Langfuse.
- The Bulk SEO module is the test surface. A good test puts a catalogue of products (facts, listing copy, eligibility), a fake search-demand adapter (or the refresh module with that fake), selected ids, and Plan entitlement in, and asserts row reasons, mixed pack outcomes, proposed use count, per-product persist vs no-persist, and spend vs no-spend — without HTTP and without Stripe.
- Do not re-test the full listing-copy-refresh gate matrix here. Those tests stay on the refresh module. Bulk SEO tests assert reuse: a product refresh would block is not eligible; a product refresh would start can be included; accept that would fail refresh accept persists nothing and does not spend.
- Cases that must exist: blocked rows keep the refresh reason; Start without Plan is blocked; unconfigured demand blocks Start with the refresh reason; empty selection is refused; one empty-demand item does not drop siblings; one parse failure does not drop siblings; accept spends Bulk SEO persist once when the write lands; dismiss and regenerate do not spend; accept conflict (mutated facts block) spends nothing; proposed use count matches successful proposals, not failed items; leaving the page is not a server persistence of the pack; title and AEO are absent from persist; local bypass may run with no ledger billing.
- Thin HTTP tests are optional and are not a second seam: start returns mixed items rather than failing the request; accept uses the module’s reason. Prior art: listing-copy-refresh module tests, Plan module tests (`bulk_seo_persist` is already a job kind), Website’s on-page picker.
- Do not test Express. Do not snapshot SERP preview layout. Do not hit a real query API in CI.

## Out of Scope

- Replacing or changing one-product listing copy refresh on Product Details
- A LangGraph agent, internet-browse tools, or Langfuse tracing
- A weekly cron, scheduled proposal pack, or autonomous write
- Scraping competitor listings, fashion media, or social trends
- Shop-wide or week-cached search demand
- Rewriting product title or AEO
- All-or-nothing accept, per-field accept inside a product, or Push from this page
- Picking the run from the Products catalogue bar
- A hard cap that re-rations Allowance
- A second paid Plan, credit packs, or a compliance-check product
- Changing product-facts rules, refresh demand rules, or Plan prices except to call them
- Multi-shop billing; Wix/Vinted as a second Channel in this job
- Locale picker; SEO scores; URL handle editors; Shopify Search Console as a v1 gate

## Further Notes

- Glossary: **Bulk SEO**, **listing copy refresh**, **search demand**, **listing copy**, **Plan**, **Allowance**, **confirmed facts**, **stale listing copy**. Do not name this Agentic SEO, SEO agent, or a weekly SEO agent.
- ADRs: 0015 (seller-started search-demand pack, not an agent), 0016 (reuse listing copy refresh per selected product, pick on Bulk SEO, partial pack, no second cap), 0012 (demand not competitors), 0014 (Plan and Allowance), 0002 (facts gate), 0007 (rules on the server), 0009 (not channel admin).
- Plan already reserved Bulk SEO persist; this spec is the catalogue loop that job kind was waiting on.
- After this spec: split into tracer-bullet tickets with blocking edges (`/to-tickets`). Do not implement from this file in one shot if the work will span sessions.
