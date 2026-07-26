import { Pool } from 'pg';
import crypto from 'crypto';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

async function generateSchemaHash() {
  if (!DATABASE_URL) {
    console.error('ERROR: DATABASE_URL is not set.');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const client = await pool.connect();
    try {
      // Fetch tables
      const tablesRes = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE' 
        ORDER BY table_name;
      `);
      const tables = tablesRes.rows.map(r => r.table_name);

      // Fetch columns
      const colsRes = await client.query(`
        SELECT table_name, column_name, ordinal_position, data_type, udt_name, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public'
        ORDER BY table_name, ordinal_position;
      `);

      // Fetch constraints
      const constRes = await client.query(`
        SELECT tc.table_name, tc.constraint_name, tc.constraint_type, kcu.column_name
        FROM information_schema.table_constraints tc
        LEFT JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
        WHERE tc.table_schema = 'public'
        ORDER BY tc.table_name, tc.constraint_name, kcu.ordinal_position;
      `);

      // Fetch indexes
      const idxRes = await client.query(`
        SELECT tablename, indexname, indexdef
        FROM pg_indexes
        WHERE schemaname = 'public'
        ORDER BY tablename, indexname;
      `);

      const canonicalObject = {
        tables,
        columns: colsRes.rows,
        constraints: constRes.rows,
        indexes: idxRes.rows
      };

      const canonicalString = JSON.stringify(canonicalObject, null, 2);
      const hash = crypto.createHash('sha256').update(canonicalString).digest('hex');

      const metaDir = path.join(process.cwd(), 'dist');
      if (!fs.existsSync(metaDir)) {
        fs.mkdirSync(metaDir, { recursive: true });
      }
      const metaPath = path.join(metaDir, 'schema-metadata.json');
      fs.writeFileSync(metaPath, canonicalString, 'utf8');

      console.log('=== CANONICAL SCHEMA METADATA ===');
      console.log(`Metadata file path: ${metaPath}`);
      console.log(`Metadata byte count: ${Buffer.byteLength(canonicalString, 'utf8')}`);
      console.log(`Table count: ${tables.length}`);
      console.log(`Column count: ${colsRes.rows.length}`);
      console.log(`Constraint count: ${constRes.rows.length}`);
      console.log(`Index count: ${idxRes.rows.length}`);
      console.log(`Canonical SHA-256 Hash: ${hash}`);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Error generating schema hash:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

generateSchemaHash();
