import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

async function runGate4B() {
  if (!DATABASE_URL) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const client = await pool.connect();

  console.log('============================================================');
  console.log('GATE 4B EXECUTOR — INVALID MIGRATION METADATA INSERT TESTS');
  console.log('============================================================\n');

  try {
    const preCount = await client.query(`SELECT COUNT(*) FROM public.schema_migrations;`);
    console.log(`PRE-TEST MIGRATION ROW COUNT: ${preCount.rows[0].count}\n`);

    const dummyVersion = '0099_test_invalid_migration';
    const dummyChecksum = '1111111122222222333333334444444455555555666666667777777788888888';

    const testCases = [
      {
        name: 'A. NULL filename',
        sql: `INSERT INTO public.schema_migrations (version, filename, checksum_sha256, execution_order, status, applied_at) VALUES ('v_test_a', NULL, '${dummyChecksum}', 999, 'APPLIED', NOW());`,
      },
      {
        name: 'B. NULL checksum',
        sql: `INSERT INTO public.schema_migrations (version, filename, checksum_sha256, execution_order, status, applied_at) VALUES ('v_test_b', 'test_b.sql', NULL, 999, 'APPLIED', NOW());`,
      },
      {
        name: 'C. invalid short checksum',
        sql: `INSERT INTO public.schema_migrations (version, filename, checksum_sha256, execution_order, status, applied_at) VALUES ('v_test_c', 'test_c.sql', 'short_sha', 999, 'APPLIED', NOW());`,
      },
      {
        name: 'D. NULL execution_order',
        sql: `INSERT INTO public.schema_migrations (version, filename, checksum_sha256, execution_order, status, applied_at) VALUES ('v_test_d', 'test_d.sql', '${dummyChecksum}', NULL, 'APPLIED', NOW());`,
      },
      {
        name: 'E. unsupported status',
        sql: `INSERT INTO public.schema_migrations (version, filename, checksum_sha256, execution_order, status, applied_at) VALUES ('v_test_e', 'test_e.sql', '${dummyChecksum}', 999, 'INVALID_STATUS', NOW());`,
      },
      {
        name: 'F. duplicate execution_order',
        sql: `INSERT INTO public.schema_migrations (version, filename, checksum_sha256, execution_order, status, applied_at) VALUES ('v_test_f', 'test_f.sql', '${dummyChecksum}', 1, 'APPLIED', NOW());`, // order 1 already exists
      },
      {
        name: 'G. duplicate filename',
        sql: `INSERT INTO public.schema_migrations (version, filename, checksum_sha256, execution_order, status, applied_at) VALUES ('v_test_g', '0001_normalize_membership_lifecycle.sql', '${dummyChecksum}', 999, 'APPLIED', NOW());`, // filename already exists
      },
    ];

    let deniedCount = 0;

    for (const tc of testCases) {
      await client.query('BEGIN;');
      try {
        await client.query(tc.sql);
        await client.query('COMMIT;');
        console.error(`FAIL: ${tc.name} was unexpectedly allowed!`);
      } catch (err: any) {
        await client.query('ROLLBACK;');
        deniedCount++;
        console.log(`TEST CASE: ${tc.name}`);
        console.log(`RESULT: DENIED BY POSTGRESQL CONSTRAINT`);
        console.log(`POSTGRESQL ERROR CODE: ${err.code}`);
        console.log(`ERROR MESSAGE: ${err.message}\n`);
      }
    }

    const postCount = await client.query(`SELECT COUNT(*) FROM public.schema_migrations;`);
    const delta = Number(postCount.rows[0].count) - Number(preCount.rows[0].count);

    console.log(`SUMMARY:`);
    console.log(`TOTAL TEST CASES: ${testCases.length}`);
    console.log(`DENIED COUNT: ${deniedCount}`);
    console.log(`ALL DENIED BY POSTGRESQL CONSTRAINTS: ${deniedCount === testCases.length ? 'YES' : 'NO'}`);
    console.log(`FINAL MIGRATION ROW COUNT DELTA: ${delta}`);

  } finally {
    client.release();
    await pool.end();
  }
}

runGate4B().catch(console.error);
