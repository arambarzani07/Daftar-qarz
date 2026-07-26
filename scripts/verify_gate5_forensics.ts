import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

async function runGate5Forensics() {
  const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

  console.log('=== GATE 5: COMPLETE DEMO-CUSTOMER DEPENDENCY FORENSICS & FK ANALYSIS ===\n');

  const targetCustId = 'cust-mrx3a7x4-demo';
  const targetCalId = 'cal-test-1';

  const tables = [
    { name: 'customer_auth_links', col: 'customer_id' },
    { name: 'ledger_entries', col: 'customer_id' },
    { name: 'customer_balances', col: 'customer_id' },
    { name: 'customer_credit_settings', col: 'customer_id' },
    { name: 'customer_debt_controls', col: 'customer_id' },
    { name: 'temporary_debt_unlocks', col: 'customer_id' },
    { name: 'approval_requests', col: 'customer_id' },
    { name: 'payment_promises', col: 'customer_id' },
    { name: 'customer_reminders', col: 'customer_id' },
    { name: 'customer_disputes', col: 'customer_id' },
    { name: 'customer_attachments', col: 'customer_id' },
    { name: 'audit_logs', col: 'customer_id' },
    { name: 'protection_alerts', col: 'customer_id' }
  ];

  console.log('--- 1. SCANNING ALL TABLES FOR REMOVED DEMO CUSTOMER ---');
  let totalMatches = 0;
  for (const t of tables) {
    try {
      const res = await pool.query(`SELECT COUNT(*) FROM public.${t.name} WHERE ${t.col} = $1 OR id = $1 OR id = $2`, [targetCustId, targetCalId]);
      const cnt = parseInt(res.rows[0].count);
      totalMatches += cnt;
      console.log(`Table public.${t.name}: ${cnt} rows found for target ID`);
    } catch (err: any) {
      console.log(`Table public.${t.name}: [Column missing or skipped] (${err.message})`);
    }
  }

  console.log(`\nTOTAL REMOVED TARGET MATCHES IN SCHEMA: ${totalMatches}`);

  console.log('\n--- 2. FOREIGN KEY RESTRICT CASACDE VERIFICATION ---');
  const fkRes = await pool.query(`
    SELECT
      tc.table_name, 
      kcu.column_name, 
      ccu.table_name AS foreign_table_name,
      rc.delete_rule
    FROM 
      information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      JOIN information_schema.referential_constraints AS rc
        ON rc.constraint_name = tc.constraint_name
    WHERE ccu.table_name = 'customers'
    GROUP BY tc.table_name, kcu.column_name, ccu.table_name, rc.delete_rule
    ORDER BY tc.table_name;
  `);

  console.table(fkRes.rows);

  console.log('\n--- 3. ISOLATED DELETION PROTECTION TEST ---');
  // Create a test customer with a ledger entry in a transaction to prove RESTRICT blocks deletion
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Seed test customer
    await client.query(`
      INSERT INTO public.customers (id, market_id, seq_num, name, phone, status, created_at, updated_at)
      VALUES ('cust-test-restrict', 'market-mrx3a7x4', 999, 'Test Restrict Customer', '07500001122', 'ACTIVE', NOW(), NOW())
    `);

    // Seed linked ledger entry
    await client.query(`
      INSERT INTO public.ledger_entries (id, market_id, customer_id, seq_num, entry_type, amount, currency, created_by, created_at, occurred_at)
      VALUES ('leg-test-restrict', 'market-mrx3a7x4', 'cust-test-restrict', 1, 'DEBT_ADD', 1000, 'IQD', 'usr-mrx3a7x4', NOW(), NOW())
    `);

    let deleteBlocked = false;
    try {
      await client.query("DELETE FROM public.customers WHERE id = 'cust-test-restrict'");
    } catch (delErr: any) {
      deleteBlocked = delErr.code === '23503'; // foreign_key_violation
      console.log(`Deletion of customer with ledger entry blocked as expected: Code ${delErr.code} (${delErr.message})`);
    }

    await client.query('ROLLBACK');
    console.log(`RESTRICT PROTECTION TEST PASSED: ${deleteBlocked ? 'YES (Database denied deletion)' : 'NO'}`);
  } finally {
    client.release();
  }

  console.log('\n--- 4. FINAL SCHEMA-WIDE ORPHAN SCAN ---');
  const orphanChecks = [
    { name: 'customer_auth_links', query: `SELECT COUNT(*) FROM public.customer_auth_links cal LEFT JOIN public.customers c ON c.id = cal.customer_id AND c.market_id = cal.market_id WHERE c.id IS NULL` },
    { name: 'customer_balances', query: `SELECT COUNT(*) FROM public.customer_balances cb LEFT JOIN public.customers c ON c.id = cb.customer_id AND c.market_id = cb.market_id WHERE c.id IS NULL` },
    { name: 'customer_credit_settings', query: `SELECT COUNT(*) FROM public.customer_credit_settings ccs LEFT JOIN public.customers c ON c.id = ccs.customer_id AND c.market_id = ccs.market_id WHERE c.id IS NULL` },
    { name: 'customer_debt_controls', query: `SELECT COUNT(*) FROM public.customer_debt_controls cdc LEFT JOIN public.customers c ON c.id = cdc.customer_id AND c.market_id = cdc.market_id WHERE c.id IS NULL` },
    { name: 'temporary_debt_unlocks', query: `SELECT COUNT(*) FROM public.temporary_debt_unlocks tdu LEFT JOIN public.customers c ON c.id = tdu.customer_id AND c.market_id = tdu.market_id WHERE c.id IS NULL` },
    { name: 'approval_requests', query: `SELECT COUNT(*) FROM public.approval_requests ar LEFT JOIN public.customers c ON c.id = ar.customer_id AND c.market_id = ar.market_id WHERE ar.customer_id IS NOT NULL AND c.id IS NULL` },
    { name: 'payment_promises', query: `SELECT COUNT(*) FROM public.payment_promises pp LEFT JOIN public.customers c ON c.id = pp.customer_id AND c.market_id = pp.market_id WHERE c.id IS NULL` },
    { name: 'customer_reminders', query: `SELECT COUNT(*) FROM public.customer_reminders cr LEFT JOIN public.customers c ON c.id = cr.customer_id AND c.market_id = cr.market_id WHERE c.id IS NULL` },
    { name: 'customer_disputes', query: `SELECT COUNT(*) FROM public.customer_disputes cd LEFT JOIN public.customers c ON c.id = cd.customer_id AND c.market_id = cd.market_id WHERE c.id IS NULL` },
    { name: 'customer_attachments', query: `SELECT COUNT(*) FROM public.customer_attachments ca LEFT JOIN public.customers c ON c.id = ca.customer_id AND c.market_id = ca.market_id WHERE c.id IS NULL` },
    { name: 'ledger_entries', query: `SELECT COUNT(*) FROM public.ledger_entries le LEFT JOIN public.customers c ON c.id = le.customer_id AND c.market_id = le.market_id WHERE le.customer_id IS NOT NULL AND c.id IS NULL` }
  ];

  let totalOrphans = 0;
  for (const check of orphanChecks) {
    const res = await pool.query(check.query);
    const cnt = parseInt(res.rows[0].count);
    totalOrphans += cnt;
    console.log(`Orphans in ${check.name}: ${cnt}`);
  }

  console.log(`\nTOTAL ORPHANS IN SCHEMA: ${totalOrphans}`);

  await pool.end();
}

runGate5Forensics().catch(console.error);
