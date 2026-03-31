# Codebase Structure

**Analysis Date:** 2026-03-31

## Directory Layout

```
lisai-app/
├── api/                    # Vercel serverless function entry point
│   └── index.js            # Imports compiled server bundle; exported as Vercel handler
├── client/                 # React SPA source (Vite root)
│   ├── public/             # Static assets served as-is
│   └── src/
│       ├── App.tsx         # Root component: auth gates, routing, providers
│       ├── main.tsx        # React DOM mount point
│       ├── index.css       # Global Tailwind + custom CSS
│       ├── assets/         # Images bundled into the app (logo etc.)
│       ├── components/     # Reusable UI components
│       │   ├── ui/         # shadcn/ui primitives (50+ components)
│       │   ├── app-sidebar.tsx
│       │   ├── image-card.tsx
│       │   ├── review-queue-modal.tsx
│       │   ├── upload-zone.tsx
│       │   ├── mode-toggle.tsx
│       │   └── theme-provider.tsx
│       ├── hooks/          # React Query hooks (data fetching + mutations)
│       │   ├── use-images.ts   # All image/subscription/credit/platform hooks
│       │   ├── use-auth.ts
│       │   ├── use-mobile.tsx
│       │   └── use-toast.ts
│       ├── lib/            # Client-side utilities
│       │   ├── queryClient.ts  # TanStack QueryClient config + apiRequest helper
│       │   ├── auth-utils.ts
│       │   └── utils.ts        # cn() classname helper
│       └── pages/          # Full-page route components
│           ├── Home.tsx        # Main dashboard (image list, marketplace controls)
│           ├── Landing.tsx     # Unauthenticated marketing/auth page
│           ├── ProductDetails.tsx  # Single product edit view
│           └── not-found.tsx
├── server/                 # Express API server
│   ├── index.ts            # Express app factory, Stripe init, Vercel handler export
│   ├── routes.ts           # All API route handlers (~3,000 lines)
│   ├── storage.ts          # IStorage interface + DatabaseStorage implementation
│   ├── db.ts               # Drizzle ORM + pg Pool setup
│   ├── supabaseClient.ts   # Supabase Storage upload helper
│   ├── stripeClient.ts     # Stripe SDK client factory
│   ├── webhookHandlers.ts  # Stripe webhook event processor
│   ├── static.ts           # Static file serving for production
│   ├── vite.ts             # Vite dev server middleware (dev only)
│   ├── seed-products.ts    # One-off DB seed script
│   └── replit_integrations/
│       ├── image/          # OpenAI image generation/edit client
│       │   ├── client.ts   # openai SDK instance + generateImageBuffer/editImages
│       │   ├── index.ts
│       │   └── routes.ts
│       ├── batch/          # Batch processing utilities
│       │   ├── index.ts
│       │   └── utils.ts
│       ├── chat/           # Chat integration (unused in main flow)
│       └── audio/          # Audio integration (unused in main flow)
├── shared/                 # Code shared between client and server
│   ├── schema.ts           # Drizzle table definitions + TypeScript types (source of truth)
│   ├── routes.ts           # Typed API manifest with Zod response schemas
│   └── models/
│       └── chat.ts
├── script/
│   └── build.ts            # Custom esbuild + Vite build script
├── dist/                   # Build output (gitignored)
│   ├── public/             # Vite SPA build (served as static files)
│   └── index.cjs           # Server bundle (imported by api/index.js)
├── attached_assets/        # Design assets / reference images (not bundled)
├── .planning/              # GSD planning documents
│   └── codebase/           # Codebase analysis documents
├── package.json
├── tsconfig.json
├── vite.config.ts          # Vite config; sets @/ and @shared path aliases
├── drizzle.config.ts       # Drizzle Kit config; points to shared/schema.ts
├── tailwind.config.ts
├── postcss.config.js
├── components.json         # shadcn/ui component config
└── vercel.json             # Vercel routing: /api/* → serverless, /* → index.html
```

## Directory Purposes

**`client/src/pages/`:**
- Purpose: Full-page route-level components mounted by wouter `<Route>`
- Contains: `Home.tsx` (dashboard), `Landing.tsx` (marketing + auth), `ProductDetails.tsx` (per-product edit), `not-found.tsx`
- Key files: `Home.tsx` (55 KB), `ProductDetails.tsx` (56 KB), `Landing.tsx` (50 KB) — these are large monolithic pages

**`client/src/components/`:**
- Purpose: Reusable UI components composed inside pages
- Contains: Feature components (`upload-zone.tsx`, `image-card.tsx`, `review-queue-modal.tsx`, `app-sidebar.tsx`) + shadcn primitives in `ui/`
- Key files: `review-queue-modal.tsx` (31 KB), `upload-zone.tsx` (23 KB), `image-card.tsx` (10 KB)

**`client/src/hooks/`:**
- Purpose: All server state lives here via TanStack Query `useQuery` / `useMutation` hooks
- Contains: One main file `use-images.ts` (31 KB) exporting ~30 hooks covering images, subscriptions, credits, Shopify, Etsy, Amazon, Instagram
- Key files: `use-images.ts` — the primary data layer for the entire client

**`client/src/lib/`:**
- Purpose: Thin utility layer; no business logic
- Contains: `queryClient.ts` (QueryClient singleton + `apiRequest` fetch wrapper), `auth-utils.ts`, `utils.ts` (shadcn `cn()`)

