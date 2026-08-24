**Status:** ready-for-agent

# One Product facts module

## Problem Statement

I already confirm product facts before Generate will write listing copy. The browser still re-decides the same rules: whether I may generate, and how fibre composition, care instructions, and GPSR identity are stamped into the description. Those two rulebooks can disagree. When I edit confirmed facts, nothing marks listing copy stale, so I can publish copy that no longer matches the facts I just saved. Changing Shop GPSR identity has the same hole for products that use the shop default.

## Solution

Product facts live in one server module. Confirm, the generate gate, description-block HTML, and stale listing copy are decided there. HTTP returns those outcomes on the product payload. The workspace reads them; it does not re-encode the rules.

When confirmed facts change and listing copy already exists, listing copy becomes stale. A banner tells me to regenerate. Generate stays available. Channel push stays allowed, with a warning. Stale clears only when I persist a generated description (the server applies the fact blocks). Ordinary save and title-only Accept do not clear it. Saving Shop GPSR identity stales products that use the shop default and already have listing copy. Existing mismatched rows are not backfilled.

## User Stories

1. As a seller, I want Generate enabled or disabled from the server’s product payload, so that the browser cannot open a gate the server would refuse.
2. As a seller, I want per-field regenerate to use that same payload outcome, so that a single field cannot bypass the gate either.
3. As a seller whose confirm is rejected, I want the server error to be the authority, so that a local “ready” check cannot contradict confirm.
4. As a seller filling GPSR identity or care instructions, I want Confirm disabled while those picks are still empty, so that I am not submitting a form I know will fail.
5. As a seller, I want that disable to be form completeness only, so that it is not a second generate gate.
6. As a seller who confirms product facts, I want the response to include whether I may generate listing copy, so that the page does not compute that from the facts blob.
7. As a seller who confirms product facts, I want the response to include whether listing copy is stale, so that the banner is not a client guess.
8. As a seller on Product Details, I want description-block HTML from the payload, so that the page does not assemble fibre, care, or GPSR blocks itself.
9. As a seller looking at the Products catalogue, I want each product to say whether listing copy is stale, so that Channel push can warn without opening Product Details.
10. As a seller who generates listing copy, I want the server to still refuse with a conflict when facts are not confirmed, so that a stale or hacked client cannot invent copy.
11. As a seller who accepts generated description, I want that Accept to persist on a dedicated path, so that ordinary product save cannot be mistaken for a regenerate.
12. As a seller who accepts generated description, I want the server to insert the current fact blocks into that description, so that publish cannot drop composition, care, or GPSR identity.
13. As a seller who accepts generated description, I want stale listing copy cleared, so that the banner goes away when facts and copy match again.
14. As a seller who accepts only a generated title, I want listing copy to stay stale, so that a new title cannot hide an outdated description.
15. As a seller who accepts generated tags or AEO without a new description, I want listing copy to stay stale, so that SEO tweaks do not count as regenerating facts-bearing copy.
16. As a seller who Accepts generated copy but has not persisted yet, I want stale to stay set, so that closing the tab does not pretend I regenerated.
17. As a seller who fixes a typo in the title and hits Save, I want stale listing copy unchanged, so that a hand edit is not treated as a regenerate.
18. As a seller who changes price, tags, or media order and saves, I want stale listing copy unchanged, so that commerce edits do not clear a facts mismatch.
19. As a seller who generates listing copy via the stream, I want the stream itself not to write the product, so that incomplete streams cannot clear stale.
20. As a seller confirming product facts for the first time with no title or description yet, I want listing copy not marked stale, so that an empty product is not treated as outdated copy.
21. As a seller confirming the same facts again with no change, I want listing copy not marked stale, so that a no-op Confirm does not nag me to regenerate.
22. As a seller with a grandfathered title who confirms facts for the first time, I want listing copy marked stale, so that I know that title was not written from these facts.
23. As a seller who already generated listing copy and then changes fibre composition, I want listing copy marked stale, so that 80% cotton in the description cannot outlive 100% cotton in the facts.
24. As a seller who changes care instructions from skip to fill after generating, I want listing copy marked stale, so that a missing care block is visible as a mismatch.
25. As a seller who changes GPSR identity on the product after generating, I want listing copy marked stale, so that the old manufacturer line is not treated as current.
26. As a seller who switches GPSR from shop default to skip after generating, I want listing copy marked stale, so that a GPSR block that should disappear is flagged.
27. As a seller who flips “this is a textile” after generating, I want listing copy marked stale, so that a composition block cannot stay on a non-textile (or vanish from a textile) unnoticed.
28. As a seller with stale listing copy, I want a banner telling me to regenerate, so that the mismatch is obvious on Product Details.
29. As a seller with stale listing copy, I want the existing title and description still on screen, so that nothing is wiped.
30. As a seller with stale listing copy, I want Generate still enabled, so that stale is not a second gate.
31. As a seller with stale listing copy, I want to still push to Shopify, so that a facts tweak cannot trap a live product.
32. As a seller pushing products that include stale listing copy, I want a warning before the push, so that I can choose to regenerate or proceed.
33. As a seller whose selected products have no stale listing copy, I want Channel push to behave as it does today, so that the warning only appears when it is true.
34. As a seller who saves Shop GPSR identity, I want listing copy marked stale on products that use the shop default and already have listing copy, so that a catalogue-wide legal fact change is not silent.
35. As a seller who saves Shop GPSR identity, I want products that override GPSR identity left unstaled by that save, so that an override is not flagged for a shop-level edit.
36. As a seller who saves Shop GPSR identity, I want products that skipped GPSR identity left unstaled by that save, so that an explicit skip is not treated as using the shop default.
37. As a seller who saves Shop GPSR identity, I want products with no listing copy left unstaled, so that empty products do not grow a stale banner.
38. As a seller with several photos on one product, I want stale listing copy to be a product fact, so that one banner covers the group.
39. As a seller loading a product that already had mismatched copy before this change, I want it not marked stale until I next change facts or Shop GPSR identity, so that the catalogue is not suddenly all banners.
40. As a seller, I want listing copy to mean title, description, tags, SEO, or AEO already present when deciding “copy exists” for staling, so that a grandfathered title counts.
41. As a seller, I want the workspace not to re-apply fact blocks when I accept generated description, so that the browser cannot stamp different HTML than the server.
42. As a seller, I want pick labels for fibre names and care families to still appear in the form, so that Confirm remains fillable without the form becoming the rulebook.
43. As a seller, I want unsaved fibre rows and GPSR drafts to stay in the page until Confirm, so that typing is not a round trip.
44. As a future agent, I want Product facts rules in one server module, so that a later GPSR-on-generate change cannot leave a TypeScript twin behind.
45. As a future agent, I want HTTP to copy module outcomes onto the payload rather than encode rules, so that adapters stay thin.
46. As a future agent, I want tests to hit the Product facts module interface, so that stale, blocks, and the generate gate cannot drift apart.
47. As a future agent, I want no client tests of the generate gate or block assembly, so that a deleted twin cannot be reintroduced as “coverage.”
48. As a seller of a non-textile with confirmed facts, I still want Generate available, so that this deepening does not reopen the textile-only gate.
49. As a seller, I want existing listing copy left in place when facts change, so that stale is a mark, not a rewrite.
50. As a seller, I want publish to remain unblocked when listing copy is stale, so that SnapSync is not a compliance checker on Channel push.
51. As a seller who regenerates description after a Shop GPSR identity change, I want the new description to carry the updated GPSR block, so that regenerate actually matches the shop default.
52. As a seller who regenerates description after a fibre change, I want the composition block to show the new percentages, so that Accept persist is how facts re-enter listing copy.
53. As a seller confirming facts, I want suggested facts to still merge as they do today, so that this deepening does not rewrite confirm’s existing errors.
54. As a seller, I want Classification from the photo unchanged, so that upload and unlock still suggest visible attributes without writing listing copy.
55. As an unpaid seller, I want this deepening not to invent a title teaser, so that the unpaid path stays gated as it is.
56. As a seller, I want Bulk SEO, Import, Inventory, and New listing jobs out of this change, so that only the Product facts / listing copy seam moves.
57. As a seller pushing while some selected products are unpaid, I want the existing unpaid check unchanged, so that stale warning is extra information, not a replacement for payment.
58. As a seller, I want the generate stream to keep using server-side listing copy constraints, so that the model is still told not to invent skipped legal facts.

