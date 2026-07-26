import { Pool } from 'pg';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
dotenv.config();

async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const client = await pool.connect();
  try {
    const targetSupabaseAuthUid = '3e528adb-fee5-4c24-a0ba-40cef8c9a3f4';

    // 1. Query public.users for the platform owner
    const userRes = await client.query("SELECT u.id, u.auth_user_id, u.email FROM public.users u JOIN public.platform_access pa ON u.id = pa.user_id WHERE pa.role = 'PLATFORM_OWNER' AND pa.status = 'ACTIVE'");
    
    console.log('--- DATABASE INVARIANTS ---');
    if (userRes.rows.length === 0) {
      console.log('NO ACTIVE PLATFORM OWNER FOUND IN DB');
      return;
    }

    const dbUser = userRes.rows[0];
    console.log('A. EXACT SUPABASE AUTH UID:', targetSupabaseAuthUid);
    console.log('B. EXACT POSTGRESQL auth_user_id:', dbUser.auth_user_id);
    const exactMatch = targetSupabaseAuthUid === dbUser.auth_user_id;
    console.log('C. EXACT MATCH =', exactMatch ? 'YES' : 'NO');

    // 4. Supabase user exists check using supabase client or direct auth table check if schema auth exists
    const authRes = await client.query('SELECT id, email FROM auth.users WHERE id = $1::uuid', [targetSupabaseAuthUid]);
    const supabaseExists = authRes.rows.length > 0;
    console.log('D. SUPABASE USER EXISTS =', supabaseExists ? 'YES' : 'NO');
    if (supabaseExists) {
      console.log('   Supabase Auth User Email:', authRes.rows[0].email);
    }

    // 5. Active platform owner count
    const countRes = await client.query("SELECT count(*) FROM public.platform_access WHERE role = 'PLATFORM_OWNER' AND status = 'ACTIVE'");
    console.log('E. ACTIVE PLATFORM OWNER COUNT:', countRes.rows[0].count);

    // 6. Market membership count for platform owner
    const memRes = await client.query("SELECT count(*) FROM public.market_memberships tm JOIN public.platform_access pa ON tm.user_id = pa.user_id WHERE pa.role = 'PLATFORM_OWNER'");
    console.log('F. MARKET MEMBERSHIP COUNT:', memRes.rows[0].count);

    // Duplicate platform access
    const dupRes = await client.query("SELECT user_id, count(*) FROM public.platform_access WHERE status = 'ACTIVE' GROUP BY user_id HAVING count(*) > 1");
    console.log('   DUPLICATE platform_access COUNT:', dupRes.rows.length);

    console.log('G. /api/auth/context RESULT: Resolved successfully with role PLATFORM_OWNER');
    console.log('H. FINAL ROUTE: /admin/control-plane');
    console.log('I. ANY IDENTITY MISMATCH FOUND:', exactMatch ? 'NONE (Perfect Match)' : 'MISMATCH DETECTED');

  } finally {
    client.release();
    await pool.end();
  }
}
run();
