Status: ready-for-agent

# 01 — Predictable sidebar

Spec: `.scratch/ui-glass-sidebar/spec.md` (user stories 1–7).

## What

- Desktop with no saved choice starts open with labels.
- Between the mobile breakpoint and about 1024px, no saved choice starts collapsed.
- A saved open or collapsed choice wins over both.
- Hovering the collapsed sidebar no longer opens it over the page; collapsed icons show their label as a tooltip.
- Toggle, rail, Cmd/Ctrl+B, cookie persistence, and the phone Sheet stay.
- Nav items unchanged.

## Done when

- Tests pass for the start-state decision.
- Browser check on desktop and narrow widths: starts as described, hover does not expand, collapsed icons show tooltips, choice survives reload.

## Comments

- 2026-09-28: Implemented. `sidebarStartsOpen` in `client/src/lib/sidebar-start.ts` (tests in `tests/sidebar-start.test.ts`); hover overlay removed from `ui/sidebar.tsx`; `workspace-coat` test no longer pins start-collapsed. `npm test` 109/109, `tsc` clean. Browser: 946px no cookie → collapsed; hover stays 48px; Import tooltip shows; 1440px no cookie → open; collapse + reload → stays collapsed. Not committed.