**`server/`:**
- Purpose: Entire backend — HTTP routing, AI orchestration, payments, DB access
- Key files: `routes.ts` (128 KB — all route handlers), `storage.ts` (15 KB — DB access), `index.ts` (6 KB — app bootstrap)

**`shared/`:**
- Purpose: Contract layer imported by both sides; never imports from `server/` or `client/`
- Key files: `schema.ts` (Drizzle table defs + inferred TypeScript types), `routes.ts` (API path manifest)

**`server/replit_integrations/`:**
- Purpose: Third-party AI service clients scaffolded by Replit; only `image/client.ts` is actively used (OpenAI client)
- Generated: Yes (Replit scaffold); some subdirectories (`chat/`, `audio/`) are unused in the current main flow

## Key File Locations

**Entry Points:**
- `client/src/main.tsx`: React SPA mount
- `client/src/App.tsx`: Provider tree, auth gates, wouter routes
- `server/index.ts`: Express setup, `setupApp()` factory, Vercel handler export
- `api/index.js`: Vercel serverless handler

**Configuration:**
- `vite.config.ts`: Path aliases (`@` → `client/src`, `@shared` → `shared`), Vite root, build output
- `tsconfig.json`: TypeScript config with `paths` matching Vite aliases
- `drizzle.config.ts`: Points schema at `shared/schema.ts`, dialect `postgresql`
- `vercel.json`: Rewrites — `/api/*` → `api/index.js`, `/*` → `index.html`
- `tailwind.config.ts`: Theme tokens, content paths
- `components.json`: shadcn/ui component registry config

**Core Logic:**
- `server/routes.ts`: All API endpoints — upload, AI analysis, CRUD, marketplace push, payments
- `server/storage.ts`: `IStorage` interface + `DatabaseStorage`; all SQL via Drizzle ORM
- `shared/schema.ts`: Single source of truth for all table shapes and TypeScript types
- `client/src/hooks/use-images.ts`: All client-side data fetching and mutations

**Testing:**
- `test-db.js`, `test-endpoint.mjs`, `test-update.js` — ad-hoc root-level scripts; no structured test suite

## Naming Conventions

**Files:**
- React components: `kebab-case.tsx` (e.g., `upload-zone.tsx`, `image-card.tsx`)
- React hooks: `use-kebab-case.ts` (e.g., `use-images.ts`, `use-toast.ts`)
- Pages: `PascalCase.tsx` (e.g., `Home.tsx`, `ProductDetails.tsx`, `Landing.tsx`)
- Server modules: `camelCase.ts` (e.g., `routes.ts`, `storage.ts`, `stripeClient.ts`)
- Shared modules: `camelCase.ts` (e.g., `schema.ts`, `routes.ts`)

**Directories:**
- `kebab-case` for all directories (e.g., `replit_integrations` uses underscores — legacy Replit scaffold)
- `ui/` is the only nested component directory (shadcn primitives)

**Exports:**
- Components: default export from page/component files
- Hooks: named exports from `use-*.ts` files
- Storage: singleton `export const storage = new DatabaseStorage()`
- DB: named exports `pool`, `db` from `server/db.ts`

## Where to Add New Code

**New API Route:**
- Add handler inside `registerRoutes()` in `server/routes.ts`
- Add path + method + response schema to `shared/routes.ts` `api` object
- Follow pattern: `app.METHOD("/api/...", requireAuth(), async (req, res) => { ... })`
- Use `getUserId(req)` to get scoped userId; pass to `storage.*()` methods

**New Database Table:**
- Define table in `shared/schema.ts` using `pgTable()`
- Export insert schema via `createInsertSchema(table).omit({ id, createdAt })`
- Export `type T = typeof table.$inferSelect` and `type InsertT = z.infer<...>`
- Add CRUD methods to `IStorage` interface and `DatabaseStorage` class in `server/storage.ts`
- Run `npm run db:push` to sync schema to DB

**New Page:**
- Add `PageName.tsx` to `client/src/pages/`
- Register route in `client/src/App.tsx` inside `<AuthenticatedRouter>`

**New Feature Component:**
- Add `feature-name.tsx` to `client/src/components/`
- Use shadcn primitives from `client/src/components/ui/` for base UI

**New Data Hook:**
- Add named export to `client/src/hooks/use-images.ts`
- Use `useQuery` with query key `[api.path.path, userId]` to scope by user
- Use `useMutation` with `onSuccess: () => queryClient.invalidateQueries(...)` for writes

**New shadcn/ui Component:**
- Components live in `client/src/components/ui/`; add via `npx shadcn-ui add <component>`

**Utilities:**
- Shared client helpers: `client/src/lib/utils.ts`
- Server-only helpers: add to relevant server module or a new `server/utils.ts`

## Special Directories

**`dist/`:**
- Purpose: Build output — `dist/public/` (SPA static files), `dist/index.cjs` (server bundle)
- Generated: Yes
- Committed: No (gitignored)

**`attached_assets/`:**
- Purpose: Reference screenshots and design assets used during development
- Generated: No
- Committed: Yes

**`.planning/`:**
- Purpose: GSD planning documents (codebase analysis, phase plans)
- Generated: By GSD commands
- Committed: Yes

**`server/replit_integrations/`:**
- Purpose: AI service client scaffolds generated by Replit; `image/client.ts` is the active OpenAI client
- Generated: Partially (Replit scaffold); `image/client.ts` has been extended manually
- Committed: Yes

**`node_modules/`:**
- Generated: Yes
- Committed: No

---

*Structure analysis: 2026-03-31*
