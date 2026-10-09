**Status:** ready-for-agent

# Facts ready on the catalogue card

## Problem Statement

I look at a product card in the catalogue and I cannot tell whether the facts pack is complete. Fibre composition, care instructions, and GPSR identity are already confirmed, skipped, or missing, but the card only talks about listing copy and Shopify. I want that card to say, in one calm or amber sentence, whether the pack is ready, still unconfirmed, or pointing at a Shop GPSR identity that is no longer there.

## Solution

The catalogue card shows one facts sentence under the title. The sentence is a reading of confirmed facts and Shop GPSR identity. It says **Facts ready**, **Facts unconfirmed**, or names **Unfilled GPSR identity**. An explicit skip stays named. A product confirmed as not a textile says so. The sentence never says the product complies with the law.

The top-right badge stays the listing-copy and Shopify status. Push, Go live, Publish, and Generate stay as they are. Stale listing copy stays on the product page. Shoppers do not see the sentence.

## User Stories

1. As a seller looking at the catalogue, I want each product card to show one facts sentence under the title, so that I can see the facts pack without opening the product.
2. As a seller, I want that sentence to use the words Facts ready, Facts unconfirmed, Not a textile, Care skipped, GPSR skipped, and GPSR identity, so that the card speaks the same language as the rest of the workspace.
3. As a seller, I want the sentence never to say the product complies, is lawful, or is EU compliant, so that the card is a reading of facts and not a legal verdict.
4. As a seller whose product has no confirmed facts, I want the sentence to be Facts unconfirmed, so that a missing pack is one state.
5. As a seller whose photo only suggested a textile, or suggested that it is not a textile, I want the sentence to stay Facts unconfirmed until I confirm, so that a suggestion is not a confirmed fact.
6. As a seller, I want Facts unconfirmed to name no legal fact, so that the card does not pretend confirm saved fibre, care, or GPSR on their own.
7. As a seller of a textile with fibre composition summing to 100, care instructions filled, and GPSR identity filled, I want the sentence to be Facts ready, so that a complete pack is obvious.
8. As a seller of a textile with care instructions explicitly skipped and GPSR identity filled, I want the sentence to be Facts ready · Care skipped, so that a skip is not mistaken for a filled care instruction.
9. As a seller of a textile with care instructions filled and GPSR identity explicitly skipped, I want the sentence to be Facts ready · GPSR skipped, so that a skip is not mistaken for a filled GPSR identity.
10. As a seller of a textile with both care instructions and GPSR identity explicitly skipped, I want the sentence to be Facts ready · Care skipped · GPSR skipped, so that each skip stays visible, care first.
11. As a seller, I want a filled care instruction to add no words, so that the sentence stays short when the fact is present.
12. As a seller, I want a filled GPSR identity to add no words, whether it is on the product or taken from Shop GPSR identity, so that the source of a filled identity stays on the product page.
13. As a seller who confirmed a product is not a textile, with GPSR identity filled, I want the sentence to be Not a textile · Facts ready, so that home textiles and apparel are not the only products with a mark, and a mug is not shown as a textile.
14. As a seller who confirmed a product is not a textile and explicitly skipped GPSR identity, I want the sentence to be Not a textile · Facts ready · GPSR skipped, so that the skip stays named.
15. As a seller of a product confirmed as not a textile, I want the sentence never to mention care instructions, so that a fact the fibre pack does not ask for is not invented.
16. As a seller whose confirmed facts use Shop GPSR identity, and that identity is no longer a GPSR identity, I want the sentence to name GPSR identity and not to say Facts ready, so that a default pointing at nothing is Unfilled GPSR identity.
17. As a seller in that hole who also explicitly skipped care instructions on a textile, I want the sentence to be GPSR identity · Care skipped, so that the skip stays visible beside the hole.
18. As a seller who confirmed a product is not a textile and whose Shop GPSR identity is no longer a GPSR identity, I want the sentence to be Not a textile · GPSR identity, so that both marks stay.
19. As a seller who disconnects Shopify, I want products that used Shop GPSR identity to show Unfilled GPSR identity, so that deleting the connection is the same hole as clearing the identity.
20. As a seller whose Shop GPSR identity is only partly filled, I want that to count as Unfilled GPSR identity, so that a name without the rest of a GPSR identity is not treated as filled.
21. As a seller who explicitly skipped GPSR identity, I want a missing Shop GPSR identity not to turn the sentence into GPSR identity, so that a skip is not the same as an unfilled default.
22. As a seller who overrode GPSR identity with a complete identity, I want a missing Shop GPSR identity not to change Facts ready, so that an override does not depend on the shop default.
23. As a seller, I want Facts ready, including any named skip and a Not a textile prefix, to be one calm line, so that a skip does not look like a warning.
24. As a seller, I want Facts unconfirmed and Unfilled GPSR identity to use the same amber as the confirm-facts line, so that an open pack looks different from a ready one.
25. As a seller, I want nothing in the facts sentence to be red, so that the mark does not look like a failed push.
26. As a seller, I want the facts sentence under the title, so that a long skip list fits.
27. As a seller, I want the top-right badge to keep saying No copy, Synced, Pending, or Failed, so that listing copy and Shopify stay their own status.
28. As a seller whose product is Facts unconfirmed and has no listing copy, I want the existing line “Confirm facts, then listing copy” to stay under the facts sentence, so that the next step is still written out.
29. As a seller whose product is Facts ready and has no listing copy, I want that confirm-facts line to go away and the No copy badge to remain, so that the card does not tell me to confirm facts I already confirmed.
30. As a seller whose product has Unfilled GPSR identity and no listing copy, I want that confirm-facts line to go away, so that the card does not pretend nothing was confirmed.
31. As a seller whose product is Facts unconfirmed and already has listing copy, I want the facts sentence without the confirm-facts line, so that grandfathered copy is not told to confirm facts as if copy were missing.
32. As a seller, I want the facts sentence hidden while the card says Thinking, so that it does not sit on the skeleton.
33. As a seller with several photos of one product, I want one facts sentence on that product’s card, so that the pack belongs to the product.
34. As a seller, I want stale listing copy to stay off this sentence, so that a fibre change after generation is still the product page’s concern.
35. As a seller, I want Generate to stay available or refused exactly as it is today when the sentence changes, so that Unfilled GPSR identity is not a new generate gate.
36. As a seller, I want Push, Go live, and Publish to stay available exactly as they are today, so that the sentence does not block the shop.
37. As a seller pushing a product that is Facts unconfirmed, or that has Unfilled GPSR identity, I want push to proceed under the rules it already has, so that the card is information.
38. As a seller, I want the Website to stay without this sentence, so that shoppers do not see a workspace reading.
39. As a seller on the product page, Bulk SEO, Inventory, or New listing, I want those surfaces unchanged, so that the reading lives on the catalogue card.
40. As a seller, I want confirming facts, and looking at the sentence, not to spend a Plan use, so that a reading of facts is not a paid compliance check.
41. As a seller, I want the sentence to be decided with confirm, the generate gate, and description blocks, so that the card cannot disagree with the product page.
42. As a seller, I want the catalogue to receive that decision on the product it already loads, so that the card does not re-encode fibre, care, or GPSR rules.
43. As a future agent, I want tests to assert the sentence and its tone from facts and Shop GPSR identity, so that the eight readings cannot drift apart.

