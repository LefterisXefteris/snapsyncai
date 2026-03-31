# Architecture

**Analysis Date:** 2026-03-31

## Pattern Overview

**Overall:** Full-stack monorepo — Express API + React SPA with shared schema layer

**Key Characteristics:**
- Single Node.js process serves both the API and the Vite dev server (in development); in production on Vercel the Express handler is deployed as a serverless function via `api/index.js`
- A `shared/` package is imported by both client and server via path alias `@shared`, enabling type-safe contract between layers
- All business logic lives in a single monolithic `server/routes.ts` — there is no internal service layer splitting
- Authentication is delegated entirely to Clerk; user identity flows from Clerk JWT on every request via `requireAuth()` middleware
- Data isolation is enforced by `sessionId` (= Clerk `userId`) scoping on all DB queries

## Layers

**Shared Contract Layer:**
- Purpose: Database schema definitions and API route contracts shared between client and server
- Location: `shared/`
- Contains: `schema.ts` (Drizzle table definitions + Zod types), `routes.ts` (typed API path/method manifest), `models/chat.ts`
- Depends on: nothing (no imports from server or client)
- Used by: both `server/` and `client/src/`

**Server / API Layer:**
- Purpose: HTTP request handling, AI analysis orchestration, payment processing, external marketplace integration
- Location: `server/`
- Contains: `index.ts` (Express app setup + Vercel handler export), `routes.ts` (all route handlers ~3,000+ lines), `storage.ts` (DB access via `IStorage` / `DatabaseStorage`), `db.ts` (Drizzle + pg pool), `supabaseClient.ts`, `stripeClient.ts`, `webhookHandlers.ts`, `replit_integrations/`
- Depends on: `shared/schema`, OpenAI SDK, Stripe SDK, Supabase SDK, Clerk Express SDK
- Used by: Vercel serverless handler (`api/index.js`), local dev server

**Storage / Data Access Layer:**
- Purpose: All PostgreSQL reads and writes, isolated behind the `IStorage` interface
- Location: `server/storage.ts`
- Contains: `IStorage` interface + `DatabaseStorage` class (singleton export `storage`)
- Depends on: `server/db.ts`, `shared/schema`
- Used by: `server/routes.ts`, `server/webhookHandlers.ts`

**Client / Frontend Layer:**
- Purpose: React SPA — image upload, product management dashboard, marketplace connection UI, payment flows
- Location: `client/src/`
- Contains: `main.tsx` (mount), `App.tsx` (routing + auth gates), `pages/` (full-page views), `components/` (UI blocks), `hooks/` (React Query mutations/queries), `lib/` (utilities)
- Depends on: `@shared/schema` (types), `@shared/routes` (API paths), TanStack Query, Clerk React SDK, Radix UI, Tailwind
- Used by: Vite dev server / static build output

## Data Flow

**Image Upload + AI Analysis:**

1. User drops images in `client/src/components/upload-zone.tsx`
2. `useUploadImages` hook (`client/src/hooks/use-images.ts`) POSTs `multipart/form-data` to `POST /api/images/upload`
3. `routes.ts` receives files via multer memory storage; checks subscription/credit status via `storage.getSubscription()`
4. If subscriber: calls `fullAnalyzeImage()` or `fullAnalyzeMultipleImages()` (OpenAI GPT vision, memoized 24h)
5. If free tier: calls `quickPreviewImage()` (lighter GPT call, returns title/category/tags only)
6. Image buffer is uploaded to Supabase Storage via `uploadImageToStorage()` → `storage_url` column
7. `storage.createImage()` writes row to `images` table with AI-generated fields
8. TanStack Query cache is invalidated; `Home.tsx` re-renders with new image cards

**Authentication Flow:**

1. `App.tsx` wraps app in `<ClerkProvider>` with publishable key from `VITE_CLERK_PUBLISHABLE_KEY` (or fetched from `/api/auth/clerk-config` as fallback)
2. Unauthenticated users see `<Landing />` page via `<SignedOut>`
3. Authenticated users see `<AuthenticatedLayout>` routing (`/`, `/product/:id`)
4. Every API call includes session cookie; `requireAuth()` in routes calls `clerkRequireAuth()` which validates Clerk JWT; `getUserId(req)` extracts `userId`
5. `CacheFlusher` component clears TanStack Query cache on user switch

**Payment / Credit Flow:**

1. User triggers subscription or credit pack checkout via mutations in `use-images.ts`
2. Routes create Stripe Checkout sessions; Stripe redirects back with `?session_id=`
3. `POST /api/stripe/webhook` receives Stripe events (raw body, registered before `express.json()`)
4. `WebhookHandlers.processWebhook()` dispatches events: `checkout.session.completed` (payment) → `storage.addCredits()`, (subscription) → `storage.upsertSubscription()`
5. Credit deduction on AI analysis: `storage.deductCredits()` called atomically in DB (balance check + decrement in single UPDATE WHERE)

