**Status:** ready-for-agent

# Product facts before listing copy

## Problem Statement

When I upload product photos, SnapSync writes a title and description from the picture. That copy invents fibre, materials, and safety claims I never confirmed. I cannot put EU-ready composition, care, or GPSR identity on the listing first, so Generate and publish ship marketing text that looks like a spec. I need to give real product facts — and confirm them — before any listing copy is written.

## Solution

I confirm product facts on Product Details before Generate will run. Upload still takes the photos and may classify the product and suggest whether it is a textile and likely fibre names (percentages blank). It does not write listing copy.

For a textile product, I must enter fibre composition (EU names, percentages summing to 100). Care instructions and GPSR identity are filled or explicitly skipped. Skipped blocks are left out of the description, never invented. GPSR identity defaults from my connected Shopify shop and can be overridden on the product.

Once facts are confirmed, Generate writes listing copy that includes those facts as English blocks in the description (composition, then care if present, then GPSR if present). Existing listing copy is left alone. If I edit facts later, copy is marked stale and I regenerate; publish is not blocked.

## User Stories

1. As a seller, I want listing copy not to generate until I have confirmed product facts, so that titles and descriptions cannot invent fibre or safety claims.
2. As a seller, I want to upload photos without waiting on a facts form, so that getting pictures into the library stays fast.
3. As a seller, I want upload to still classify category and product type from the photo, so that I am not starting from a blank product.
4. As a seller, I want upload to still suggest price and color/size variants, so that commerce fields are not blocked on legal facts.
5. As a seller, I want upload not to write a title, description, tags, SEO, or AEO, so that listing copy cannot appear before facts are confirmed.
6. As an unpaid seller, I want not to see a generated title as a teaser, so that the product does not teach me that photos invent copy.
7. As a seller looking at the library, I want a product without listing copy to show the original filename (or an untitled label), so that I can still find it.
8. As a seller, I want vision to suggest whether the product is a textile, so that I am not guessing the pack myself.
9. As a seller, I want vision to suggest likely fibre names with blank percentages, so that I only type the legal numbers.
10. As a seller, I want vision not to suggest fibre percentages, so that a legal fact is never invented from a photo.
11. As a seller, I want color to stay a variant, so that I do not confirm color twice as a product fact.
12. As a seller, I want to confirm or reject “this is a textile” on Product Details, so that a mug in a fabric shot is not trapped in composition-required.
13. As a seller of a textile product, I want Generate disabled until fibre composition is confirmed, so that I cannot ship a textile listing with no composition line.
14. As a seller of a textile product, I want to enter fibre composition as rows of EU fibre name plus percentage, so that the listing can state a real composition.
15. As a seller, I want fibre percentages to be required to sum to 100, so that I cannot confirm 80% cotton alone.
16. As a seller, I want a dropdown of common EU fibre names plus Other, so that I am not typing unofficial blend names as the only option.
17. As a seller who picks Other, I want to type a fibre name, so that uncommon fibres are still representable.
18. As a seller of a textile product, I want to fill care instructions or explicitly skip them, so that an empty care section is not mistaken for “no care needed.”
19. As a seller filling care, I want one pick each for washing, bleaching, drying, ironing, and professional textile care, so that care is structured rather than a paragraph.
20. As a seller, I want those care picks written as English text in the description, so that I do not depend on trademarked care pictograms.
21. As a seller of a textile product, I want to fill GPSR identity or explicitly skip it, so that Generate is not blocked when I do not yet have an EU responsible person.
22. As a seller who skips care, I want the description not to mention care, so that listing copy does not invent a wash code.
23. As a seller who skips GPSR identity, I want the description not to mention manufacturer or EU responsible person, so that those claims are not invented.
24. As a seller of a non-textile product, I want confirming “not a textile” to open the Generate gate, so that a mug is not blocked on fibre composition.
25. As a seller of a non-textile product, I want composition and care hidden, so that I am not filling a textile pack for the wrong product.
26. As a seller of a non-textile product, I want shop GPSR identity to still apply unless I skip or override it, so that a mug can still show who made it.
27. As a seller, I want GPSR identity to default from my connected Shopify shop, so that I do not retype manufacturer and EU responsible person on every product.
28. As a seller, I want to override GPSR identity on one product, so that a line made by someone else can name a different manufacturer.
29. As a seller with no Shopify connection, I want to enter GPSR identity on the product or skip it, so that facts still work before I connect a shop.
30. As a seller, I want GPSR identity to include manufacturer name, postal address, and email, so that the listing has the contact GPSR expects.
31. As a seller, I want a “manufacturer is in the EU” flag, so that I am not asked for an EU responsible person when the maker is already in the EU.
32. As a seller whose manufacturer is not in the EU, I want EU responsible person name, postal address, and email, so that the listing names the EU contact.
33. As a seller, I want to edit shop GPSR identity once and have new products pick it up, so that catalog-wide identity stays in one place.
34. As a seller, I want Product Details to show suggested facts ready to confirm, so that I am not starting the form from scratch after upload.
35. As a seller, I want Generate to stay off until facts are confirmed, so that I cannot click through the gate.
36. As a seller, I want per-field regenerate to stay off until facts are confirmed, so that a single field cannot invent copy either.
37. As a seller with confirmed facts, I want Generate to use those facts plus category, tone, and audience, so that listing copy matches both voice and spec.
38. As a seller, I want generated description to include a composition block when the product is a textile with confirmed composition, so that the Shopify listing shows fibre % before purchase.
39. As a seller, I want that composition block in English, so that v1 has one listing language.
40. As a seller, I want care and GPSR blocks after composition in the description when they were not skipped, so that required information is visible in a stable order.
41. As a seller, I want tags to wait with listing copy, so that “cotton” cannot appear as a tag before composition is confirmed.
42. As a seller, I want generated tags and AEO answers to use confirmed fibre names rather than guessed materials, so that SEO does not contradict the composition line.
43. As a seller who accepts generated copy, I want the fact blocks to remain in the description I save, so that publish sends them to Shopify.
44. As a seller, I want publish to Shopify to keep sending the description as it does today, so that fact blocks ride along without metafields.
45. As a seller with listing copy from before this change, I want that copy left as it is, so that live text is not rewritten by surprise.
46. As a seller with grandfathered copy and unconfirmed facts, I want Generate still gated, so that the next rewrite cannot invent facts.
47. As a seller, I want to still be able to publish grandfathered copy, so that SnapSync is not a compliance checker that blocks the shop.
48. As a seller who edits confirmed facts after generating, I want listing copy marked stale, so that I know the title and description no longer match the facts.
49. As a seller with stale listing copy, I want a banner telling me to regenerate, so that the fix is obvious.
50. As a seller with stale listing copy, I want the old title and description still on screen, so that nothing is wiped.
51. As a seller with stale listing copy, I want to still publish, so that a facts tweak cannot trap a live product.
52. As a seller who regenerates after a facts edit, I want stale cleared and new copy to include the updated blocks, so that facts and listing copy match again.
53. As a seller of a product with several photos, I want one facts record for the product, so that I do not confirm composition on every photo.
54. As a seller who groups photos after confirming facts, I want those facts to stay on the product, so that grouping does not drop the spec.
55. As a paid seller unlocking full analysis, I want unlock not to write listing copy, so that paying does not bypass the gate.
56. As a seller, I want an empty care or GPSR field to be rejected until I fill it or explicitly skip, so that a blank is not treated as a skip.
57. As a seller confirming a textile with 0% rows or names and no percentages, I want confirmation to fail, so that incomplete composition cannot open the gate.
58. As a future agent, I want this behaviour concentrated in one product-facts module, so that upload, Generate, and description blocks cannot drift apart.

