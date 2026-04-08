---
phase: 07-ai-auto-grouping-agent
plan: 05
subsystem: auto-grouping
tags: [ai-grouping, variants, upload, ux]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Explicit auto-group mode contract: default vs variant-family"
    - "Deterministic family-key merge layered on top of model grouping"

key-files:
  created:
    - server/auto-group-utils.ts
  modified:
    - shared/routes.ts
    - server/routes.ts
    - client/src/hooks/use-auto-group.ts
    - client/src/components/upload-zone.tsx
    - tests/auto-group-utils.test.ts

requirements-completed: [GROUP-01, GROUP-02, GROUP-04]
completed: 2026-04-08
---

# Phase 07 Plan 05 Summary

Implemented a one-click workspace action for variant-family grouping so users can sort large variant-heavy uploads into product families without manual regrouping.

## What Changed

- Added an explicit auto-group request mode contract in the client hook: `default` vs `variant-family`
- Updated the server auto-group pipeline to honor mode-specific prompts and merge logic
- Strengthened variant-aware grouping so same-product colors, sizes, materials, prints, washes, and views are more likely to collapse into one product family
- Replaced the misleading "One product" shortcut in the chooser/toolbar with a clearer "Sort Variants Into Products" action
- Added regression coverage for mode wiring and variant-family prompt/merge behavior

## Files Created/Modified

- `shared/routes.ts`
- `server/auto-group-utils.ts`
- `server/routes.ts`
- `client/src/hooks/use-auto-group.ts`
- `client/src/components/upload-zone.tsx`
- `tests/auto-group-utils.test.ts`

## Verification

- Automated: `pnpm test` — 16 passing
- Manual follow-up still recommended with a real variant-heavy batch in the upload workspace

## Notes

- The default "Auto-group with AI" path remains available
- The new variant-family action is the stronger, outcome-oriented path for large apparel-style uploads
- When the model is genuinely unsure, the implementation still favors keeping products separate over destructive over-merging
