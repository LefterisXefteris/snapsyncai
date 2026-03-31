# Technology Stack

**Analysis Date:** 2026-03-31

## Languages

**Primary:**
- TypeScript 5.6.3 - All server code (`server/`), all client code (`client/src/`), shared schema (`shared/`)

**Secondary:**
- JavaScript - Build output only (`dist/index.cjs`, `api/index.js`)

## Runtime

**Environment:**
- Node.js (targeting ESNext modules)
- ESM by default (`"type": "module"` in `package.json`)

**Package Manager:**
- pnpm (primary — `pnpm-lock.yaml` present, `vercel.json` uses `pnpm install`)
- npm also present (`package-lock.json`)
- Lockfiles: Both present

## Frameworks

**Backend:**
- Express 5.0.1 (`server/index.ts`) — HTTP server, REST API
- HTTP server created via Node `http.createServer` and wrapped for Vercel serverless

**Frontend:**
- React 18.3.1 — SPA (`client/src/main.tsx`)
- Wouter 3.3.5 — Client-side routing (`client/src/App.tsx`)
- TanStack React Query 5.60.5 — Server state management and caching (`client/src/lib/queryClient.ts`)

**UI Component Library:**
- shadcn/ui (Radix UI primitives + Tailwind) — All `@radix-ui/react-*` packages listed in dependencies
- Tailwind CSS 3.4.17 — Styling (`tailwind.config.ts`)
- Framer Motion 11.13.1 — Animations

**Forms:**
- React Hook Form 7.55.0 + `@hookform/resolvers` 3.10.0 + Zod 3.25.76 — All form validation

**Drag-and-Drop:**
- `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` — Image reordering UI

**Testing:**
- Not detected (no test runner config files, no `*.test.*` or `*.spec.*` files found)

**Build/Dev:**
- Vite 7.3.0 — Frontend dev server and client build (`vite.config.ts`)
- esbuild 0.25.0 — Server bundle build (CJS output for Vercel) (`script/build.ts`)
- tsx 4.20.5 — TypeScript execution for dev server (`npm run dev`)
- Drizzle Kit 0.31.8 — Database schema management and migrations (`drizzle.config.ts`)

## Key Dependencies

**Critical:**
- `openai` 6.21.0 — Core AI feature: product listing generation, background generation, chat (via Replit AI Integrations proxy)
- `drizzle-orm` 0.39.3 — ORM for all PostgreSQL queries (`server/db.ts`, `server/storage.ts`)
- `@supabase/supabase-js` 2.100.0 — File storage for product images (`server/supabaseClient.ts`)
- `stripe` 20.0.0 — Payments: credit packs and subscriptions (`server/stripeClient.ts`)
- `stripe-replit-sync` 1.0.0 — Stripe schema migrations and webhook sync helper (`server/index.ts`)
- `@clerk/clerk-react` 5.60.2 + `@clerk/express` 1.7.71 — Authentication, user identity (`server/routes.ts`, `client/src/App.tsx`)
- `multer` 2.0.2 — File upload handling (product image uploads, 10 MB limit)
- `pg` 8.16.3 — PostgreSQL connection pool (`server/db.ts`)
- `zod` 3.25.76 — Runtime validation for API inputs and schema (`shared/schema.ts`)

**Infrastructure:**
- `compression` 1.8.1 — Gzip all JSON/text responses (60–80% size reduction)
- `memoizee` 0.4.17 — In-process caching for hot lookups (`server/routes.ts`)
- `p-limit` 7.3.0, `p-retry` 7.1.1 — Concurrency and retry for batch AI processing
- `ws` 8.18.0 — WebSocket support (used in dev Vite HMR bridge)
- `drizzle-zod` 0.7.1 — Auto-generates Zod insert schemas from Drizzle table definitions
- `date-fns` 3.6.0 — Date formatting utilities
- `next-themes` 0.4.6 — Dark/light theme management (forced dark in `App.tsx`)

## Configuration

**Environment:**
- Runtime config loaded via `dotenv` from `.env` (dev) and Vercel env vars (production)
- `.env` and `.env.vercel.local` / `.env.vercel.prod` files present (never read for security)
- TypeScript path aliases: `@/*` → `client/src/`, `@shared/*` → `shared/`
- Vite alias: `@assets` → `attached_assets/`

**Key env vars required:**
- `DATABASE_URL` — PostgreSQL connection string (required, throws on startup if missing)
- `SUPABASE_URL`, `SUPABASE_ANON_KEY` — Supabase Storage
- `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY` — Stripe payments
- `CLERK_PUBLISHABLE_KEY` (server) + `VITE_CLERK_PUBLISHABLE_KEY` (client) — Auth
- `AI_INTEGRATIONS_OPENAI_API_KEY`, `AI_INTEGRATIONS_OPENAI_BASE_URL` — OpenAI via Replit proxy
- `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`, `FACEBOOK_CONFIG_ID` — Instagram OAuth
- `DEV_BYPASS_AUTH` — Dev-only flag to skip Clerk auth gates
- `VITE_DEV_BYPASS_AUTH` — Client-side counterpart to bypass auth in dev

**Build:**
- `tsconfig.json` — Strict TypeScript, bundler module resolution, covers `client/src/`, `shared/`, `server/`
- `vite.config.ts` — Client build, outputs to `dist/public/`
- `script/build.ts` — Runs Vite then esbuild; server bundled to `dist/index.cjs`
- `drizzle.config.ts` — Schema at `shared/schema.ts`, dialect postgresql, migrations in `migrations/`
- `vercel.json` — Rewrites: `/api/*` → `/api/index.js` (serverless), `/*` → `/index.html` (SPA)

## Platform Requirements

**Development:**
- Node.js with `tsx` for TypeScript execution
- PostgreSQL database (connection via `DATABASE_URL`)
- Dev server runs on port 5001 (`server/index.ts`)
- Optional Replit-specific plugins active when `REPL_ID` env var is set

**Production:**
- Vercel (serverless functions, `api/index.js` entry point)
- Express app exported as default function handler for Vercel
- PostgreSQL (Supabase-hosted based on SSL config detecting `supabase` in connection string)
- Supabase Storage bucket named `product-images`

---

*Stack analysis: 2026-03-31*