## Implementation Decisions

- One Product facts module is the seam. Confirm, generate-gate, description-block assembly, and stale listing copy are decided there. HTTP and the workspace are adapters: they copy outcomes, they do not re-encode rules. ADR 0007.
- Listing copy generation (stream + per-field regenerate) consumes the gate and the blocks. It does not rebuild description blocks on Accept. Ordinary product update does not assemble blocks and does not clear stale.
- Form chrome may keep pick labels (fibre names, care families) and unsaved draft fields. Chrome may disable Confirm when GPSR or care picks are still empty. Chrome must not decide “may generate.”
- Stale listing copy is stored with the product’s facts record so grouped photos share one mark. It is not computed by diffing description HTML.
- Stale is **set** when confirmed facts actually change and listing copy already exists. Same-values confirm is a no-op. First confirm with no listing copy is not stale. A grandfathered title (or any other listing copy field already present) plus first confirm **is** stale. Listing copy “exists” if title, description, tags, SEO, or AEO is already present.
- Stale is **set** when Shop GPSR identity is saved, for products whose GPSR choice is shop default and that already have listing copy. Override and explicit skip are not staled by that save. Products with no listing copy are not staled.
- Stale is **cleared** only when generated **description** is persisted on a dedicated Accept path. That path applies current description blocks, writes listing copy, and clears stale. Title-only, tags-only, or AEO-only Accept does not clear stale. The generate stream does not persist and does not clear stale. Ordinary product save never clears stale.
- Stale is not a generate gate and not a publish gate. Product Details shows a banner. Generate stays enabled. Channel push is allowed with a warning when any selected product is stale.
- HTTP: product payloads expose `mayGenerateListingCopy` and `listingCopyStale`. Product detail also exposes `descriptionBlocks`. The catalogue list includes `listingCopyStale` so Channel push can warn. Confirm 400 and generate 409 remain the backstops. No preview/validate endpoint.
- Dedicated Accept persist path for generated listing copy fields, distinct from ordinary product update. Ordinary update must not grow a “from generate” flag.
- Forward only: do not backfill stale on read for rows that already mismatch. Grandfathering from ADR 0002 stands until the next facts or Shop GPSR identity change.
- Do not persist listing copy when the generate stream completes. Do not split Product Details into a new facts editor in this spec. Do not move New listing upload, unlock, or vision prompts.

