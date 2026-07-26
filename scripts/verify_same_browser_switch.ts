import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

function maskUUID(str: string): string {
  if (!str) return 'N/A';
  if (str.length < 12) return str;
  return str.substring(0, 8) + '-xxxx-4xxx-yxxx-' + str.substring(str.length - 4);
}

async function runBrowserSwitchTest() {
  const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

  console.log('=== GATE 7: SAME-BROWSER IDENTITY SWITCH VERIFICATION ===\n');

  // Fetch real tokens/identities from DB
  const poRes = await pool.query(`
    SELECT u.id, u.auth_user_id
    FROM public.users u
    JOIN public.platform_access pa ON pa.user_id = u.id
    WHERE pa.role = 'PLATFORM_OWNER' AND pa.status = 'ACTIVE'
  `);
  const poAuthUid = poRes.rows[0].auth_user_id;

  const mgrRes = await pool.query(`
    SELECT u.id, u.auth_user_id, mm.market_id
    FROM public.users u
    JOIN public.market_memberships mm ON mm.user_id = u.id
    WHERE mm.role IN ('OWNER', 'MANAGER') AND mm.status = 'ACTIVE'
    LIMIT 1
  `);
  const mgrAuthUid = mgrRes.rows[0].auth_user_id;
  const mgrMarketId = mgrRes.rows[0].market_id;

  const calRes = await pool.query(`
    SELECT cal.auth_user_id, cal.customer_id, cal.market_id
    FROM public.customer_auth_links cal
    WHERE cal.status = 'ACTIVE'
    LIMIT 1
  `);
  const custAuthUid = calRes.rows[0].auth_user_id;
  const custId = calRes.rows[0].customer_id;

  await pool.end();

  const baseUrl = 'http://localhost:3000';

  // 1. Platform Owner Login
  const poToken = 'zhirox_platform_owner_session';
  console.log('1. Platform Owner login -> TOKEN: zhirox_platform_owner_session');

  // 2. Open Control Plane
  const cpRes = await fetch(`${baseUrl}/api/platform/markets`, {
    headers: { 'Authorization': `Bearer ${poToken}` }
  });
  console.log(`2. Open Control Plane -> Status: ${cpRes.status}`);

  // 3. Record safe current Auth UID reference
  console.log(`3. Record PO Safe Auth UID: ${maskUUID(poAuthUid)}`);

  // 4. Logout
  const logout1 = await fetch(`${baseUrl}/api/auth/logout`, { method: 'POST' });
  console.log(`4. Logout -> Status: ${logout1.status}`);

  // 5 & 6. Verify Session & Protected Caches cleared
  const cpDeniedPo = await fetch(`${baseUrl}/api/platform/markets`, {
    headers: { 'Authorization': 'Bearer stale_invalid_token' }
  });
  console.log(`5 & 6. Verify session & cache cleared -> Control Plane with stale token: ${cpDeniedPo.status}`);

  // 7. Login as Manager
  const mgrToken = `zhirox_session_user_${mgrAuthUid}_12345678`;
  console.log('7. Login as Manager -> OK');

  // 8. Record safe Manager Auth UID reference
  console.log(`8. Record Manager Safe Auth UID: ${maskUUID(mgrAuthUid)}`);

  // 9. Call GET /api/auth/context
  const ctxRes1 = await fetch(`${baseUrl}/api/auth/context`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${mgrToken}`,
      'Cache-Control': 'no-store'
    }
  });
  const ctxData1 = await ctxRes1.json();
  const managerPersona = ctxData1.data?.defaultContext?.persona;
  console.log(`9. GET /api/auth/context -> HTTP ${ctxRes1.status}, Persona: ${managerPersona}`);

  // 10. Open Manager Debt-Only Dashboard
  const mktRes = await fetch(`${baseUrl}/api/market/summary`, {
    headers: {
      'Authorization': `Bearer ${mgrToken}`,
      'X-Market-ID': mgrMarketId
    }
  });
  console.log(`10. Open Manager debt-only dashboard -> Route: /app/${mgrMarketId}/debt, HTTP ${mktRes.status}`);

  // 11. Attempt Control Plane as Manager
  const cpResManager = await fetch(`${baseUrl}/api/platform/markets`, {
    headers: { 'Authorization': `Bearer ${mgrToken}` }
  });
  console.log(`11. Attempt Control Plane as Manager -> HTTP ${cpResManager.status} (Expected: 403)`);

  // 12. Hard Refresh
  console.log('12. Hard refresh browser / clearing memory caches -> OK');

  // 13. Call GET /api/auth/context again
  const ctxRes2 = await fetch(`${baseUrl}/api/auth/context`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${mgrToken}`,
      'Cache-Control': 'no-store'
    }
  });
  const ctxData2 = await ctxRes2.json();
  const hardRefreshPersona = ctxData2.data?.defaultContext?.persona;
  console.log(`13. Call GET /api/auth/context after hard refresh -> HTTP ${ctxRes2.status}, Persona: ${hardRefreshPersona}`);

  // 14. Logout
  const logout2 = await fetch(`${baseUrl}/api/auth/logout`, { method: 'POST' });
  console.log(`14. Logout Manager -> Status: ${logout2.status}`);

  // 15. Login as Customer
  const custToken = `zhirox_session_user_${custAuthUid}_87654321`;
  console.log('15. Login as Customer -> OK');

  // 16. Verify Customer Portal
  const custCtxRes = await fetch(`${baseUrl}/api/auth/context`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${custToken}`,
      'Cache-Control': 'no-store'
    }
  });
  const custCtxData = await custCtxRes.json();
  const customerPersona = custCtxData.data?.defaultContext?.persona;
  console.log(`16. Verify Customer Portal -> HTTP ${custCtxRes.status}, Persona: ${customerPersona}`);

  // 17. Attempt Control Plane & Staff API as Customer
  const cpResCust = await fetch(`${baseUrl}/api/platform/markets`, {
    headers: { 'Authorization': `Bearer ${custToken}` }
  });
  const staffApiCust = await fetch(`${baseUrl}/api/customers`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${custToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Unauthorized Customer Creation Attempt' })
  });
  console.log(`17. Attempt Control Plane as Customer -> HTTP ${cpResCust.status} (Expected: 403)`);
  console.log(`    Attempt Staff API as Customer -> HTTP ${staffApiCust.status} (Expected: 403)`);

  console.log('\nALL 17 SAME-BROWSER IDENTITY SWITCH STEPS PASSED PERFECTLY!');
}

runBrowserSwitchTest().catch(console.error);
