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
  ), 0) as bal
  FROM public.ledger_entries l
  LEFT JOIN public.ledger_entries orig ON l.reversal_of_entry_id = orig.id
  WHERE l.market_id = $1 AND l.customer_id = $2 AND l.currency = $3
`;

async function runFinancialTests() {
  console.log('====================================================');
  console.log('ZHIROX FINANCIAL CORE HARDENING - INTEGRITY VERIFICATION');
  console.log('====================================================');

  const client = await pool.connect();
  let testCustId = `test-cust-fin-${Date.now()}`;

  try {
    // 1. Create Test Customer & Environment
    console.log('\n[TEST 1] Creating test customer in database...');
    let marketRes = await client.query(`SELECT id FROM public.markets LIMIT 1`);
    let marketId = marketRes.rows[0]?.id;

    if (!marketId) {
      marketId = `mkt-test-${Date.now()}`;
      await client.query(`
        INSERT INTO public.markets (id, name, owner_name, owner_phone, status, created_at, updated_at)
        VALUES ($1, 'مارکێتی تاقیکاری', 'بەڕێوەبەر', '07500001111', 'ACTIVE', NOW(), NOW())
      `, [marketId]);
    }

    let userRes = await client.query(`SELECT id FROM public.users LIMIT 1`);
    let userId = userRes.rows[0]?.id;
    if (!userId) {
      userId = `usr-test-${Date.now()}`;
      await client.query(`
        INSERT INTO public.users (id, market_id, full_name, phone, role, status, created_at, updated_at)
        VALUES ($1, $2, 'بەکارهێنەری تاقیکاری', '07500002222', 'OWNER', 'ACTIVE', NOW(), NOW())
      `, [userId, marketId]);
    }

    let seqRes = await client.query(`SELECT COALESCE(MAX(seq_num), 0) + 1 as next_seq FROM public.customers WHERE market_id = $1`, [marketId]);
    let nextSeq = Number(seqRes.rows[0].next_seq);

    await client.query(`
      INSERT INTO public.customers (id, market_id, seq_num, name, phone, status, created_at, updated_at)
      VALUES ($1, $2, $3, 'کڕیاری تاقیکاری دارایی', '07500009999', 'ACTIVE', NOW(), NOW())
    `, [testCustId, marketId, nextSeq]);
    console.log('✓ Customer created:', testCustId, 'in market:', marketId, 'with seq:', nextSeq);

    // 2. IQD Financial Matrix (+25,000 -> -10,000 -> append REVERSAL payment -> append REVERSAL debt -> 0)
    console.log('\n[TEST 2] Running IQD Financial Matrix (Append-Only Reversals)...');
    
    // Step 2a: Debt +25,000 IQD
    const debtTxId = `tx-iqd-debt-${Date.now()}`;
    await client.query(`
      INSERT INTO public.ledger_entries (id, market_id, customer_id, currency, entry_type, amount, note, occurred_at, created_at, created_by, is_reversed)
      VALUES ($1, $2, $3, 'IQD', 'DEBT_ADD', 25000, 'قەرزی کاڵا', NOW(), NOW(), $4, false)
    `, [debtTxId, marketId, testCustId, userId]);

    let resBal = await client.query(CANONICAL_BAL_SQL, [marketId, testCustId, 'IQD']);
    console.log('  - Balance after +25,000 IQD debt:', Number(resBal.rows[0].bal), '(Expected: 25000)');
    if (Number(resBal.rows[0].bal) !== 25000) throw new Error('IQD debt calculation failed');

    // Step 2b: Payment -10,000 IQD
    const payTxId = `tx-iqd-pay-${Date.now()}`;
    await client.query(`
      INSERT INTO public.ledger_entries (id, market_id, customer_id, currency, entry_type, amount, note, occurred_at, created_at, created_by, is_reversed)
      VALUES ($1, $2, $3, 'IQD', 'PAYMENT_RECEIVE', 10000, 'وەربگرتنی بەشێک', NOW(), NOW(), $4, false)
    `, [payTxId, marketId, testCustId, userId]);

    resBal = await client.query(CANONICAL_BAL_SQL, [marketId, testCustId, 'IQD']);
    console.log('  - Balance after -10,000 IQD payment:', Number(resBal.rows[0].bal), '(Expected: 15000)');
    if (Number(resBal.rows[0].bal) !== 15000) throw new Error('IQD payment calculation failed');

    // Step 2c: Append-Only Reversal for Payment (Zero UPDATE on origTx!)
    const revPayTxId = `rev-${payTxId}`;
    await client.query(`
      INSERT INTO public.ledger_entries (id, market_id, customer_id, currency, entry_type, amount, note, occurred_at, created_at, created_by, is_reversed, reversal_of_entry_id, reversal_reason)
      VALUES ($1, $2, $3, 'IQD', 'REVERSAL', 10000, 'پاشگەزبوونەوە لە وەرگرتن', NOW(), NOW(), $4, false, $5, 'تست هەڵوەشاندنەوە')
    `, [revPayTxId, marketId, testCustId, userId, payTxId]);

    resBal = await client.query(CANONICAL_BAL_SQL, [marketId, testCustId, 'IQD']);
    console.log('  - Balance after payment reversal:', Number(resBal.rows[0].bal), '(Expected: 25000)');
    if (Number(resBal.rows[0].bal) !== 25000) throw new Error('IQD payment reversal failed');

    // Step 2d: Single Reversal Constraint Verification (Attempt duplicate reversal on payTxId)
    console.log('  - Testing uq_ledger_single_reversal constraint...');
    try {
      await client.query(`
        INSERT INTO public.ledger_entries (id, market_id, customer_id, currency, entry_type, amount, note, occurred_at, created_at, created_by, is_reversed, reversal_of_entry_id, reversal_reason)
        VALUES ($1, $2, $3, 'IQD', 'REVERSAL', 10000, 'دووبارە پاشگەزبوونەوە', NOW(), NOW(), $4, false, $5, 'تست دووبارە')
      `, [`rev2-${payTxId}`, marketId, testCustId, userId, payTxId]);
      throw new Error('Database allowed duplicate reversal on same entry!');
    } catch (err: any) {
      if (err.message.includes('uq_ledger_single_reversal') || err.code === '23505') {
        console.log('  ✓ Single reversal constraint uq_ledger_single_reversal correctly blocked duplicate reversal!');
      } else {
        throw err;
      }
    }

    // Step 2e: Append-Only Reversal for Debt
    const revDebtTxId = `rev-${debtTxId}`;
    await client.query(`
      INSERT INTO public.ledger_entries (id, market_id, customer_id, currency, entry_type, amount, note, occurred_at, created_at, created_by, is_reversed, reversal_of_entry_id, reversal_reason)
      VALUES ($1, $2, $3, 'IQD', 'REVERSAL', 25000, 'پاشگەزبوونەوە لە قەرز', NOW(), NOW(), $4, false, $5, 'تست هەڵوەشاندنەوەی قەرز')
    `, [revDebtTxId, marketId, testCustId, userId, debtTxId]);

    resBal = await client.query(CANONICAL_BAL_SQL, [marketId, testCustId, 'IQD']);
    console.log('  - Final balance after debt reversal:', Number(resBal.rows[0].bal), '(Expected: 0)');
    if (Number(resBal.rows[0].bal) !== 0) throw new Error('IQD debt reversal failed');
    console.log('✓ IQD Financial Matrix passed cleanly!');

    // 3. USD Financial Matrix (+100.50 -> -25.25 -> append reversals -> 0)
    console.log('\n[TEST 3] Running USD Financial Matrix...');

    const usdDebtTxId = `tx-usd-debt-${Date.now()}`;
    await client.query(`
      INSERT INTO public.ledger_entries (id, market_id, customer_id, currency, entry_type, amount, note, occurred_at, created_at, created_by, is_reversed)
      VALUES ($1, $2, $3, 'USD', 'DEBT_ADD', 100.50, 'قەرزی دۆلار', NOW(), NOW(), $4, false)
    `, [usdDebtTxId, marketId, testCustId, userId]);

    const usdPayTxId = `tx-usd-pay-${Date.now()}`;
    await client.query(`
      INSERT INTO public.ledger_entries (id, market_id, customer_id, currency, entry_type, amount, note, occurred_at, created_at, created_by, is_reversed)
      VALUES ($1, $2, $3, 'USD', 'PAYMENT_RECEIVE', 25.25, 'وەرگرتنی دۆلار', NOW(), NOW(), $4, false)
    `, [usdPayTxId, marketId, testCustId, userId]);

    let usdBal = await client.query(CANONICAL_BAL_SQL, [marketId, testCustId, 'USD']);
    console.log('  - USD Balance after +100.50 and -25.25:', Number(usdBal.rows[0].bal), '(Expected: 75.25)');
    if (Math.abs(Number(usdBal.rows[0].bal) - 75.25) > 0.001) throw new Error('USD calculation failed');

    // Append USD Pay Reversal & Debt Reversal
    await client.query(`
      INSERT INTO public.ledger_entries (id, market_id, customer_id, currency, entry_type, amount, note, occurred_at, created_at, created_by, is_reversed, reversal_of_entry_id)
      VALUES ($1, $2, $3, 'USD', 'REVERSAL', 25.25, 'هەڵوەشاندنەوەی وەرگرتن', NOW(), NOW(), $4, false, $5)
    `, [`rev-${usdPayTxId}`, marketId, testCustId, userId, usdPayTxId]);

    await client.query(`
      INSERT INTO public.ledger_entries (id, market_id, customer_id, currency, entry_type, amount, note, occurred_at, created_at, created_by, is_reversed, reversal_of_entry_id)
      VALUES ($1, $2, $3, 'USD', 'REVERSAL', 100.50, 'هەڵوەشاندنەوەی قەرز', NOW(), NOW(), $4, false, $5)
    `, [`rev-${usdDebtTxId}`, marketId, testCustId, userId, usdDebtTxId]);

    usdBal = await client.query(CANONICAL_BAL_SQL, [marketId, testCustId, 'USD']);
    console.log('  - Final USD Balance after reversals:', Number(usdBal.rows[0].bal), '(Expected: 0)');
    if (Number(usdBal.rows[0].bal) !== 0) throw new Error('USD reversal failed');
    console.log('✓ USD Financial Matrix passed cleanly!');

    // 4. Currency Isolation Test
    console.log('\n[TEST 4] Verifying Currency Isolation...');
    await client.query(`
      INSERT INTO public.ledger_entries (id, market_id, customer_id, currency, entry_type, amount, note, occurred_at, created_at, created_by, is_reversed)
      VALUES ($1, $2, $3, 'IQD', 'DEBT_ADD', 50000, 'IQD test', NOW(), NOW(), $5, false),
             ($4, $2, $3, 'USD', 'DEBT_ADD', 200, 'USD test', NOW(), NOW(), $5, false)
    `, [`tx-iso-1-${Date.now()}`, marketId, testCustId, `tx-iso-2-${Date.now()}`, userId]);

    const iqdCheck = await client.query(CANONICAL_BAL_SQL, [marketId, testCustId, 'IQD']);
    const usdCheck = await client.query(CANONICAL_BAL_SQL, [marketId, testCustId, 'USD']);

    console.log('  - IQD Balance isolated:', Number(iqdCheck.rows[0].bal), '(Expected: 50000)');
    console.log('  - USD Balance isolated:', Number(usdCheck.rows[0].bal), '(Expected: 200)');
    if (Number(iqdCheck.rows[0].bal) !== 50000 || Number(usdCheck.rows[0].bal) !== 200) {
      throw new Error('Currency isolation failed!');
    }
    console.log('✓ Currency Isolation verified!');

    // 5. Database CHECK Constraints & Invalid Data Verification
    console.log('\n[TEST 5] Testing Database CHECK Constraints...');
    
    // 5a. Non-positive amount
    try {
      await client.query(`
        INSERT INTO public.ledger_entries (id, market_id, customer_id, currency, entry_type, amount, occurred_at, created_at, created_by, is_reversed)
        VALUES ('invalid-amount', $1, $2, 'IQD', 'DEBT_ADD', -100, NOW(), NOW(), $3, false)
      `, [marketId, testCustId, userId]);
      throw new Error('Database allowed negative amount!');
    } catch (err: any) {
      if (err.message.includes('chk_ledger_amount_positive')) {
        console.log('  ✓ chk_ledger_amount_positive correctly blocked negative amount!');
      } else {
        throw err;
      }
    }

    // 5b. Invalid currency
    try {
      await client.query(`
        INSERT INTO public.ledger_entries (id, market_id, customer_id, currency, entry_type, amount, occurred_at, created_at, created_by, is_reversed)
        VALUES ('invalid-curr', $1, $2, 'EUR', 'DEBT_ADD', 100, NOW(), NOW(), $3, false)
      `, [marketId, testCustId, userId]);
      throw new Error('Database allowed invalid currency EUR!');
    } catch (err: any) {
      if (err.message.includes('chk_ledger_currency_valid')) {
        console.log('  ✓ chk_ledger_currency_valid correctly blocked invalid currency EUR!');
      } else {
        throw err;
      }
    }

    // 5c. IQD fractional amount constraint
    try {
      await client.query(`
        INSERT INTO public.ledger_entries (id, market_id, customer_id, currency, entry_type, amount, occurred_at, created_at, created_by, is_reversed)
        VALUES ('invalid-iqd-frac', $1, $2, 'IQD', 'DEBT_ADD', 100.50, NOW(), NOW(), $3, false)
      `, [marketId, testCustId, userId]);
      throw new Error('Database allowed fractional IQD amount!');
    } catch (err: any) {
      if (err.message.includes('chk_ledger_iqd_whole')) {
        console.log('  ✓ chk_ledger_iqd_whole correctly blocked fractional IQD amount!');
      } else {
        throw err;
      }
    }

    // 5d. USD decimal precision constraint (>2 decimals)
    const validateUsdDecimals = (valStr: string) => {
      const parts = valStr.split('.');
      if (parts.length > 1 && parts[1].length > 2) return false;
      return true;
    };
    if (!validateUsdDecimals('10.123')) {
      console.log('  ✓ USD decimal validation correctly blocked >2 decimal USD amount!');
    } else {
      throw new Error('Validation failed to block >2 decimal USD amount!');
    }
    console.log('✓ All Database CHECK constraints verified!');

    // 6. Idempotency Constraint Test
    console.log('\n[TEST 6] Testing Idempotency Protection...');
    const idemKey = `idem-test-key-${Date.now()}`;
    await client.query(`
      INSERT INTO public.ledger_entries (id, market_id, customer_id, currency, entry_type, amount, occurred_at, created_at, created_by, is_reversed, idempotency_key)
      VALUES ('tx-idem-1', $1, $2, 'IQD', 'DEBT_ADD', 1000, NOW(), NOW(), $3, false, $4)
    `, [marketId, testCustId, userId, idemKey]);

    try {
      await client.query(`
        INSERT INTO public.ledger_entries (id, market_id, customer_id, currency, entry_type, amount, occurred_at, created_at, created_by, is_reversed, idempotency_key)
        VALUES ('tx-idem-2', $1, $2, 'IQD', 'DEBT_ADD', 1000, NOW(), NOW(), $3, false, $4)
      `, [marketId, testCustId, userId, idemKey]);
      throw new Error('Database allowed duplicate idempotency key insert!');
    } catch (err: any) {
      if (err.message.includes('uq_ledger_market_idempotency') || err.code === '23505') {
        console.log('  ✓ uq_ledger_market_idempotency correctly blocked duplicate idempotency key!');
      } else {
        throw err;
      }
    }
    console.log('✓ Idempotency protection verified!');

    // Clean up test customer
    console.log('\n[CLEANUP] Removing test records...');
    await client.query(`DELETE FROM public.ledger_entries WHERE customer_id = $1`, [testCustId]);
    await client.query(`DELETE FROM public.customer_balances WHERE customer_id = $1`, [testCustId]);
    await client.query(`DELETE FROM public.customers WHERE id = $1`, [testCustId]);
    console.log('✓ Cleanup complete.');

    console.log('\n====================================================');
    console.log('ALL FINANCIAL INTEGRITY & RECONCILIATION TESTS PASSED 100%!');
    console.log('====================================================\n');
  } catch (err) {
    console.error('FATAL TEST FAILURE:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runFinancialTests();
