**Status:** done

# Import missing Shopify products into the catalogue

## Problem Statement

I already sell on Shopify. SnapSync’s New listing path is for photos I have not listed yet. My live catalogue is not in the workspace, so I cannot confirm product facts, refresh listing copy, run Bulk SEO, or treat those SKUs as Products. Inventory Autopilot can pull stock; that is not this job. I do not want to re-upload photos, tick 80 boxes, merge with Shopify every night, or run the shop (orders, collections, shipping) here.

## Solution

I open **Import** and start one run. SnapSync fetches products from the connected Shopify shop whose Channel product id is not already in my catalogue. Each new row gets identity, photos, listing copy, selling, variants (visible), Draft/Active, and publications. Product facts stay unconfirmed. Channel listing copy is grandfathered: I can edit and Push it; generate, listing copy refresh, and Bulk SEO still wait on confirmed facts. A re-run skips rows already here and only adds missing products. After Import, SnapSync owns facts, listing copy, selling, and variants; Push/Sync writes to Shopify. Import does not spend Allowance. Wix, Vinted, variant editing, and shop ops stay out.

## User Stories

1. As a seller, I want Import to be the job of fetching Channel products into the catalogue that are not already there, so that I am not re-doing New listing for a live shop.
2. As a seller, I want that job on Import, so that Products stays the catalogue and Push, and Inventory stays stock.
3. As a seller, I want Import unmarked as a stub in the nav once it works, so that the page is the job, not “not available yet.”
4. As a seller without Shopify connected, I want Start disabled with a connect reason, so that I am sent to Settings, not a fake fetch.
5. As a seller with Shopify connected, I want to start one run without ticking products, so that getting the shop in here is not a second Bulk SEO picker.
6. As a seller, I want Start to fetch every Shopify product whose Channel product id is not in my catalogue, so that a live SKU is not left behind because I forgot to tick it.
7. As a seller, I want match to be the Shopify product id, so that a dress I already pushed from SnapSync is not a second catalogue row.
8. As a seller whose twelve products already have that id, I want those twelve skipped, so that confirmed facts and listing copy I already have are not overwritten.
9. As a seller who added five SKUs in Shopify since the last run, I want a new Start to fetch those five and skip the rest, so that re-run means fetch-missing, not merge.
10. As a seller, I want a re-run not to refresh Draft/Active, publications, listing copy, or selling from Shopify on rows already here, so that SnapSync stays the owner after the first fetch.
11. As a seller, I want no schedule and no cron, so that Import stays seller-started.
12. As a seller, I want no silent fetch when I open Products or Import, so that a catalogue surprise is not a “sync.”
13. As a seller who starts while a run is already in progress, I want the second Start refused, so that two fetches cannot race into twins.
14. As a seller, I want a run that is interrupted to be safe to Start again, so that skip-on-id means retry cannot duplicate.
15. As a seller with an empty Shopify catalogue, I want a completed run with nothing created, so that empty is honest, not an error.
16. As a seller whose whole shop is already in SnapSync, I want a completed run with everything skipped, so that I know there was nothing missing.
17. As a seller, I want to see created, skipped, and failed counts when the run finishes, so that I know what landed.
18. As a seller whose one Shopify product fails, I want siblings still created, so that one bad SKU is not all-or-nothing.
19. As a seller, I want a failed product not to write a catalogue row, so that a partial product cannot look imported.
20. As a seller, I want Import not to spend Allowance, so that fetching the catalogue is free.
21. As a seller without a Plan, I want Import to run, so that the free workspace includes this job the way Plan already promised.
22. As a seller, I want New listing unchanged, so that photos I have not listed still go through draft products.
23. As a seller, I want Inventory Autopilot unchanged, so that stock import is not this page and this page does not write Inventory tables.
24. As a seller, I want listing copy on each imported product to be the Shopify title, description, tags, SEO title, and meta, so that I do not rebuild words I already sell with.
25. As a seller, I want AEO left empty on Import, so that Shopify cannot invent FAQ copy SnapSync does not have.
26. As a seller, I want product facts unconfirmed on Import, so that Channel description cannot become fibre composition, care, or GPSR identity.
27. As a seller, I want vision not to run on Import, so that suggested facts cannot be guessed from photos in this job.
28. As a seller, I want category and product type copied from Shopify when they exist, so that Details is not blank when the Channel already classified it.
29. As a seller, I want generate still gated on confirmed facts after Import, so that ADR 0002 is not a back door for live shops.
30. As a seller, I want listing copy refresh still gated on confirmed facts after Import, so that demand-shaped copy cannot invent linen.
31. As a seller, I want Bulk SEO to show those imported rows blocked with the same confirm-facts reason refresh would show, so that a pack cannot rewrite unconfirmed SKUs.
32. As a seller, I want to edit grandfathered listing copy and Push without generating, so that typed or Channel words can still ship.
33. As a seller who then confirms facts, I want existing stale-listing-copy behaviour, so that I regenerate from facts (free) before refresh.
34. As a seller, I want photos from Shopify media on the product, so that the catalogue row is not a headless title.
35. As a seller whose product has several media, I want several photos on one product (one group), so that Import matches how New listing groups photos.
36. As a seller whose Shopify product has no media, I want the product still created, so that listing copy is not refused for a missing photo.
37. As a seller, I want selling copied as price, compare-at, cost, SKU, and barcode (from the Channel’s first/default variant when the product has options), so that Selling is filled without copying stock.
38. As a seller, I want available quantity not copied as SnapSync Inventory, so that Import is not a second Autopilot and Sync cannot push a stock number this job invented.
39. As a seller, I want track-quantity copied from the Channel when it exists, so that the selling card’s track flag matches the shop without owning count.
40. As a seller, I want variants visible as Channel option names and values (color, size), so that the product page can show options that already exist.
41. As a seller, I want not to create or edit variants on Import, so that grouping photos still does not create variants and the editor stays a later product job.
42. As a seller, I want Draft or Active copied from Shopify status, so that the Channel row matches the live product.
43. As a seller, I want publications copied from the product’s current Shopify publications, so that Sync later sends that set, not a default of none.
44. As a seller, I want collections, vendor, shipping/weight, and theme template not copied onto the product page, so that ADR 0009 holds.
45. As a seller, I want the imported row already linked to that Shopify product id, so that a later Sync updates that product instead of creating a twin on the Channel.
46. As a seller, I want Push/Sync after Import to write SnapSync facts, listing copy, selling, and variants out, so that Shopify is the destination, not the owner.
47. As a seller, I want Website eligibility unchanged (already on Shopify, listing copy present), so that Import is not a second website job.
48. As a seller, I want Wix and Vinted still not connected, so that this job is Shopify-only.
49. As a seller, I want no orders, analytics, or collection manager on Import, so that this page is not channel admin.
50. As a seller, I want the SPA to show connect, in-progress, created/skipped/failed, and blocked reasons from the server, so that the page cannot invent a different skip rule than the module.
51. As a local developer with auth bypass, I want Start to run without Stripe, so that `npm run dev` can exercise Import.
52. As a future agent, I want skip, persist, and field-copy decided in one Import module, so that HTTP and the SPA cannot drift on twins, overwrite, or facts.
53. As a future agent, I want the Channel product list behind an adapter, so that tests pass a list and production uses Shopify Admin GraphQL.
54. As a future agent, I want that adapter not to be Inventory Autopilot’s bulk inventory JSONL, so that stock fetch cannot be mistaken for catalogue Import.
55. As a future agent, I want persist not to call Plan, listing copy generate, listing copy refresh, Bulk SEO, or website handoff, so that this job cannot spend or rewrite.
56. As a seller, I want one Shopify product with many variants to be one catalogue product, so that color/size is not one row per SKU.
57. As a seller, I want HTML description from Shopify stored as listing-copy description, so that Push can send it back as description HTML the way it already does.
58. As a seller looking at Products after a run, I want new rows in the catalogue, so that “imported” means visible, not only a count on Import.
59. As a seller, I want catalogue grouping of several photos of one imported product to appear as one Products row, so that media is not duplicate SKUs.
60. As a seller whose Shopify title is empty, I want the product still imported with whatever listing copy fields exist, so that a missing title is not a failed fetch (title-only still counts as listing copy present later).
61. As a seller, I want Shop GPSR left as shop default / empty on the product, so that Import does not scrape manufacturer from the description.
62. As a seller, I want no “sync from Shopify” control on Product Details in this spec, so that the product page is not a merge UI.
63. As a seller, I want leftover-weekly and Plan overage untouched, so that a free fetch cannot look like a write.
64. As a seller who forges Start without a connection, I want the module reason, so that HTTP cannot bypass connect.
65. As a seller, I want failed media on one photo not to fail the whole product when other media or listing copy can land, so that a dead CDN URL is not a lost SKU.
66. As a seller, I want no plugin Channel registry, so that Shopify Import is an in-repo Channel job (ADR 0013).
67. As a seller, I want Settings copy for Wix/Vinted unchanged, so that placeholders do not pretend Import works there.
68. As a seller, I want this page not to grow a product ticker or per-row accept, so that Import is not Bulk SEO.
69. As a seller with two photos already grouped in SnapSync under one Shopify id, I want the Channel product skipped as one match, so that extra photos on our side do not look like “missing.”
70. As a seller, I want language to stay Import, Channel, Product, Photo, listing copy, product facts, Selling, Variant, Inventory — not sync, pull, scrape, or store.

