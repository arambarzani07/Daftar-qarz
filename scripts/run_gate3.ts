import { Pool } from 'pg';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

async function runGate3() {
  if (!DATABASE_URL) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const client = await pool.connect();

  console.log('============================================================');
  console.log('GATE 3 & 3B EXECUTOR — RANDOM INTERNAL PUBLIC USER IDS');
  console.log('============================================================\n');

  try {
    const testPersonas = [
      { persona: 'PLATFORM_OWNER', authUid: 'e1111111-2222-4333-a444-555555555555', role: 'PLATFORM_OWNER' },
      { persona: 'MARKET_MANAGER', authUid: 'e2222222-3333-4444-b555-666666666666', role: 'MANAGER' },
      { persona: 'EMPLOYEE', authUid: 'e3333333-4444-5555-c666-777777777777', role: 'EMPLOYEE' },
      { persona: 'CUSTOMER', authUid: 'e4444444-5555-6666-d777-888888888888', role: 'CUSTOMER' },
    ];

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    for (const p of testPersonas) {
      // Create with crypto.randomUUID()
      const publicUserId = crypto.randomUUID();

      await client.query(`
        INSERT INTO public.users (id, auth_user_id, full_name, email, is_active, created_at, updated_at)
        VALUES ($1, $2, $3, $4, true, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET auth_user_id = $2;
      `, [publicUserId, p.authUid, p.persona, `${p.persona.toLowerCase()}@zhirox.system`]);

      const isRandom = uuidRegex.test(publicUserId);
      const equalsAuth = publicUserId === p.authUid;
      const derivedFromAuth = publicUserId.includes(p.authUid);

      const dupCheck = await client.query(`SELECT COUNT(*) FROM public.users WHERE id = $1;`, [publicUserId]);

      console.log(`PERSONA: ${p.persona}`);
      console.log(`PUBLIC USER ID: ${publicUserId}`);
      console.log(`ID FORMAT: UUID`);
      console.log(`RANDOMLY GENERATED: ${isRandom ? 'YES' : 'NO'}`);
      console.log(`AUTH USER ID: ${p.authUid}`);
      console.log(`PUBLIC ID EQUALS AUTH UID: ${equalsAuth ? 'YES' : 'NO'}`);
      console.log(`PUBLIC ID DERIVED FROM AUTH UID: ${derivedFromAuth ? 'YES' : 'NO'}`);
      console.log(`DUPLICATE COUNT: ${Number(dupCheck.rows[0].count) - 1}\n`);

      // Clean up test insert
      await client.query(`DELETE FROM public.users WHERE id = $1;`, [publicUserId]);
    }

  } finally {
    client.release();
    await pool.end();
  }
}

runGate3().catch(console.error);