## Implementation Decisions

- One product-facts module is the seam. Upload persistence, Generate, per-field regenerate, and description-block assembly call it. Tests call the same interface. Vision and HTTP are not that seam.
- The module’s interface is: confirm facts (or return why not); whether listing copy may be generated; effective GPSR identity (product override, else shop default, else none); English description blocks from confirmed facts; whether listing copy is stale; which vision fields may be persisted on upload (classification, price, variants, suggested facts — never listing copy).
- FastAPI is the backend for this work. Do not add a parallel Express implementation; Express is on the way out (ADR 0001).
- Product facts belong to the product, not to a photo. There is no separate product table today: persist facts with the product group the same way other listing fields already fan out across grouped photos (standalone photo = its own product).
- Shop GPSR identity lives on the Shopify connection (one default per connected shop). Product facts record either “use shop default”, an override, or an explicit skip.
- Suggested facts from vision: textile yes/no plus likely fibre names. Percentages stay blank. Color is not a product fact.
- Fibre names offered: cotton, wool, silk, flax (linen), viscose, cupro, modal, lyocell, polyester, polyamide, acrylic, elastane, polypropylene, plus Other with a typed name. Percentages are integers; rows must sum to 100 to confirm a textile product.
- Care, if not skipped: exactly one pick per family, stored as a code, rendered as English text. Families and v1 picks:
  - washing: do not wash, hand wash, 30°C, 40°C, 60°C, 95°C
  - bleaching: any bleach, non-chlorine bleach only, do not bleach
  - drying: tumble dry normal, tumble dry low, do not tumble dry, line dry
  - ironing: iron high, iron medium, iron low, do not iron
  - professional textile care: dry clean, do not dry clean, professional wet clean
