import pg from 'pg';
import fs from 'fs';
import path from 'path';
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

async function applyMigration() {
  const client = await pool.connect();
  try {
    const sql = fs.readFileSync(path.join(process.cwd(), 'src/db/migrations/0010_financial_core_hardening.sql'), 'utf-8');
    
    console.log('Applying Migration 0010 atomically...');
    await client.query('BEGIN;');
    await client.query(sql);
    await client.query('COMMIT;');
    console.log('✓ Migration 0010 applied successfully!');

    // Post-migration verification
    console.log('\n=== POST-MIGRATION OBJECT VERIFICATION ===');
    const constraintsRes = await client.query(`
      SELECT conname, contype, pg_get_constraintdef(oid) as def
      FROM pg_constraint
      WHERE conrelid IN ('public.ledger_entries'::regclass, 'public.customer_balances'::regclass);
    `);
    console.log('Constraints:', constraintsRes.rows);

    const indexesRes = await client.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'ledger_entries' AND indexname IN ('uq_ledger_market_idempotency', 'uq_ledger_single_reversal');
    `);
    console.log('Indexes:', indexesRes.rows);

  } catch (err) {
    await client.query('ROLLBACK;');
    console.error('Migration 0010 failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

applyMigration();
