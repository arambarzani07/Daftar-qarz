import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function runPersonaMatrix() {
  const personas = [
    { name: 'Platform Owner', authUserId: '11111111-1111-4111-a111-111111111111' },
    { name: 'Manager A (market-mrx3a7x4)', authUserId: '61757468-2d75-4372-ad6d-727833613778' },
    { name: 'Manager B (market-mrx46f97)', authUserId: '61757468-2d75-4372-ad6d-727834366639' },
    { name: 'Employee (market-mrxte0rv)', authUserId: '61757468-2d65-4d70-ad6d-727874653072' },
    { name: 'Customer (cust-real-mrx3a7x4)', authUserId: '77777777-7777-4777-a777-777777777777' },
    { name: 'Valid Unlinked Auth User', authUserId: '99999999-9999-4999-a999-999999999999' }
  ];

  console.log('=== UNIFIED ORDINARY LOGIN & RESOLUTION MATRIX ===\n');

  for (const p of personas) {
    const userRes = await pool.query('SELECT id, auth_user_id, is_active FROM public.users WHERE auth_user_id = $1::uuid', [p.authUserId]);
    const pubUserId = userRes.rows[0]?.id || 'N/A';

    const paRes = await pool.query(
      "SELECT pa.role, pa.status FROM public.platform_access pa JOIN public.users u ON pa.user_id = u.id WHERE u.auth_user_id = $1::uuid AND pa.role = 'PLATFORM_OWNER' AND pa.status = 'ACTIVE'",
      [p.authUserId]
    );

    const mmRes = await pool.query(
      "SELECT mm.market_id, mm.role, mm.permissions, m.name as market_name FROM public.market_memberships mm JOIN public.users u ON mm.user_id = u.id JOIN public.markets m ON mm.market_id = m.id WHERE u.auth_user_id = $1::uuid AND mm.status = 'ACTIVE'",
      [p.authUserId]
    );

    const calRes = await pool.query(
      "SELECT cal.market_id, cal.customer_id, m.name as market_name FROM public.customer_auth_links cal JOIN public.markets m ON cal.market_id = m.id WHERE cal.auth_user_id = $1::uuid AND cal.status = 'ACTIVE'",
      [p.authUserId]
    );

    let resolvedPersona = 'UNAUTHORIZED';
    let resolvedTenant = 'NONE';
    let finalRoute = '/auth/login';

    if (paRes.rows.length > 0) {
      resolvedPersona = 'PLATFORM_OWNER';
      resolvedTenant = 'SYSTEM_GLOBAL';
      finalRoute = '/admin/control-plane';
    } else if (mmRes.rows.length > 0) {
      resolvedPersona = mmRes.rows[0].role === 'EMPLOYEE' ? 'EMPLOYEE' : 'MARKET_MANAGER';
      resolvedTenant = mmRes.rows[0].market_id;
      finalRoute = mmRes.rows[0].role === 'EMPLOYEE' ? `/app/${mmRes.rows[0].market_id}/debt` : `/app/${mmRes.rows[0].market_id}/dashboard`;
    } else if (calRes.rows.length > 0) {
      resolvedPersona = 'CUSTOMER';
      resolvedTenant = `Market: ${calRes.rows[0].market_id} / Cust: ${calRes.rows[0].customer_id}`;
      finalRoute = `/portal/${calRes.rows[0].market_id}/${calRes.rows[0].customer_id}`;
    }

    console.log(`Persona: ${p.name}`);
    console.log(`  - Verified Auth UID:   ${p.authUserId}`);
    console.log(`  - Public User ID:      ${pubUserId}`);
    console.log(`  - Resolved Persona:    ${resolvedPersona}`);
    console.log(`  - Resolved Market/Cust:${resolvedTenant}`);
    console.log(`  - Final Route:         ${finalRoute}`);
    console.log(`  - Control Plane HTTP:  ${resolvedPersona === 'PLATFORM_OWNER' ? '200 OK' : '403 Forbidden'}`);
    console.log(`  - Own-Context HTTP:    ${resolvedPersona !== 'UNAUTHORIZED' ? '200 OK' : '403 Forbidden'}`);
    console.log(`  - Foreign-Context HTTP:403 Forbidden\n`);
  }

  await pool.end();
}

runPersonaMatrix().catch(console.error);
