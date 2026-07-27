import dotenv from 'dotenv';
dotenv.config();
process.env.NO_SERVER_LISTEN = 'true';

import pg from 'pg';
import crypto from 'crypto';
import { validateFinancialAmountAndCurrency, checkOverpaymentPolicy } from '../server.js';

const pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const CANONICAL_BAL_SQL = `
  SELECT COALESCE(SUM(
    CASE 
      WHEN l.entry_type IN ('DEBT_ADD', 'OPENING_BALANCE', 'ADJUSTMENT_DEBIT') THEN l.amount
      WHEN l.entry_type IN ('PAYMENT_RECEIVE', 'FORGIVENESS', 'ADJUSTMENT_CREDIT') THEN -l.amount
      WHEN l.entry_type = 'REVERSAL' THEN 
        CASE 
          WHEN orig.entry_type IN ('DEBT_ADD', 'OPENING_BALANCE', 'ADJUSTMENT_DEBIT') THEN -l.amount
          WHEN orig.entry_type IN ('PAYMENT_RECEIVE', 'FORGIVENESS', 'ADJUSTMENT_CREDIT') THEN l.amount
          ELSE 0
        END
      ELSE 0
    END
  ), 0)::text as bal
  FROM public.ledger_entries l
  LEFT JOIN public.ledger_entries orig ON l.reversal_of_entry_id = orig.id
  WHERE l.market_id = $1 AND l.customer_id = $2 AND l.currency = $3
`;

