**Status:** ready-for-agent

# Landing: AI listing copy first

## Problem Statement

A stranger opens the SnapSync landing and is told it is an e-commerce agent for textile and coffee listings. That frames the product as two verticals, not as AI listing copy from photos. The page also presents seven destination cards like a product dashboard. The seller wants a cool, confident marketing page that leads on AI listing copy, keeps facts-before-copy honest, and does not sell Textile product / Coffee product in the hero.

## Solution

Redo the public landing so the first viewport sells **photos → confirm facts → AI listing copy**, with Push to Shopify and Trendyol International named under the CTAs. Textile product and Coffee product appear only in one FAQ about confirmed facts. Keep forced dark + gold. Replace the seven job cards with How it works, then three workspace jobs (Products, Import & Inventory, Bulk SEO), then Credits pricing, then a short FAQ. Evolve the live merino demo without labelling Product kind. Update the landing-copy contract tests to match the new claims.

## User Stories

1. As a stranger on the landing, I want the brand SnapSync to read as the hero-level signal, so that the page does not feel generic after the nav is ignored.
2. As a stranger, I want an eyebrow that says the loop “Photos → facts → AI listing copy,” so that I know the product promise in one glance.
3. As a stranger, I want the H1 “AI listing copy from your product photos,” so that AI listing copy is the lead claim, not textile or coffee.
4. As a stranger, I want a subhead that states I confirm facts before AI writes listing copy, so that I do not think the photo invents product facts.
5. As a stranger, I want the primary CTA “Start free,” so that I can open sign-in without a card.
6. As a stranger, I want the secondary CTA “How it works,” so that I can jump to the steps without signing in.
7. As a stranger, I want the first viewport to name Push to Shopify and Trendyol International, so that I know the live Channels.
8. As a stranger, I want a live product-card demo (photo → confirming facts → AI listing copy typing → live on a Channel), so that I see the loop without a lifestyle collage.
9. As a stranger watching the demo, I want a concrete merino specimen with fibre composition, care instructions, and GPSR identity, so that facts feel real — without the chrome saying Textile product or Coffee product.
10. As a stranger, I want intentional motion (demo phases, scroll reveal, reduced-motion respect), so that the page feels crafted, not noisy.
11. As a stranger, I want How it works as four steps — Photos, Confirm facts, Listing copy, Push to a Channel — so that the path is clear.
12. As a stranger, I want step copy to say listing copy is written from confirmed facts, not invented from the photo, so that the honesty claim holds below the hero.
13. As a stranger, I want three mid-page jobs — Products, Import & Inventory, Bulk SEO — so that I see the workspace without seven cards.
14. As a stranger, I want Products described as the catalogue I live in after New listing, so that listing from photos is one job, not the whole product.
15. As a stranger, I want Import & Inventory described as parallel Channel jobs (fetch products; hold stock), so that I do not confuse them with Push or Accept.
16. As a stranger, I want Bulk SEO described as refreshing listing copy with search demand, one Credit per Accept, Accept does not Push, so that Credits and Push stay distinct.
17. As a stranger, I want a Pricing section with three free Credits then packs of 10 (£7), 50 (£30), and 100 (£55), so that money is clear.
18. As a stranger, I want pricing copy to say catalogue, facts, and typed listing copy stay free, so that I know what Credits meter.
19. As a stranger, I want pricing copy to say one Credit is spent when an Accept lands, so that I know what I pay for.
20. As a stranger, I want a short FAQ, so that common questions are answered without a second homepage.
21. As a stranger, I want one FAQ “What facts do I confirm?” that names Textile product vs Coffee product packs and that a Coffee product may Push only to Shopify, so that Product kind is honest once and not in the hero.
22. As a stranger, I want other FAQs to explain SnapSync, Credits, creating a product from photos, which Channels, cost, and editing before Push, without leading on textile/coffee.
23. As a stranger, I want document title and meta description to match the AI listing copy positioning and snapsyncai.co.uk, so that search/social match the page.
24. As a stranger, I want the wordmark to stay SnapSync (never SnapSync AI), so that the brand stays consistent.
25. As a stranger, I want the page not to say “workspace” in visible marketing copy, so that existing brand voice constraints stay.
26. As a stranger, I want the page not to name Wix or Vinted as live, so that only live Channels are sold.
27. As a stranger, I want no fake social proof, “watch demo,” “supercharge,” or old Plan/£0.70-per-write story, so that the Credits truth holds.
28. As a stranger on a phone, I want the first viewport and sections to remain readable and usable, so that the redo works on small screens.
29. As a seller who prefers reduced motion, I want the demo and reveals to degrade safely, so that animation is not required.
30. As a maintainer, I want the landing-copy visible-text contract tests updated to the new claims, so that an agent cannot silently reintroduce textile/coffee hero copy or old pricing language.
31. As a maintainer, I want `index.html` meta kept in sync with the landing-copy module’s document title and description story, so that static and runtime meta do not diverge into the old £0.70 story.
32. As a designer implementing the redo, I want to keep forced dark and gold primary tokens, so that the landing stays on the same theme as the signed-in app (ADR 0041).
33. As a stranger scrolling past the hero, I want a bottom CTA to start free / start with New listing intent after sign-in, so that the page still closes the loop.
34. As a stranger in the footer, I want a short blurb that names AI listing copy and that New listing from photos is one job, so that the footer matches the hero promise.
35. As a stranger, I want nav anchors that match the new sections (How it works, the mid jobs or “The agent” renamed appropriately, Pricing, FAQ), so that jump links still work.
36. As an implementer, I want marketing to say “AI listing copy” while in-product language stays listing copy / Accept / Credit, so that the glossary is not rewritten for a slogan.

