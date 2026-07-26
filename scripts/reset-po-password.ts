import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const client = await pool.connect();
  try {
    const authUserId = '3e528adb-fee5-4c24-a0ba-40cef8c9a3f4';
    const newPassword = 'ZhiroxOwner2026!';

    // Update password hash in auth.users using pgcrypto gen_salt / crypt
    const updateRes = await client.query(
      `UPDATE auth.users SET encrypted_password = crypt($1, gen_salt('bf')), updated_at = NOW() WHERE id = $2::uuid RETURNING email`,
      [newPassword, authUserId]
    );

    if (updateRes.rows.length > 0) {
      console.log('SUCCESSFULLY RESET PASSWORD IN POSTGRESQL auth.users FOR:', updateRes.rows[0].email);
      console.log('NEW PASSWORD:', newPassword);
    } else {
      console.error('User not found in auth.users');
    }
  } finally {
    client.release();
    await pool.end();
  }
}
run();