## Testing Decisions

- Test external behaviour through the Product facts module interface only — the same seam confirm, generate-gate, and description blocks already use. Assert outcomes (may generate, stale, description HTML), not how the mark is stored.
- A good test: confirm with listing copy present and facts changed → stale. Same-values confirm → not stale. Empty first confirm → not stale. Grandfathered title + first confirm → stale. Accept generated description → blocks applied and stale cleared. Title-only Accept → stale remains. Shop GPSR identity change → only shop-default products with listing copy go stale. Existing gate, GPSR, care, and vision-strip tests still pass.
- A bad test: asserting on payload field names in isolation, React banner markup, or a reimplemented TypeScript gate.
- The module under test is Product facts. HTTP adapters are not a second test seam for these rules. No client tests of the generate gate or description-block assembly.
- Prior art: the existing Product facts test module (vision listing copy is not persistable, confirm opens or refuses the generate gate, description blocks and explicit skip, GPSR shop default / override / skip, care families). Extend that file; do not start a parallel suite.

## Out of Scope

- Extracting New listing upload out of the HTTP router.
- Extracting unlock Classification out of billing.
- Changing vision prompts so Classification does not invent listing copy (the stripper stays).
- Splitting Product Details into a dedicated facts editor.
- Persisting listing copy when the generate stream completes.
- A generated TypeScript twin or a shared package of the rules.
- Shopify metafields / Disclosures (ADR 0003).
- Care pictograms (ADR 0004).
- Catalogue cache shape (ADR 0006).
- Import, Bulk SEO, Inventory backends.
- Blocking Channel push on stale listing copy (would reopen ADR 0002).
- Backfilling stale on existing mismatched rows.

## Further Notes

Domain language is `CONTEXT.md`. Do not call listing copy “AI content.” Do not call product facts “metadata.” Stale listing copy is information, not a gate.

ADR 0002 still holds: listing copy waits on confirmed facts; existing copy is grandfathered; publish is not blocked. This spec implements the stale half that never landed, and removes the client twin.

ADR 0007: Product facts rules live only on the server.

Next: `/to-tickets` to split this spec into tracer-bullet tickets with blocking edges.
