import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function runAudit() {
  const client = await pool.connect();
  console.log("=== 1. DB SCHEMA & CONSTRAINTS AUDIT ===");
  try {
    const constraintsRes = await client.query(`
      SELECT conname, pg_get_constraintdef(c.oid) AS def
      FROM pg_constraint c
      JOIN pg_namespace n ON n.oid = c.connamespace
      WHERE n.nspname = 'public' AND conrelid::regclass::text IN ('ledger_entries', 'customer_balances', 'customers');
    `);
    console.log("CONSTRAINTS FOUND:");
    constraintsRes.rows.forEach(r => console.log(` - ${r.conname}: ${r.def}`));

    const indexesRes = await client.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public' AND tablename IN ('ledger_entries', 'customer_balances', 'customers');
    `);
    console.log("\nINDEXES FOUND:");
    indexesRes.rows.forEach(r => console.log(` - ${r.indexname}: ${r.indexdef}`));

    console.log("\n=== 2. PREFLIGHT VIOLATIONS AUDIT ===");
    
    // Non-positive ledger amounts
    const nonPosRes = await client.query(`SELECT COUNT(*)::text as cnt FROM public.ledger_entries WHERE amount <= 0`);
    console.log("non_positive_amount_count:", nonPosRes.rows[0].cnt);

    // Invalid currencies
    const invCurrRes = await client.query(`SELECT COUNT(*)::text as cnt FROM public.ledger_entries WHERE currency NOT IN ('IQD', 'USD')`);
    console.log("invalid_currency_count:", invCurrRes.rows[0].cnt);

    // Invalid entry types
    const invTypeRes = await client.query(`SELECT COUNT(*)::text as cnt FROM public.ledger_entries WHERE entry_type NOT IN ('DEBT_ADD', 'OPENING_BALANCE', 'PAYMENT_RECEIVE', 'FORGIVENESS', 'ADJUSTMENT_DEBIT', 'ADJUSTMENT_CREDIT', 'REVERSAL')`);
    console.log("invalid_entry_type_count:", invTypeRes.rows[0].cnt);

    // Fractional IQD
    const fracIqdRes = await client.query(`SELECT COUNT(*)::text as cnt FROM public.ledger_entries WHERE currency = 'IQD' AND (amount != trunc(amount))`);
    console.log("fractional_iqd_count:", fracIqdRes.rows[0].cnt);

    // USD amounts exceeding 2 decimals
    const usdPrecRes = await client.query(`SELECT COUNT(*)::text as cnt FROM public.ledger_entries WHERE currency = 'USD' AND (scale(amount) > 2)`);
    console.log("invalid_usd_precision_count:", usdPrecRes.rows[0].cnt);

    // Duplicate idempotency keys
    const dupIdemRes = await client.query(`SELECT COUNT(*)::text as cnt FROM (SELECT market_id, idempotency_key FROM public.ledger_entries WHERE idempotency_key IS NOT NULL GROUP BY market_id, idempotency_key HAVING COUNT(*) > 1) t`);
    console.log("duplicate_idempotency_count:", dupIdemRes.rows[0].cnt);

    // Duplicate reversal targets
    const dupRevRes = await client.query(`SELECT COUNT(*)::text as cnt FROM (SELECT reversal_of_entry_id FROM public.ledger_entries WHERE entry_type = 'REVERSAL' AND reversal_of_entry_id IS NOT NULL GROUP BY reversal_of_entry_id HAVING COUNT(*) > 1) t`);
    console.log("duplicate_reversal_target_count:", dupRevRes.rows[0].cnt);

    // Orphan reversal references
    const orphanRevRes = await client.query(`SELECT COUNT(*)::text as cnt FROM public.ledger_entries l WHERE l.entry_type = 'REVERSAL' AND l.reversal_of_entry_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.ledger_entries orig WHERE orig.id = l.reversal_of_entry_id)`);
    console.log("orphan_reversal_count:", orphanRevRes.rows[0].cnt);

    // Orphan ledger customers
    const orphanCustRes = await client.query(`SELECT COUNT(*)::text as cnt FROM public.ledger_entries l WHERE NOT EXISTS (SELECT 1 FROM public.customers c WHERE c.id = l.customer_id)`);
    console.log("orphan_ledger_customers_count:", orphanCustRes.rows[0].cnt);

    // Orphan ledger markets
    const orphanMktRes = await client.query(`SELECT COUNT(*)::text as cnt FROM public.ledger_entries l WHERE NOT EXISTS (SELECT 1 FROM public.markets m WHERE m.id = l.market_id)`);
    console.log("orphan_ledger_markets_count:", orphanMktRes.rows[0].cnt);

    // Duplicate customer balance dimensions
    const dupBalRes = await client.query(`SELECT COUNT(*)::text as cnt FROM (SELECT market_id, customer_id, currency FROM public.customer_balances GROUP BY market_id, customer_id, currency HAVING COUNT(*) > 1) t`);
    console.log("duplicate_customer_balance_dimensions_count:", dupBalRes.rows[0].cnt);

  } catch (err) {
    console.error("Audit error:", err);
  } finally {
    client.release();
    await pool.end();
  }
}

runAudit();
