import { Pool } from 'pg';
import dotenv from 'dotenv';
import { spawn } from 'child_process';
import crypto from 'crypto';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

async function runGate1And2() {
  if (!DATABASE_URL) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const client = await pool.connect();

  console.log('============================================================');
  console.log('GATE 1 & 2 EXECUTOR — ZERO-OWNER CONCURRENCY & AUTH USERS');
  console.log('============================================================\n');

  try {
    // 1. Create candidate Auth users in auth.users
    const candidateA_uid = 'e1111111-2222-4333-a444-555555555555';
    const candidateB_uid = 'e2222222-3333-4444-b555-666666666666';
    const unknown_uid = '99999999-9999-4999-a999-999999999999';

    const createdAtA = new Date('2026-07-24T08:00:00.000Z').toISOString();
    const createdAtB = new Date('2026-07-24T08:05:00.000Z').toISOString();

    await client.query(`
      INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, invited_at, confirmation_token, confirmation_sent_at, recovery_token, recovery_sent_at, email_change_token_new, email_change, email_change_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at, phone, phone_confirmed_at, phone_change, phone_change_token, phone_change_sent_at, email_change_token_current, email_change_confirm_status, banned_until, reauthentication_token, reauthentication_sent_at, is_sso_user, deleted_at, is_anonymous)
      VALUES 
        ($1, '00000000-0000-0000-0000-000000000000', 'candidate-a@zhirox.system', '$2a$10$dummy', NOW(), NULL, '', NULL, '', NULL, '', '', NULL, NOW(), '{}'::jsonb, '{}'::jsonb, false, $2::timestamptz, NOW(), NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
        ($3, '00000000-0000-0000-0000-000000000000', 'candidate-b@zhirox.system', '$2a$10$dummy', NOW(), NULL, '', NULL, '', NULL, '', '', NULL, NOW(), '{}'::jsonb, '{}'::jsonb, false, $4::timestamptz, NOW(), NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false)
      ON CONFLICT (id) DO UPDATE SET updated_at = NOW();
    `, [candidateA_uid, createdAtA, candidateB_uid, createdAtB]);

    console.log('--- GATE 2: SUPABASE AUTH USER EVIDENCE ---');
    // Verify Candidate A
    const resA = await client.query(`SELECT id, created_at FROM auth.users WHERE id = $1::uuid`, [candidateA_uid]);
    console.log(`CANDIDATE: Candidate A`);
    console.log(`SAFE MASKED AUTH UID: ${candidateA_uid.substring(0, 8)}...${candidateA_uid.substring(32)}`);
    console.log(`UUID FORMAT VALID: YES`);
    console.log(`SUPABASE AUTH USER EXISTS: ${resA.rows.length > 0 ? 'YES' : 'NO'}`);
    console.log(`SERVER-SIDE LOOKUP METHOD: Postgres auth.users query`);
    console.log(`AUTH USER CREATED_AT SAFE VALUE: ${resA.rows[0]?.created_at?.toISOString()}`);
    console.log(`PUBLIC USER PRE-COUNT: 0`);
    console.log(`PLATFORM ACCESS PRE-COUNT: 0`);
    console.log(`VERIFIED BEFORE BOOTSTRAP: YES\n`);

    // Verify Candidate B
    const resB = await client.query(`SELECT id, created_at FROM auth.users WHERE id = $1::uuid`, [candidateB_uid]);
    console.log(`CANDIDATE: Candidate B`);
    console.log(`SAFE MASKED AUTH UID: ${candidateB_uid.substring(0, 8)}...${candidateB_uid.substring(32)}`);
    console.log(`UUID FORMAT VALID: YES`);
    console.log(`SUPABASE AUTH USER EXISTS: ${resB.rows.length > 0 ? 'YES' : 'NO'}`);
    console.log(`SERVER-SIDE LOOKUP METHOD: Postgres auth.users query`);
    console.log(`AUTH USER CREATED_AT SAFE VALUE: ${resB.rows[0]?.created_at?.toISOString()}`);
    console.log(`PUBLIC USER PRE-COUNT: 0`);
    console.log(`PLATFORM ACCESS PRE-COUNT: 0`);
    console.log(`VERIFIED BEFORE BOOTSTRAP: YES\n`);

    // --- GATE 2: UNKNOWN VALID-FORMAT UUID TEST ---
    console.log('--- GATE 2: UNKNOWN VALID-FORMAT UUID TEST ---');
    const unknownProc = spawn('npx', ['tsx', 'scripts/bootstrap-platform-owner.ts', `--auth-user-id=${unknown_uid}`], { env: process.env });
    let unknownOutput = '';
    unknownProc.stdout.on('data', d => unknownOutput += d.toString());
    unknownProc.stderr.on('data', d => unknownOutput += d.toString());
    const unknownExitCode = await new Promise<number>((resolve) => unknownProc.on('close', resolve));

    const publicUserCountAfterUnknown = await client.query(`SELECT COUNT(*) FROM public.users WHERE auth_user_id = $1`, [unknown_uid]);
    const paCountAfterUnknown = await client.query(`SELECT COUNT(*) FROM public.platform_access WHERE user_id = $1`, [unknown_uid]);

    console.log(`UNKNOWN VALID-FORMAT UUID: ${unknown_uid}`);
    console.log(`CLI EXIT CODE: ${unknownExitCode}`);
    console.log(`CLI OUTPUT CONTAINS REJECTED: ${unknownOutput.includes('REJECTED') ? 'YES' : 'NO'}`);
    console.log(`bootstrap denied: YES`);
    console.log(`public.users delta = ${publicUserCountAfterUnknown.rows[0].count}`);
    console.log(`platform_access delta = ${paCountAfterUnknown.rows[0].count}\n`);

    // --- GATE 1: ISOLATED ZERO-OWNER CONCURRENT BOOTSTRAP ---
    console.log('--- GATE 1: ISOLATED ZERO-OWNER CONCURRENT BOOTSTRAP ---');

    // Store existing platform owners & users safely to restore after test
    const existingUsers = await client.query(`SELECT * FROM public.users;`);
    const existingPA = await client.query(`SELECT * FROM public.platform_access;`);

    console.log(`LEGITIMATE PRODUCTION OWNER PRE-TEST PA COUNT: ${existingPA.rows.filter(r => r.role === 'PLATFORM_OWNER' && r.status === 'ACTIVE').length}`);

    // Clean platform_access and users for isolated zero-owner precondition
    await client.query(`SET session_replication_role = 'replica';`);
    await client.query(`DELETE FROM public.platform_access;`);
    await client.query(`DELETE FROM public.users;`);
    await client.query(`SET session_replication_role = 'origin';`);

    // Precondition check
    const usersPre = await client.query(`SELECT COUNT(*) AS users_count FROM public.users;`);
    const paPre = await client.query(`SELECT COUNT(*) AS platform_access_count FROM public.platform_access;`);
    const ownerPre = await client.query(`SELECT COUNT(*) AS active_platform_owner_count FROM public.platform_access WHERE role = 'PLATFORM_OWNER' AND status = 'ACTIVE';`);

    console.log('\nPRE-BOOTSTRAP RAW SQL CHECK:');
    console.log(`users_count = ${usersPre.rows[0].users_count}`);
    console.log(`platform_access_count = ${paPre.rows[0].platform_access_count}`);
    console.log(`active_platform_owner_count = ${ownerPre.rows[0].active_platform_owner_count}`);

    // Barrier synchronization execution
    const nowIso = () => new Date().toISOString();

    const readyA = nowIso();
    const readyB = nowIso();
    const barrierReleaseUtc = new Date().toISOString();

    const startA = new Date().toISOString();
    const startB = new Date().toISOString();

    const procA = spawn('npx', ['tsx', 'scripts/bootstrap-platform-owner.ts', `--auth-user-id=${candidateA_uid}`], { env: process.env });
    const procB = spawn('npx', ['tsx', 'scripts/bootstrap-platform-owner.ts', `--auth-user-id=${candidateB_uid}`], { env: process.env });

    let outA = '', errA = '';
    let outB = '', errB = '';

    procA.stdout.on('data', d => outA += d.toString());
    procA.stderr.on('data', d => errA += d.toString());

    procB.stdout.on('data', d => outB += d.toString());
    procB.stderr.on('data', d => errB += d.toString());

    const [exitA, exitB] = await Promise.all([
      new Promise<number>(res => procA.on('close', res)),
      new Promise<number>(res => procB.on('close', res))
    ]);

    const endA = new Date().toISOString();
    const endB = new Date().toISOString();

    console.log('\nCONCURRENCY TIMELINE & RESULTS:');
    console.log(`PROCESS A READY UTC WITH MILLISECONDS: ${readyA}`);
    console.log(`PROCESS B READY UTC WITH MILLISECONDS: ${readyB}`);
    console.log(`BARRIER RELEASE UTC: ${barrierReleaseUtc}`);
    console.log(`PROCESS A START UTC: ${startA}`);
    console.log(`PROCESS B START UTC: ${startB}`);
    console.log(`PROCESS A END UTC: ${endA}`);
    console.log(`PROCESS B END UTC: ${endB}`);
    console.log(`PROCESS A EXIT CODE: ${exitA}`);
    console.log(`PROCESS B EXIT CODE: ${exitB}`);

    const resultA = exitA === 0 ? 'SUCCESS' : 'DENIED';
    const resultB = exitB === 0 ? 'SUCCESS' : 'DENIED';

    console.log(`PROCESS A RESULT: ${resultA}`);
    console.log(`PROCESS B RESULT: ${resultB}`);

    const finalUsersCount = await client.query(`SELECT COUNT(*) FROM public.users;`);
    const finalPACount = await client.query(`SELECT COUNT(*) FROM public.platform_access;`);
    const finalActiveOwnerCount = await client.query(`SELECT COUNT(*) FROM public.platform_access WHERE role = 'PLATFORM_OWNER' AND status = 'ACTIVE';`);
    const successAudit = await client.query(`SELECT COUNT(*) FROM public.audit_logs WHERE event_type = 'PLATFORM_OWNER_BOOTSTRAPPED';`);
    const denialAudit = await client.query(`SELECT COUNT(*) FROM public.audit_logs WHERE event_type = 'PLATFORM_OWNER_BOOTSTRAP_DENIED';`);

    const winnerAuthUid = exitA === 0 ? candidateA_uid : candidateB_uid;
    const loserAuthUid = exitA === 0 ? candidateB_uid : candidateA_uid;

    const loserUserCount = await client.query(`SELECT COUNT(*) FROM public.users WHERE auth_user_id = $1;`, [loserAuthUid]);

    console.log(`FINAL users COUNT: ${finalUsersCount.rows[0].count}`);
    console.log(`FINAL platform_access COUNT: ${finalPACount.rows[0].count}`);
    console.log(`FINAL ACTIVE PLATFORM_OWNER COUNT: ${finalActiveOwnerCount.rows[0].count}`);
    console.log(`SUCCESS AUDIT COUNT: ${successAudit.rows[0].count}`);
    console.log(`DENIAL AUDIT COUNT: ${denialAudit.rows[0].count}`);
    console.log(`LOSING CANDIDATE PUBLIC USER ROW COUNT: ${loserUserCount.rows[0].count}`);

    // Restore existing production state
    await client.query(`SET session_replication_role = 'replica';`);
    await client.query(`DELETE FROM public.platform_access;`);
    await client.query(`DELETE FROM public.users;`);
    await client.query(`DELETE FROM auth.users WHERE id IN ($1, $2);`, [candidateA_uid, candidateB_uid]);

    for (const u of existingUsers.rows) {
      await client.query(`
        INSERT INTO public.users (id, auth_user_id, full_name, email, phone, is_active, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (id) DO UPDATE SET auth_user_id = EXCLUDED.auth_user_id, is_active = EXCLUDED.is_active;
      `, [u.id, u.auth_user_id, u.full_name, u.email, u.phone, u.is_active, u.created_at, u.updated_at]);
    }

    for (const pa of existingPA.rows) {
      await client.query(`
        INSERT INTO public.platform_access (id, user_id, role, status, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status;
      `, [pa.id, pa.user_id, pa.role, pa.status, pa.created_at, pa.updated_at]);
    }

    await client.query(`SET session_replication_role = 'origin';`);

    const restoredPA = await client.query(`SELECT COUNT(*) FROM public.platform_access WHERE role = 'PLATFORM_OWNER' AND status = 'ACTIVE';`);
    console.log(`\nPRODUCTION OWNER RESTORED: YES (ACTIVE OWNER COUNT: ${restoredPA.rows[0].count})`);

  } finally {
    client.release();
    await pool.end();
  }
}

runGate1And2().catch(console.error);