## Implementation Decisions

- **Seam (single):** All marketing claims are owned by the landing-copy module. External behaviour is what `landingVisibleText()` (and exported constants used by the page) assert, plus the existing `index.html` meta assertions in the landing-copy test file. No new test seam; rewrite that contract for the new positioning.
- **Page composition:** Rebuild the landing page sections to: fixed nav → hero (brand, eyebrow, H1, subhead, CTAs, Channel line, live demo) → How it works (four steps) → three jobs (Products; Import & Inventory; Bulk SEO) → Credits pricing → FAQ → bottom CTA → footer. Drop the seven-card jobs grid.
- **Copy lock (hero):** Eyebrow `Photos → facts → AI listing copy`. H1 `AI listing copy from your product photos.` Subhead must state confirm facts then AI writes listing copy, and that Push is to Shopify or Trendyol International. CTAs remain `Start free` and `How it works`.
- **Product kind on marketing:** Do not put Textile product, Coffee product, “textile-first,” or “coffee on Shopify” in hero, jobs, steps titles, or meta lead. Exactly one FAQ answer names both Product kinds and the Coffee product Shopify-only Push rule.
- **Demo:** Keep the phased live card (photo → facts → write → publish). Specimen may stay merino with fibre composition, care instructions, and GPSR identity. Chrome must not label Product kind. Publish phase may show Shopify (demo already does); Channel strip under CTAs names both live Channels.
- **Theme:** Forced dark + gold primary remains. Redesign is composition, typography emphasis, motion, and section chrome — not a new accent system and not a light marketing theme.
- **Credits:** Pricing section states three free Credits for life on the shop, then packs 10 (£7), 50 (£30), 100 (£55); one Credit per Accept; catalogue, facts, and typed listing copy free. No Plan, unlock, £19/£190/£4, or £0.70-each language.
- **Forbidden claims (keep):** Wix, Vinted as live; image editor; ceramic/vase props; fake stats; watch demo; push to all stores; listings everywhere; SnapSync AI; listing generator; workspace (visible copy); not a textile.
- **JSON-LD / SoftwareApplication:** Refresh description and offers to match Credits packs and AI listing copy positioning; do not claim unshipped Channels.
- **Glossary:** Do not change CONTEXT.md Product kind definitions. Marketing “AI listing copy” is a public phrase wrapping listing copy generated for Accept; in-app strings stay glossary terms.
- **ADR respect:** Live Channels remain Shopify and Trendyol International. Facts before listing copy remains. Theme sharing with workspace remains.

## Testing Decisions

- Good tests assert **external marketing behaviour**: visible claim strings, CTA labels, step/job titles, required vs forbidden phrases, Credits pack story, brand wordmark, and HTML meta — not React structure, class names, or animation timers.
- **Module under test:** the landing-copy module via `landingVisibleText()` and exported constants; `index.html` for static title/domain constraints.
- **Prior art:** existing `tests/landing-copy.test.ts` — replace textile/coffee hero assertions with AI listing copy + facts-before-copy + Channels; replace seven JOBS titles with the three mid-page jobs; keep CTA, Credits, forbidden-phrase, and SnapSync-not-SnapSync-AI tests, updated where claims changed.
- Hero must match AI listing copy positioning; must not require textile/coffee in the H1; must still require listing copy, Shopify, Trendyol International, and facts language somewhere appropriate (hero subhead / steps / the one FAQ).
- Textile and coffee must still appear somewhere in visible text (the Product kind FAQ) so the honesty claim stays testable, but must not appear in H1/eyebrow.

## Out of Scope

- Changing Product kind, listing copy generation, Accept, Credit spend, or Channel Push behaviour in the app.
- Rewriting CONTEXT.md or adding a new ADR unless implementation discovers a hard theme/copy conflict that cannot stay a marketing-only decision.
- Light theme, new primary accent, or separating marketing theme tokens from the workspace.
- Adding Wix/Vinted as connectable Channels on the landing.
- New social proof, testimonials, or blog content.
- Redesigning the signed-in workspace destinations.
- Replacing the merino demo with real photography assets (optional later; not required by this spec).
- Clerk/auth flow changes beyond existing Start free / Sign in wiring.

## Further Notes

- Grilled decisions locked with the product owner: hero = photos → AI listing copy; audience = Shopify / Trendyol International sellers; kinds only in one FAQ; phrase = AI listing copy; live demo; keep dark+gold; medium page shape; facts in hero subhead; H1 as specified; merino demo without kind labels; real Credits pricing; both Channels in first viewport; CTAs unchanged; three jobs as Products / Import & Inventory / Bulk SEO.
- Stale scratch (`plan-allowance` landing/unlock) and any `index.html` meta still mentioning £0.70 per write must not guide this work; Credits ADR and this spec win.
- Implementer should treat “super cool” as composition and motion within the existing theme, not a second design system.
