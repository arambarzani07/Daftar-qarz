import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;

if (!connectionString) {
  console.error('CRITICAL: POSTGRES_URL environment variable is missing.');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function checkColumns() {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'ledger_entries';
    `);
    console.log('ledger_entries columns:', res.rows);
  } finally {
    client.release();
    await pool.end();
  }
}

checkColumns();