## Implementation Decisions

- One **Import** module is the seam. HTTP, the SPA, Shopify Admin GraphQL, and storage are adapters. Tests call the module. The Import page does not re-encode skip, overwrite, or field copy (ADR 0007).
- Channel product list is an adapter: tests pass a sequence of Channel products (id, listing copy, selling, option variants, media URLs, status, publication ids, product type/category, track-quantity). Production wires Shopify Admin GraphQL product pagination for the connected shop. Do not reuse Inventory Autopilot bulk `inventoryItems` JSONL. Do not add a plugin registry (ADR 0013).
- Existing catalogue ids for the session are the set of `shopify_product_id` values already stored. Match is exact Channel product id. Skip means persist nothing for that id. Never match on title or SKU.
- Module interface: blocked reason when Start must not run (Shopify not connected; a run already in progress); start a seller-started run; result counts (created, skipped, failed) plus per-failed-id reason; persist missing products only. A second Start during a run is refused. A later Start after complete is a new fetch-missing run.
- Persist one Channel product as one SnapSync product (photo group): listing copy from Channel; selling from the default/first variant (price, compare-at, cost, SKU, barcode, track-quantity); variants JSON as option name/values for display; Draft/Active and publication ids; category/product type from Channel when present; `shopify_product_id` set so later Sync updates that product. Product facts unconfirmed and empty of legal facts. AEO empty. Collections/vendor/weight/template not stored as product-page fields. Available quantity not persisted as Inventory.
- Photos: media URLs from the Channel become Photo rows in one group (primary holds listing copy and Channel id). Do not run vision/classification from photos on Import. A product with no media still persists. One dead media URL fails that photo, not the product, when listing copy can land.
- Catalogue Image rows remain the product record. If the table requires file metadata for a photo-less product, use an honest placeholder on that row rather than skipping the SKU.
- No Plan call. No Import job kind. No spend. No listing-copy generate, refresh, Bulk SEO, or website call. Confirm-facts and stale behaviour stay in the product-facts module; refresh/Bulk SEO gates stay where they are. After Import those gates must already block unconfirmed facts.
- In-flight run state may live on the server so a long fetch can be polled; it is not a schedule. Retry is safe because skip-on-id is the idempotency key. Do not add a two-way merge table or a “last Shopify hash.”
- FastAPI only (ADR 0001). Nav: Import `stub` false once the page is the job; stub copy goes away. No Push chrome on Import. No variant editor. No Wix/Vinted fetch.
- Invalidate the catalogue read the way other image writes already do so Products shows new rows.

