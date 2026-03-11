import { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

async function check() {
  const queryClient = postgres(process.env.DATABASE_URL);
  const result = await queryClient`SELECT id, title, price, "cost_per_item" FROM images LIMIT 1`;
  console.log("DB row:", result);
  process.exit(0);
}
check();
