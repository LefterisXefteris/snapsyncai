# Phase 5: Validation Architecture

**Phase:** 05-drag-drop-ui
**Status:** Manual verification only

## Test Infrastructure

This project has no automated test framework (no Jest, Vitest, Playwright, etc. in package.json).

All phase verification is manual. The sole automated signal available is TypeScript type checking:

```bash
npx tsc --noEmit
```

## Validation Strategy

| Requirement | Test Type | Signal |
|-------------|-----------|--------|
| UX-01: Staged images persist (IndexedDB) | Manual | Open app → drop images → refresh → verify restore |
| UX-02: 24h expiry | Manual | Set timestamp to expired in DevTools → reload → verify cleared |
| UX-03: Full card drop target | Manual | Drag image → hover over card → verify highlight + successful drop |
| UX-04: Multi-select drag | Manual | Click multiple thumbnails → drag batch → verify all move |
| UX-05: Hero = first image | Manual | Reorder within group → verify first slot shown as primary |
| UX-06: Per-group +/- control | Manual | Click +/- on group card → verify maxImages changes |

## Automated Gates

- `npx tsc --noEmit` — must pass (no type errors introduced)
- `npm run build` — must complete successfully

## Notes

- Object URL revocation on unmount must not conflict with IDB blob reads (verified in Plan 05-02)
- All 6 ROADMAP.md success criteria are verified manually in Plan 05-04