## Testing Decisions

- Test external behaviour of the Import module, not Shopify GraphQL payloads, React layout, Supabase, or Inventory Autopilot workers.
- The Import module is the test surface. A good test puts a Channel product list, the session’s existing Channel ids, and a fake persist in, and asserts created vs skipped vs failed, no overwrite of an existing id, unconfirmed facts, copied listing copy/selling/variants/status/publications, no quantity-as-inventory, no Plan spend, no twin rows, mixed failure, and second start while running refused — without HTTP and without a live shop.
- Do not re-test the full listing-copy-refresh or product-facts matrices. Assert reuse: an imported row with grandfathered copy and unconfirmed facts is blocked for refresh/generate the same way those modules already decide. Prior art: `test_bulk_seo.py` (module + fake adapters), `test_website_handoff.py`, `test_product_facts.py` (grandfathered copy), `test_listing_copy_refresh.py` (facts gate), `test_plan.py` (no spend unless called).
- Cases that must exist: not connected blocks Start; empty Channel list creates zero; all ids already present skips all; one new id among existing creates one; same id twice in one Channel list still one persist; multi-media becomes one product group; no media still creates; variants options stored, one catalogue product; selling from first variant, quantity not stored as stock; publications and Draft/Active copied; legal facts not inferred from description; AEO empty; collections not required; one Channel failure does not drop siblings; in-progress Start refused; post-complete Start only adds ids not seen; persist is never a Plan job kind.
- Thin HTTP tests are optional and are not a second seam: Start without connect returns the module reason; completed body exposes created/skipped/failed. Do not hit Shopify in CI. Do not test Express. Do not snapshot Import layout.

## Out of Scope

- Variant create/edit on the product page (later product job; ADR 0009 / 0017)
- Quantity writes, Inventory Autopilot changes, or using Autopilot bulk JSONL as Import
- Two-way merge, scheduled Import, or overwriting SnapSync from Shopify on re-run
- Bulk SEO–style product ticks; Push from Import
- Wix, Vinted, WooCommerce
- Orders, collections, shipping/weight, vendor, theme template, analytics
- Vision / suggested facts / listing-copy generate on Import
- Website handoff changes; Plan prices or a new job kind
- Guessing fibre composition, care, or GPSR from Channel description
- A live SnapSync storefront or “open in Shopify” chrome
- Locale picker; matching on title/SKU

## Further Notes

- Glossary: **Import**, **Channel**, **Product**, **Photo**, **listing copy**, **product facts**, **confirmed facts**, **Selling**, **Variant**, **Inventory**, **Publication**, **Plan**, **Allowance**. Avoid sync, pull, scrape, store (for Channel), credits, unlock.
- ADRs: 0017 (fetch-missing; SnapSync owns the record), 0002 (facts gate; grandfathered copy), 0005 (catalogue-first; honest stub until this job), 0007 (rules on the server), 0008 (photos do not create variants), 0009 / 0011 (not channel admin; publications on the Channel row), 0013 (second Channel later), 0014 (Import does not spend).
- Inventory Autopilot’s “Import Shopify catalog” is stock setup, not this job. Keep the words apart in UI copy: this page is **Import**.
- After this spec: split into tracer-bullet tickets with blocking edges (`/to-tickets`). Do not implement from this file in one shot if the work will span sessions.
