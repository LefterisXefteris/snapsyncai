import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
  const result = await pool.query('SELECT id, title, price, "compare_at_price" FROM images LIMIT 1');
  console.log("DB row:", result.rows);
  process.exit(0);
}
check();
