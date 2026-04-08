---
phase: 07-ai-auto-grouping-agent
plan: 06
subsystem: auto-grouping
tags: [ai-grouping, variants, apparel, evaluation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Apparel identity profiling: garment type, silhouette, and graphic-signature shaping"
    - "Candidate bucketing before AI grouping for existing uploaded images"
    - "Descriptor-aware deterministic merge keys with weak-key isolation"

key-files:
  modified:
    - server/auto-group-utils.ts
    - server/routes.ts
    - tests/auto-group-utils.test.ts
  carried-forward:
    - client/src/pages/Home.tsx
    - client/src/lib/workspace-variant-sort.ts

requirements-completed: [GROUP-01, GROUP-02, GROUP-04]
completed: 2026-04-08
---

# Phase 07 Plan 06 Summary

Strengthened the variant-family sorter for apparel-heavy batches by replacing the old color/view-only heuristic layer with richer apparel identity profiling and a more structured server-side grouping pipeline.

## What Changed

- Added apparel identity profiling in `server/auto-group-utils.ts` so grouping logic now distinguishes:
  - variant attributes such as color, size, and camera angle
  - family-breaking attributes such as different graphics, different silhouettes, and different base garments
- Added candidate bucket keys so existing uploaded images are grouped inside coarse garment-family buckets before the AI pass
- Updated the server grouping pipeline in `server/routes.ts` to:
  - create bucketed grouping passes
  - preserve singleton leftovers explicitly
  - attach descriptor summaries to groups
  - run descriptor-aware merge verification across candidate families
- Expanded regression coverage with apparel-specific failure cases:
  - same tee in different colors/angles
  - different graphic tees staying separate
  - different trouser cuts staying separate
  - garment-category bucket separation

## Verification

- Automated: `pnpm test` — 23 passing

## Notes

- Workspace honesty and highlight behavior from the recent UI fixes remain in place and continue to support this stronger grouping layer
- The next meaningful manual check is a real 100+ image apparel batch to compare the grouped family count against the expected product count
