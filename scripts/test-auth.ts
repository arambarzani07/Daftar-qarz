import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const client = await pool.connect();
  try {
    const res = await client.query("SELECT * FROM public.platform_access WHERE user_id = 'usr-11111111'");
    console.log('Platform access for usr-11111111:', res.rows);
  } finally {
    client.release();
    await pool.end();
  }
}
run();
