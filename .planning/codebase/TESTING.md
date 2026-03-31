# Testing Patterns

**Analysis Date:** 2026-03-31

## Test Framework

**Runner:** None configured — no `jest.config.*`, `vitest.config.*`, or testing framework found in `package.json` dependencies or devDependencies.

**Assertion Library:** None — no `@testing-library/*`, `jest`, `vitest`, `chai`, or similar present.

**Run Commands:** No test scripts defined in `package.json`.

```
Available scripts:
  npm run dev       # Start dev server
  npm run build     # Production build
  npm run start     # Start production server
  npm run check     # TypeScript type checking only (tsc --noEmit)
  npm run db:push   # Push Drizzle schema to database
```

## Test File Organization

**Formal test files:** None found. The `tsconfig.json` excludes `**/*.test.ts` from compilation, indicating tests were anticipated but never written.

**Ad-hoc test scripts at root level (not test suite files):**
- `test-db.js` — manual DB connectivity check (raw SQL via `pg` pool, logs result and exits)
- `test-endpoint.mjs` — manual Stripe checkout session creation script (uses live Stripe API + DB)
- `test-update.js` — manual DB column check via `postgres` client

These are one-off developer scripts, not test suites. They require a live database and real credentials to run. No assertions, no test runner, no isolation.

## Test Structure

**No formal test suites exist.** There is no pattern to follow from existing tests.

**The tsconfig `exclude` hint:**
```json
"exclude": ["node_modules", "build", "dist", "**/*.test.ts"]
```
This exclusion was added proactively, not because tests exist.

## Mocking

**Framework:** None configured.

**Current state:** No mocking infrastructure exists. The ad-hoc test scripts connect to real services (live PostgreSQL, live Stripe API).

## Fixtures and Factories

**Test Data:** None — no fixture files, factory functions, or seed data helpers for tests.

**Database seed script:** `server/seed-products.ts` exists but it seeds Stripe products/prices into the live Stripe account, not a test database. It is a one-time operational script, not a test fixture.

## Coverage

**Requirements:** None enforced — no coverage tooling configured.

**Current coverage:** Effectively 0% — no automated tests exist.

## Test Types

**Unit Tests:** Not present.

**Integration Tests:** Not present.

**E2E Tests:** Not present. No Playwright, Cypress, or Puppeteer dependency.

## Type Checking as Quality Gate

The only automated quality check in the codebase is TypeScript compilation:

```bash
npm run check   # runs: tsc (noEmit: true, strict: true)
```

TypeScript `strict: true` in `tsconfig.json` provides compile-time safety covering:
- Null/undefined checks
- Implicit `any` prevention
- Strict function types

This is the only programmatic correctness check in the CI/deployment pipeline.

## Manual Testing Workflow

Based on the three root-level test scripts, the current manual verification workflow is:

1. **DB connectivity check:** Run `node test-db.js` with `DATABASE_URL` in environment to verify schema columns exist.
2. **Stripe integration check:** Run `node test-endpoint.mjs` against a configured Stripe key and DB to verify checkout session creation end-to-end.
3. **Column check:** Run `node test-update.js` to check specific column values in the database.

All require real credentials and produce `console.log` output for manual inspection.

## Recommendations for Adding Tests

If tests are added to this codebase, use these locations and conventions:

**Framework recommendation:** Vitest (already compatible with Vite, no config changes needed to start)

**Test file placement:** Co-locate with source — `server/storage.test.ts`, `client/src/hooks/use-images.test.ts`

**Critical areas to test first (highest value):**
1. `server/storage.ts` — `DatabaseStorage` methods (requires DB test instance or mocked `db`)
2. `server/routes.ts` — request handlers for `/api/images`, `/api/credits/*`, `/api/subscription/*`
3. `client/src/hooks/use-images.ts` — mutation `onSuccess`/`onError` handlers
4. `shared/schema.ts` — Zod validation schemas via `insertImageSchema.parse(...)`
5. `shared/routes.ts` — `buildUrl` URL builder function (pure function, easy to unit test)

**Example unit test for `buildUrl` (pure function in `shared/routes.ts`):**
```typescript
import { buildUrl } from '@shared/routes';

describe('buildUrl', () => {
  it('replaces :id param', () => {
    expect(buildUrl('/api/images/:id', { id: 42 })).toBe('/api/images/42');
  });
  it('returns path unchanged when no params', () => {
    expect(buildUrl('/api/images')).toBe('/api/images');
  });
});
```

---

*Testing analysis: 2026-03-31*
