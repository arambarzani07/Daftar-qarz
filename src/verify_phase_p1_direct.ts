import pg from 'pg';
import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function runDirectTest() {
  const marketId = 'mkt-direct-' + Date.now();
  const customerId = 'cust-direct-' + Date.now();

  console.log('0. Inserting market...');
  await pool.query(`
    INSERT INTO public.markets (id, name, created_at)
    VALUES ($1, 'Direct Test Market', NOW())
  `, [marketId]);

  console.log('1. Inserting customer...');
  await pool.query(`
    INSERT INTO public.customers (id, market_id, seq_num, name, phone, status, created_at)
    VALUES ($1, $2, 1, 'Direct Test Customer', '07500000000', 'ACTIVE', NOW())
  `, [customerId, marketId]);

  console.log('2. Inserting credit settings (limit 1,000,000 IQD, SOFT_LIMIT)...');
  await pool.query(`
    INSERT INTO public.customer_credit_settings (id, market_id, customer_id, currency, limit_amount, limit_mode, created_at, updated_at)
    VALUES ($1, $2, $3, 'IQD', 1000000, 'SOFT_LIMIT', NOW(), NOW())
  `, ['cs-' + Date.now(), marketId, customerId]);

  console.log('3. Inserting balance (1,200,000 IQD)...');
  await pool.query(`
    INSERT INTO public.customer_balances (id, market_id, customer_id, currency, balance, updated_at)
    VALUES ($1, $2, $3, 'IQD', 1200000, NOW())
  `, ['cb-' + Date.now(), marketId, customerId]);

  console.log('4. Inserting temporary debt unlock...');
  const unlockId = 'unlock-' + Date.now();
  const userId = 'user-' + Date.now();
  await pool.query(`
    INSERT INTO public.users (id, auth_user_id, full_name, email, is_active, created_at)
    VALUES ($1, $2, 'User', 'u@test.com', true, NOW())
  `, [userId, crypto.randomUUID()]);

  await pool.query(`
    INSERT INTO public.temporary_debt_unlocks (id, customer_id, market_id, approved_by, reason, currency, scope_type, maximum_amount, status, expires_at, created_at)
    VALUES ($1, $2, $3, $4, 'Test unlock', 'IQD', 'UNTIL_TIME', 100000, 'ACTIVE', NOW() + INTERVAL '2 hours', NOW())
  `, [unlockId, customerId, marketId, userId]);

  console.log('5. Testing query inside a transaction client...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN;');
    const uRes = await client.query(`
      SELECT maximum_amount, status, expires_at FROM public.temporary_debt_unlocks 
      WHERE market_id = $1 AND customer_id = $2 AND status = 'ACTIVE' AND expires_at > NOW() 
      ORDER BY created_at DESC LIMIT 1
    `, [marketId, customerId]);
    console.log('Transaction query result rows:', uRes.rows);
    await client.query('COMMIT;');
  } catch (err) {
    await client.query('ROLLBACK;');
    throw err;
  } finally {
    client.release();
  }

  await pool.end();
}

runDirectTest().catch(console.error);
