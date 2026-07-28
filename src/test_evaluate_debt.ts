import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

// Let's import or replicate evaluateDebtOperation logic or test pool query
async function runTest() {
  const marketId = 'mkt-p1-e2e-test';
  const customerId = 'cust-p1-e2e-test';

  await pool.query('INSERT INTO public.markets (id, name, created_at) VALUES ($1, $2, NOW()) ON CONFLICT (id) DO NOTHING', [marketId, 'Test Market']);
  await pool.query('INSERT INTO public.customers (id, market_id, seq_num, name, status, created_at) VALUES ($1, $2, 1, $3, $4, NOW()) ON CONFLICT (id) DO NOTHING', [customerId, marketId, 'Test Cust', 'ACTIVE']);

  try {
    const uRes = await pool.query(
      `SELECT maximum_amount FROM public.temporary_debt_unlocks 
       WHERE market_id = $1 AND customer_id = $2 AND status = 'ACTIVE' AND expires_at > NOW() 
       ORDER BY created_at DESC LIMIT 1`,
      [marketId, customerId]
    );
    console.log('Temp unlock success:', uRes.rows);
  } catch (err: any) {
    console.error('Temp unlock failed:', err.message, err.stack);
  }

  await pool.end();
}

runTest();
