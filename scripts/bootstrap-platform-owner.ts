import { Pool } from 'pg';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

async function verifySupabaseAuthUser(client: any, authUserId: string): Promise<{ exists: boolean; createdAt?: string }> {
  // 1. Try Supabase Auth Admin API if service role key is available
  if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
      const { data, error } = await sb.auth.admin.getUserById(authUserId);
      if (data?.user) {
        return { exists: true, createdAt: data.user.created_at };
      }
    } catch {}
  }

  // 2. Query Postgres auth.users table directly (Supabase schema)
  try {
    const res = await client.query(`
      SELECT id, created_at FROM auth.users WHERE id = $1::uuid
    `, [authUserId]);
    if (res.rows.length > 0) {
      return { exists: true, createdAt: res.rows[0].created_at?.toISOString() || new Date().toISOString() };
    }
  } catch {}

  // 3. Fallback: Check if already registered in public.users auth_user_id
  try {
    const res = await client.query(`
      SELECT auth_user_id, created_at FROM public.users WHERE auth_user_id = $1
    `, [authUserId]);
    if (res.rows.length > 0) {
      return { exists: true, createdAt: res.rows[0].created_at?.toISOString() || new Date().toISOString() };
    }
  } catch {}

  return { exists: false };
}

async function bootstrapPlatformOwner() {
  const args = process.argv.slice(2);
  let authUserId = '';
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--auth-user-id=')) {
      authUserId = arg.split('=')[1].trim();
    } else if (arg === '--auth-user-id' && args[i + 1]) {
      authUserId = args[i + 1].trim();
      i++;
    } else if (arg === '--dry-run') {
      dryRun = true;
    }
  }

  if (!authUserId) {
    console.error('ERROR: Missing required argument --auth-user-id=<SUPABASE_AUTH_UID>');
    process.exit(1);
  }

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(authUserId)) {
    console.error('ERROR: Invalid Supabase Auth user ID format (must be a valid UUID).');
    process.exit(1);
  }

  if (!DATABASE_URL) {
    console.error('ERROR: DATABASE_URL environment variable is required.');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const client = await pool.connect();
    try {
      console.log(`[BOOTSTRAP CLI] Verifying Supabase Auth user ID: ${authUserId}`);
      
      // Gate 2: Server-side Supabase Auth Lookup
      const authVerification = await verifySupabaseAuthUser(client, authUserId);
      if (!authVerification.exists) {
        console.error(`[BOOTSTRAP CLI] REJECTED: User ID ${authUserId} is an unknown UUID that does not exist in Supabase Auth.`);
        client.release();
        await pool.end();
        process.exit(1);
      }

      console.log(`[BOOTSTRAP CLI] Verified Supabase Auth User exists. CreatedAt: ${authVerification.createdAt}`);

      const userCheck = await client.query(`
        SELECT id, auth_user_id, email, phone, is_active 
        FROM public.users 
        WHERE auth_user_id = $1
      `, [authUserId]);
      
      let userId = '';
      if (userCheck.rows.length > 0) {
        userId = userCheck.rows[0].id;
        console.log(`[BOOTSTRAP CLI] Found existing user record: id=${userId}`);
      } else {
        // Gate 3: Random Internal Public User ID
        userId = crypto.randomUUID();
        console.log(`[BOOTSTRAP CLI] Creating new user record with random internal UUID id=${userId} and auth_user_id=${authUserId}`);
      }

      if (dryRun) {
        console.log('[BOOTSTRAP CLI] DRY RUN mode enabled. No database mutations performed.');
        client.release();
        await pool.end();
        process.exit(0);
      }

      await client.query('BEGIN');

      // Gate 1: Exclusive lock on platform_access to prevent race condition during zero-owner bootstrap
      await client.query('LOCK TABLE public.platform_access IN EXCLUSIVE MODE');

      const existingOwnerRes = await client.query(`
        SELECT id, user_id FROM public.platform_access 
        WHERE role = 'PLATFORM_OWNER' AND status = 'ACTIVE'
      `);

      if (existingOwnerRes.rows.length > 0) {
        const existingOwnerUserId = existingOwnerRes.rows[0].user_id;
        if (existingOwnerUserId !== userId) {
          // Record denial audit before rollback
          await client.query(`
            INSERT INTO public.audit_logs (id, market_id, actor_user_id, event_type, reason, created_at)
            VALUES ($1, 'SYSTEM_GLOBAL', $2, 'PLATFORM_OWNER_BOOTSTRAP_DENIED', 'Denied: An active Platform Owner already exists in the system', NOW())
          `, [`audit-denied-${Date.now()}-${Math.random().toString(36).substring(2,6)}`, authUserId]);

          await client.query('COMMIT');
          console.error(`[BOOTSTRAP CLI] DENIED: An active Platform Owner already exists in the system.`);
          client.release();
          await pool.end();
          process.exit(1);
        }
      }

      if (userCheck.rows.length === 0) {
        await client.query(`
          INSERT INTO public.users (id, auth_user_id, full_name, email, is_active, created_at, updated_at)
          VALUES ($1, $2, $3, $4, true, NOW(), NOW())
          ON CONFLICT (id) DO UPDATE SET auth_user_id = $2, is_active = true, updated_at = NOW()
        `, [userId, authUserId, 'Platform Owner', `po-${authUserId.substring(0, 8)}@zhirox.system`]);
      } else {
        await client.query(`
          UPDATE public.users SET is_active = true, auth_user_id = $2, updated_at = NOW() WHERE id = $1
        `, [userId, authUserId]);
      }

      const paId = `pa-${authUserId.substring(0, 8)}`;
      await client.query(`
        INSERT INTO public.platform_access (id, user_id, role, status, created_at, updated_at)
        VALUES ($1, $2, 'PLATFORM_OWNER', 'ACTIVE', NOW(), NOW())
        ON CONFLICT (user_id) DO UPDATE SET role = 'PLATFORM_OWNER', status = 'ACTIVE', updated_at = NOW()
      `, [paId, userId]);

      await client.query(`
        INSERT INTO public.audit_logs (id, market_id, actor_user_id, event_type, reason, created_at)
        VALUES ($1, 'SYSTEM_GLOBAL', $2, 'PLATFORM_OWNER_BOOTSTRAPPED', 'Secure server-side CLI bootstrap executed successfully for Platform Owner', NOW())
      `, [`audit-boot-${Date.now()}`, userId]);

      await client.query('COMMIT');
      console.log(`[BOOTSTRAP CLI] SUCCESS: Platform Owner successfully bootstrapped for Auth UID ${authUserId} (User ID: ${userId}).`);
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[BOOTSTRAP CLI] FAILED:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

bootstrapPlatformOwner();
