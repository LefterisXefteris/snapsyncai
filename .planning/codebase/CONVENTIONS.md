# Coding Conventions

**Analysis Date:** 2026-03-31

## Naming Patterns

**Files:**
- React pages: PascalCase — `Home.tsx`, `ProductDetails.tsx`, `Landing.tsx`
- React components: kebab-case — `image-card.tsx`, `upload-zone.tsx`, `app-sidebar.tsx`
- Hooks: `use-` prefix, kebab-case — `use-images.ts`, `use-auth.ts`, `use-toast.ts`
- Server files: camelCase — `routes.ts`, `storage.ts`, `stripeClient.ts`, `supabaseClient.ts`, `webhookHandlers.ts`
- Shared files: camelCase — `schema.ts`, `routes.ts`
- UI components (shadcn): kebab-case — `client/src/components/ui/button.tsx`, `client/src/components/ui/dialog.tsx`

**Functions:**
- React components: PascalCase — `ImageCard`, `UploadZone`, `DraggableThumbnail`
- Custom hooks: `use` prefix, camelCase — `useImages`, `useShopifyConnect`, `usePushToEtsy`
- Server utility functions: camelCase — `loadImageBuffer`, `runWithConcurrency`, `getOrCreateCreditPackPriceId`
- Server route handler functions: camelCase — `pushProductToShopify`, `pushProductToEtsy`, `getAmazonAccessToken`
- Helper functions: camelCase — `buildUrl`, `imageHashNormalizer`, `chunkArray`

**Variables:**
- camelCase for all variables — `shopDomain`, `accessToken`, `imageBuffers`, `cachedCreditPriceIds`
- SCREAMING_SNAKE_CASE for module-level constants — `MIN_IMAGE_COUNT`, `CONCURRENCY_LIMIT`, `CREDIT_PACKS`, `MAX_BUFFER_ENTRIES`
- Environment variable flags: SCREAMING_SNAKE_CASE — `DEV_BYPASS_AUTH`, `DEV_USER_ID`

**Types and Interfaces:**
- PascalCase for interfaces and types — `ImageCardProps`, `ProductAnalysis`, `QuickPreview`
- Types exported from schema via Drizzle inference — `type Image = typeof images.$inferSelect`
- `InsertX` prefix for insert types — `InsertImage`, `InsertShopifyConnection`
- `IStorage` prefix for interface of storage abstraction — `IStorage`

## Code Style

**Formatting:**
- No `.prettierrc` or `eslint.config.*` found — no enforced formatter configured
- TypeScript `strict: true` in `tsconfig.json`
- Single quotes for strings in most server code; template literals for multi-part strings
- Semicolons used throughout
- Arrow functions preferred for callbacks; `function` keyword used for named declarations

**TypeScript:**
- `strict: true` enforced — `tsconfig.json`
- `noEmit: true` — type checking only, build via esbuild
- `skipLibCheck: true` — skip type checking of `.d.ts` files
- `moduleResolution: "bundler"` for modern ESM resolution
- Explicit `as const` used on literal arrays — `BG_STYLES`, `CREDIT_PACKS`
- `as unknown as X` cast used sparingly; `as any` used in complex Shopify/Amazon payload building where typing is impractical

**Line Length / Blocks:**
- No hard limit enforced
- Long import lists are single-line (see `Home.tsx` line 6 — single-line import of ~30 hooks)
- Block comments use `// ── Section Name ───` dividers to organize large files

## Import Organization

**Order (observed pattern in client files):**
1. React and React ecosystem (`react`, `wouter`, `@tanstack/react-query`, `framer-motion`)
2. Internal hooks (`@/hooks/use-images`, `@/hooks/use-toast`)
3. Internal components (`@/components/upload-zone`, `@/components/image-card`, `@/components/ui/*`)
4. Internal lib utilities (`@/lib/utils`, `@/lib/queryClient`)
5. Shared types/routes (`@shared/schema`, `@shared/routes`)
6. Static assets (`../assets/snapsyncai-logo.png`)

**Order (observed pattern in server files):**
1. Node/framework imports (`express`, `multer`, `crypto`)
2. Internal server modules (`./storage`, `./db`, `./supabaseClient`, `./stripeClient`)
3. Shared modules (`@shared/schema`, `@shared/routes`) — via tsconfig path alias
4. Third-party SDKs (`openai`, `memoizee`, `zod`)

**Path Aliases (configured in `tsconfig.json` and `vite.config.ts`):**
- `@/*` → `./client/src/*`
- `@shared/*` → `./shared/*`
- `@assets` → `./attached_assets` (Vite only)

## Error Handling

