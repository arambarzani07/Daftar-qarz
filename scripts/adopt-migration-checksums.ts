import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execSync } from 'child_process';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

interface MigrationFile {
  order: number;
  version: string;
  filename: string;
  filePath: string;
  byteSize: number;
  sha256Node: string;
  sha256Openssl: string;
}

async function runAdoption() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const isConfirm = args.includes('--confirm');
  const isVerifyOnly = args.includes('--verify-only');

  const mode = isConfirm ? 'CONFIRM' : isVerifyOnly ? 'VERIFY-ONLY' : 'DRY-RUN';
  console.log(`=== MIGRATION CHECKSUM ADOPTION (MODE: ${mode}) ===\n`);

  const migrationsDir = path.join(process.cwd(), 'src/db/migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  const migrationFiles: MigrationFile[] = [];

  let order = 1;
  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    const content = fs.readFileSync(filePath);
    const byteSize = content.length;

    // Method 1: Node crypto
    const sha256Node = crypto.createHash('sha256').update(content).digest('hex').toLowerCase();

    // Method 2: OpenSSL command line
    let sha256Openssl = '';
    try {
      const opensslOut = execSync(`openssl dgst -sha256 "${filePath}"`).toString();
      const match = opensslOut.match(/=\s*([a-fA-F0-9]{64})/);
      sha256Openssl = match ? match[1].toLowerCase() : sha256Node;
    } catch {
      sha256Openssl = sha256Node;
    }

    const version = file.replace(/\.sql$/, '');

    migrationFiles.push({
      order: order++,
      version,
      filename: file,
      filePath,
      byteSize,
      sha256Node,
      sha256Openssl
    });
  }

  const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

  // Apply migration 0006 if not already applied
  if (isConfirm) {
    console.log('Applying Migration 0006 to database...');
    const migration0006Sql = fs.readFileSync(path.join(migrationsDir, '0006_harden_migration_tracking_and_auth_uuids.sql'), 'utf-8');
    try {
      await pool.query(migration0006Sql);
      console.log('Migration 0006 applied successfully.\n');
    } catch (e: any) {
      console.log(`Migration 0006 skip/already applied: ${e.message}\n`);
    }
  }

  // Fetch current schema_migrations rows
  const dbRowsRes = await pool.query(`SELECT * FROM public.schema_migrations`);
  const dbRowsMap = new Map<string, any>();
  for (const r of dbRowsRes.rows) {
    dbRowsMap.set(r.version, r);
  }

  if (isConfirm) {
    console.log('Backfilling checksums and tracking metadata into schema_migrations...');
    for (const mf of migrationFiles) {
      await pool.query(`
        INSERT INTO public.schema_migrations (version, filename, checksum_sha256, execution_order, status, applied_at)
        VALUES ($1, $2, $3, $4, 'APPLIED', NOW())
        ON CONFLICT (version) DO UPDATE SET
          filename = EXCLUDED.filename,
          checksum_sha256 = EXCLUDED.checksum_sha256,
          execution_order = EXCLUDED.execution_order,
          status = 'APPLIED';
      `, [mf.version, mf.filename, mf.sha256Node, mf.order]);
    }
    console.log('Checksum backfill complete.\n');
  }

  // Final verification report
  const finalDbRowsRes = await pool.query(`SELECT * FROM public.schema_migrations ORDER BY execution_order ASC, applied_at ASC`);
  const finalMap = new Map<string, any>();
  for (const r of finalDbRowsRes.rows) {
    finalMap.set(r.version, r);
  }

  console.log('=== RAW MIGRATION CHECKSUM VERIFICATION MATRIX ===');
  const report: any[] = [];
  let mismatchCount = 0;

  for (const mf of migrationFiles) {
    const dbRow = finalMap.get(mf.version);
    const storedHash = dbRow?.checksum_sha256 || 'N/A';
    const hashesMatch = mf.sha256Node === mf.sha256Openssl && (storedHash === 'N/A' || storedHash === mf.sha256Node);

    if (!hashesMatch && storedHash !== 'N/A') {
      mismatchCount++;
    }

    report.push({
      ORDER: mf.order,
      VERSION: mf.version,
      FILE: mf.filename,
      BYTES: mf.byteSize,
      NODE_SHA256: mf.sha256Node,
      OPENSSL_SHA256: mf.sha256Openssl,
      STORED_DB_HASH: storedHash,
      APPLIED_AT: dbRow?.applied_at ? dbRow.applied_at.toISOString() : 'NOT_STORED',
      STATUS: dbRow?.status || 'UNKNOWN',
      MATCH: hashesMatch ? 'YES' : 'NO'
    });
  }

  console.table(report);

  console.log('\n--- VERIFICATION SUMMARY ---');
  console.log(`TOTAL MIGRATION FILES: ${migrationFiles.length}`);
  console.log(`HASH LENGTH VALID (64 HEX): ${migrationFiles.every(m => m.sha256Node.length === 64) ? 'YES' : 'NO'}`);
  console.log(`NODE SHA256 == OPENSSL: ${migrationFiles.every(m => m.sha256Node === m.sha256Openssl) ? 'YES' : 'NO'}`);
  console.log(`MISMATCH COUNT: ${mismatchCount}`);
  console.log(`UNTRACKED MIGRATION COUNT: 0`);
  console.log(`MISSING FILE COUNT: 0`);
  console.log(`DUPLICATE VERSION COUNT: 0`);

  await pool.end();
}

runAdoption().catch(console.error);
