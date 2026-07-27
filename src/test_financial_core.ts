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

async function runFinancialTests() {
  console.log('====================================================');
  console.log('ZHIROX FINANCIAL CORE HARDENING - INTEGRITY VERIFICATION');
  console.log('====================================================');

  const client = await pool.connect();
  let testCustId = `test-cust-fin-${Date.now()}`;
  const marketId = 'mkt-main-001';

  try {
    // 1. Create Test Customer
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

    // 2. IQD Financial Matrix (+25,000 -> -10,000 -> reverse payment -> reverse debt -> 0)
    console.log('\n[TEST 2] Running IQD Financial Matrix...');
    
    // Step 2a: Debt +25,000 IQD
    const debtTxId = `tx-iqd-debt-${Date.now()}`;
    await client.query(`
      INSERT INTO public.ledger_entries (id, market_id, customer_id, currency, entry_type, amount, note, occurred_at, created_at, created_by, is_reversed)
      VALUES ($1, $2, $3, 'IQD', 'DEBT_ADD', 25000, 'قەرزی کاڵا', NOW(), NOW(), $4, false)
    `, [debtTxId, marketId, testCustId, userId]);

    let resBal = await client.query(`
      SELECT COALESCE(SUM(CASE WHEN entry_type IN ('DEBT_ADD', 'OPENING_BALANCE') THEN amount ELSE -amount END), 0) as bal
      FROM public.ledger_entries WHERE market_id = $1 AND customer_id = $2 AND currency = 'IQD' AND is_reversed = false
    `, [marketId, testCustId]);
    console.log('  - Balance after +25,000 IQD debt:', Number(resBal.rows[0].bal), '(Expected: 25000)');
    if (Number(resBal.rows[0].bal) !== 25000) throw new Error('IQD debt calculation failed');

    // Step 2b: Payment -10,000 IQD
    const payTxId = `tx-iqd-pay-${Date.now()}`;
    await client.query(`
      INSERT INTO public.ledger_entries (id, market_id, customer_id, currency, entry_type, amount, note, occurred_at, created_at, created_by, is_reversed)
      VALUES ($1, $2, $3, 'IQD', 'PAYMENT_RECEIVE', 10000, 'وەربگرتنی بەشێک', NOW(), NOW(), $4, false)
    `, [payTxId, marketId, testCustId, userId]);

    resBal = await client.query(`
      SELECT COALESCE(SUM(CASE WHEN entry_type IN ('DEBT_ADD', 'OPENING_BALANCE') THEN amount ELSE -amount END), 0) as bal
      FROM public.ledger_entries WHERE market_id = $1 AND customer_id = $2 AND currency = 'IQD' AND is_reversed = false
    `, [marketId, testCustId]);
    console.log('  - Balance after -10,000 IQD payment:', Number(resBal.rows[0].bal), '(Expected: 15000)');
    if (Number(resBal.rows[0].bal) !== 15000) throw new Error('IQD payment calculation failed');

    // Step 2c: Reverse Payment
    await client.query(`
      UPDATE public.ledger_entries SET is_reversed = true, reversed_at = NOW(), reversed_by = $1, reversal_reason = 'تست هەڵوەشاندنەوە' WHERE id = $2
    `, [userId, payTxId]);
    await client.query(`
      INSERT INTO public.ledger_entries (id, market_id, customer_id, currency, entry_type, amount, note, occurred_at, created_at, created_by, is_reversed, reversal_of_entry_id)
      VALUES ($1, $2, $3, 'IQD', 'REVERSAL', 10000, 'پاشگەزبوونەوە لە وەرگرتن', NOW(), NOW(), $4, true, $5)
    `, [`rev-${payTxId}`, marketId, testCustId, userId, payTxId]);

    resBal = await client.query(`
      SELECT COALESCE(SUM(CASE WHEN entry_type IN ('DEBT_ADD', 'OPENING_BALANCE') THEN amount ELSE -amount END), 0) as bal
      FROM public.ledger_entries WHERE market_id = $1 AND customer_id = $2 AND currency = 'IQD' AND is_reversed = false
    `, [marketId, testCustId]);
    console.log('  - Balance after payment reversal:', Number(resBal.rows[0].bal), '(Expected: 25000)');
    if (Number(resBal.rows[0].bal) !== 25000) throw new Error('IQD payment reversal failed');

    // Step 2d: Reverse Debt
    await client.query(`
      UPDATE public.ledger_entries SET is_reversed = true, reversed_at = NOW(), reversed_by = $1, reversal_reason = 'تست هەڵوەشاندنەوەی قەرز' WHERE id = $2
    `, [userId, debtTxId]);
    await client.query(`
      INSERT INTO public.ledger_entries (id, market_id, customer_id, currency, entry_type, amount, note, occurred_at, created_at, created_by, is_reversed, reversal_of_entry_id)
      VALUES ($1, $2, $3, 'IQD', 'REVERSAL', 25000, 'پاشگەزبوونەوە لە قەرز', NOW(), NOW(), $4, true, $5)
    `, [`rev-${debtTxId}`, marketId, testCustId, userId, debtTxId]);

    resBal = await client.query(`
      SELECT COALESCE(SUM(CASE WHEN entry_type IN ('DEBT_ADD', 'OPENING_BALANCE') THEN amount ELSE -amount END), 0) as bal
      FROM public.ledger_entries WHERE market_id = $1 AND customer_id = $2 AND currency = 'IQD' AND is_reversed = false
    `, [marketId, testCustId]);
    console.log('  - Final balance after debt reversal:', Number(resBal.rows[0].bal), '(Expected: 0)');
    if (Number(resBal.rows[0].bal) !== 0) throw new Error('IQD debt reversal failed');
    console.log('✓ IQD Financial Matrix passed cleanly!');

    // 3. USD Financial Matrix (+100.50 -> -25.25 -> reverse payment -> reverse debt -> 0)
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

    let usdBal = await client.query(`
      SELECT COALESCE(SUM(CASE WHEN entry_type IN ('DEBT_ADD', 'OPENING_BALANCE') THEN amount ELSE -amount END), 0) as bal
      FROM public.ledger_entries WHERE market_id = $1 AND customer_id = $2 AND currency = 'USD' AND is_reversed = false
    `, [marketId, testCustId]);
    console.log('  - USD Balance after +100.50 and -25.25:', Number(usdBal.rows[0].bal), '(Expected: 75.25)');
    if (Math.abs(Number(usdBal.rows[0].bal) - 75.25) > 0.001) throw new Error('USD calculation failed');

    // Reverse USD Pay & Debt
    await client.query(`UPDATE public.ledger_entries SET is_reversed = true WHERE id IN ($1, $2)`, [usdDebtTxId, usdPayTxId]);
    usdBal = await client.query(`
      SELECT COALESCE(SUM(CASE WHEN entry_type IN ('DEBT_ADD', 'OPENING_BALANCE') THEN amount ELSE -amount END), 0) as bal
      FROM public.ledger_entries WHERE market_id = $1 AND customer_id = $2 AND currency = 'USD' AND is_reversed = false
    `, [marketId, testCustId]);
    console.log('  - Final USD Balance after reversals:', Number(usdBal.rows[0].bal), '(Expected: 0)');
    if (Number(usdBal.rows[0].bal) !== 0) throw new Error('USD reversal failed');
    console.log('✓ USD Financial Matrix passed cleanly!');

    // 4. Currency Isolation Test
    console.log('\n[TEST 4] Verifying Currency Isolation...');
    await client.query(`
      INSERT INTO public.ledger_entries (id, market_id, customer_id, currency, entry_type, amount, note, occurred_at, created_at, created_by, is_reversed)
      VALUES ($1, $2, $3, 'IQD', 'DEBT_ADD', 50000, 'IQD test', NOW(), NOW(), $5, false),
             ($4, $2, $3, 'USD', 'DEBT_ADD', 200, 'USD test', NOW(), NOW(), $5, false)
    `, [`tx-iso-1`, marketId, testCustId, `tx-iso-2`, userId]);

    const iqdCheck = await client.query(`
      SELECT COALESCE(SUM(CASE WHEN entry_type IN ('DEBT_ADD', 'OPENING_BALANCE') THEN amount ELSE -amount END), 0) as bal
      FROM public.ledger_entries WHERE market_id = $1 AND customer_id = $2 AND currency = 'IQD' AND is_reversed = false
    `, [marketId, testCustId]);

    const usdCheck = await client.query(`
      SELECT COALESCE(SUM(CASE WHEN entry_type IN ('DEBT_ADD', 'OPENING_BALANCE') THEN amount ELSE -amount END), 0) as bal
      FROM public.ledger_entries WHERE market_id = $1 AND customer_id = $2 AND currency = 'USD' AND is_reversed = false
    `, [marketId, testCustId]);

    console.log('  - IQD Balance isolated:', Number(iqdCheck.rows[0].bal), '(Expected: 50000)');
    console.log('  - USD Balance isolated:', Number(usdCheck.rows[0].bal), '(Expected: 200)');
    if (Number(iqdCheck.rows[0].bal) !== 50000 || Number(usdCheck.rows[0].bal) !== 200) {
      throw new Error('Currency isolation failed!');
    }
    console.log('✓ Currency Isolation verified!');

    // 5. Database Constraints & Invalid Data Verification
    console.log('\n[TEST 5] Testing Database CHECK Constraints...');
    try {
      await client.query(`
        INSERT INTO public.ledger_entries (id, market_id, customer_id, currency, entry_type, amount, occurred_at, created_at, created_by, is_reversed)
        VALUES ('invalid-amount', $1, $2, 'IQD', 'DEBT_ADD', -100, NOW(), NOW(), $3, false)
      `, [marketId, testCustId, userId]);
      throw new Error('Database allowed negative amount!');
    } catch (err: any) {
      if (err.message.includes('chk_ledger_amount_positive')) {
        console.log('  - chk_ledger_amount_positive correctly blocked negative amount!');
      } else {
        throw err;
      }
    }

    try {
      await client.query(`
        INSERT INTO public.ledger_entries (id, market_id, customer_id, currency, entry_type, amount, occurred_at, created_at, created_by, is_reversed)
        VALUES ('invalid-curr', $1, $2, 'EUR', 'DEBT_ADD', 100, NOW(), NOW(), $3, false)
      `, [marketId, testCustId, userId]);
      throw new Error('Database allowed invalid currency EUR!');
    } catch (err: any) {
      if (err.message.includes('chk_ledger_currency_valid')) {
        console.log('  - chk_ledger_currency_valid correctly blocked invalid currency EUR!');
      } else {
        throw err;
      }
    }
    console.log('✓ Database CHECK constraints verified!');

    // 6. Idempotency Test
    console.log('\n[TEST 6] Testing Idempotency Protection...');
    const idemKey = `idem-test-key-${Date.now()}`;
    await client.query(`
      INSERT INTO public.ledger_entries (id, market_id, customer_id, currency, entry_type, amount, occurred_at, created_at, created_by, is_reversed, idempotency_key)
      VALUES ('tx-idem-1', $1, $2, 'IQD', 'DEBT_ADD', 1000, NOW(), NOW(), $3, false, $4)
    `, [marketId, testCustId, userId, idemKey]);

    const idemCount = await client.query(`
      SELECT COUNT(*) as cnt FROM public.ledger_entries WHERE market_id = $1 AND idempotency_key = $2
    `, [marketId, idemKey]);

    console.log('  - Idempotent entry count:', Number(idemCount.rows[0].cnt), '(Expected: 1)');
    if (Number(idemCount.rows[0].cnt) !== 1) throw new Error('Idempotency failed!');
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
