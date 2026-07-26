import { Pool } from 'pg';
import { exec } from 'child_process';
import dotenv from 'dotenv';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

async function testConcurrency() {
  console.log('=== GATE 3: REAL SUPABASE BOOTSTRAP CONCURRENCY TEST ===\n');

  const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

  // Real candidate UUIDs (UUID v4 format)
  const candidateA = 'e1111111-2222-4333-a444-555555555555';
  const candidateB = 'e2222222-3333-4444-b555-666666666666';

  console.log(`Candidate A: ${candidateA}`);
  console.log(`Candidate B: ${candidateB}`);

  // Pre-cleanup if any previous test remnants exist
  await pool.query(`DELETE FROM public.platform_access WHERE user_id IN ('usr-${candidateA}', 'usr-${candidateB}')`);
  await pool.query(`DELETE FROM public.users WHERE id IN ('usr-${candidateA}', 'usr-${candidateB}')`);

  console.log('\nStarting simultaneous execution barrier...');
  const tStartReady = new Date().toISOString();

  const promiseA = new Promise<{ code: number, stdout: string, stderr: string }>((resolve) => {
    exec(`npx tsx scripts/bootstrap-platform-owner.ts --auth-user-id=${candidateA}`, (err, stdout, stderr) => {
      resolve({ code: err ? err.code || 1 : 0, stdout, stderr });
    });
  });

  const promiseB = new Promise<{ code: number, stdout: string, stderr: string }>((resolve) => {
    exec(`npx tsx scripts/bootstrap-platform-owner.ts --auth-user-id=${candidateB}`, (err, stdout, stderr) => {
      resolve({ code: err ? err.code || 1 : 0, stdout, stderr });
    });
  });

  const barrierTime = new Date().toISOString();
  console.log(`BARRIER RELEASED AT: ${barrierTime}`);

  const [resA, resB] = await Promise.all([promiseA, promiseB]);
  const tEnd = new Date().toISOString();

  console.log(`\nPROCESS A EXIT CODE: ${resA.code}`);
  console.log(`PROCESS B EXIT CODE: ${resB.code}`);

  // Verify database state
  const ownerRes = await pool.query(`
    SELECT pa.id, pa.user_id, pa.role, pa.status, u.auth_user_id
    FROM public.platform_access pa
    JOIN public.users u ON u.id = pa.user_id
    WHERE pa.role = 'PLATFORM_OWNER' AND pa.status = 'ACTIVE'
  `);

  console.log('\n--- DATABASE POST-CONCURRENCY STATE ---');
  console.log(`Active Platform Owner Count in DB: ${ownerRes.rows.length}`);
  console.log(ownerRes.rows);

  const candidateUsers = await pool.query(`
    SELECT id, auth_user_id, email FROM public.users WHERE id IN ('usr-${candidateA}', 'usr-${candidateB}')
  `);
  console.log(`Candidate user rows created: ${candidateUsers.rows.length}`);
  console.log(candidateUsers.rows);

  // Clean up candidate test records so production Platform Owner is untouched
  await pool.query(`DELETE FROM public.platform_access WHERE user_id IN ('usr-${candidateA}', 'usr-${candidateB}')`);
  await pool.query(`DELETE FROM public.users WHERE id IN ('usr-${candidateA}', 'usr-${candidateB}')`);

  const activeOwnerCountFinal = await pool.query(`
    SELECT COUNT(*) FROM public.platform_access WHERE role = 'PLATFORM_OWNER' AND status = 'ACTIVE'
  `);
  console.log(`Final Platform Owner Count after cleanup: ${activeOwnerCountFinal.rows[0].count}`);

  await pool.end();
}

testConcurrency().catch(console.error);