**Marketplace Push Flow:**

1. User connects Shopify/Etsy/Amazon/Instagram via dedicated connect endpoints; credentials stored in respective connection tables
2. `POST /api/images/push-to-{platform}` fetches stored credentials, calls platform API, updates `images.shopifyProductId` / status columns
3. Instagram additionally supports OAuth flow (`/api/instagram/oauth/start` → redirect → `/api/instagram/oauth/callback`)

**State Management:**

- Server-authoritative: TanStack Query is the sole client state manager for server data
- Query keys are scoped by `userId` to prevent cross-user cache pollution
- `staleTime: 60_000` on image list; mutations call `queryClient.invalidateQueries()` after success
- No global Redux/Zustand store; component-local `useState` for ephemeral UI state

## Key Abstractions

**`IStorage` Interface:**
- Purpose: Decouples route handlers from DB implementation; enables future in-memory or test implementations
- Examples: `server/storage.ts`
- Pattern: Interface + concrete class `DatabaseStorage`; exported as singleton `storage`

**`requireAuth()` Factory:**
- Purpose: Returns either a Clerk middleware or a passthrough no-op based on `DEV_BYPASS_AUTH` env flag
- Examples: `server/routes.ts` line 21–24
- Pattern: Conditional factory function wrapping `clerkRequireAuth()`

**Shared `api` Route Manifest:**
- Purpose: Single source of truth for HTTP method + path + response shapes; used client-side in hooks and server-side for reference
- Examples: `shared/routes.ts`
- Pattern: Typed const object with Zod response schemas; `buildUrl()` helper for path param substitution

**Memoized AI Functions:**
- Purpose: Deduplicate expensive OpenAI vision calls across concurrent uploads of identical images
- Examples: `quickPreviewImage`, `fullAnalyzeImage` in `server/routes.ts`
- Pattern: `memoizee()` with SHA-256 hash of image buffer + parameter string as cache key; 24h TTL, 1000-item cap

**`loadImageBuffer()` Resolution Chain:**
- Purpose: Transparently load image bytes from in-memory LRU → base64 DB column → Supabase Storage URL
- Examples: `server/routes.ts` lines 51–68
- Pattern: Waterfall async fallback; LRU map capped at 500 entries

## Entry Points

**Local Development:**
- Location: `server/index.ts` via `npm run dev` (`tsx server/index.ts`)
- Triggers: `setupApp()` → `registerRoutes()` + Vite middleware; HTTP listen on port 5001

**Vercel Serverless (Production):**
- Location: `api/index.js` → imports `dist/index.cjs` (compiled server bundle)
- Triggers: Every inbound HTTP request; `setupApp()` is called once per cold start and cached via `setupPromise`
- Responsibilities: Delegate to Express app; `maxDuration: 60s` for AI analysis requests

**React SPA:**
- Location: `client/src/main.tsx` → `client/src/App.tsx`
- Triggers: Browser load from `dist/public/index.html`
- Responsibilities: Mount React tree, initialize TanStack Query + ThemeProvider + ClerkProvider, gate routes behind auth

**Build:**
- Location: `script/build.ts`
- Triggers: `npm run build`; produces `dist/public/` (Vite SPA) + `dist/index.cjs` (server bundle via esbuild)

## Error Handling

**Strategy:** HTTP status codes with JSON `{ message }` bodies; Express global error handler as catch-all

**Patterns:**
- Route handlers use `try/catch` and `return res.status(N).json({ message })` directly
- Global error middleware in `server/index.ts` catches unhandled errors: returns 500 with sanitized message
- AI analysis errors degrade gracefully: fallback to filename-derived title if OpenAI call fails
- Client: TanStack Query surfaces errors via `isError`/`error` fields; `useToast` displays user-facing messages
- Stripe webhook errors return 400; all other webhook processing errors are logged but not fatal

## Cross-Cutting Concerns

**Logging:** Custom `log()` function in `server/index.ts`; patches `res.json` to capture response body for API request logging (method, path, status, duration, truncated body)

**Validation:** Zod schemas validate route inputs inline in handlers; `drizzle-zod` generates insert schemas from table definitions in `shared/schema.ts`

**Authentication:** Clerk JWT verified per-request via `clerkMiddleware` + `requireAuth()`; `DEV_BYPASS_AUTH=true` env flag bypasses all auth checks in development

**Data Isolation:** Every DB query that reads user data requires `sessionId` parameter (= Clerk userId); `listImages` and `getAllImages` throw if called without `sessionId`

**Image Storage:** Dual-path — primary: Supabase Storage (public URL); fallback: base64 in `images.image_data` column; in-memory LRU buffer cache (`imageBuffers` Map, max 500 entries) for hot paths

---

*Architecture analysis: 2026-03-31*
