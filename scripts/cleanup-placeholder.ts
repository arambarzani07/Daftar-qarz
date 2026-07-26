import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Remove placeholder platform access
    await client.query("DELETE FROM public.platform_access WHERE user_id = 'usr-11111111'");
    // Remove placeholder user
    await client.query("DELETE FROM public.users WHERE id = 'usr-11111111'");
    await client.query('COMMIT');
    console.log('Placeholder test owner removed successfully.');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Error removing placeholder:', e);
  } finally {
    client.release();
    await pool.end();
  }
}
run();
