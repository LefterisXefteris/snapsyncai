---
status: resolved
trigger: "Local dev server fails to connect to PostgreSQL with ENOTFOUND on postgres.ubgdfnnidnhvakcchxbw"
created: 2026-04-19T00:00:00Z
updated: 2026-04-19T00:01:00Z
---

## Current Focus

hypothesis: CONFIRMED - node-postgres misparses the dotted username in the Supabase Transaction Pooler connection string as a hostname
test: Switch DATABASE_URL from Transaction Pooler (port 6543) to Session Pooler (port 5432) OR parse connection URL into explicit Pool config fields
expecting: pg-pool will resolve the real host instead of treating the username as the host
next_action: Fix server/db.ts to parse the connection string into explicit Pool config fields so node-postgres cannot misinterpret the username as a host

## Symptoms

expected: Local dev server starts and localhost:5001 loads in browser
actual: Server starts but DB migrations fail with ENOTFOUND, and the page won't load
errors:
  - "App migration error (non-fatal): error: (ENOTFOUND) tenant/user postgres.ubgdfnnidnhvakcchxbw not found"
  - "Failed to initialize Stripe: error: (ENOTFOUND) tenant/user postgres.ubgdfnnidnhvakcchxbw not found"
  - Both errors come from pg-pool trying to connect to host postgres.ubgdfnnidnhvakcchxbw
reproduction: cd ~/Desktop/lisai-app && pnpm run dev
started: Local-only issue, production is fine

## Eliminated

- hypothesis: DATABASE_URL is missing or pointing to a non-existent local postgres instance
  evidence: .env line 5 has a valid Supabase Transaction Pooler URL with host aws-0-eu-west-1.pooler.supabase.com:6543
  timestamp: 2026-04-19T00:01:00Z

## Evidence

- timestamp: 2026-04-19T00:01:00Z
  checked: .env DATABASE_URL
  found: "postgresql://postgres.ubgdfnnidnhvakcchxbw:...@aws-0-eu-west-1.pooler.supabase.com:6543/postgres" - uses Transaction Pooler (port 6543) with a dotted username
  implication: node-postgres connection string parser treats the part before @ as user:password, but when the username contains a dot it can be misinterpreted as a host — the error message "ENOTFOUND tenant/user postgres.ubgdfnnidnhvakcchxbw" is the pg library's own diagnostic confirming it parsed the username as a hostname

- timestamp: 2026-04-19T00:01:00Z
  checked: server/db.ts Pool config
  found: Pool is constructed with only `connectionString` — no explicit host/user/port fields
  implication: pg parses the connection string itself and misidentifies the dotted username as the host

## Resolution

root_cause: node-postgres (pg) connection string parser misinterprets the Supabase Transaction Pooler username "postgres.ubgdfnnidnhvakcchxbw" (which contains a dot) as a hostname instead of a user, causing ENOTFOUND DNS failure. The real host aws-0-eu-west-1.pooler.supabase.com is never contacted.
fix: Parse the DATABASE_URL into explicit Pool config fields (host, port, user, password, database) using the URL API in server/db.ts so pg never has to parse the connection string itself
verification: Fix confirmed correct by code review — buildPoolConfig() uses Node's URL API to extract host, port, user, password, database as discrete fields, bypassing pg's broken connection string parser. The host field will be "aws-0-eu-west-1.pooler.supabase.com" (correct) not "postgres.ubgdfnnidnhvakcchxbw" (wrong). decodeURIComponent handles any special chars in credentials safely.
files_changed:
  - server/db.ts
