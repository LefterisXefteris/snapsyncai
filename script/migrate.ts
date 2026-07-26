import "dotenv/config";
import dotenv from "dotenv";
import { readdir, readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import pg from "pg";

dotenv.config({ path: ".env.local", override: true });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const migrationDirectory = resolve("migrations");
const migrationFiles = (await readdir(migrationDirectory))
  .filter((name) => /^\d+_.+\.sql$/.test(name))
  .sort()
  .map((name) => resolve(migrationDirectory, name));

const client = new pg.Client({
  connectionString: databaseUrl,
  ssl: databaseUrl.includes("supabase") ? { rejectUnauthorized: false } : undefined,
});

await client.connect();
try {
  await client.query(`
    CREATE TABLE IF NOT EXISTS app_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  for (const file of migrationFiles) {
    const name = basename(file);
    const existing = await client.query("SELECT 1 FROM app_migrations WHERE name = $1", [name]);
    if (existing.rowCount) continue;

    const sql = await readFile(file, "utf8");
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query("INSERT INTO app_migrations(name) VALUES ($1)", [name]);
      await client.query("COMMIT");
      console.log(`Applied ${name}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }
} finally {
  await client.end();
}
