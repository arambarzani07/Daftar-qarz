import dotenv from 'dotenv';
dotenv.config();
process.env.NO_SERVER_LISTEN = 'true';

import pg from 'pg';
import crypto from 'crypto';
import { initPostgresSchema } from '../server.js';

const pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  console.log("=== VERIFYING LEDGER IMMUTABILITY TRIGGER AT DATABASE LEVEL ===");
  await initPostgresSchema();

  const client = await pool.connect();
  const testMarketId = `mkt-immut-${Date.now()}`;
  const testCustId = `cust-immut-${Date.now()}`;
  const entryId = crypto.randomUUID();

  try {
    // 1. Insert test ledger entry
    await client.query(`
      INSERT INTO public.markets (id, name, status, created_at, updated_at)
      VALUES ($1, 'Test Market Immutability', 'ACTIVE', NOW(), NOW())
    `, [testMarketId]);

    await client.query(`
      INSERT INTO public.customers (id, market_id, seq_num, name, phone, status, created_at, updated_at)
      VALUES ($1, $2, 1, 'Immutability Customer', '07501112233', 'ACTIVE', NOW(), NOW())
    `, [testCustId, testMarketId]);

    await client.query(`
      INSERT INTO public.ledger_entries (id, market_id, customer_id, currency, entry_type, amount, note, occurred_at, created_at, created_by, is_reversed)
      VALUES ($1, $2, $3, 'IQD', 'DEBT_ADD', '50000', 'Immutability Test Entry', NOW(), NOW(), null, false)
    `, [entryId, testMarketId, testCustId]);

    console.log('[PASS] Test 1: INSERT into public.ledger_entries succeeded');

    // 2. Attempt UPDATE on ledger_entries
    let updateFailedAsExpected = false;
    try {
      await client.query(`UPDATE public.ledger_entries SET amount = '999999' WHERE id = $1`, [entryId]);
    } catch (err: any) {
      if (err.message && err.message.includes('Ledger entries are immutable')) {
        updateFailedAsExpected = true;
      } else {
        console.error('Unexpected update error:', err);
      }
    }

    if (updateFailedAsExpected) {
      console.log('[PASS] Test 2: UPDATE public.ledger_entries rejected by DB trigger');
    } else {
      console.error('[FAIL] Test 2: UPDATE public.ledger_entries was NOT rejected!');
      process.exit(1);
    }

    // 3. Attempt DELETE on ledger_entries
    let deleteFailedAsExpected = false;
    try {
      await client.query(`DELETE FROM public.ledger_entries WHERE id = $1`, [entryId]);
    } catch (err: any) {
      if (err.message && err.message.includes('Ledger entries are immutable')) {
        deleteFailedAsExpected = true;
      } else {
        console.error('Unexpected delete error:', err);
      }
    }

    if (deleteFailedAsExpected) {
      console.log('[PASS] Test 3: DELETE FROM public.ledger_entries rejected by DB trigger');
    } else {
      console.error('[FAIL] Test 3: DELETE FROM public.ledger_entries was NOT rejected!');
      process.exit(1);
    }

    console.log('\n=== LEDGER IMMUTABILITY VERIFICATION: ALL TESTS PASSED ===');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => {
  console.error('Execution error:', err);
  process.exit(1);
});
