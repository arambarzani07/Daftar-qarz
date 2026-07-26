import pg from 'pg';

let pool: pg.Pool | null = null;

export function getDbPool(): pg.Pool | null {
  if (!pool && process.env.DATABASE_URL) {
    pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
    
    pool.on('error', (err) => {
      console.error('Unexpected error on idle PostgreSQL client');
    });
  }
  return pool;
}

export async function testDbConnection(): Promise<boolean> {
  const p = getDbPool();
  if (!p) return false;
  try {
    const client = await p.connect();
    await client.query('SELECT 1;');
    client.release();
    return true;
  } catch {
    return false;
  }
}
