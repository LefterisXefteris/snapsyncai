**Status:** ready-for-agent

# Glass chrome and a predictable sidebar

## Problem Statement

The workspace sidebar starts as an icon strip, so I cannot see what the items are. When I move the mouse over it, the full sidebar pops out on top of the page I am working on. Everything is flat near-black, so the workspace feels heavy and the chrome does not separate from my products.

## Solution

The sidebar and the chrome around the page — page headers, dialogs, dropdowns, popovers, menus — become frosted glass over a soft backdrop. Product cards, forms, and the light table stay solid so photos, prices, and facts read cleanly.

On desktop the sidebar starts open with labels. A toggle collapses it to an icon strip; collapsed icons show their label as a tooltip. Hovering no longer opens the sidebar over the page. The pinned or collapsed choice is still remembered. On narrow desktop widths it starts collapsed. Phones keep the slide-out sheet.

The nav items stay the same seven. Conversation is not added until its page exists.

## User Stories

1. As a seller, I want the sidebar open with labels when I arrive on desktop, so that I can see where everything is.
2. As a seller, I want to collapse the sidebar to an icon strip, so that I have more room for the catalogue.
3. As a seller with the sidebar collapsed, I want each icon to show its label on hover, so that I know what it opens without the sidebar covering my work.
4. As a seller, I want hovering the collapsed sidebar not to open it over the page, so that what I am working on is never hidden.
5. As a seller, I want my pinned or collapsed choice remembered, so that the workspace opens the way I left it.
6. As a seller on a narrow laptop window, I want the sidebar to start collapsed, so that the page keeps its width, and I can still open it.
7. As a seller on a phone, I want the slide-out sheet as today, so that the sidebar does not take the screen.
8. As a seller, I want the sidebar, page headers, dialogs, and menus to look like frosted glass over a soft backdrop, so that the chrome separates from my products.
9. As a seller, I want product cards, forms, and the light table to stay solid, so that photos, prices, and facts stay easy to read.
10. As a seller who has turned on reduced transparency, I want solid surfaces instead of glass, so that the workspace respects my setting.
11. As a seller, I want text on glass to stay readable, so that the look never costs legibility.
12. As a seller, I want the backdrop neutral and kept to the page edges, so that my product photos keep their true colours.

## Implementation Decisions

- Theme stays forced dark. Backdrop: the current near-black background with a faint neutral grey glow at the page edges only, never behind product photos, fixed so it does not scroll. No gold and no colour: the aurora was removed in `3ee214a` because it competed with the product photo, and that reason still holds.
- Glass surfaces: sidebar and page headers use a dark fill at about 60% opacity with a strong backdrop blur and a faint border of about 10% white. Dialogs, dropdowns, popovers, and menus use about 80% opacity so their text stays readable. Values live as theme tokens / utility classes in `client/src/index.css`, not inline per component.
- Solid surfaces: `glass-card` (product cards), `glass-panel` (Settings panels), forms, and the light table stay solid as today. Their class names are not repurposed.
- `prefers-reduced-transparency: reduce` swaps every glass surface for its solid equivalent.
- Text on glass meets WCAG AA contrast against the darkest and lightest points of the backdrop.
- Sidebar on desktop: `defaultOpen` becomes open. The hover-to-overlay behaviour in `client/src/components/ui/sidebar.tsx` is removed; collapsed icons rely on the existing menu-button tooltips. Cookie persistence, the toggle, the rail, and Cmd/Ctrl+B stay.
- Between the mobile breakpoint and about 1024px the sidebar starts collapsed unless the seller's saved choice says otherwise. Below the mobile breakpoint the Sheet stays.
- Nav items, their order, and `client/src/lib/workspace-nav.ts` do not change. No Conversation item.
- No new global desktop top bar. Page headers that already exist take the glass style.

## Testing Decisions

- A good test asserts what the seller can observe. It does not assert class names or pixel values.
- The one unit seam is the start-state decision: saved choice and viewport width in, open or collapsed out. Prior art: `tests/workspace-nav.test.ts` (node:test, no DOM). Cases that must exist: wide desktop with no saved choice starts open; narrow desktop with no saved choice starts collapsed; a saved choice wins at either width. The existing nav-order test keeps the seven items pinned.
- No DOM test tooling is added. Hover not expanding, collapsed tooltips, and the glass are checked in the browser: screenshots of Products, a product page, a dialog, and Settings, with the sidebar open and collapsed, plus one with reduced transparency on, before the change is called done.

## Out of Scope

- A context-aware sidebar: the connected shop's name, jobs in progress, or items that change with Shopify connection. This is a separate issue, grilled on its own after this ships, because it depends on the Conversation rules for a seller with no shop.
- Adding Conversation to the nav.
- A light theme or theme toggle.
- Glass on product cards, forms, or the light table.
- The Plan badge footer shift.

## Further Notes

- `client/src/index.css` currently labels `glass-panel` and `glass-card` as "Flat surfaces". This change keeps them flat and adds glass only to chrome.