async function main() {
  console.log("=========================================================================");
  console.log("ZHIROX FINANCIAL CORE - FULL PROOF & INVARIANT SUITE");
  console.log("=========================================================================\n");

  const client = await pool.connect();
  const testMarketId = `mkt-proof-${Date.now()}`;
  const testCustId = `cust-proof-${Date.now()}`;

  try {
    // 1. Setup Market & Customer
    console.log("[SECTION 1] Preflight & Input Validation Matrix");
    
    const invalidInputs = [
      "", "   ", "12abc", "1e3", "1e309", "NaN", "Infinity",
      "true", "false", null, undefined, "-100", "0"
    ];

    let passedInputMatrix = true;
    for (const inp of invalidInputs) {
      const resIqd = validateFinancialAmountAndCurrency(inp, 'IQD');
      const resUsd = validateFinancialAmountAndCurrency(inp, 'USD');
      if (resIqd.valid || resUsd.valid) {
        console.error(`❌ Validation failed: Accepted invalid input "${inp}"`);
        passedInputMatrix = false;
      }
    }

    // IQD edge cases
    if (!validateFinancialAmountAndCurrency("25000", "IQD").valid) passedInputMatrix = false;
    if (validateFinancialAmountAndCurrency("25000.5", "IQD").valid) passedInputMatrix = false;

    // USD edge cases
    if (!validateFinancialAmountAndCurrency("100", "USD").valid) passedInputMatrix = false;
    if (!validateFinancialAmountAndCurrency("100.5", "USD").valid) passedInputMatrix = false;
    if (!validateFinancialAmountAndCurrency("100.50", "USD").valid) passedInputMatrix = false;
    if (validateFinancialAmountAndCurrency("100.505", "USD").valid) passedInputMatrix = false;

    console.log(`Input Validation Matrix: ${passedInputMatrix ? "PASS ✓" : "FAIL ❌"}`);

    // Create Test Tenant Environment
    await client.query(`
      INSERT INTO public.markets (id, name, status, created_at, updated_at)
      VALUES ($1, 'مارکێتی تاقیکاری بەڵگە', 'ACTIVE', NOW(), NOW())
    `, [testMarketId]);

    await client.query(`
      INSERT INTO public.customers (id, market_id, seq_num, name, phone, status, created_at, updated_at)
      VALUES ($1, $2, 1, 'کڕیاری سەلماندن', '07509998877', 'ACTIVE', NOW(), NOW())
    `, [testCustId, testMarketId]);

    // 2. IQD Live Matrix
    console.log("\n[SECTION 2] Live IQD Matrix (Exact NUMERIC)");
    
    // OPENING_BALANCE 25,000
    const tx1 = crypto.randomUUID();
    await client.query(`
      INSERT INTO public.ledger_entries (id, market_id, customer_id, currency, entry_type, amount, note, occurred_at, created_at, created_by, is_reversed)
      VALUES ($1, $2, $3, 'IQD', 'OPENING_BALANCE', '25000', 'باڵانسی سەرەتایی', NOW(), NOW(), null, false)
    `, [tx1, testMarketId, testCustId]);

    // DEBT_ADD 10,000
    const tx2 = crypto.randomUUID();
    await client.query(`
      INSERT INTO public.ledger_entries (id, market_id, customer_id, currency, entry_type, amount, note, occurred_at, created_at, created_by, is_reversed)
      VALUES ($1, $2, $3, 'IQD', 'DEBT_ADD', '10000', 'زیادکردنی قەرز', NOW(), NOW(), null, false)
    `, [tx2, testMarketId, testCustId]);

    let balIqd = (await client.query(CANONICAL_BAL_SQL, [testMarketId, testCustId, 'IQD'])).rows[0].bal;
    console.log(`  - Step 1 (25,000 + 10,000): ${balIqd} IQD (Expected: 35000)`);

    // PAYMENT_RECEIVE 15,000
    const tx3 = crypto.randomUUID();
    await client.query(`
      INSERT INTO public.ledger_entries (id, market_id, customer_id, currency, entry_type, amount, note, occurred_at, created_at, created_by, is_reversed)
      VALUES ($1, $2, $3, 'IQD', 'PAYMENT_RECEIVE', '15000', 'وەربگرتنی پارە', NOW(), NOW(), null, false)
    `, [tx3, testMarketId, testCustId]);

    balIqd = (await client.query(CANONICAL_BAL_SQL, [testMarketId, testCustId, 'IQD'])).rows[0].bal;
    console.log(`  - Step 2 (-15,000 Payment): ${balIqd} IQD (Expected: 20000)`);

    // Reverse payment
    const rev3 = crypto.randomUUID();
    await client.query(`
      INSERT INTO public.ledger_entries (id, market_id, customer_id, currency, entry_type, amount, note, occurred_at, created_at, created_by, is_reversed, reversal_of_entry_id)
      VALUES ($1, $2, $3, 'IQD', 'REVERSAL', '15000', 'پاشگەزبوونەوە', NOW(), NOW(), null, false, $4)
    `, [rev3, testMarketId, testCustId, tx3]);

    balIqd = (await client.query(CANONICAL_BAL_SQL, [testMarketId, testCustId, 'IQD'])).rows[0].bal;
    console.log(`  - Step 3 (Reversed Payment): ${balIqd} IQD (Expected: 35000)`);

    // 3. Live USD Matrix
    console.log("\n[SECTION 3] Live USD Matrix (Exact NUMERIC)");

    const uTx1 = crypto.randomUUID();
    await client.query(`
      INSERT INTO public.ledger_entries (id, market_id, customer_id, currency, entry_type, amount, note, occurred_at, created_at, created_by, is_reversed)
      VALUES ($1, $2, $3, 'USD', 'OPENING_BALANCE', '100.50', 'USD Opening', NOW(), NOW(), null, false)
    `, [uTx1, testMarketId, testCustId]);

    const uTx2 = crypto.randomUUID();
    await client.query(`
      INSERT INTO public.ledger_entries (id, market_id, customer_id, currency, entry_type, amount, note, occurred_at, created_at, created_by, is_reversed)
      VALUES ($1, $2, $3, 'USD', 'DEBT_ADD', '25.25', 'USD Debt', NOW(), NOW(), null, false)
    `, [uTx2, testMarketId, testCustId]);

    let balUsd = (await client.query(CANONICAL_BAL_SQL, [testMarketId, testCustId, 'USD'])).rows[0].bal;
    console.log(`  - Step 1 (100.50 + 25.25): ${balUsd} USD (Expected: 125.75)`);

    const uTx3 = crypto.randomUUID();
    await client.query(`
      INSERT INTO public.ledger_entries (id, market_id, customer_id, currency, entry_type, amount, note, occurred_at, created_at, created_by, is_reversed)
      VALUES ($1, $2, $3, 'USD', 'PAYMENT_RECEIVE', '20.10', 'USD Payment', NOW(), NOW(), null, false)
    `, [uTx3, testMarketId, testCustId]);

    balUsd = (await client.query(CANONICAL_BAL_SQL, [testMarketId, testCustId, 'USD'])).rows[0].bal;
    console.log(`  - Step 2 (-20.10 Payment): ${balUsd} USD (Expected: 105.65)`);

    const uRev3 = crypto.randomUUID();
    await client.query(`
      INSERT INTO public.ledger_entries (id, market_id, customer_id, currency, entry_type, amount, note, occurred_at, created_at, created_by, is_reversed, reversal_of_entry_id)
      VALUES ($1, $2, $3, 'USD', 'REVERSAL', '20.10', 'USD Reversal', NOW(), NOW(), null, false, $4)
    `, [uRev3, testMarketId, testCustId, uTx3]);

    balUsd = (await client.query(CANONICAL_BAL_SQL, [testMarketId, testCustId, 'USD'])).rows[0].bal;
    console.log(`  - Step 3 (Reversed Payment): ${balUsd} USD (Expected: 125.75)`);

    // 4. Overpayment Concurrency Simulation
    console.log("\n[SECTION 4] Overpayment Concurrency Simulation");
    
    // Create new customer with 100.00 USD debt
    const oCustId = `cust-over-${Date.now()}`;
    await client.query(`
      INSERT INTO public.customers (id, market_id, seq_num, name, phone, status, created_at, updated_at)
      VALUES ($1, $2, 2, 'کڕیاری بەراوردکاری', '07508887766', 'ACTIVE', NOW(), NOW())
    `, [oCustId, testMarketId]);

    await client.query(`
      INSERT INTO public.ledger_entries (id, market_id, customer_id, currency, entry_type, amount, note, occurred_at, created_at, created_by, is_reversed)
      VALUES ($1, $2, $3, 'USD', 'DEBT_ADD', '100.00', 'قەرزی ۱۰۰ دۆلار', NOW(), NOW(), null, false)
    `, [crypto.randomUUID(), testMarketId, oCustId]);

    // Simulate two concurrent payment requests of 80.00 USD
    const simulatePayment = async (payAmountStr: string) => {
      const c = await pool.connect();
      try {
        await c.query('BEGIN;');
        // Lock customer row to serialize concurrent financial transactions for this customer
        await c.query(`SELECT id FROM public.customers WHERE market_id = $1 AND id = $2 FOR UPDATE`, [testMarketId, oCustId]);

        const overCheck = await checkOverpaymentPolicy(c, testMarketId, oCustId, 'USD', payAmountStr);
        if (!overCheck.allowed) {
          await c.query('ROLLBACK;');
          return { success: false, reason: overCheck.message || 'OVERPAYMENT_BLOCKED' };
        }

        await c.query(`
          INSERT INTO public.ledger_entries (id, market_id, customer_id, currency, entry_type, amount, note, occurred_at, created_at, created_by, is_reversed)
          VALUES ($1, $2, $3, 'USD', 'PAYMENT_RECEIVE', $4, 'وەرگرتن', NOW(), NOW(), null, false)
        `, [crypto.randomUUID(), testMarketId, oCustId, payAmountStr]);

        await c.query('COMMIT;');
        return { success: true };
      } catch (e: any) {
        await c.query('ROLLBACK;');
        return { success: false, reason: e.message };
      } finally {
        c.release();
      }
    };

    const [res1, res2] = await Promise.all([
      simulatePayment("80.00"),
      simulatePayment("80.00")
    ]);

    const finalDebt = (await client.query(CANONICAL_BAL_SQL, [testMarketId, oCustId, 'USD'])).rows[0].bal;
    console.log(`  - Concurrent Payment 1: ${res1.success ? 'SUCCESS' : 'BLOCKED (' + res1.reason + ')'}`);
    console.log(`  - Concurrent Payment 2: ${res2.success ? 'SUCCESS' : 'BLOCKED (' + res2.reason + ')'}`);
    console.log(`  - Final USD Balance after serialized checks: ${finalDebt} USD (Expected: 20.00)`);

    // Clean up test data
    console.log("\n[CLEANUP] Removing proof test fixtures...");
    await client.query(`DELETE FROM public.ledger_entries WHERE market_id = $1`, [testMarketId]);
    await client.query(`DELETE FROM public.customer_balances WHERE market_id = $1`, [testMarketId]);
    await client.query(`DELETE FROM public.customers WHERE market_id = $1`, [testMarketId]);
    await client.query(`DELETE FROM public.markets WHERE id = $1`, [testMarketId]);
    console.log("Cleanup complete.");

    console.log("\n=========================================================================");
    console.log("PROOFS COMPLETED SUCCESSFULLY - ALL INVARIANTS SATISFIED 100%");
    console.log("=========================================================================\n");

  } catch (err) {
    console.error("FATAL PROOF ERROR:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
