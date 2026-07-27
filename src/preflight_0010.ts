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

async function runPreflight() {
  const client = await pool.connect();
  try {
    console.log('=== PREFLIGHT VIOLATION CHECKS ===');

    // 1. Non-positive amounts
    const nonPosRes = await client.query(`
      SELECT COUNT(*) as count FROM public.ledger_entries WHERE amount <= 0
    `);
    const nonPositiveCount = Number(nonPosRes.rows[0].count);

    // 2. Invalid currencies
    const invCurrRes = await client.query(`
      SELECT COUNT(*) as count FROM public.ledger_entries WHERE currency NOT IN ('IQD', 'USD')
    `);
    const invalidCurrencyCount = Number(invCurrRes.rows[0].count);

    // 3. Invalid entry types
    const invTypeRes = await client.query(`
      SELECT COUNT(*) as count FROM public.ledger_entries WHERE entry_type NOT IN ('DEBT_ADD', 'PAYMENT_RECEIVE', 'OPENING_BALANCE', 'FORGIVENESS', 'REVERSAL', 'ADJUSTMENT_DEBIT', 'ADJUSTMENT_CREDIT', 'ADJUSTMENT')
    `);
    const invalidEntryTypeCount = Number(invTypeRes.rows[0].count);

    // 4. Fractional IQD amounts
    const fracIqdRes = await client.query(`
      SELECT COUNT(*) as count FROM public.ledger_entries WHERE currency = 'IQD' AND amount != TRUNC(amount)
    `);
    const fractionalIqdCount = Number(fracIqdRes.rows[0].count);

    // 5. USD > 2 decimals
    const usdDecRes = await client.query(`
      SELECT COUNT(*) as count FROM public.ledger_entries WHERE currency = 'USD' AND amount != ROUND(amount, 2)
    `);
    const usdOver2DecimalsCount = Number(usdDecRes.rows[0].count);

    // 6. Duplicate idempotency keys
    const dupIdemRes = await client.query(`
      SELECT COUNT(*) as count FROM (
        SELECT market_id, idempotency_key FROM public.ledger_entries
        WHERE idempotency_key IS NOT NULL
        GROUP BY market_id, idempotency_key HAVING COUNT(*) > 1
      ) sub
    `);
    const duplicateIdempotencyKeysCount = Number(dupIdemRes.rows[0].count);

    // 7. Duplicate reversal targets
    const dupRevRes = await client.query(`
      SELECT COUNT(*) as count FROM (
        SELECT reversal_of_entry_id FROM public.ledger_entries
        WHERE reversal_of_entry_id IS NOT NULL AND entry_type = 'REVERSAL'
        GROUP BY reversal_of_entry_id HAVING COUNT(*) > 1
      ) sub
    `);
    const duplicateReversalTargetsCount = Number(dupRevRes.rows[0].count);

    // 8. Orphan reversal references
    const orphanRevRes = await client.query(`
      SELECT COUNT(*) as count FROM public.ledger_entries l
      LEFT JOIN public.ledger_entries orig ON l.reversal_of_entry_id = orig.id
      WHERE l.reversal_of_entry_id IS NOT NULL AND orig.id IS NULL
    `);
    const orphanReversalReferencesCount = Number(orphanRevRes.rows[0].count);

    // 9. Orphan customer references
    const orphanCustRes = await client.query(`
      SELECT COUNT(*) as count FROM public.ledger_entries l
      LEFT JOIN public.customers c ON l.customer_id = c.id
      WHERE c.id IS NULL
    `);
    const orphanCustomerReferencesCount = Number(orphanCustRes.rows[0].count);

    // 10. Orphan market references
    const orphanMktRes = await client.query(`
      SELECT COUNT(*) as count FROM public.ledger_entries l
      LEFT JOIN public.markets m ON l.market_id = m.id
      WHERE m.id IS NULL
    `);
    const orphanMarketReferencesCount = Number(orphanMktRes.rows[0].count);

    console.log({
      nonPositiveCount,
      invalidCurrencyCount,
      invalidEntryTypeCount,
      fractionalIqdCount,
      usdOver2DecimalsCount,
      duplicateIdempotencyKeysCount,
      duplicateReversalTargetsCount,
      orphanReversalReferencesCount,
      orphanCustomerReferencesCount,
      orphanMarketReferencesCount
    });

  } catch (err) {
    console.error('Preflight error:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

runPreflight();