## Implementation Decisions

- One Product facts module is the seam. The facts sentence is another outcome beside the generate gate, description blocks, and stale listing copy. HTTP copies the outcome onto the product payload the catalogue already uses. The card prints it. ADR 0007. The card must not decide Facts ready, Facts unconfirmed, or Unfilled GPSR identity.
- The outcome is an ordered list of phrases and a tone. The card joins the phrases with “ · ”. Phrases, in order, are only: Not a textile, Facts ready, GPSR identity, Care skipped, GPSR skipped, and, alone, Facts unconfirmed.
- No confirmed facts: the only phrase is Facts unconfirmed, and the tone is amber. Suggested facts do not add Not a textile or a fibre name.
- Confirmed not a textile: the first phrase is Not a textile. Care instructions are absent, so Care skipped is never added.
- Facts ready: fibre composition sums to 100 when the product is a textile, and GPSR identity is filled or an explicit skip. A product confirmed as not a textile has no fibre pack and the same GPSR rule. Tone is calm. Filled care instructions and a filled GPSR identity add no phrase.
- Explicit skip stays a phrase: Care skipped, then GPSR skipped, including when the product is Facts ready and when GPSR identity is unfilled. A skip is not a warning and does not change a calm tone on its own.
- Unfilled GPSR identity: confirmed facts use Shop GPSR identity, and that identity is no longer a GPSR identity (absent, including after Shopify disconnect, or present but not complete). The phrase is GPSR identity. The tone is amber. The sentence does not say Facts ready and does not say Facts unconfirmed. Confirmed facts stay. An explicit skip of GPSR identity is not this hole. A complete product override is not this hole.
- GPSR identity filled on the product and Shop GPSR identity that is still a complete GPSR identity both count as filled.
- The confirm-facts line (“Confirm facts, then listing copy”) renders only when the sentence is Facts unconfirmed and listing copy is missing. Facts ready with no listing copy keeps the No copy badge and omits the line. Unfilled GPSR identity omits the line. The top-right badge is unchanged.
- The sentence is hidden while the card says Thinking.
- The sentence is computed, not stored. No schema change.
- Generate, Push, Go live, and Publish do not read the sentence. Stale listing copy is not an input to it.
- Product details may receive the outcome and does not show it. The Website, Bulk SEO, Inventory, and New listing do not show it.
- One card per product. The sentence is that product’s confirmed facts plus the shop’s GPSR identity.

