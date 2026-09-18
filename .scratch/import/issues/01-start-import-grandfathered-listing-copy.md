# 01: Start Import; missing Shopify products land with grandfathered listing copy

**What to build:** A seller with Shopify connected opens Import and starts one run (no product ticks). Every Shopify product whose Channel product id is not in the catalogue lands as a Products row with Channel listing copy (title, description, tags, SEO title, meta), category/product type when the Channel has them, and that Shopify product id already linked. Product facts stay unconfirmed; AEO stays empty; fibre, care, and GPSR are not guessed from the Channel description. Existing ids are skipped and not overwritten. Generate, listing copy refresh, and Bulk SEO still wait on confirmed facts; grandfathered copy can be edited and Pushed. Import does not spend Allowance and works without a Plan. The page is the job, not “not available yet.” Inventory Autopilot’s stock setup no longer uses the word Import.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Shopify not connected: Start disabled with the connect reason; a forged Start returns that same reason
- [x] Connected Start fetches every Shopify product whose Channel product id is missing; no picker, no silent fetch on open, no schedule
- [x] Match is Shopify product id only (not title or SKU); existing ids skip and keep SnapSync listing copy and facts; several photos already grouped under one id count as one skip
- [x] New rows show in Products with grandfathered listing copy, Channel id set (later Sync updates that product), HTML description stored as listing copy, AEO empty, product facts unconfirmed, Shop GPSR left as shop default
- [x] Empty Shopify catalogue completes with nothing created; a shop already fully here completes with everything skipped; empty title still imports
- [x] Generate, listing copy refresh, and Bulk SEO stay blocked on confirm-facts for those rows; Push of grandfathered copy still works; New listing is unchanged
- [x] Import does not spend Allowance and runs without a Plan (including local auth bypass)
- [x] Nav Import is no longer a stub; Inventory Autopilot no longer labels stock setup “Import Shopify catalog”
- [x] Skip, persist, and field-copy live in one Import module with a Channel product-list adapter (not Inventory Autopilot bulk stock); tests fake the list; Wix/Vinted/Push-from-Import/variant editor stay out
