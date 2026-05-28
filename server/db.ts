import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// node-postgres misparses Supabase Transaction Pooler connection strings when the
// username contains a dot (e.g. "postgres.ubgdfnnidnhvakcchxbw") — it treats the
// dotted username as a hostname, causing ENOTFOUND. Parsing the URL explicitly and
// passing discrete fields prevents pg from doing its own (broken) parsing.
function buildPoolConfig(databaseUrl: string): pg.PoolConfig {
  const url = new URL(databaseUrl);
  const isSupabase = databaseUrl.includes('supabase');
  const isServerless = process.env.VERCEL === "1" || process.env.VERCEL === "true";
  const maxConnections = Number.parseInt(
    process.env.DATABASE_POOL_MAX || (isServerless ? "1" : "10"),
    10,
  );

  return {
    host: url.hostname,
    port: parseInt(url.port, 10) || 5432,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ''),
    max: Number.isFinite(maxConnections) && maxConnections > 0 ? maxConnections : 1,
    idleTimeoutMillis: isServerless ? 5000 : 30000,
    connectionTimeoutMillis: 10000,
    allowExitOnIdle: isServerless,
    maxLifetimeSeconds: isServerless ? 60 : 0,
    keepAlive: true,
    keepAliveInitialDelayMillis: 0,
    ssl: isSupabase ? { rejectUnauthorized: false } : undefined,
  };
}

export const pool = new Pool(buildPoolConfig(process.env.DATABASE_URL));
export const db = drizzle(pool, { schema });
