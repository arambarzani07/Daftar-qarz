import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import pg from 'pg';

const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL || '';

function assertSafeTarget(url: string) {
  if (!url) throw new Error('POSTGRES_URL or DATABASE_URL is required');
  let hostname = '';
  try {
    hostname = new URL(url).hostname;
  } catch {
    throw new Error('Invalid PostgreSQL connection URL');
  }

  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  if (process.env.CI !== 'true' && !isLocal) {
    throw new Error('Refusing to bootstrap a non-local database outside CI');
  }
}

function sqlFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((file) => file.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));
}

async function applyFile(client: pg.PoolClient, filePath: string, label: string) {
  const sql = fs.readFileSync(filePath, 'utf8');
  await client.query('BEGIN');
  try {
    await client.query(sql);
    await client.query('COMMIT');
    console.log(`[CI DB] applied ${label}`);
  } catch (error) {
    await client.query('ROLLBACK');
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to apply ${label}: ${message}`);
  }
}

async function bootstrap() {
  assertSafeTarget(connectionString);

  const pool = new pg.Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 2,
    connectionTimeoutMillis: 5000
  });

  const client = await pool.connect();
  try {
    // Minimal Supabase-compatible auth surface for vanilla PostgreSQL CI.
    await client.query(`
      CREATE EXTENSION IF NOT EXISTS pgcrypto;
      CREATE SCHEMA IF NOT EXISTS auth;

      CREATE TABLE IF NOT EXISTS auth.users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE OR REPLACE FUNCTION auth.uid()
      RETURNS UUID
      LANGUAGE SQL
      STABLE
      AS $$ SELECT NULL::UUID $$;

      CREATE OR REPLACE FUNCTION auth.role()
      RETURNS TEXT
      LANGUAGE SQL
      STABLE
      AS $$ SELECT 'authenticated'::TEXT $$;

      CREATE OR REPLACE FUNCTION auth.jwt()
      RETURNS JSONB
      LANGUAGE SQL
      STABLE
      AS $$ SELECT '{}'::JSONB $$;
    `);

    const root = process.cwd();
    const supabaseDir = path.join(root, 'supabase', 'migrations');
    for (const file of sqlFiles(supabaseDir)) {
      await applyFile(client, path.join(supabaseDir, file), `supabase/${file}`);
    }

    // The historical app migration chain starts from a database that already had
    // the old inline baseline. Recreate only those legacy baseline columns here;
    // do not edit historical migration files, because their checksums are immutable.
    await client.query(`
      ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone TEXT;
    `);

    // Server startup intentionally refuses an untracked schema. CI creates the
    // tracker explicitly, then applies every forward migration and records its hash.
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.schema_migrations (
        version TEXT PRIMARY KEY,
        filename TEXT UNIQUE,
        checksum_sha256 VARCHAR(64),
        execution_order INTEGER UNIQUE,
        status VARCHAR(20) NOT NULL DEFAULT 'APPLIED',
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    const appMigrationDir = path.join(root, 'src', 'db', 'migrations');
    const appFiles = sqlFiles(appMigrationDir);

    for (let index = 0; index < appFiles.length; index++) {
      const file = appFiles[index];
      const filePath = path.join(appMigrationDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');
      const checksum = crypto.createHash('sha256').update(sql).digest('hex');
      const version = file.substring(0, 4);

      const existing = await client.query(
        'SELECT checksum_sha256 FROM public.schema_migrations WHERE version = $1',
        [version]
      );
      if (existing.rowCount) {
        if (existing.rows[0].checksum_sha256 !== checksum) {
          throw new Error(`Migration checksum mismatch while bootstrapping ${file}`);
        }
        continue;
      }

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          `INSERT INTO public.schema_migrations
            (version, filename, checksum_sha256, execution_order, status, applied_at)
           VALUES ($1, $2, $3, $4, 'APPLIED', NOW())`,
          [version, file, checksum, index + 1]
        );
        await client.query('COMMIT');
        console.log(`[CI DB] applied app/${file}`);
      } catch (error) {
        await client.query('ROLLBACK');
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to apply app/${file}: ${message}`);
      }
    }

    const tracking = await client.query(`
      SELECT version, filename, checksum_sha256, execution_order, status
      FROM public.schema_migrations
      ORDER BY execution_order ASC
    `);

    if (tracking.rowCount !== appFiles.length) {
      throw new Error(`Migration tracking count mismatch: expected ${appFiles.length}, got ${tracking.rowCount}`);
    }

    console.log(`[CI DB] bootstrap complete: ${appFiles.length} app migrations tracked`);
  } finally {
    client.release();
    await pool.end();
  }
}

bootstrap().catch((error) => {
  console.error('[CI DB] bootstrap failed:', error);
  process.exit(1);
});