- GPSR identity fields: manufacturer name, postal address, email; manufacturer-in-EU flag; if not in the EU, EU responsible person name, postal address, email. Same shape at shop default and product override.
- Confirming a textile product requires fibre composition. Care and GPSR identity require either a complete value or an explicit skip. An empty field is not a skip.
- Confirming a non-textile product is confirming it is not a textile. That opens the gate. Composition and care are not shown. GPSR identity still uses shop default, override, or skip.
- Generate and regenerate-field refuse when the gate is closed (do not call the model). When open, prompts receive confirmed facts and must not assert skipped or absent blocks. Description output includes the module’s blocks in order: composition (textiles), care (if not skipped), GPSR (if not skipped). Language is English.
- Tags are listing copy. They are not written at upload. After Generate they may include confirmed fibre names, not suggested-only names.
- Shopify push is unchanged: it already sends description HTML. Fact blocks must already be in that description. No metafields or Disclosures in v1 (ADR 0003).
- Grandfather existing listing copy. Do not strip old invented claims. Do not block publish. Editing facts after a generation timestamp marks copy stale; UI is a banner plus regenerate; do not clear fields.
- Care pictograms are not rendered (ADR 0004). Unpaid title teaser is removed (ADR 0002).

## Testing Decisions

- Test external behaviour of the product-facts module, not prompt wording, OpenAI, or React layout.
- The module is the test surface. A good test puts facts (or vision output) in and asserts gate, persisted fields, description HTML, effective GPSR, or stale — without HTTP or a model.
- Cases that must exist: textile without composition cannot generate; composition not summing to 100 cannot confirm; empty care is not a skip; explicit skip omits that block; non-textile can generate without composition; shop GPSR used unless override or skip; upload vision with a title/tags is persisted without those listing-copy fields; suggested fibre names do not include percentages; facts edited after generation → stale; grandfathered copy with unconfirmed facts still cannot Generate.
- Do not add tests that snapshot GINETEX symbols or Shopify metafields.
- Prior art: pure function tests (upload mode routing) and FastAPI TestClient auth tests. Prefer the former for this module. A thin HTTP test that Generate refuses when the gate is closed is optional, not a second seam.
- Do not test Express.

## Out of Scope

- Category packs beyond textiles (cosmetics INCI, toys, electronics, food contact)
- Shopify metafields and Disclosures metaobjects
- GINETEX / ISO care pictograms
- Listing copy in languages other than English
- Validating Other fibre names against the full Annex I of Regulation 1007/2011
- A compliance checker that blocks publish or certifies that a physical product is lawful
- Appointing an EU responsible person as a service
- Changing Shopify OAuth, billing, or photo storage
- Restoring Etsy or Amazon
- Blocking or rewriting grandfathered listing copy
- A separate color product fact (color remains a variant)

## Further Notes

Glossary is `CONTEXT.md`. Hard decisions: ADR 0002 (gate + no title teaser), ADR 0003 (facts in the description), ADR 0004 (care as text). Next step is `/to-tickets` into tracer-bullet issues; do not implement from this spec in one pass.

The product-facts module is the only new seam. Vision still suggests; Generate still writes copy; neither is the place the rules live.
