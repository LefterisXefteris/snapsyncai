Status: ready-for-agent

# 02 — Glass chrome over a soft backdrop

Spec: `.scratch/ui-glass-sidebar/spec.md` (user stories 8–12).

## What

- Fixed backdrop: near-black with a faint neutral grey glow at the page edges only, never behind product photos. No gold (see `3ee214a`).
- Sidebar and existing page headers: dark fill about 60% opacity, strong blur, border about 10% white.
- Dialogs, dropdowns, popovers, menus: about 80% opacity with blur.
- Product cards, Settings panels, forms, light table stay solid.
- `prefers-reduced-transparency: reduce` makes every glass surface solid.
- Text on glass meets WCAG AA.

## Done when

- Screenshots of Products, a product page, a dialog, and Settings with the sidebar open and collapsed, plus one with reduced transparency on, reviewed by the seller-owner.

## Comments

- 2026-09-28: Implemented. `glass-chrome` / `glass-overlay` and the corner-only neutral glow in `client/src/index.css`; applied to sidebar (desktop + mobile sheet), sticky headers on Products, Product page, Inventory, Import, Website, Bulk SEO; dialog, select, tooltip. `glass-card` / `glass-panel` untouched. Computed styles confirmed (60% / 80%, blur 24px, 10% white border); reduced transparency → solid, no blur. Contrast worst case (select over a white photo, no dim overlay) ≈ 8.6:1 for foreground text. `npm test` 109/109, `tsc` clean. Toast left as is (not in scope). Awaiting owner review of screenshots. Not committed.
