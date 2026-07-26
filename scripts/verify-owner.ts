import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const client = await pool.connect();
  try {
    const authUserId = '3e528adb-fee5-4c24-a0ba-40cef8c9a3f4';

    // 1. Check auth_user_id in public.users
    const userRes = await client.query('SELECT * FROM public.users WHERE auth_user_id = $1', [authUserId]);
    console.log('1. User record in public.users:', userRes.rows.length === 1 ? 'EXISTS (1)' : `FAILED (${userRes.rows.length})`);
    if (userRes.rows.length === 1) {
      console.log('   User ID:', userRes.rows[0].id);
      console.log('   Auth User ID:', userRes.rows[0].auth_user_id);
    }

    // 2 & 3 & 4. platform_access checks
    const paRes = await client.query('SELECT * FROM public.platform_access WHERE user_id = $1', [userRes.rows[0]?.id]);
    console.log('2/3/4. Platform access records for user:', paRes.rows.length === 1 ? 'EXACTLY 1' : `FAILED (${paRes.rows.length})`);
    if (paRes.rows.length === 1) {
      console.log('   Role:', paRes.rows[0].role);
      console.log('   Status:', paRes.rows[0].status);
    }

    // 5. Total ACTIVE PLATFORM_OWNER count
    const countRes = await client.query("SELECT count(*) FROM public.platform_access WHERE role = 'PLATFORM_OWNER' AND status = 'ACTIVE'");
    console.log('5. Total ACTIVE PLATFORM_OWNER count:', countRes.rows[0].count);

    // 6. Platform Owner market membership count
    const memRes = await client.query("SELECT count(*) FROM public.market_memberships tm JOIN public.platform_access pa ON tm.user_id = pa.user_id WHERE pa.role = 'PLATFORM_OWNER'");
    console.log('6. Platform Owner market membership count:', memRes.rows[0].count);

    // 7. Duplicate platform_access per user
    const dupRes = await client.query("SELECT user_id, count(*) FROM public.platform_access WHERE status = 'ACTIVE' GROUP BY user_id HAVING count(*) > 1");
    console.log('7. Duplicate active platform_access:', dupRes.rows.length);

  } finally {
    client.release();
    await pool.end();
  }
}
run();
