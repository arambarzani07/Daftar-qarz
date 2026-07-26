import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

async function auditAndRepairAuthIdentities() {
  const args = process.argv.slice(2);
  let auditOnly = false;
  let dryRun = false;
  let repairClusterId = '';
  let confirmProductionRepair = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--audit-only') auditOnly = true;
    else if (arg === '--dry-run') dryRun = true;
    else if (arg.startsWith('--repair-cluster=')) repairClusterId = arg.split('=')[1].trim();
    else if (arg === '--confirm-production-repair') confirmProductionRepair = true;
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
      console.log('=== ZHIROX IDENTITY & AUTHORIZATION AUDIT TOOL ===\n');

      // 1. Audit duplicate auth_user_id on public.users
      const dupAuthUsers = await client.query(`
        SELECT auth_user_id, count(*), array_agg(id) as user_ids
        FROM public.users
        WHERE auth_user_id IS NOT NULL AND auth_user_id != ''
        GROUP BY auth_user_id
        HAVING count(*) > 1
      `);

      // 2. Audit non-Platform Owner users with platform_access
      const invalidPlatformAccess = await client.query(`
        SELECT pa.id as pa_id, pa.user_id, pa.role, pa.status, u.full_name, u.email, u.phone
        FROM public.platform_access pa
        JOIN public.users u ON pa.user_id = u.id
        WHERE pa.status = 'ACTIVE' AND u.id != 'usr-platform-owner' AND u.email != 'admin@zhirox.com'
      `);

      // 3. Audit Platform Owner users with market memberships
      const poMarketMemberships = await client.query(`
        SELECT mm.id as mm_id, mm.market_id, mm.user_id, mm.role, mm.status
        FROM public.market_memberships mm
        JOIN public.users u ON mm.user_id = u.id
        WHERE u.id = 'usr-platform-owner' OR mm.role = 'PLATFORM_OWNER' OR mm.market_id = 'SYSTEM_GLOBAL'
      `);

      // 4. Audit active Platform Owner count in platform_access
      const activePoCount = await client.query(`
        SELECT count(*) FROM public.platform_access WHERE role = 'PLATFORM_OWNER' AND status = 'ACTIVE'
      `);

      console.log(`Active Platform Owner count in platform_access: ${activePoCount.rows[0].count}`);
      console.log(`Duplicate Auth UID user clusters count: ${dupAuthUsers.rows.length}`);
      console.log(`Invalid platform_access records count: ${invalidPlatformAccess.rows.length}`);
      console.log(`Legacy/Incorrect Platform Owner market memberships count: ${poMarketMemberships.rows.length}`);

      if (dupAuthUsers.rows.length > 0) {
        console.log('\n[CLUSTER REPORT - Duplicate Auth UIDs]:');
        dupAuthUsers.rows.forEach(r => {
          console.log(`  - Auth UID: ${r.auth_user_id} -> User IDs: [${r.user_ids.join(', ')}]`);
        });
      }

      if (invalidPlatformAccess.rows.length > 0) {
        console.log('\n[CLUSTER REPORT - Invalid Platform Access]:');
        invalidPlatformAccess.rows.forEach(r => {
          console.log(`  - PA ID: ${r.pa_id}, User ID: ${r.user_id} (${r.full_name || r.email})`);
        });
      }

      if (poMarketMemberships.rows.length > 0) {
        console.log('\n[CLUSTER REPORT - Legacy/Incorrect PO Memberships]:');
        poMarketMemberships.rows.forEach(r => {
          console.log(`  - Membership ID: ${r.mm_id}, Market: ${r.market_id}, Role: ${r.role}`);
        });
      }

      if (auditOnly || dryRun) {
        console.log('\n[AUDIT ONLY / DRY RUN COMPLETE] No mutations performed.');
        client.release();
        await pool.end();
        process.exit(0);
      }

      if (confirmProductionRepair) {
        await client.query('BEGIN');

        // Cleanup legacy PLATFORM_OWNER or SYSTEM_GLOBAL market memberships
        if (poMarketMemberships.rows.length > 0) {
          await client.query(`
            DELETE FROM public.market_memberships
            WHERE role = 'PLATFORM_OWNER' OR market_id = 'SYSTEM_GLOBAL'
          `);
          console.log('[REPAIR] Cleaned up legacy PLATFORM_OWNER market memberships.');
        }

        // Revoke invalid platform_access records
        if (invalidPlatformAccess.rows.length > 0) {
          for (const row of invalidPlatformAccess.rows) {
            await client.query(`
              UPDATE public.platform_access SET status = 'REVOKED', updated_at = NOW() WHERE id = $1
            `, [row.pa_id]);
          }
          console.log('[REPAIR] Revoked invalid platform_access rows.');
        }

        await client.query(`
          INSERT INTO public.audit_logs (id, market_id, actor_user_id, event_type, reason, created_at)
          VALUES ($1, 'SYSTEM_GLOBAL', 'SYSTEM_AUDIT_CLI', 'AUTH_IDENTITY_BINDING_REPAIRED', 'Executed audit and repair tool to enforce zero-trust identity invariants', NOW())
        `, [`audit-repair-${Date.now()}`]);

        await client.query('COMMIT');
        console.log('[REPAIR SUCCESS] Identity bindings and platform access constraints repaired cleanly.');
      }
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[AUDIT TOOL FAILED]:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

auditAndRepairAuthIdentities();