## Testing Decisions

- Test external behaviour through the Product facts module interface only. Put confirmed facts, suggested facts, and Shop GPSR identity in. Assert the ordered phrases and the tone. Do not assert card markup, colour classes, or HTTP field names as a second seam.
- A good test covers: no confirmed facts, including a textile suggestion and a not-a-textile suggestion; textile with care and GPSR filled; care skipped; GPSR skipped; both skipped; not a textile with GPSR filled; not a textile with GPSR skipped; shop default while Shop GPSR identity is complete; shop default when it is absent; shop default when it is incomplete; shop default after the connection is gone; product override while Shop GPSR identity is absent; GPSR skipped while Shop GPSR identity is absent; textile care skipped plus unfilled shop default; not a textile plus unfilled shop default. Facts ready and named skips are calm. Facts unconfirmed and Unfilled GPSR identity are amber.
- A good test also asserts the generate gate is unchanged for those same inputs, so Unfilled GPSR identity does not become a new refusal.
- A bad test: React layout, the confirm-facts line’s CSS, Push behaviour, or a TypeScript copy of the rules.
- Prior art: the existing Product facts tests for confirm, the generate gate, description blocks, explicit skip, and Shop GPSR identity. Extend that module. Do not start a parallel suite.

## Out of Scope

- A legal verdict, a compliance certificate, or the words compliant, lawful, or EU compliant.
- Blocking Push, Go live, Publish, or Generate on the sentence.
- Splitting confirm so fibre, care, and GPSR can be saved one at a time.
- Showing the sentence on the product page, the Website, Bulk SEO, Inventory, or New listing.
- Putting stale listing copy on the catalogue card.
- Changing what No copy, Synced, Pending, and Failed mean.
- Member-state language of listing copy, sewn-in labels, or a lab test.
- Care pictograms. Shopify metafields.
- Spending a Plan use to show the sentence.
- A generated TypeScript twin of the rules.

## Further Notes

Domain language is `CONTEXT.md`: Facts ready, Facts unconfirmed, Unfilled GPSR identity, explicit skip, Shop GPSR identity, textile product. The card tells the seller about the pack. It does not certify the physical product.

ADR 0007: Product facts rules live only on the server.