**Server routes pattern — try/catch on every handler:**
```typescript
app.get("/api/credits/balance", requireAuth(), async (req, res) => {
  try {
    const userId = getUserId(req);
    // ... business logic
    res.json({ balance: row?.balance ?? 0 });
  } catch (error: any) {
    res.status(500).json({ message: "Failed to fetch credit balance" });
  }
});
```

**Client mutations — onError with toast:**
```typescript
return useMutation({
  mutationFn: async () => { /* ... */ },
  onError: (error) => {
    toast({ title: "Error Title", description: error.message, variant: "destructive" });
  },
});
```

**Client fetch helper — throws on non-OK response:**
- `apiRequest` in `client/src/lib/queryClient.ts` calls `throwIfResNotOk` which throws `Error(\`${res.status}: ${text}\`)`
- Direct `fetch` calls in hooks check `if (!res.ok) throw new Error(...)` manually

**Server AI retry pattern:**
- Functions like `fullAnalyzeImage` accept an `attempt` parameter and recurse up to `MAX_RETRIES`
- On final failure, return safe fallback object rather than throwing

**Silent catch for non-critical operations:**
```typescript
try { await stripe.prices.update(..., { active: false }); } catch (e) {}
```
Used when side effects (like deactivating old Stripe prices) are non-fatal.

## Logging

**Framework:** Native `console.*` — no structured logger library

**Patterns:**
- `console.log(...)` — info-level events (webhooks received, migrations complete, Stripe actions)
- `console.error(...)` — errors with context string prefix: `console.error("Shopify push error:", error)`
- `console.warn(...)` — non-fatal issues: `console.warn('DATABASE_URL not set, skipping Stripe init')`
- Custom `log()` function in `server/index.ts` (line 100) for request logging with timestamp — used for HTTP access log

**Structured request logging** in `server/index.ts`:
- Middleware captures `res.json` response to log `METHOD /path STATUS in Xms :: {response}`

## Comments

**Section Dividers:**
```typescript
// ── Section Name ──────────────────────────────────────────────────────────
```
Used throughout `server/routes.ts`, `server/storage.ts`, and component files to delineate logical sections in long files.

**Inline explanatory comments:**
- Used above non-obvious decisions: `// LRU-capped buffer store: keeps at most MAX_BUFFER_ENTRIES...`
- Used above complex DB queries explaining what they retrieve
- Used above skipped edge cases: `// Non-fatal — log and fall through to subscribed: false`

**JSDoc/TSDoc:** Not used — no `@param` or `@returns` annotations present.

## Function Design

**Size:** Large functions are common — `server/routes.ts` is 3070 lines, `Home.tsx` is 1230 lines, `ProductDetails.tsx` is 1076 lines. Business logic is not split into small functions.

**Parameters:** Prefer named object parameters for complex inputs — `{ shopDomain, accessToken }`, `{ buffer, mimeType, originalName }`. Positional params used for simple cases.

**Return Values:** 
- Server functions return `{ error?: string; fieldId?: string }` discriminated union on failure rather than throwing
- Async functions return `Promise<T>` with explicit type annotations on exported functions
- Nullable returns use `T | undefined` (not `T | null`) for DB lookups — e.g., `Promise<Image | undefined>`

## Module Design

**Exports:**
- Server modules: named exports — `export class DatabaseStorage`, `export function registerRoutes`, `export const storage`
- Client hooks: named function exports from single file — all hooks in `client/src/hooks/use-images.ts`
- Shared schema: named exports for each table, insert schema, and inferred types

**Barrel Files:** Not used — imports reference specific file paths, not index files.

**Singleton Pattern:**
- `storage` exported as singleton from `server/storage.ts`
- `queryClient` exported as singleton from `client/src/lib/queryClient.ts`
- Module-level caches (`cachedPriceId`, `cachedCreditPriceIds`, `imageBuffers`) used as in-memory singletons

## React Patterns

**Component definition:**
- `memo()` wrapping used on `ImageCard` to prevent unnecessary re-renders: `export const ImageCard = memo(function ImageCard(...))`
- Default exports for pages — `export default function Home()`
- Named exports for reusable components — `export { Button, buttonVariants }`

**State management:**
- All remote state via TanStack Query (`@tanstack/react-query`)
- Local UI state via `useState`
- No global state manager (no Redux, Zustand, Jotai)
- Query invalidation after mutations: `queryClient.invalidateQueries({ queryKey: [...] })`

**Query key pattern:**
```typescript
queryKey: [api.images.list.path, userId]  // Scoped by userId to prevent cross-user cache sharing
```

**Hooks file pattern:** All hooks for a domain are co-located in a single file (`use-images.ts` contains 40+ hooks). Each hook is a self-contained exported function wrapping `useQuery` or `useMutation`.

---

*Convention analysis: 2026-03-31*
