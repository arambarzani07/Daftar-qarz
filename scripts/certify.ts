import { Pool } from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

async function certify() {
  if (!DATABASE_URL) {
    console.error('ERROR: DATABASE_URL not set');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const client = await pool.connect();

  try {
    console.log('=== ZHIROX CERTIFICATION EVIDENCE COLLECTION ===');

    // 1. Tables & Count
    const tablesRes = await client.query(`
      SELECT table_schema, table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE' 
      ORDER BY table_name;
    `);
    console.log('PUBLIC TABLES:', tablesRes.rows.map(r => r.table_name));
    console.log('PUBLIC TABLE COUNT:', tablesRes.rows.length);

    // 2. Schema migrations
    const migRes = await client.query('SELECT version, applied_at FROM public.schema_migrations ORDER BY version;');
    console.log('SCHEMA MIGRATIONS:', migRes.rows);

    // 3. Column counts & Constraints
    const colRes = await client.query(`
      SELECT COUNT(*) as count FROM information_schema.columns WHERE table_schema = 'public';
    `);
    console.log('TOTAL COLUMNS:', colRes.rows[0].count);

    const pkRes = await client.query(`
      SELECT COUNT(*) as count FROM information_schema.table_constraints WHERE table_schema = 'public' AND constraint_type = 'PRIMARY KEY';
    `);
    console.log('PRIMARY KEYS:', pkRes.rows[0].count);

    const fkRes = await client.query(`
      SELECT COUNT(*) as count FROM information_schema.table_constraints WHERE table_schema = 'public' AND constraint_type = 'FOREIGN KEY';
    `);
    console.log('FOREIGN KEYS:', fkRes.rows[0].count);

    // 4. Financial totals & Reconciliation
    const finRes = await client.query(`
      SELECT market_id, currency, COUNT(*) as ledger_count, SUM(amount) as total_amount 
      FROM public.ledger_entries 
      GROUP BY market_id, currency;
    `);
    console.log('FINANCIAL RECONCILIATION TOTALS:', finRes.rows);

    // 5. Migration files and checksums
    const migDir = path.join(process.cwd(), 'src/db/migrations');
    if (fs.existsSync(migDir)) {
      const files = fs.readdirSync(migDir).filter(f => f.endsWith('.sql')).sort();
      for (const f of files) {
        const fp = path.join(migDir, f);
        const content = fs.readFileSync(fp, 'utf-8');
        const size = fs.statSync(fp).size;
        const sha = crypto.createHash('sha256').update(content).digest('hex');
        console.log(`MIGRATION FILE: ${f} | Size: ${size} | SHA256: ${sha}`);
      }
    }

  } finally {
    client.release();
    await pool.end();
  }
}

certify().catch(err => {
  console.error('Certification error:', err);
  process.exit(1);
});
