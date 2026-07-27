import pg from 'pg';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function applyMigration() {
  const client = await pool.connect();
  try {
    const filename = '0012_customer_recovery_and_protection.sql';
    const filePath = path.join(process.cwd(), 'src', 'db', 'migrations', filename);
    const sql = fs.readFileSync(filePath, 'utf8');
    const checksum = crypto.createHash('sha256').update(sql).digest('hex');

    console.log(`Applying migration ${filename} with checksum ${checksum}...`);
    await client.query(sql);

    // Record in schema_migrations
    await client.query(
      `INSERT INTO public.schema_migrations (version, filename, checksum_sha256, execution_order, applied_at, status)
       VALUES ($1, $2, $3, $4, NOW(), 'APPLIED')
       ON CONFLICT (version) DO UPDATE SET filename = EXCLUDED.filename, checksum_sha256 = EXCLUDED.checksum_sha256, execution_order = EXCLUDED.execution_order, applied_at = NOW(), status = 'APPLIED'`,
      ['0012', filename, checksum, 12]
    );

    console.log(`Migration ${filename} applied successfully!`);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

applyMigration();
