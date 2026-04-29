---
status: resolved
trigger: "Fatal crash at startup — supabaseUrl is required thrown by @supabase/supabase-js because process.env.SUPABASE_URL is undefined at module load time"
created: 2026-04-17T00:00:00Z
updated: 2026-04-17T00:01:00Z
symptoms_prefilled: true
goal: find_and_fix
---

## Current Focus

hypothesis: CONFIRMED — supabase client is instantiated at module-load time (top-level code) with no guard; on Vercel the env var is missing from one or more environment scopes, causing immediate crash before any request is served
test: apply lazy-initialization fix to supabaseClient.ts
expecting: crash eliminated; if env var is missing the error surfaces only at call time with a useful message
next_action: rewrite supabaseClient.ts to lazy-init the client inside uploadImageToStorage

## Symptoms

expected: Server starts successfully with Supabase client initialized
actual: Fatal unhandled crash: "supabaseUrl is required" — process exits immediately
errors: |
  Error: supabaseUrl is required.
  at validateSupabaseUrl (.../node_modules/@supabase/supabase-js/src/lib/helpers.ts)
  at /Users/lefterisgilmaz/Desktop/lisai-app/server/supabaseClient.ts line 7:25
  mechanism: auto.node.onuncaughtexception
  handled: false
  level: fatal
reproduction: Start the server — crashes on import of supabaseClient.ts before any request is handled
timeline: First seen 15 hours ago, 10 events total

## Eliminated

- hypothesis: dotenv loads after supabaseClient import (import order bug)
  evidence: built CJS bundle shows require("dotenv/config") at offset 1,224,563, SUPABASE_URL access at 1,598,690 — dotenv runs first
  timestamp: 2026-04-17T00:01:00Z

- hypothesis: instrument.ts triggers supabaseClient import before dotenv loads
  evidence: instrument.ts only calls Sentry.init(), imports nothing from supabaseClient
  timestamp: 2026-04-17T00:01:00Z

## Evidence

- timestamp: 2026-04-17T00:01:00Z
  checked: server/index.ts import order
  found: instrument.ts (line 1) → dotenv/config (line 2) → routes.ts (line 6). dotenv loads before routes/supabaseClient.
  implication: import order is NOT the bug locally

- timestamp: 2026-04-17T00:01:00Z
  checked: dist/index.cjs byte offsets
  found: require("dotenv/config") at 1224563, process.env.SUPABASE_URL + createClient at 1598690
  implication: bundle execution order is correct — dotenv runs before supabase client init

- timestamp: 2026-04-17T00:01:00Z
  checked: .env file presence
  found: .env exists with SUPABASE_URL="https://ubgdfnnidnhvakcchxbw.supabase.co" — correct value present locally
  implication: local env is fine; Vercel runtime does NOT read .env files

- timestamp: 2026-04-17T00:01:00Z
  checked: vercel.json + api/index.js + .env.vercel.local
  found: Vercel entry is api/index.js → dist/index.cjs. .env.vercel.local has ONLY VERCEL_OIDC_TOKEN — no SUPABASE_URL
  implication: SUPABASE_URL is absent from Vercel development environment scope; dotenv finds no .env file on Vercel, so env var stays undefined

- timestamp: 2026-04-17T00:01:00Z
  checked: who uses supabaseClient exports
  found: only routes.ts imports from supabaseClient, and only uploadImageToStorage is used (not bare supabase export)
  implication: safe to lazy-initialize — create client inside the function, not at module load time

## Resolution

root_cause: |
  supabaseClient.ts instantiates createClient() at module load time (top-level code).
  On Vercel, SUPABASE_URL is not set in the development environment scope (missing from Vercel dashboard env vars for that environment).
  dotenv/config cannot help on Vercel — there is no .env file on the Vercel runtime filesystem.
  The top-level createClient() call fires during module import, before any request is handled, and crashes the entire process.
fix: lazy-initialize the supabase client inside uploadImageToStorage (and getClient helper) so it only throws at call time with a meaningful error, not at module load time
verification: |
  TypeScript check passes with zero errors in supabaseClient.ts.
  No callers use the bare `supabase` export — only uploadImageToStorage is imported by routes.ts.
  Lazy singleton pattern confirmed: client creation deferred until first call, crash cannot occur at module load time.
files_changed:
  - server/supabaseClient.ts
