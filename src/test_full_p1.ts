import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function runInProcessTest() {
  const marketId = `mkt-direct-${Date.now()}`;
  const customerId = `cust-direct-${Date.now()}`;

  await pool.query('INSERT INTO public.markets (id, name, created_at) VALUES ($1, $2, NOW())', [marketId, 'Direct Market']);
  await pool.query('INSERT INTO public.customers (id, market_id, seq_num, name, status, created_at) VALUES ($1, $2, 1, $3, $4, NOW())', [customerId, marketId, 'Direct Cust', 'ACTIVE']);

  // Test the temporary debt unlock query directly with pool
  try {
    const uRes = await pool.query(
      `SELECT maximum_amount FROM public.temporary_debt_unlocks 
       WHERE market_id = $1 AND customer_id = $2 AND status = 'ACTIVE' AND expires_at > NOW() 
       ORDER BY created_at DESC LIMIT 1`,
      [marketId, customerId]
    );
    console.log('Direct query success:', uRes.rows);
  } catch (err: any) {
    console.error('Direct query error:', err.message, err.code, err.detail, err.hint, err.stack);
  }

  await pool.end();
}

runInProcessTest();
