# 01 — The landing leads on AI listing copy, facts first

**Parent:** `.scratch/landing-ai-listing-copy/spec.md`

**What to build:** Rebuild the public landing as nav → hero (brand, eyebrow, H1, subhead, CTAs, Channel line, live merino demo) → How it works (four steps) → three jobs → Credits pricing → FAQ → bottom CTA → footer. All claims live in the landing-copy module; `index.html` meta and JSON-LD match. Covers user stories 1–32 and 34–36.

**Blocked by:** None — can start immediately.

**Status:** done

- [x] Hero eyebrow, H1, subhead, and CTAs match the spec's copy lock; both live Channels named in the first viewport
- [x] Product kind appears only in the "What facts do I confirm?" FAQ, with the Coffee product Shopify-only Push rule
- [x] Steps are Photos, Confirm facts, Listing copy, Push to a Channel; jobs are Products, Import & Inventory, Bulk SEO
- [x] Pricing is three free Credits then 10 (£7), 50 (£30), 100 (£55); one Credit per Accept; no Plan or £0.70 story
- [x] Live demo shows photo → facts → listing copy → live without labelling Product kind; reduced motion shows the final state
- [x] `index.html` title and description equal the landing-copy constants; JSON-LD offers are the Credit packs
- [x] `tests/landing-copy.test.ts` rewritten to the new claims

## Comments

Shipped to the branch in `559bc9f`. Story 33 (bottom CTA lands on New listing after sign-in) is ticket 02.
