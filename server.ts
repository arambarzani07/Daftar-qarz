import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
import { AsyncLocalStorage } from 'async_hooks';
import { GoogleGenAI, Type } from '@google/genai';

export const dbStorage = new AsyncLocalStorage<ZhiroxDatabase>();

const app = express();
const PORT = 3000;

export const CANONICAL_MARKET_ROLE = 'MARKET_MANAGER';

app.use(express.json());

// Supabase Connection Setup
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const DATABASE_URL = process.env.DATABASE_URL || '';

export const pool = DATABASE_URL ? new pg.Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } }) : null;

export const supabase = (SUPABASE_URL && SUPABASE_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false }
    })
  : null;

// Enforce valid real UUID format
export function isValidUuid(id: string): boolean {
  if (!id) return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

// Ensure PostgreSQL Schema is fully applied and up-to-date (Zero Runtime Mutations/Seeds)
export async function initPostgresSchema() {
  if (!pool) return;
  try {
    const client = await pool.connect();
    try {
      // 1. Verify schema_migrations table exists
      const tableCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'schema_migrations'
        );
      `);
      if (!tableCheck.rows[0].exists) {
        throw new Error('CRITICAL: public.schema_migrations table does not exist. Outdated database schema!');
      }

      // 2. Fetch applied migrations
      const dbRes = await client.query('SELECT version, filename, checksum_sha256 FROM public.schema_migrations ORDER BY version ASC;');
      const appliedMap = new Map<string, { filename: string; checksum: string }>();
      for (const row of dbRes.rows) {
        const metadata = { filename: row.filename, checksum: row.checksum_sha256 };
        appliedMap.set(row.version, metadata);
        if (row.version && row.version.length >= 4) {
          appliedMap.set(row.version.substring(0, 4), metadata);
        }
      }

      // 3. Scan local migrations and verify checksums
      const migrationsDir = path.join(process.cwd(), 'src/db/migrations');
      if (fs.existsSync(migrationsDir)) {
        const files = fs.readdirSync(migrationsDir)
          .filter(f => f.endsWith('.sql'))
          .sort();

        for (const file of files) {
          const migrationVersion = file.substring(0, 4); // E.g., '0001'
          const filePath = path.join(migrationsDir, file);
          const sqlContent = fs.readFileSync(filePath, 'utf-8');
          const checksum = crypto.createHash('sha256').update(sqlContent).digest('hex');

          const applied = appliedMap.get(migrationVersion);
          if (!applied) {
            throw new Error(`CRITICAL: Migration ${file} is not applied in the database!`);
          }
          if (applied.checksum !== checksum) {
            throw new Error(`CRITICAL: Migration checksum mismatch for ${file}. Recorded: ${applied.checksum}, Actual: ${checksum}`);
          }
        }
      }
      console.log('Database schema verified successfully! All migrations are applied and up-to-date.');
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error('Database schema verification failed:', err.message);
    throw err;
  }
}


// In-Memory & File Persisted Ledger Store for Zhirox
export interface Customer {
  id: string;
  market_id: string;
  seq_num: number;
  name: string;
  latin_name?: string;
  phone?: string;
  password?: string;
  whatsapp?: string;
  address?: string;
  currency: 'IQD' | 'USD';
  notes?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  created_at: string;
  updated_at: string;
}

export interface CustomerCreditSettings {
  customer_id: string;
  market_id: string;
  limit_iqd: number;
  limit_usd: number;
  policy: 'NONE' | 'SOFT' | 'HARD';
  lock_status: 'ACTIVE' | 'SOFT_WARNING' | 'LOCKED' | 'TEMPORARY_UNLOCK';
  updated_at?: string;
}

export interface PaymentPromise {
  id: string;
  customer_id: string;
  market_id: string;
  amount: number;
  currency: 'IQD' | 'USD';
  promised_date: string;
  note: string;
  status: 'PENDING' | 'FULFILLED' | 'BROKEN' | 'CANCELLED';
  created_at: string;
  created_by: string;
}

export interface CustomerReminder {
  id: string;
  customer_id: string;
  market_id: string;
  follow_up_date: string;
  reason: string;
  status: 'PENDING' | 'COMPLETED';
  created_at: string;
}

export interface CustomerAttachment {
  id: string;
  customer_id: string;
  market_id: string;
  file_name: string;
  file_type: string;
  file_data_url?: string;
  description?: string;
  created_at: string;
  uploaded_by: string;
}

export interface CustomerDispute {
  id: string;
  customer_id: string;
  market_id: string;
  transaction_id?: string;
  title: string;
  description: string;
  status: 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' | 'REJECTED';
  created_at: string;
  created_by: string;
}

export interface CustomerAuditLog {
  id: string;
  customer_id: string;
  market_id: string;
  action_type: string;
  description: string;
  performed_by: string;
  timestamp: string;
}

export interface RiskAssessment {
  score: number | null;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'INSUFFICIENT_DATA';
  explanation: string;
}

export interface Transaction {
  id: string;
  customer_id: string;
  market_id: string;
  type: 'DEBT_ADD' | 'PAYMENT_RECEIVE' | 'DEBT_FORGIVE' | 'ADJUSTMENT';
  amount: number;
  currency: 'IQD' | 'USD';
  note: string;
  timestamp: string;
  created_by: string;
  reversed?: boolean;
  reversed_reason?: string;
}

export interface ShareLink {
  id: string;
  market_id: string;
  customer_id: string;
  token: string;
  status: 'ACTIVE' | 'REVOKED';
  created_at: string;
  updated_at: string;
  expires_at?: string | null;
  access_count: number;
  last_accessed_at?: string | null;
  pin_code?: string | null;
}

export interface SystemUser {
  id: string;
  name: string;
  phone: string;
  password?: string;
  role: 'PLATFORM_OWNER' | 'MARKET_MANAGER' | 'EMPLOYEE';
  status: 'ACTIVE' | 'INACTIVE' | 'PENDING_ACTIVATION' | 'SUSPENDED' | 'REVOKED';
  permissions: string[];
  created_at: string;
}

export interface UserRecord {
  id: string;
  auth_user_id: string;
  full_name: string;
  email?: string;
  phone?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface PlatformAccessRecord {
  id: string;
  user_id: string;
  role: 'PLATFORM_OWNER';
  status: 'ACTIVE' | 'SUSPENDED' | 'REVOKED';
  created_at?: string;
  updated_at?: string;
}

export interface CustomerAuthLinkRecord {
  id: string;
  market_id: string;
  customer_id: string;
  auth_user_id: string;
  status: 'PENDING_INVITATION' | 'ACTIVE' | 'SUSPENDED' | 'REVOKED';
  linked_at: string;
  revoked_at?: string | null;
  created_at: string;
  updated_at: string;
}

interface ZhiroxDatabase {
  system_users: SystemUser[];
  users: UserRecord[];
  platform_access: PlatformAccessRecord[];
  customer_auth_links: CustomerAuthLinkRecord[];
  customers: Customer[];
  transactions: Transaction[];
  share_links: ShareLink[];
  credit_settings: CustomerCreditSettings[];
  payment_promises: PaymentPromise[];
  reminders: CustomerReminder[];
  attachments: CustomerAttachment[];
  disputes: CustomerDispute[];
  audit_logs: CustomerAuditLog[];
  markets: any[];
  activation_tokens?: any[];
  approval_requests?: any[];
  temporary_debt_unlocks?: any[];
  market_protection_policies?: any[];
  settings: {
    market_name: string;
    owner_name: string;
    owner_phone?: string;
    market_id: string;
    pin_enabled: boolean;
    pin_code: string;
    language: 'ku' | 'ar' | 'en';
    default_currency: 'IQD' | 'USD';
    theme?: 'dark' | 'light';
    is_locked_by_system?: boolean;
  };
}

// Clean empty data structure
const INITIAL_DATA: ZhiroxDatabase = {
  system_users: [],
  users: [],
  platform_access: [],
  customer_auth_links: [],
  markets: [],
  settings: {
    market_name: 'سیستەمی سەرەکی ژیرۆکس',
    owner_name: '',
    market_id: '',
    pin_enabled: false,
    pin_code: '',
    language: 'ku',
    default_currency: 'IQD',
    theme: 'dark'
  },
  share_links: [],
  credit_settings: [],
  payment_promises: [],
  reminders: [],
  attachments: [],
  disputes: [],
  audit_logs: [],
  customers: [],
  transactions: [],
  activation_tokens: [],
  approval_requests: [],
  temporary_debt_unlocks: [],
  market_protection_policies: []
};

// PostgreSQL Real-Time Ledger Mapping & Single-Source-Of-Truth Integration
let globalDb: ZhiroxDatabase = INITIAL_DATA;

export const db = new Proxy({} as ZhiroxDatabase, {
  get(target, prop) {
    if (typeof prop !== 'string' || prop === 'then' || prop === 'toJSON') {
      return (target as any)[prop];
    }
    const store = dbStorage.getStore();
    const targetObj = (store || globalDb) as any;
    if (targetObj[prop] === undefined) {
      if (prop === 'settings') {
        targetObj[prop] = {
          market_name: 'سیستەمی سەرەکی ژیرۆکس',
          owner_name: 'خاوەنی سیستەم',
          market_id: '',
          pin_enabled: false,
          pin_code: '',
          language: 'ku',
          default_currency: 'IQD',
          theme: 'dark'
        };
      } else {
        targetObj[prop] = [];
      }
    }
    return targetObj[prop];
  },
  set(target, prop, value) {
    const store = dbStorage.getStore();
    if (store) {
      (store as any)[prop] = value;
      return true;
    }
    (globalDb as any)[prop] = value;
    return true;
  }
});

export async function loadDbFromPostgres(requestedMarketId?: string): Promise<ZhiroxDatabase> {
  const data: ZhiroxDatabase = {
    system_users: [],
    users: [],
    platform_access: [],
    customer_auth_links: [],
    customers: [],
    transactions: [],
    share_links: [],
    credit_settings: [],
    payment_promises: [],
    reminders: [],
    attachments: [],
    disputes: [],
    audit_logs: [],
    markets: [],
    activation_tokens: [],
    approval_requests: [],
    temporary_debt_unlocks: [],
    market_protection_policies: [],
    settings: {
      market_name: 'ژیڕۆکس مۆڵ (Erbil)',
      owner_name: 'خاوەن کار',
      market_id: 'zhirox-market-erbil',
      pin_enabled: false,
      pin_code: '1234',
      language: 'ku',
      default_currency: 'IQD',
      theme: 'dark'
    }
  };

  if (!pool) return data;

  try {
    const client = await pool.connect();
    try {
      // Load tables in parallel
      const [
        resUsers,
        resMarkets,
        resMemberships,
        resPlatform,
        resCustLinks,
        resCustomers,
        resLedger,
        resShareLinks,
        resCredit,
        resDebtControls,
        resPromises,
        resReminders,
        resAttachments,
        resDisputes,
        resAudit,
        resSettings
      ] = await Promise.all([
        client.query('SELECT * FROM public.users').catch(() => ({ rows: [] })),
        client.query('SELECT * FROM public.markets').catch(() => ({ rows: [] })),
        client.query('SELECT * FROM public.market_memberships').catch(() => ({ rows: [] })),
        client.query('SELECT * FROM public.platform_access').catch(() => ({ rows: [] })),
        client.query('SELECT * FROM public.customer_auth_links').catch(() => ({ rows: [] })),
        client.query(`SELECT * FROM public.customers WHERE status != 'DELETED'`).catch(() => ({ rows: [] })),
        client.query('SELECT * FROM public.ledger_entries WHERE is_reversed = false').catch(() => ({ rows: [] })),
        client.query('SELECT * FROM public.customer_share_links').catch(() => ({ rows: [] })),
        client.query('SELECT * FROM public.customer_credit_settings').catch(() => ({ rows: [] })),
        client.query('SELECT * FROM public.customer_debt_controls').catch(() => ({ rows: [] })),
        client.query('SELECT * FROM public.payment_promises').catch(() => ({ rows: [] })),
        client.query('SELECT * FROM public.customer_reminders').catch(() => ({ rows: [] })),
        client.query('SELECT * FROM public.customer_attachments').catch(() => ({ rows: [] })),
        client.query('SELECT * FROM public.customer_disputes').catch(() => ({ rows: [] })),
        client.query('SELECT * FROM public.audit_logs').catch(() => ({ rows: [] })),
        client.query('SELECT * FROM public.market_settings').catch(() => ({ rows: [] }))
      ]);

      // Map users
      data.users = resUsers.rows.map(u => ({
        id: u.id,
        auth_user_id: u.auth_user_id || u.id,
        full_name: u.full_name || '',
        email: u.email || '',
        phone: u.phone || '',
        is_active: u.is_active !== false,
        created_at: u.created_at?.toISOString ? u.created_at.toISOString() : new Date().toISOString()
      }));

      // In-memory system_users for compatibility
      data.system_users = resUsers.rows.map(u => ({
        id: u.id,
        name: u.full_name || '',
        phone: u.phone || '',
        role: resPlatform.rows.some(pa => pa.user_id === u.id && pa.role === 'PLATFORM_OWNER' && pa.status === 'ACTIVE') ? 'PLATFORM_OWNER' : 'MARKET_MANAGER',
        status: u.is_active !== false ? 'ACTIVE' : 'INACTIVE',
        permissions: [],
        created_at: u.created_at?.toISOString ? u.created_at.toISOString() : new Date().toISOString()
      }));

      // Map platform_access
      data.platform_access = resPlatform.rows.map(pa => ({
        id: pa.id,
        user_id: pa.user_id,
        role: pa.role,
        status: pa.status,
        created_at: pa.created_at?.toISOString ? pa.created_at.toISOString() : new Date().toISOString()
      }));

      // Map customer_auth_links
      data.customer_auth_links = resCustLinks.rows.map(cal => ({
        id: cal.id,
        market_id: cal.market_id,
        customer_id: cal.customer_id,
        auth_user_id: cal.auth_user_id,
        status: cal.status,
        linked_at: cal.linked_at?.toISOString ? cal.linked_at.toISOString() : new Date().toISOString(),
        revoked_at: cal.revoked_at?.toISOString ? cal.revoked_at.toISOString() : null,
        created_at: cal.created_at?.toISOString ? cal.created_at.toISOString() : new Date().toISOString(),
        updated_at: cal.updated_at?.toISOString ? cal.updated_at.toISOString() : new Date().toISOString()
      }));

      // Map markets
      data.markets = resMarkets.rows.map(m => {
        const setRow = resSettings.rows.find(s => s.market_id === m.id);
        const memCount = resMemberships.rows.filter(mm => mm.market_id === m.id).length;
        const custCount = resCustomers.rows.filter(c => c.market_id === m.id).length;
        
        // Lookup actual owner user from membership and user tables
        const ownerMem = resMemberships.rows.find(mm => mm.market_id === m.id && mm.role === 'MARKET_MANAGER');
        const ownerUsr = ownerMem ? resUsers.rows.find(u => u.id === ownerMem.user_id) : null;

        return {
          id: m.id,
          name: m.name,
          status: m.status,
          owner_name: setRow?.owner_name || ownerUsr?.full_name || 'کاک کاوان',
          owner_email: ownerUsr?.email || `${m.id}@zhirox.com`,
          owner_phone: setRow?.owner_phone || ownerUsr?.phone || '07501234567',
          created_at: m.created_at?.toISOString ? m.created_at.toISOString() : new Date().toISOString(),
          license_expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          managers_count: memCount,
          customers_count: custCount,
          currency: setRow?.default_currency || 'IQD'
        };
      });

      // Map customers
      data.customers = resCustomers.rows.map(c => ({
        id: c.id,
        market_id: c.market_id,
        seq_num: c.seq_num || 1,
        name: c.name,
        latin_name: c.latin_name || undefined,
        phone: c.phone || '',
        currency: 'IQD',
        notes: c.notes || undefined,
        created_at: c.created_at?.toISOString ? c.created_at.toISOString() : new Date().toISOString(),
        updated_at: c.updated_at?.toISOString ? c.updated_at.toISOString() : new Date().toISOString()
      }));

      // Map transactions (ledger entries)
      data.transactions = resLedger.rows.map(l => ({
        id: l.id,
        market_id: l.market_id,
        customer_id: l.customer_id,
        amount: Number(l.amount || 0),
        currency: l.currency || 'IQD',
        type: l.entry_type === 'DEBT_ADD' ? 'DEBT_ADD' : 'PAYMENT_RECEIVE',
        note: l.note || '',
        timestamp: l.occurred_at?.toISOString ? l.occurred_at.toISOString() : (l.created_at?.toISOString ? l.created_at.toISOString() : new Date().toISOString()),
        reversed: l.is_reversed || false,
        reversed_reason: l.reversal_reason || undefined,
        created_by: 'system'
      }));

      // Map share_links
      data.share_links = resShareLinks.rows.map(sl => ({
        id: sl.id,
        market_id: sl.market_id,
        customer_id: sl.customer_id,
        token: sl.token,
        status: sl.status,
        pin_code: sl.pin_code || undefined,
        access_count: sl.access_count || 0,
        last_accessed_at: sl.last_accessed_at?.toISOString ? sl.last_accessed_at.toISOString() : undefined,
        created_at: sl.created_at?.toISOString ? sl.created_at.toISOString() : new Date().toISOString(),
        updated_at: sl.updated_at?.toISOString ? sl.updated_at.toISOString() : new Date().toISOString()
      }));

      // Map credit_settings
      const creditSettingsMap = new Map<string, any>();
      for (const cs of resCredit.rows) {
        let item = creditSettingsMap.get(cs.customer_id);
        if (!item) {
          item = {
            id: `cs-${cs.customer_id}`,
            customer_id: cs.customer_id,
            limit_iqd: 0,
            limit_usd: 0,
            lock_status: cs.lock_status || 'UNLOCKED',
            updated_at: cs.updated_at?.toISOString ? cs.updated_at.toISOString() : new Date().toISOString()
          };
          creditSettingsMap.set(cs.customer_id, item);
        }
        if (cs.currency === 'IQD') {
          item.limit_iqd = Number(cs.limit_amount || 0);
        } else if (cs.currency === 'USD') {
          item.limit_usd = Number(cs.limit_amount || 0);
        }
      }
      for (const dc of resDebtControls.rows) {
        let item = creditSettingsMap.get(dc.customer_id);
        if (!item) {
          item = {
            id: `cs-${dc.customer_id}`,
            customer_id: dc.customer_id,
            limit_iqd: 0,
            limit_usd: 0,
            lock_status: dc.debt_status === 'LOCKED' ? 'LOCKED' : 'UNLOCKED',
            updated_at: dc.changed_at?.toISOString ? dc.changed_at.toISOString() : new Date().toISOString()
          };
          creditSettingsMap.set(dc.customer_id, item);
        } else {
          item.lock_status = dc.debt_status === 'LOCKED' ? 'LOCKED' : 'UNLOCKED';
        }
      }
      data.credit_settings = Array.from(creditSettingsMap.values());

      // Map payment_promises
      data.payment_promises = resPromises.rows.map(p => ({
        id: p.id,
        customer_id: p.customer_id,
        market_id: p.market_id || '',
        amount: Number(p.promised_amount || 0),
        currency: p.currency || 'IQD',
        promised_date: p.promise_date?.toISOString ? p.promise_date.toISOString() : p.promise_date,
        status: p.status,
        note: p.note || '',
        created_at: p.created_at?.toISOString ? p.created_at.toISOString() : new Date().toISOString(),
        created_by: 'system'
      }));

      // Map reminders
      data.reminders = resReminders.rows.map(r => ({
        id: r.id,
        customer_id: r.customer_id,
        market_id: r.market_id || '',
        follow_up_date: r.remind_at?.toISOString ? r.remind_at.toISOString() : r.remind_at,
        reason: r.note || '',
        status: r.status,
        created_at: r.created_at?.toISOString ? r.created_at.toISOString() : new Date().toISOString()
      }));

      // Map attachments
      data.attachments = resAttachments.rows.map(a => ({
        id: a.id,
        customer_id: a.customer_id,
        market_id: a.market_id || '',
        file_name: a.file_name,
        file_type: a.mime_type || 'application/octet-stream',
        file_data_url: a.storage_path || '',
        uploaded_by: a.uploaded_by || 'system',
        created_at: a.created_at?.toISOString ? a.created_at.toISOString() : new Date().toISOString()
      }));

      // Map disputes
      data.disputes = resDisputes.rows.map(d => ({
        id: d.id,
        customer_id: d.customer_id,
        market_id: d.market_id || '',
        title: d.reason ? d.reason.split(':')[0] : '',
        description: d.reason ? d.reason.split(':').slice(1).join(':').trim() : '',
        status: d.status,
        created_by: d.opened_by || 'system',
        created_at: d.opened_at?.toISOString ? d.opened_at.toISOString() : new Date().toISOString()
      }));

      // Map audit_logs
      data.audit_logs = resAudit.rows.map(al => ({
        id: al.id,
        customer_id: al.customer_id || '',
        market_id: al.market_id || '',
        action_type: al.action_type,
        description: al.description,
        performed_by: al.performed_by,
        timestamp: al.timestamp?.toISOString ? al.timestamp.toISOString() : new Date().toISOString()
      }));

      // Map market settings
      const globalSettings = (requestedMarketId && resSettings.rows.find(s => s.market_id === requestedMarketId)) || resSettings.rows[0];
      
      const activeMktId = requestedMarketId || '';
      const ownerMemForActive = resMemberships.rows.find(mm => mm.market_id === activeMktId && mm.role === 'MARKET_MANAGER');
      const ownerUsrForActive = ownerMemForActive ? resUsers.rows.find(u => u.id === ownerMemForActive.user_id) : null;

      if (globalSettings) {
        data.settings = {
          market_name: globalSettings.market_name || '',
          owner_name: globalSettings.owner_name || ownerUsrForActive?.full_name || '',
          owner_phone: globalSettings.owner_phone || ownerUsrForActive?.phone || '',
          market_id: globalSettings.market_id || requestedMarketId || '',
          pin_enabled: globalSettings.pin_enabled || false,
          pin_code: globalSettings.pin_code || '',
          language: globalSettings.language || 'ku',
          default_currency: globalSettings.default_currency || 'IQD',
          theme: globalSettings.theme || 'dark'
        };
      } else {
        data.settings = {
          market_name: '',
          owner_name: ownerUsrForActive?.full_name || '',
          owner_phone: ownerUsrForActive?.phone || '',
          market_id: activeMktId,
          pin_enabled: false,
          pin_code: '',
          language: 'ku',
          default_currency: 'IQD',
          theme: 'dark'
        };
      }
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Error loading DB from Postgres:', err);
    throw err;
  }

  return data;
}

export async function saveDbToPostgres(data: ZhiroxDatabase) {
  if (!pool) return;
  const client = await pool.connect();
  try {
    await client.query('BEGIN;');

    // 1. Save Customers
    for (const c of data.customers) {
      await client.query(`
        INSERT INTO public.customers (id, market_id, seq_num, name, latin_name, phone, notes, status, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'ACTIVE', NOW())
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          latin_name = EXCLUDED.latin_name,
          phone = EXCLUDED.phone,
          notes = EXCLUDED.notes,
          updated_at = NOW();
      `, [c.id, c.market_id || '', c.seq_num || 1, c.name, c.latin_name || null, c.phone || null, c.notes || null]);
    }

    // 2. Save Ledger Entries
    for (const t of data.transactions) {
      await client.query(`
        INSERT INTO public.ledger_entries (
          id, market_id, customer_id, currency, entry_type, amount, note, occurred_at, is_reversed, reversal_reason, reversed_at, reversed_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (id) DO UPDATE SET
          is_reversed = EXCLUDED.is_reversed,
          reversal_reason = EXCLUDED.reversal_reason,
          reversed_at = EXCLUDED.reversed_at,
          reversed_by = EXCLUDED.reversed_by;
      `, [
        t.id,
        t.market_id || '',
        t.customer_id,
        t.currency || 'IQD',
        t.type === 'DEBT_ADD' ? 'DEBT_ADD' : 'PAYMENT_RECEIVE',
        t.amount,
        t.note || null,
        t.timestamp ? new Date(t.timestamp) : new Date(),
        t.reversed || false,
        t.reversed_reason || null,
        t.reversed ? new Date() : null,
        t.reversed ? 'system' : null
      ]);
    }

    // 3. Save Credit & Debt Lock Settings
    for (const cs of data.credit_settings) {
      await client.query(`
        INSERT INTO public.customer_credit_settings (
          id, market_id, customer_id, currency, limit_mode, limit_amount, is_enabled, updated_at
        ) VALUES ($1, $2, $3, 'IQD', $4, $5, true, NOW())
        ON CONFLICT (market_id, customer_id, currency) DO UPDATE SET
          limit_mode = EXCLUDED.limit_mode,
          limit_amount = EXCLUDED.limit_amount,
          updated_at = NOW();
      `, [
        `cs-${cs.customer_id}-IQD`,
        data.settings.market_id || '',
        cs.customer_id,
        cs.limit_iqd > 0 ? 'HARD_LIMIT' : 'NO_LIMIT',
        cs.limit_iqd
      ]);

      await client.query(`
        INSERT INTO public.customer_credit_settings (
          id, market_id, customer_id, currency, limit_mode, limit_amount, is_enabled, updated_at
        ) VALUES ($1, $2, $3, 'USD', $4, $5, true, NOW())
        ON CONFLICT (market_id, customer_id, currency) DO UPDATE SET
          limit_mode = EXCLUDED.limit_mode,
          limit_amount = EXCLUDED.limit_amount,
          updated_at = NOW();
      `, [
        `cs-${cs.customer_id}-USD`,
        data.settings.market_id || '',
        cs.customer_id,
        cs.limit_usd > 0 ? 'HARD_LIMIT' : 'NO_LIMIT',
        cs.limit_usd
      ]);

      await client.query(`
        INSERT INTO public.customer_debt_controls (
          id, market_id, customer_id, debt_status, changed_at
        ) VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (market_id, customer_id) DO UPDATE SET
          debt_status = EXCLUDED.debt_status,
          changed_at = NOW();
      `, [
        `dc-${cs.customer_id}`,
        data.settings.market_id || '',
        cs.customer_id,
        cs.lock_status === 'LOCKED' ? 'LOCKED' : 'ACTIVE'
      ]);
    }

    // 4. Save Share Links
    for (const sl of data.share_links) {
      await client.query(`
        INSERT INTO public.customer_share_links (
          id, market_id, customer_id, token, status, pin_code, access_count, last_accessed_at, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET
          status = EXCLUDED.status,
          pin_code = EXCLUDED.pin_code,
          access_count = EXCLUDED.access_count,
          last_accessed_at = EXCLUDED.last_accessed_at,
          updated_at = NOW();
      `, [
        sl.id,
        sl.market_id || '',
        sl.customer_id,
        sl.token,
        sl.status,
        sl.pin_code || null,
        sl.access_count || 0,
        sl.last_accessed_at ? new Date(sl.last_accessed_at) : null
      ]);
    }

    // 5. Save Payment Promises
    for (const p of data.payment_promises) {
      await client.query(`
        INSERT INTO public.payment_promises (
          id, market_id, customer_id, currency, promised_amount, promise_date, note, status, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        ON CONFLICT (id) DO UPDATE SET
          status = EXCLUDED.status,
          note = EXCLUDED.note;
      `, [
        p.id,
        p.market_id || '',
        p.customer_id,
        p.currency || 'IQD',
        p.amount,
        p.promised_date ? new Date(p.promised_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        p.note || null,
        p.status
      ]);
    }

    // 6. Save Reminders
    for (const r of data.reminders) {
      await client.query(`
        INSERT INTO public.customer_reminders (
          id, market_id, customer_id, remind_at, note, priority, status, created_at
        ) VALUES ($1, $2, $3, $4, $5, 'MEDIUM', $6, NOW())
        ON CONFLICT (id) DO UPDATE SET
          status = EXCLUDED.status,
          note = EXCLUDED.note;
      `, [
        r.id,
        r.market_id || '',
        r.customer_id,
        r.follow_up_date ? new Date(r.follow_up_date) : new Date(),
        r.reason || null,
        r.status
      ]);
    }

    // 7. Save Attachments
    for (const a of data.attachments) {
      await client.query(`
        INSERT INTO public.customer_attachments (
          id, market_id, customer_id, file_name, file_size, storage_path, mime_type, uploaded_by, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        ON CONFLICT (id) DO NOTHING;
      `, [
        a.id,
        a.market_id || '',
        a.customer_id,
        a.file_name,
        100, // file size placeholder
        a.file_data_url || '',
        a.file_type || 'application/octet-stream',
        a.uploaded_by || 'system'
      ]);
    }

    // 8. Save Disputes
    for (const d of data.disputes) {
      await client.query(`
        INSERT INTO public.customer_disputes (
          id, market_id, customer_id, reason, status, opened_by, opened_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT (id) DO UPDATE SET
          status = EXCLUDED.status;
      `, [
        d.id,
        data.settings.market_id || '',
        d.customer_id,
        d.title ? `${d.title}: ${d.description || ''}` : (d.description || ''),
        d.status,
        d.created_by || 'system'
      ]);
    }

    // 9. Save Audit Logs
    for (const al of data.audit_logs) {
      try {
        await client.query('SAVEPOINT audit_savepoint;');
        await client.query(`
          INSERT INTO public.audit_logs (
            id, market_id, customer_id, action_type, description, performed_by, timestamp
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (id) DO NOTHING;
        `, [
          al.id,
          al.market_id || '',
          al.customer_id || null,
          al.action_type,
          al.description,
          al.performed_by,
          al.timestamp ? new Date(al.timestamp) : new Date()
        ]);
        await client.query('RELEASE SAVEPOINT audit_savepoint;');
      } catch (aErr) {
        await client.query('ROLLBACK TO SAVEPOINT audit_savepoint;').catch(() => {});
        console.warn('Failed to insert audit log in saveDbToPostgres:', aErr);
      }
    }

    // 10. Save Market Settings
    await client.query(`
      INSERT INTO public.market_settings (
        market_id, market_name, owner_name, owner_phone, pin_enabled, pin_code, language, default_currency, theme, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      ON CONFLICT (market_id) DO UPDATE SET
        market_name = EXCLUDED.market_name,
        owner_name = EXCLUDED.owner_name,
        owner_phone = EXCLUDED.owner_phone,
        pin_enabled = EXCLUDED.pin_enabled,
        pin_code = EXCLUDED.pin_code,
        language = EXCLUDED.language,
        default_currency = EXCLUDED.default_currency,
        theme = EXCLUDED.theme,
        updated_at = NOW();
    `, [
      data.settings.market_id || '',
      data.settings.market_name,
      data.settings.owner_name,
      data.settings.owner_phone || null,
      data.settings.pin_enabled || false,
      data.settings.pin_code || '',
      data.settings.language || 'ku',
      data.settings.default_currency || 'IQD',
      data.settings.theme || 'dark'
    ]);

    await client.query('COMMIT;');
  } catch (err) {
    await client.query('ROLLBACK;');
    console.error('Failed transaction in saveDbToPostgres:', err);
    throw err;
  } finally {
    client.release();
  }

  // After writing changes to public.ledger_entries, rebuild active cache/balances table
  try {
    await rebuildCustomerBalances();
  } catch (err) {
    console.error('Failed to rebuild customer balances cache table:', err);
  }
}

export async function updateCustomerBalanceForCurrency(marketId: string, customerId: string, currency: string, dbClient?: pg.PoolClient) {
  if (!pool && !dbClient) return;
  const exec = dbClient || pool;
  
  const res = await exec!.query(`
    SELECT 
      SUM(CASE WHEN entry_type = 'DEBT_ADD' THEN amount ELSE -amount END) as net_balance,
      SUM(CASE WHEN entry_type = 'DEBT_ADD' THEN amount ELSE 0 END) as total_debt,
      SUM(CASE WHEN entry_type = 'PAYMENT_RECEIVE' THEN amount ELSE 0 END) as total_payments,
      COUNT(*) as tx_count,
      MAX(occurred_at) as last_tx_at
    FROM public.ledger_entries
    WHERE market_id = $1 AND customer_id = $2 AND currency = $3 AND is_reversed = false
  `, [marketId, customerId, currency]);

  const row = res.rows[0];
  const netBalance = Number(row?.net_balance || 0);
  const totalDebt = Number(row?.total_debt || 0);
  const totalPayments = Number(row?.total_payments || 0);
  const txCount = Number(row?.tx_count || 0);
  const lastTxAt = row?.last_tx_at ? new Date(row.last_tx_at) : null;
  const balanceId = `bal-${customerId}-${currency}`;

  await exec!.query(`
    INSERT INTO public.customer_balances (
      id, market_id, customer_id, currency, balance, total_debt_added, total_payments_received, transaction_count, last_transaction_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
    ON CONFLICT (market_id, customer_id, currency) DO UPDATE SET
      balance = EXCLUDED.balance,
      total_debt_added = EXCLUDED.total_debt_added,
      total_payments_received = EXCLUDED.total_payments_received,
      transaction_count = EXCLUDED.transaction_count,
      last_transaction_at = EXCLUDED.last_transaction_at,
      updated_at = NOW()
  `, [balanceId, marketId, customerId, currency, netBalance, totalDebt, totalPayments, txCount, lastTxAt]);
}

export async function rebuildCustomerBalances() {
  if (!pool) return;
  const client = await pool.connect();
  try {
    await client.query('BEGIN;');
    await client.query('DELETE FROM public.customer_balances');

    const res = await client.query(`
      SELECT 
        customer_id,
        market_id,
        currency,
        SUM(CASE WHEN entry_type = 'DEBT_ADD' THEN amount ELSE -amount END) as net_balance,
        SUM(CASE WHEN entry_type = 'DEBT_ADD' THEN amount ELSE 0 END) as total_debt,
        SUM(CASE WHEN entry_type = 'PAYMENT_RECEIVE' THEN amount ELSE 0 END) as total_payments,
        COUNT(*) as tx_count,
        MAX(occurred_at) as last_tx_at
      FROM public.ledger_entries
      WHERE is_reversed = false
      GROUP BY customer_id, market_id, currency
    `);

    for (const r of res.rows) {
      const balanceId = `bal-${r.customer_id}-${r.currency}`;
      await client.query(`
        INSERT INTO public.customer_balances (
          id, market_id, customer_id, currency, balance, total_debt_added, total_payments_received, transaction_count, last_transaction_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      `, [
        balanceId,
        r.market_id,
        r.customer_id,
        r.currency,
        Number(r.net_balance || 0),
        Number(r.total_debt || 0),
        Number(r.total_payments || 0),
        Number(r.tx_count || 0),
        r.last_tx_at ? new Date(r.last_tx_at) : null
      ]);
    }
    await client.query('COMMIT;');
  } catch (err) {
    await client.query('ROLLBACK;');
    console.error('Error in rebuildCustomerBalances:', err);
    throw err;
  } finally {
    client.release();
  }
}

export function saveDb(data: ZhiroxDatabase) {
  saveDbToPostgres(data).catch((err) => {
    console.error('Failed to save database to Postgres:', err);
  });
}

// Phone normalization helper
function normalizePhone(p: string): string {
  if (!p) return '';
  let cleaned = p.replace(/\D/g, '');
  if (cleaned.startsWith('964')) {
    cleaned = '0' + cleaned.substring(3);
  }
  if (cleaned.length === 10 && !cleaned.startsWith('0')) {
    cleaned = '0' + cleaned;
  }
  return cleaned;
}

// Helper functions for immutable balance calculation
function calculateCustomerBalances(customerId: string) {
  const customerTxs = db.transactions.filter(
    (t) => t.customer_id === customerId && !t.reversed
  );

  let iqd = 0;
  let usd = 0;

  for (const t of customerTxs) {
    const isDebt = t.type === 'DEBT_ADD';
    const isPay = t.type === 'PAYMENT_RECEIVE';
    const mult = isDebt ? 1 : isPay ? -1 : 0;

    if (t.currency === 'USD') {
      usd += t.amount * mult;
    } else {
      iqd += t.amount * mult;
    }
  }

  return { iqd, usd };
}

function logAudit(customerId: string, marketId: string, actionType: string, description: string, performedBy: string) {
  const log: CustomerAuditLog = {
    id: `audit-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    customer_id: customerId,
    market_id: marketId,
    action_type: actionType,
    description,
    performed_by: performedBy,
    timestamp: new Date().toISOString()
  };
  db.audit_logs.push(log);
}

function computeRiskAssessment(customerId: string): RiskAssessment {
  const custTxs = db.transactions.filter(t => t.customer_id === customerId && !t.reversed);
  if (custTxs.length < 2) {
    return {
      score: null,
      risk_level: 'INSUFFICIENT_DATA',
      explanation: 'هێشتا زانیاری بەس بۆ هەڵسەنگاندن نییە'
    };
  }

  const payments = custTxs.filter(t => t.type === 'PAYMENT_RECEIVE');
  const debts = custTxs.filter(t => t.type === 'DEBT_ADD');

  let daysSinceLastPayment = null;
  if (payments.length > 0) {
    const lastPayDate = new Date(Math.max(...payments.map(p => new Date(p.timestamp).getTime())));
    daysSinceLastPayment = Math.floor((Date.now() - lastPayDate.getTime()) / (1000 * 60 * 60 * 24));
  } else {
    const firstTxDate = new Date(Math.min(...custTxs.map(t => new Date(t.timestamp).getTime())));
    daysSinceLastPayment = Math.floor((Date.now() - firstTxDate.getTime()) / (1000 * 60 * 60 * 24));
  }

  const brokenPromises = db.payment_promises.filter(p => p.customer_id === customerId && p.status === 'BROKEN').length;

  let score = 100;
  const reasons: string[] = [];

  if (brokenPromises > 0) {
    score -= brokenPromises * 20;
    reasons.push(`${brokenPromises} بەڵێنی پارەدان شکێنراون`);
  }

  if (daysSinceLastPayment > 60) {
    score -= 35;
    reasons.push(`${daysSinceLastPayment} ڕۆژە هیچ پارەدانێک نەکراوە`);
  } else if (daysSinceLastPayment > 30) {
    score -= 20;
    reasons.push(`${daysSinceLastPayment} ڕۆژە پارەدان نەکراوە`);
  }

  const totalDebtIqd = debts.filter(d => d.currency === 'IQD').reduce((s, d) => s + d.amount, 0);
  const totalPayIqd = payments.filter(p => p.currency === 'IQD').reduce((s, p) => s + p.amount, 0);
  if (totalDebtIqd > 0 && totalPayIqd === 0) {
    score -= 15;
    reasons.push('هیچ واسیلییەک بە دینار تۆمار نەکراوە');
  }

  score = Math.max(0, Math.min(100, score));

  let risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
  if (score >= 80) risk_level = 'LOW';
  else if (score >= 55) risk_level = 'MEDIUM';
  else if (score >= 30) risk_level = 'HIGH';
  else risk_level = 'CRITICAL';

  const explanation = reasons.length > 0 ? reasons.join('، ') : 'مێژووی پارەدان دروست و ڕێکە.';

  return {
    score,
    risk_level,
    explanation
  };
}

function getMarketId(req: express.Request): string {
  const paramMarket = req.params?.market_id as string;
  if (paramMarket && paramMarket !== 'SYSTEM_GLOBAL') {
    return paramMarket;
  }
  const headerMarket = (req.headers['x-market-id'] as string) || (req.headers['x-tenant-id'] as string) || (req.headers['x-active-tenant-id'] as string);
  if (headerMarket && headerMarket !== 'SYSTEM_GLOBAL') {
    return headerMarket;
  }
  const queryMarket = req.query.market_id as string;
  if (queryMarket && queryMarket !== 'SYSTEM_GLOBAL') {
    return queryMarket;
  }
  const bodyMarket = req.body?.market_id as string;
  if (bodyMarket && bodyMarket !== 'SYSTEM_GLOBAL') {
    return bodyMarket;
  }
  return '';
}

function calculateMarketTotal(marketId: string) {
  let totalIqd = 0;
  let totalUsd = 0;

  for (const cust of db.customers.filter(c => c.market_id === marketId)) {
    const { iqd, usd } = calculateCustomerBalances(cust.id);
    if (iqd > 0) totalIqd += iqd;
    if (usd > 0) totalUsd += usd;
  }

  return { totalIqd, totalUsd };
}

async function resolveMarketName(marketId?: string): Promise<string> {
  if (!marketId) {
    return db.settings.market_name || 'سوپەرمارکێت';
  }

  // 1. Check in-memory db.markets
  if (db.markets && Array.isArray(db.markets)) {
    const m = db.markets.find((item: any) => item.id === marketId);
    if (m && (m.name || m.official_market_name)) {
      return m.name || m.official_market_name;
    }
  }

  // 2. Query Postgres if connected
  if (pool) {
    try {
      const mRes = await pool.query('SELECT name FROM public.markets WHERE id = $1', [marketId]);
      if (mRes.rows.length > 0 && mRes.rows[0].name) {
        return mRes.rows[0].name;
      }
    } catch (e) {}

    try {
      const msRes = await pool.query('SELECT market_name FROM public.market_settings WHERE market_id = $1', [marketId]);
      if (msRes.rows.length > 0 && msRes.rows[0].market_name) {
        return msRes.rows[0].market_name;
      }
    } catch (e) {}

    try {
      const tokRes = await pool.query("SELECT market_name FROM public.activation_tokens WHERE market_id = $1 AND market_name IS NOT NULL AND market_name != '' AND market_name != 'Market' LIMIT 1", [marketId]);
      if (tokRes.rows.length > 0 && tokRes.rows[0].market_name) {
        return tokRes.rows[0].market_name;
      }
    } catch (e) {}
  }

  // 3. Check if active context in db.settings matches marketId
  if (db.settings.market_id === marketId && db.settings.market_name) {
    return db.settings.market_name;
  }

  return db.settings.market_name || 'سوپەرمارکێت';
}

// REST API Endpoints

// Centralized Authorization Boundary & Default-Deny Tenant Security Middleware
app.use('/api/*', async (req, res, next) => {
  let requestDb: ZhiroxDatabase;
  const headerMarket = (req.headers['x-market-id'] as string) || (req.headers['x-tenant-id'] as string) || (req.headers['x-active-tenant-id'] as string);
  const queryMarket = req.query.market_id as string;
  const bodyMarket = req.body?.market_id as string;
  const reqMarketId = (headerMarket && headerMarket !== 'SYSTEM_GLOBAL') ? headerMarket :
                      (queryMarket && queryMarket !== 'SYSTEM_GLOBAL') ? queryMarket :
                      (bodyMarket && bodyMarket !== 'SYSTEM_GLOBAL') ? bodyMarket : undefined;

  if (pool) {
    try {
      requestDb = await loadDbFromPostgres(reqMarketId);
    } catch (e: any) {
      console.error('Failed to load DB in middleware:', e);
      requestDb = {
        system_users: [],
        users: [],
        platform_access: [],
        customer_auth_links: [],
        customers: [],
        transactions: [],
        share_links: [],
        credit_settings: [],
        payment_promises: [],
        reminders: [],
        attachments: [],
        disputes: [],
        audit_logs: [],
        markets: [],
        activation_tokens: [],
        approval_requests: [],
        temporary_debt_unlocks: [],
        market_protection_policies: [],
        settings: {
          market_name: 'ژیڕۆکس مۆڵ (Erbil)',
          owner_name: 'خاوەن کار',
          market_id: 'zhirox-market-erbil',
          pin_enabled: false,
          pin_code: '1234',
          language: 'ku',
          default_currency: 'IQD',
          theme: 'dark'
        }
      };
      (requestDb as any)._dbError = e;
    }
  } else {
    requestDb = globalDb;
  }

  dbStorage.run(requestDb, async () => {
    const fullUrl = req.originalUrl || req.url || req.path;
    const cleanPath = fullUrl.split('?')[0];

    // Check for DB Outage
    if ((requestDb as any)._dbError) {
      if (
        cleanPath.startsWith('/api/portal') ||
        cleanPath.startsWith('/api/customers') ||
        cleanPath.startsWith('/api/transactions') ||
        cleanPath.startsWith('/api/settings') ||
        cleanPath.startsWith('/api/markets')
      ) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        return res.status(503).json({
          status: 'error',
          code: 'DATABASE_UNAVAILABLE',
          message: 'سیستمی بنکەی زانیاری لەم کاتەدا بەردەست نییە (503 Service Unavailable)'
        });
      }
    }

    // 1. PUBLIC_AUTH_FLOW — ALLOW ALL
    if (
      cleanPath.startsWith('/api/auth') ||
      cleanPath.startsWith('/api/portal') ||
      cleanPath.startsWith('/api/public') ||
      cleanPath.startsWith('/api/activation') ||
      cleanPath === '/api/database/status' ||
      cleanPath === '/api/supabase/status'
    ) {
      return next();
    }

    // 2. CONTROL_PLANE — AUTHORIZE PLATFORM OWNER ONLY
    if (cleanPath.startsWith('/api/platform')) {
      if (!(await isActorPlatformOwner(req))) {
        return res.status(403).json({
          status: 'error',
          code: 'NOT_AUTHORIZED_PLATFORM_OWNER',
          message: 'دەستگەیشتن ڕەتکرایەوە - تەنها خاوەنی سیستەم دەتوانێت بەڕێوەبردنی سەرەکی (Control Plane) ببات بەڕێوە'
        });
      }
      return next();
    }

    // 3. TENANT_SCOPED — VERIFY TENANT ACTOR MEMBERSHIP & MARKET BOUNDARY
    const tenantCheck = await verifyTenantActor(req);
    if (!tenantCheck.authorized) {
      if (await isActorPlatformOwner(req)) {
        return res.status(403).json({
          status: 'error',
          code: 'PLATFORM_OWNER_NO_TENANT_ACCESS',
          message: 'دەستگەیشتن ڕەتکرایەوە - خاوەنی سیستەم تەنها مافی بەڕێوەبردنی سەرەکی (Control Plane) هەیە و مافی بینینی زانیارییە دارایی و کڕیارەکانی مارکێتی نییە (403 Forbidden)'
        });
      }
      const statusCode = tenantCheck.code === 'UNAUTHORIZED' ? 401 : 403;
      return res.status(statusCode).json({
        status: 'error',
        code: tenantCheck.code || 'ACCESS_DENIED',
        message: tenantCheck.message || 'دەستگەیشتن ڕەتکرایەوە'
      });
    }

    next();
  });
});

// Market Summary
app.get('/api/market/summary', async (req, res) => {
  const permCheck = await verifyTenantPermission(req, res, 'VIEW_ANALYTICS');
  if (!permCheck.authorized) return;

  const marketId = getMarketId(req);
  const resolvedMarketName = await resolveMarketName(marketId);
  const marketObj = db.markets?.find((m: any) => m.id === marketId);
  const { totalIqd, totalUsd } = calculateMarketTotal(marketId);
  const marketCustomers = db.customers.filter(c => c.market_id === marketId);
  const customerCount = marketCustomers.length;
  const customerIds = new Set(marketCustomers.map(c => c.id));
  const transactionCount = db.transactions.filter((t) => !t.reversed && customerIds.has(t.customer_id)).length;

  res.json({
    status: 'success',
    data: {
      market_name: resolvedMarketName,
      owner_name: marketObj?.owner_name || db.settings.owner_name,
      total_debt_iqd: totalIqd,
      total_debt_usd: totalUsd,
      customer_count: customerCount,
      transaction_count: transactionCount,
      settings: {
        ...db.settings,
        market_id: marketId,
        market_name: resolvedMarketName,
        owner_name: marketObj?.owner_name || db.settings.owner_name,
        owner_phone: marketObj?.owner_phone || db.settings.owner_phone
      }
    }
  });
});

// 30-Day Debt & Payment Trend Analytics
app.get('/api/analytics/30days', async (req, res) => {
  const permCheck = await verifyTenantPermission(req, res, 'VIEW_ANALYTICS');
  if (!permCheck.authorized) return;

  const marketId = getMarketId(req);
  const now = new Date();
  const daysMap = new Map<string, { date: string; displayDate: string; addedIqd: number; paidIqd: number; addedUsd: number; paidUsd: number; netIqd: number; netUsd: number }>();

  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = d.toISOString().split('T')[0];
    const displayDate = `${d.getDate()}/${d.getMonth() + 1}`;
    daysMap.set(dateStr, {
      date: dateStr,
      displayDate,
      addedIqd: 0,
      paidIqd: 0,
      addedUsd: 0,
      paidUsd: 0,
      netIqd: 0,
      netUsd: 0
    });
  }

  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const marketCustomers = db.customers.filter(c => c.market_id === marketId);
  const customerIds = new Set(marketCustomers.map(c => c.id));
  const validTxs = db.transactions.filter(t => !t.reversed && customerIds.has(t.customer_id) && new Date(t.timestamp) >= thirtyDaysAgo);

  for (const t of validTxs) {
    const dateStr = new Date(t.timestamp).toISOString().split('T')[0];
    const item = daysMap.get(dateStr);
    if (item) {
      if (t.type === 'DEBT_ADD') {
        if (t.currency === 'USD') item.addedUsd += Number(t.amount);
        else item.addedIqd += Number(t.amount);
      } else if (t.type === 'PAYMENT_RECEIVE') {
        if (t.currency === 'USD') item.paidUsd += Number(t.amount);
        else item.paidIqd += Number(t.amount);
      }
    }
  }

  for (const item of daysMap.values()) {
    item.netIqd = item.addedIqd - item.paidIqd;
    item.netUsd = item.addedUsd - item.paidUsd;
  }

  res.json({
    status: 'success',
    data: Array.from(daysMap.values())
  });
});

// Customers List with Sorting and Filtering
app.get('/api/customers', (req, res) => {
  const marketId = getMarketId(req);
  const search = ((req.query.q as string) || '').trim().toLowerCase();
  const sort = (req.query.sort as string) || 'oldest';

  let list = db.customers.filter(c => c.market_id === marketId).map((cust) => {
    const balances = calculateCustomerBalances(cust.id);
    const lastTx = db.transactions
      .filter((t) => t.customer_id === cust.id && !t.reversed)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];

    return {
      ...cust,
      currency: cust.currency || 'IQD',
      balance_iqd: balances.iqd,
      balance_usd: balances.usd,
      last_activity: lastTx ? lastTx.timestamp : cust.updated_at
    };
  });

  if (search) {
    list = list.filter((c) => {
      const matchName = c.name.toLowerCase().includes(search);
      const matchLatin = (c.latin_name || '').toLowerCase().includes(search);
      const matchPhone = (c.phone || '').includes(search);
      const matchIqd = c.balance_iqd.toString().includes(search);
      const matchUsd = c.balance_usd.toString().includes(search);
      return matchName || matchLatin || matchPhone || matchIqd || matchUsd;
    });
  }

  // Sorting
  list.sort((a, b) => {
    if (sort === 'newest') {
      return b.seq_num - a.seq_num;
    } else if (sort === 'oldest') {
      return a.seq_num - b.seq_num;
    } else if (sort === 'highest_debt') {
      const bMax = Math.max(b.balance_iqd, b.balance_usd * 1500);
      const aMax = Math.max(a.balance_iqd, a.balance_usd * 1500);
      return bMax - aMax;
    } else if (sort === 'lowest_debt') {
      const bMax = Math.max(b.balance_iqd, b.balance_usd * 1500);
      const aMax = Math.max(a.balance_iqd, a.balance_usd * 1500);
      return aMax - bMax;
    } else if (sort === 'recent') {
      return new Date(b.last_activity).getTime() - new Date(a.last_activity).getTime();
    } else if (sort === 'alphabetical') {
      return a.name.localeCompare(b.name, 'ku');
    }
    return 0;
  });

  res.json({
    status: 'success',
    data: list
  });
});

// Get Single Customer Profile
app.get('/api/customers/:id', (req, res) => {
  const marketId = getMarketId(req);
  const cust = db.customers.find((c) => c.id === req.params.id);
  if (!cust || cust.market_id !== marketId) {
    return res.status(404).json({ status: 'error', message: 'Customer not found' });
  }

  const balances = calculateCustomerBalances(cust.id);
  const txs = db.transactions.filter((t) => t.customer_id === cust.id && !t.reversed);

  res.json({
    status: 'success',
    data: {
      ...cust,
      currency: cust.currency || 'IQD',
      balance_iqd: balances.iqd,
      balance_usd: balances.usd,
      transaction_count: txs.length
    }
  });
});

// Add Customer
app.post('/api/customers', async (req, res) => {
  const permCheck = await verifyTenantPermission(req, res, 'ADD_CUSTOMER');
  if (!permCheck.authorized) return;

  const marketId = getMarketId(req);
  const { name, latin_name, phone, password, currency, notes } = req.body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ status: 'error', message: 'ناوی قەرزدار پێویستە' });
  }
  if (!phone || typeof phone !== 'string' || !phone.trim()) {
    return res.status(400).json({ status: 'error', message: 'ژمارەی مۆبایل بۆ کڕیار پێویستە و زۆرەملێیە' });
  }
  if (!password || typeof password !== 'string' || !password.trim()) {
    return res.status(400).json({ status: 'error', message: 'وشەی نهێنی بۆ کڕیار پێویستە و زۆرەملێیە' });
  }

  const seq_num = db.customers.length > 0 ? Math.max(...db.customers.map((c) => c.seq_num)) + 1 : 1;
  const newCust: Customer = {
    id: `cust-${Date.now()}`,
    market_id: marketId,
    seq_num,
    name: name.trim(),
    latin_name: latin_name ? latin_name.trim() : undefined,
    phone: phone.trim(),
    password: password.trim(),
    currency: currency === 'USD' ? 'USD' : 'IQD',
    notes: notes ? notes.trim() : undefined,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  db.customers.push(newCust);
  saveDb(db);

  res.status(201).json({
    status: 'success',
    data: {
      ...newCust,
      balance_iqd: 0,
      balance_usd: 0
    }
  });
});

// Get Customer Transactions
app.get('/api/customers/:id/transactions', (req, res) => {
  const marketId = getMarketId(req);
  const cust = db.customers.find((c) => c.id === req.params.id);
  if (!cust || cust.market_id !== marketId) {
    return res.status(404).json({ status: 'error', message: 'Customer not found' });
  }

  const txs = db.transactions
    .filter((t) => t.customer_id === cust.id)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  res.json({
    status: 'success',
    data: txs
  });
});

// Add Transaction (Debt or Payment)
app.post('/api/customers/:id/transactions', async (req, res) => {
  const { type, amount, currency, note } = req.body || {};
  const requiredPerm = type === 'DEBT_ADD' ? 'ADD_DEBT' : 'RECEIVE_PAYMENT';
  const permCheck = await verifyTenantPermission(req, res, requiredPerm);
  if (!permCheck.authorized) return;

  const marketId = getMarketId(req);
  const cust = db.customers.find((c) => c.id === req.params.id);
  if (!cust || cust.market_id !== marketId) {
    return res.status(404).json({ status: 'error', message: 'Customer not found' });
  }

  if (type !== 'DEBT_ADD' && type !== 'PAYMENT_RECEIVE') {
    return res.status(400).json({ status: 'error', message: 'جۆری مامەڵە دیاری نەکراوە' });
  }

  const parsedAmount = Number(amount);
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({ status: 'error', message: 'بڕی پارە دەبێت ژمارەیەکی دروست بێت' });
  }

  // Credit Control Check on DEBT_ADD
  if (type === 'DEBT_ADD') {
    const credit = db.credit_settings.find(c => c.customer_id === cust.id);
    if (credit) {
      if (credit.lock_status === 'LOCKED' && !req.body.override) {
        let hasActiveUnlock = false;
        if (pool) {
          try {
            const unlockRes = await pool.query(
              `SELECT id FROM public.temporary_debt_unlocks WHERE customer_id = $1 AND status = 'ACTIVE' AND expires_at > NOW() LIMIT 1`,
              [cust.id]
            );
            if (unlockRes.rows.length > 0) hasActiveUnlock = true;
          } catch {}
        }
        if (!hasActiveUnlock && (db as any).temporary_debt_unlocks) {
          const memUnlock = (db as any).temporary_debt_unlocks.find((u: any) => u.customer_id === cust.id && u.status === 'ACTIVE' && new Date(u.expires_at) > new Date());
          if (memUnlock) hasActiveUnlock = true;
        }

        if (!hasActiveUnlock) {
          return res.status(400).json({
            status: 'error',
            code: 'ACCOUNT_LOCKED',
            message: 'هەژماری ئەم کڕیارە قفڵ کراوە. ناتوانرێت قەرزی نوێ تۆمار بكرێت.'
          });
        }
      }
      if (credit.policy === 'HARD' && !req.body.override) {
        const currentBal = calculateCustomerBalances(cust.id);
        const targetCurr = currency === 'USD' ? 'USD' : 'IQD';
        if (targetCurr === 'IQD' && credit.limit_iqd > 0 && (currentBal.iqd + parsedAmount) > credit.limit_iqd) {
          return res.status(400).json({
            status: 'error',
            code: 'CREDIT_LIMIT_EXCEEDED',
            message: `بڕی قەرز لە سنووری ڕێگەپێدراو (${credit.limit_iqd.toLocaleString()} دینار) تێدەپەڕێت.`
          });
        }
        if (targetCurr === 'USD' && credit.limit_usd > 0 && (currentBal.usd + parsedAmount) > credit.limit_usd) {
          return res.status(400).json({
            status: 'error',
            code: 'CREDIT_LIMIT_EXCEEDED',
            message: `بڕی قەرز لە سنووری ڕێگەپێدراو ($${credit.limit_usd.toLocaleString()}) تێدەپەڕێت.`
          });
        }
      }
    }
  }

  const newTx: Transaction = {
    id: `tx-${Date.now()}`,
    customer_id: cust.id,
    market_id: cust.market_id,
    type,
    amount: parsedAmount,
    currency: currency === 'USD' ? 'USD' : 'IQD',
    note: (note || '').trim(),
    timestamp: new Date().toISOString(),
    created_by: db.settings.owner_name
  };

  db.transactions.push(newTx);
  cust.updated_at = newTx.timestamp;
  saveDb(db);

  const balances = calculateCustomerBalances(cust.id);

  res.status(201).json({
    status: 'success',
    data: {
      transaction: newTx,
      balances
    }
  });
});

// Reverse/Delete Transaction with Audit
app.post('/api/customers/:id/transactions/:txId/reverse', async (req, res) => {
  const permCheck = await verifyTenantPermission(req, res, 'REVERSE_TRANSACTION');
  if (!permCheck.authorized) return;

  const marketId = getMarketId(req);
  const cust = db.customers.find((c) => c.id === req.params.id);
  if (!cust || cust.market_id !== marketId) {
    return res.status(404).json({ status: 'error', message: 'Customer not found' });
  }

  const tx = db.transactions.find(
    (t) => t.id === req.params.txId && t.customer_id === req.params.id
  );

  if (!tx || tx.market_id !== marketId) {
    return res.status(404).json({ status: 'error', message: 'Transaction not found' });
  }

  if (tx.reversed) {
    return res.status(400).json({ status: 'error', message: 'مامەڵەکە پێشتر هەڵوەشێنراوەتەوە' });
  }

  const { reason } = req.body;
  tx.reversed = true;
  tx.reversed_reason = reason || 'پاشگەزبوونەوە لە مامەڵە';
  saveDb(db);

  logAudit(req.params.id, tx.market_id, 'TRANSACTION_REVERSED', `مامەڵەی ${tx.amount} (${tx.currency}) هەڵوەشێنراوەتەوە: ${tx.reversed_reason}`, db.settings.owner_name);

  const balances = calculateCustomerBalances(req.params.id);

  res.json({
    status: 'success',
    message: 'مامەڵەکە بە سەرکەوتوویی هەڵوەشێنراوەتەوە',
    data: {
      balances
    }
  });
});

// Edit Transaction
app.put('/api/customers/:id/transactions/:txId', (req, res) => {
  const marketId = getMarketId(req);
  const cust = db.customers.find((c) => c.id === req.params.id);
  if (!cust || cust.market_id !== marketId) {
    return res.status(404).json({ status: 'error', message: 'کڕیار نەدۆزرایەوە' });
  }

  const tx = db.transactions.find(
    (t) => t.id === req.params.txId && t.customer_id === req.params.id
  );

  if (!tx || tx.market_id !== marketId) {
    return res.status(404).json({ status: 'error', message: 'مامەڵەکە نەدۆزرایەوە' });
  }

  if (tx.reversed) {
    return res.status(400).json({ status: 'error', message: 'ناتوانرێت مامەڵەی هەڵوەشێنراوە دەستکاری بكرێت' });
  }

  const { amount, currency, type, note, updated_by } = req.body;

  const parsedAmount = Number(amount);
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({ status: 'error', message: 'بڕی پارە دەبێت ژمارەیەکی دروست بێت' });
  }

  if (type !== 'DEBT_ADD' && type !== 'PAYMENT_RECEIVE') {
    return res.status(400).json({ status: 'error', message: 'جۆری مامەڵە هەڵەیە' });
  }

  const oldAmount = tx.amount;
  const oldCurrency = tx.currency;
  const oldType = tx.type;

  tx.amount = parsedAmount;
  tx.currency = currency === 'USD' ? 'USD' : 'IQD';
  tx.type = type;
  if (note !== undefined) {
    tx.note = String(note).trim();
  }

  cust.updated_at = new Date().toISOString();

  const operator = updated_by || db.settings.owner_name;
  logAudit(
    req.params.id,
    tx.market_id,
    'TRANSACTION_EDITED',
    `دەستکاری مامەڵە: لە [${oldAmount} ${oldCurrency} - ${oldType}] گۆڕدرا بۆ [${tx.amount} ${tx.currency} - ${tx.type}] (تێبینی: ${tx.note || 'بێ تێبینی'})`,
    operator
  );

  saveDb(db);

  const balances = calculateCustomerBalances(req.params.id);

  res.json({
    status: 'success',
    message: 'مامەڵەکە بە سەرکەوتوویی دەستکاری کرا',
    data: {
      transaction: tx,
      balances
    }
  });
});

// ==================================================
// PHASE 1 — ADVANCED CUSTOMER PROFILE ENDPOINTS
// ==================================================

// GET Complete Advanced Profile
app.get('/api/customers/:id/advanced-profile', (req, res) => {
  const cust = db.customers.find((c) => c.id === req.params.id);
  if (!cust) {
    return res.status(404).json({ status: 'error', message: 'کڕیار نەدۆزرایەوە' });
  }

  const balances = calculateCustomerBalances(cust.id);
  const custTxs = db.transactions.filter((t) => t.customer_id === cust.id && !t.reversed);

  const iqdDebts = custTxs.filter(t => t.currency === 'IQD' && t.type === 'DEBT_ADD');
  const iqdPays = custTxs.filter(t => t.currency === 'IQD' && t.type === 'PAYMENT_RECEIVE');
  const usdDebts = custTxs.filter(t => t.currency === 'USD' && t.type === 'DEBT_ADD');
  const usdPays = custTxs.filter(t => t.currency === 'USD' && t.type === 'PAYMENT_RECEIVE');

  const total_debt_iqd = iqdDebts.reduce((s, t) => s + t.amount, 0);
  const total_payments_iqd = iqdPays.reduce((s, t) => s + t.amount, 0);
  const total_debt_usd = usdDebts.reduce((s, t) => s + t.amount, 0);
  const total_payments_usd = usdPays.reduce((s, t) => s + t.amount, 0);

  const largest_debt_iqd = iqdDebts.length > 0 ? Math.max(...iqdDebts.map(t => t.amount)) : 0;
  const largest_payment_iqd = iqdPays.length > 0 ? Math.max(...iqdPays.map(t => t.amount)) : 0;
  const largest_debt_usd = usdDebts.length > 0 ? Math.max(...usdDebts.map(t => t.amount)) : 0;
  const largest_payment_usd = usdPays.length > 0 ? Math.max(...usdPays.map(t => t.amount)) : 0;

  const timestamps = custTxs.map(t => new Date(t.timestamp).getTime());
  const payTimestamps = custTxs.filter(t => t.type === 'PAYMENT_RECEIVE').map(t => new Date(t.timestamp).getTime());

  const first_tx_date = timestamps.length > 0 ? new Date(Math.min(...timestamps)).toISOString() : null;
  const latest_tx_date = timestamps.length > 0 ? new Date(Math.max(...timestamps)).toISOString() : null;
  const latest_payment_date = payTimestamps.length > 0 ? new Date(Math.max(...payTimestamps)).toISOString() : null;

  let days_since_last_payment: number | null = null;
  if (latest_payment_date) {
    days_since_last_payment = Math.floor((Date.now() - new Date(latest_payment_date).getTime()) / (1000 * 60 * 60 * 24));
  }

  const avg_payment_amount_iqd = iqdPays.length > 0 ? Math.round(total_payments_iqd / iqdPays.length) : null;
  const avg_payment_amount_usd = usdPays.length > 0 ? Math.round(total_payments_usd / usdPays.length) : null;

  let debt_growth_trend: 'INCREASING' | 'DECREASING' | 'STABLE' = 'STABLE';
  if (total_debt_iqd > total_payments_iqd * 1.5) debt_growth_trend = 'INCREASING';
  else if (total_payments_iqd >= total_debt_iqd && total_debt_iqd > 0) debt_growth_trend = 'DECREASING';

  const status_message = custTxs.length < 2
    ? 'زانیاری بەس نییە'
    : days_since_last_payment !== null && days_since_last_payment > 30
    ? 'واسیلی دواکەوتووە'
    : 'دۆخی دارایی گونجاوە';

  let credit = db.credit_settings.find(c => c.customer_id === cust.id);
  if (!credit) {
    credit = {
      customer_id: cust.id,
      market_id: cust.market_id,
      limit_iqd: 0,
      limit_usd: 0,
      policy: 'NONE',
      lock_status: 'ACTIVE'
    };
  }

  const risk_assessment = computeRiskAssessment(cust.id);

  const promises = db.payment_promises.filter(p => p.customer_id === cust.id);
  const reminders = db.reminders.filter(r => r.customer_id === cust.id);
  const attachments = db.attachments.filter(a => a.customer_id === cust.id);
  const disputes = db.disputes.filter(d => d.customer_id === cust.id);
  const audit_logs = db.audit_logs
    .filter(a => a.customer_id === cust.id)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  res.json({
    status: 'success',
    data: {
      customer: cust,
      balances,
      financial_summary: {
        total_debt_iqd,
        total_payments_iqd,
        total_debt_usd,
        total_payments_usd,
        debt_tx_count_iqd: iqdDebts.length,
        payment_tx_count_iqd: iqdPays.length,
        debt_tx_count_usd: usdDebts.length,
        payment_tx_count_usd: usdPays.length,
        largest_debt_iqd,
        largest_payment_iqd,
        largest_debt_usd,
        largest_payment_usd,
        first_tx_date,
        latest_tx_date,
        latest_payment_date
      },
      money_health: {
        days_since_last_payment,
        avg_payment_interval_days: null,
        avg_payment_amount_iqd,
        avg_payment_amount_usd,
        debt_growth_trend,
        status_message
      },
      credit_settings: credit,
      risk_assessment,
      promises,
      reminders,
      attachments,
      disputes,
      audit_logs
    }
  });
});

// PUT Update Customer Info
app.put('/api/customers/:id', (req, res) => {
  const cust = db.customers.find(c => c.id === req.params.id);
  if (!cust) return res.status(404).json({ status: 'error', message: 'کڕیار نەدۆزرایەوە' });

  const { name, latin_name, phone, whatsapp, address, notes, status } = req.body;
  if (name && typeof name === 'string' && name.trim()) cust.name = name.trim();
  if (latin_name !== undefined) cust.latin_name = latin_name ? latin_name.trim() : undefined;
  if (phone !== undefined) cust.phone = phone ? phone.trim() : undefined;
  if (whatsapp !== undefined) cust.whatsapp = whatsapp ? whatsapp.trim() : undefined;
  if (address !== undefined) cust.address = address ? address.trim() : undefined;
  if (notes !== undefined) cust.notes = notes ? notes.trim() : undefined;
  if (status && ['ACTIVE', 'INACTIVE', 'ARCHIVED'].includes(status)) cust.status = status;

  cust.updated_at = new Date().toISOString();
  saveDb(db);

  logAudit(cust.id, cust.market_id, 'CUSTOMER_EDIT', `زانیارییەکانی کڕیار (${cust.name}) نوێکرانەوە`, db.settings.owner_name);

  res.json({ status: 'success', data: cust });
});

// PUT Credit Control Settings
app.put('/api/customers/:id/credit-settings', async (req, res) => {
  const permCheck = await verifyTenantPermission(req, res, 'MANAGE_CREDIT_LIMIT');
  if (!permCheck.authorized) return;

  const cust = db.customers.find(c => c.id === req.params.id);
  if (!cust) return res.status(404).json({ status: 'error', message: 'کڕیار نەدۆزرایەوە' });

  const { limit_iqd, limit_usd, policy, lock_status } = req.body;
  let credit = db.credit_settings.find(c => c.customer_id === cust.id);
  if (!credit) {
    credit = {
      customer_id: cust.id,
      market_id: cust.market_id,
      limit_iqd: 0,
      limit_usd: 0,
      policy: 'NONE',
      lock_status: 'ACTIVE'
    };
    db.credit_settings.push(credit);
  }

  if (typeof limit_iqd === 'number') credit.limit_iqd = Math.max(0, limit_iqd);
  if (typeof limit_usd === 'number') credit.limit_usd = Math.max(0, limit_usd);
  if (['NONE', 'SOFT', 'HARD'].includes(policy)) credit.policy = policy;
  if (['ACTIVE', 'SOFT_WARNING', 'LOCKED', 'TEMPORARY_UNLOCK'].includes(lock_status)) credit.lock_status = lock_status;
  credit.updated_at = new Date().toISOString();

  saveDb(db);

  logAudit(cust.id, cust.market_id, 'CREDIT_LIMIT_CHANGE', `سنووری قەرز گۆڕدرا: IQD: ${credit.limit_iqd.toLocaleString()}, USD: $${credit.limit_usd.toLocaleString()}, دۆخ: ${credit.lock_status}`, db.settings.owner_name);

  res.json({ status: 'success', data: credit });
});

// POST Payment Promise
app.post('/api/customers/:id/promises', (req, res) => {
  const cust = db.customers.find(c => c.id === req.params.id);
  if (!cust) return res.status(404).json({ status: 'error', message: 'کڕیار نەدۆزرایەوە' });

  const { amount, currency, promised_date, note } = req.body;
  const parsedAmt = Number(amount);
  if (isNaN(parsedAmt) || parsedAmt <= 0) return res.status(400).json({ status: 'error', message: 'بڕی پارە لە بەڵێنی پارەدان هەڵەیە' });
  if (!promised_date) return res.status(400).json({ status: 'error', message: 'بەرواری بەڵێنی پارەدان دیاری نەکراوە' });

  const promise: PaymentPromise = {
    id: `prom-${Date.now()}`,
    customer_id: cust.id,
    market_id: cust.market_id,
    amount: parsedAmt,
    currency: currency === 'USD' ? 'USD' : 'IQD',
    promised_date,
    note: (note || '').trim(),
    status: 'PENDING',
    created_at: new Date().toISOString(),
    created_by: db.settings.owner_name
  };

  db.payment_promises.push(promise);
  saveDb(db);

  logAudit(cust.id, cust.market_id, 'PROMISE_CREATED', `بەڵێنی پارەدان تۆمارکرا: ${parsedAmt} ${promise.currency} لە بەرواری ${promised_date}`, db.settings.owner_name);

  res.status(201).json({ status: 'success', data: promise });
});

// PUT Payment Promise Status
app.put('/api/customers/:id/promises/:promiseId/status', (req, res) => {
  const cust = db.customers.find(c => c.id === req.params.id);
  if (!cust) return res.status(404).json({ status: 'error', message: 'کڕیار نەدۆزرایەوە' });

  const promise = db.payment_promises.find(p => p.id === req.params.promiseId && p.customer_id === cust.id);
  if (!promise) return res.status(404).json({ status: 'error', message: 'بەڵێنی پارەدان نەدۆزرایەوە' });

  const { status } = req.body;
  if (!['PENDING', 'FULFILLED', 'BROKEN', 'CANCELLED'].includes(status)) {
    return res.status(400).json({ status: 'error', message: 'دۆخی بەڵێنی پارەدان ناڕاستە' });
  }

  promise.status = status;
  saveDb(db);

  logAudit(cust.id, cust.market_id, 'PROMISE_STATUS_CHANGE', `دۆخی بەڵێنی پارەدان گۆڕدرا بۆ: ${status}`, db.settings.owner_name);

  res.json({ status: 'success', data: promise });
});

// POST Reminder
app.post('/api/customers/:id/reminders', (req, res) => {
  const cust = db.customers.find(c => c.id === req.params.id);
  if (!cust) return res.status(404).json({ status: 'error', message: 'کڕیار نەدۆزرایەوە' });

  const { follow_up_date, reason } = req.body;
  if (!follow_up_date) return res.status(400).json({ status: 'error', message: 'بەرواری یادخستنەوە دیاری نەکراوە' });

  const reminder: CustomerReminder = {
    id: `rem-${Date.now()}`,
    customer_id: cust.id,
    market_id: cust.market_id,
    follow_up_date,
    reason: (reason || '').trim(),
    status: 'PENDING',
    created_at: new Date().toISOString()
  };

  db.reminders.push(reminder);
  saveDb(db);

  logAudit(cust.id, cust.market_id, 'REMINDER_CREATED', `یادخستنەوە تۆمارکرا بۆ بەرواری ${follow_up_date}`, db.settings.owner_name);

  res.status(201).json({ status: 'success', data: reminder });
});

// PUT Reminder Status
app.put('/api/customers/:id/reminders/:remId/status', (req, res) => {
  const rem = db.reminders.find(r => r.id === req.params.remId && r.customer_id === req.params.id);
  if (!rem) return res.status(404).json({ status: 'error', message: 'یادخستنەوە نەدۆزرایەوە' });

  const { status } = req.body;
  if (!['PENDING', 'COMPLETED'].includes(status)) return res.status(400).json({ status: 'error', message: 'دۆخ نادیارە' });

  rem.status = status;
  saveDb(db);

  res.json({ status: 'success', data: rem });
});

// POST Attachment
app.post('/api/customers/:id/attachments', (req, res) => {
  const cust = db.customers.find(c => c.id === req.params.id);
  if (!cust) return res.status(404).json({ status: 'error', message: 'کڕیار نەدۆزرایەوە' });

  const { file_name, file_type, file_data_url, description } = req.body;
  if (!file_name) return res.status(400).json({ status: 'error', message: 'ناوی فایل پێویستە' });

  const attachment: CustomerAttachment = {
    id: `att-${Date.now()}`,
    customer_id: cust.id,
    market_id: cust.market_id,
    file_name: file_name.trim(),
    file_type: file_type || 'image/png',
    file_data_url,
    description: (description || '').trim(),
    created_at: new Date().toISOString(),
    uploaded_by: db.settings.owner_name
  };

  db.attachments.push(attachment);
  saveDb(db);

  logAudit(cust.id, cust.market_id, 'ATTACHMENT_ADDED', `هاوپێچ زیاکرا: ${attachment.file_name}`, db.settings.owner_name);

  res.status(201).json({ status: 'success', data: attachment });
});

// DELETE Attachment
app.delete('/api/customers/:id/attachments/:attId', (req, res) => {
  const idx = db.attachments.findIndex(a => a.id === req.params.attId && a.customer_id === req.params.id);
  if (idx === -1) return res.status(404).json({ status: 'error', message: 'هاوپێچ نەدۆزرایەوە' });

  const att = db.attachments[idx];
  db.attachments.splice(idx, 1);
  saveDb(db);

  logAudit(req.params.id, att.market_id, 'ATTACHMENT_DELETED', `هاوپێچ سڕایەوە: ${att.file_name}`, db.settings.owner_name);

  res.json({ status: 'success', message: 'هاوپێچ سڕایەوە' });
});

// POST Dispute
app.post('/api/customers/:id/disputes', (req, res) => {
  const cust = db.customers.find(c => c.id === req.params.id);
  if (!cust) return res.status(404).json({ status: 'error', message: 'کڕیار نەدۆزرایەوە' });

  const { title, description, transaction_id } = req.body;
  if (!title || !title.trim()) return res.status(400).json({ status: 'error', message: 'سەردێڕی ناڕەزایی پێویستە' });

  const dispute: CustomerDispute = {
    id: `disp-${Date.now()}`,
    customer_id: cust.id,
    market_id: cust.market_id,
    transaction_id,
    title: title.trim(),
    description: (description || '').trim(),
    status: 'OPEN',
    created_at: new Date().toISOString(),
    created_by: db.settings.owner_name
  };

  db.disputes.push(dispute);
  saveDb(db);

  logAudit(cust.id, cust.market_id, 'DISPUTE_LOGGED', `کێشە/ناڕەزایی تۆمارکرا: ${dispute.title}`, db.settings.owner_name);

  res.status(201).json({ status: 'success', data: dispute });
});

// ==================================================
// PHASE 2 — CUSTOMER STATEMENT & EXPORT ENGINE ENDPOINT
// ==================================================

app.get('/api/customers/:id/statement', async (req, res) => {
  const permCheck = await verifyTenantPermission(req, res, 'EXPORT_STATEMENTS');
  if (!permCheck.authorized) return;

  let cust = db.customers.find((c) => c.id === req.params.id);
  if (!cust && pool) {
    try {
      const custRes = await pool.query("SELECT * FROM public.customers WHERE id = $1", [req.params.id]);
      if (custRes.rows.length > 0) {
        cust = custRes.rows[0];
      }
    } catch (e) {
      console.error('Failed to query customer for statement:', e);
    }
  }

  if (!cust) {
    return res.status(404).json({ status: 'error', message: 'کڕیار نەدۆزرایەوە' });
  }

  // Tenant Isolation Check using active market context
  const activeMarketId = permCheck.marketId || getMarketId(req);
  if (cust.market_id && activeMarketId && activeMarketId !== 'SYSTEM_GLOBAL' && cust.market_id !== activeMarketId && permCheck.role !== 'PLATFORM_OWNER') {
    return res.status(403).json({ status: 'error', message: 'دەستەڵاتی گەیشتن نییە بۆ ئەم مارکێتە' });
  }

  const currency = (req.query.currency as string) === 'USD' ? 'USD' : 'IQD';
  const from_date = (req.query.from_date as string) || null;
  const to_date = (req.query.to_date as string) || null;
  const filterType = (req.query.type as string) || 'ALL'; // 'ALL' | 'DEBT_ADD' | 'PAYMENT_RECEIVE'

  // Get all valid non-reversed transactions for this customer and currency
  const allCustTxs = db.transactions
    .filter((t) => t.customer_id === cust.id && t.currency === currency && !t.reversed)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  // Calculate True Running Balance across entire ledger chronology
  let running = 0;
  const txsWithRunning = allCustTxs.map((t) => {
    if (t.type === 'DEBT_ADD') {
      running += t.amount;
    } else if (t.type === 'PAYMENT_RECEIVE') {
      running -= t.amount;
    }
    return {
      ...t,
      running_balance: running
    };
  });

  // Determine Opening Balance for selected date range
  let opening_balance = 0;
  let fromTime: number | null = null;
  let toTime: number | null = null;

  if (from_date) {
    const fDate = new Date(from_date.includes('T') ? from_date : `${from_date}T00:00:00.000Z`);
    if (!isNaN(fDate.getTime())) {
      fromTime = fDate.getTime();
    }
  }

  if (to_date) {
    const tDate = new Date(to_date.includes('T') ? to_date : `${to_date}T23:59:59.999Z`);
    if (!isNaN(tDate.getTime())) {
      toTime = tDate.getTime();
    }
  }

  // Transactions before fromTime contribute to opening_balance
  if (fromTime !== null) {
    const priorTxs = allCustTxs.filter((t) => new Date(t.timestamp).getTime() < fromTime!);
    for (const pTx of priorTxs) {
      if (pTx.type === 'DEBT_ADD') opening_balance += pTx.amount;
      else if (pTx.type === 'PAYMENT_RECEIVE') opening_balance -= pTx.amount;
    }
  }

  // Filter transactions within [fromTime, toTime]
  let periodTxs = txsWithRunning.filter((t) => {
    const txMs = new Date(t.timestamp).getTime();
    if (fromTime !== null && txMs < fromTime) return false;
    if (toTime !== null && txMs > toTime) return false;
    return true;
  });

  // Calculate Period Summary Metrics
  const period_total_debt = periodTxs
    .filter((t) => t.type === 'DEBT_ADD')
    .reduce((s, t) => s + t.amount, 0);

  const period_total_payments = periodTxs
    .filter((t) => t.type === 'PAYMENT_RECEIVE')
    .reduce((s, t) => s + t.amount, 0);

  const closing_balance = opening_balance + period_total_debt - period_total_payments;

  // Apply Transaction Type Filter if requested
  if (filterType === 'DEBT_ADD') {
    periodTxs = periodTxs.filter((t) => t.type === 'DEBT_ADD');
  } else if (filterType === 'PAYMENT_RECEIVE') {
    periodTxs = periodTxs.filter((t) => t.type === 'PAYMENT_RECEIVE');
  }

  const balances = calculateCustomerBalances(cust.id);
  const updatedCust = {
    ...cust,
    balance_iqd: balances.iqd,
    balance_usd: balances.usd
  };

  res.json({
    status: 'success',
    data: {
      customer: updatedCust,
      currency,
      from_date,
      to_date,
      opening_balance,
      period_total_debt,
      period_total_payments,
      closing_balance,
      transactions: periodTxs,
      total_count: periodTxs.length
    }
  });
});

// PUT Dispute Status
app.put('/api/customers/:id/disputes/:disputeId/status', (req, res) => {
  const dispute = db.disputes.find(d => d.id === req.params.disputeId && d.customer_id === req.params.id);
  if (!dispute) return res.status(404).json({ status: 'error', message: 'کێشە نەدۆزرایەوە' });

  const { status } = req.body;
  if (!['OPEN', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED'].includes(status)) return res.status(400).json({ status: 'error', message: 'دۆخی ناڕەزایی هەڵەیە' });

  dispute.status = status;
  saveDb(db);

  logAudit(req.params.id, dispute.market_id, 'DISPUTE_STATUS_CHANGE', `دۆخی کێشە (${dispute.title}) گۆڕدرا بۆ: ${status}`, db.settings.owner_name);

  res.json({ status: 'success', data: dispute });
});

const getBaseUrlFromReq = (req: express.Request) => {
  if (process.env.PUBLIC_APP_URL && process.env.PUBLIC_APP_URL.trim()) {
    return process.env.PUBLIC_APP_URL.trim().replace(/\/+$/, '');
  }
  if (process.env.APP_URL && process.env.APP_URL.trim()) {
    return process.env.APP_URL.trim().replace(/\/+$/, '');
  }

  // Check Origin header
  const origin = req.headers['origin'];
  if (typeof origin === 'string' && origin.startsWith('http')) {
    return origin.replace(/\/+$/, '');
  }

  // Check Referer header
  const referer = req.headers['referer'];
  if (typeof referer === 'string' && referer.startsWith('http')) {
    try {
      const parsed = new URL(referer);
      return `${parsed.protocol}//${parsed.host}`.replace(/\/+$/, '');
    } catch (e) {
      // ignore
    }
  }

  const forwardedHost = req.headers['x-forwarded-host'];
  const forwardedProto = req.headers['x-forwarded-proto'] || 'https';
  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`.replace(/\/+$/, '');
  }

  const host = req.get('host');
  if (host && !host.includes('localhost') && !host.includes('127.0.0.1')) {
    const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https';
    return `${proto}://${host}`.replace(/\/+$/, '');
  }

  const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https';
  return `${proto}://${host || 'localhost:3000'}`.replace(/\/+$/, '');
};

// ==================================================
// CUSTOMER LIVE BALANCE SHARE LINK ENDPOINTS
// ==================================================

// 1. Get or auto-create active share link for customer
app.get('/api/customers/:id/share-link', (req, res) => {
  const cust = db.customers.find((c) => c.id === req.params.id);
  if (!cust) {
    return res.status(404).json({ status: 'error', message: 'Customer not found' });
  }

  let activeLink = db.share_links.find(
    (sl) => sl.customer_id === cust.id && sl.status === 'ACTIVE'
  );

  if (activeLink && activeLink.expires_at && new Date(activeLink.expires_at) < new Date()) {
    activeLink.status = 'REVOKED';
    activeLink = undefined;
  }

  if (!activeLink) {
    const token = crypto.randomBytes(20).toString('hex');
    activeLink = {
      id: `sl-${Date.now()}`,
      market_id: cust.market_id,
      customer_id: cust.id,
      token,
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      access_count: 0
    };
    db.share_links.push(activeLink);
    saveDb(db);
  }

  const baseUrl = getBaseUrlFromReq(req);
  res.json({
    status: 'success',
    data: {
      ...activeLink,
      share_url: `${baseUrl}/b/${activeLink.token}`
    }
  });
});

// 2. Regenerate share link (revokes previous)
app.post('/api/customers/:id/share-link/regenerate', (req, res) => {
  const cust = db.customers.find((c) => c.id === req.params.id);
  if (!cust) {
    return res.status(404).json({ status: 'error', message: 'Customer not found' });
  }

  for (const sl of db.share_links) {
    if (sl.customer_id === cust.id && sl.status === 'ACTIVE') {
      sl.status = 'REVOKED';
      sl.updated_at = new Date().toISOString();
    }
  }

  const token = crypto.randomBytes(20).toString('hex');
  const newLink: ShareLink = {
    id: `sl-${Date.now()}`,
    market_id: cust.market_id,
    customer_id: cust.id,
    token,
    status: 'ACTIVE',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    access_count: 0
  };

  db.share_links.push(newLink);
  saveDb(db);

  const baseUrl = getBaseUrlFromReq(req);
  res.json({
    status: 'success',
    data: {
      ...newLink,
      share_url: `${baseUrl}/b/${newLink.token}`
    }
  });
});

// 3. Revoke share link
app.post('/api/customers/:id/share-link/revoke', (req, res) => {
  const cust = db.customers.find((c) => c.id === req.params.id);
  if (!cust) {
    return res.status(404).json({ status: 'error', message: 'Customer not found' });
  }

  for (const sl of db.share_links) {
    if (sl.customer_id === cust.id && sl.status === 'ACTIVE') {
      sl.status = 'REVOKED';
      sl.updated_at = new Date().toISOString();
    }
  }

  saveDb(db);

  res.json({
    status: 'success',
    message: 'بەستەرەکە هەڵوەشێنرایەوە'
  });
});

// 4. Set optional PIN
app.post('/api/customers/:id/share-link/pin', (req, res) => {
  const cust = db.customers.find((c) => c.id === req.params.id);
  if (!cust) {
    return res.status(404).json({ status: 'error', message: 'Customer not found' });
  }

  const activeLink = db.share_links.find(
    (sl) => sl.customer_id === cust.id && sl.status === 'ACTIVE'
  );

  if (!activeLink) {
    return res.status(400).json({ status: 'error', message: 'هیچ بەستەرێکی چالاک نییە' });
  }

  const { pin } = req.body;
  activeLink.pin_code = pin ? String(pin).trim() : null;
  activeLink.updated_at = new Date().toISOString();

  saveDb(db);

  res.json({
    status: 'success',
    data: activeLink
  });
});

// Generate Customer Portal Activation Link
app.post(['/api/customers/:id/portal/activation-link', '/api/customers/:id/activation-link'], async (req, res) => {
  const cust = db.customers.find((c) => c.id === req.params.id);
  if (!cust) return res.status(404).json({ status: 'error', message: 'کڕیار نەدۆزرایەوە' });

  const permCheck = await verifyTenantPermission(req, res, 'ADD_CUSTOMER', cust.market_id);
  if (!permCheck.authorized) return;

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  const actRecord = {
    id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    token_hash: tokenHash,
    market_id: cust.market_id,
    user_id: cust.id,
    manager_name: cust.name,
    manager_login_phone: cust.phone,
    role: 'CUSTOMER',
    status: 'PENDING',
    purpose: 'CUSTOMER_ACTIVATION',
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString()
  };

  if (!(db as any).activation_tokens) (db as any).activation_tokens = [];
  (db as any).activation_tokens.push(actRecord);

  if (pool) {
    try {
      await pool.query(`
        INSERT INTO public.activation_tokens (id, token_hash, market_id, user_id, manager_name, manager_login_phone, role, status, purpose, expires_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [actRecord.id, actRecord.token_hash, actRecord.market_id, actRecord.user_id, actRecord.manager_name, actRecord.manager_login_phone, actRecord.role, actRecord.status, actRecord.purpose, actRecord.expires_at]);
    } catch (e) {
      console.error('Failed to save activation_token to Postgres:', e);
    }
  }

  saveDb(db);
  const baseUrl = getBaseUrlFromReq(req);

  res.json({
    status: 'success',
    data: {
      token: rawToken,
      activation_url: `${baseUrl}/activate?token=${rawToken}`
    }
  });
});

// 5. PUBLIC READ-ONLY LIVE CUSTOMER BALANCE & HISTORY ENDPOINT
app.get('/api/public/customer-balance/:token', async (req, res) => {
  const token = req.params.token;

  if (!token) {
    return res.status(404).json({
      status: 'error',
      code: 'LINK_INVALID',
      message: 'ئەم بەستەرە بەردەست نییە یان چیتر چالاک نییە.'
    });
  }

  let link = db.share_links.find((sl) => sl.token === token && sl.status === 'ACTIVE');
  if (!link && pool) {
    try {
      const linkRes = await pool.query(
        "SELECT * FROM public.customer_share_links WHERE token = $1 AND status = 'ACTIVE'",
        [token]
      );
      if (linkRes.rows.length > 0) {
        link = linkRes.rows[0];
      }
    } catch (e) {
      console.error('Failed to fetch share link from DB:', e);
    }
  }

  if (!link) {
    return res.status(404).json({
      status: 'error',
      code: 'LINK_INVALID',
      message: 'ئەم بەستەرە بەردەست نییە یان چیتر چالاک نییە.'
    });
  }

  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    link.status = 'REVOKED';
    saveDb(db);
    return res.status(404).json({
      status: 'error',
      code: 'LINK_EXPIRED',
      message: 'ماوەی ئەم بەستەرە بەسەرچووە.'
    });
  }

  let cust = db.customers.find((c) => c.id === link.customer_id);
  if (!cust && pool) {
    try {
      const custRes = await pool.query("SELECT * FROM public.customers WHERE id = $1", [link.customer_id]);
      if (custRes.rows.length > 0) {
        cust = custRes.rows[0];
      }
    } catch (e) {
      console.error('Failed to fetch customer from DB:', e);
    }
  }

  if (!cust) {
    return res.status(404).json({
      status: 'error',
      code: 'LINK_INVALID',
      message: 'ئەم بەستەرە بەردەست نییە یان چیتر چالاک نییە.'
    });
  }

  // Check PIN if required
  if (link.pin_code && link.pin_code.length > 0) {
    const providedPin = (req.query.pin as string || '').trim();
    if (providedPin !== link.pin_code) {
      return res.json({
        status: 'pin_required',
        message: 'تکایە پین کۆد بنووسە بۆ بینینی هەژمارەکە'
      });
    }
  }

  // Update tracking stats
  link.access_count = (link.access_count || 0) + 1;
  link.last_accessed_at = new Date().toISOString();
  saveDb(db);

  // Authoritative live balance calculation
  const balances = calculateCustomerBalances(cust.id);

  // Authoritative non-reversed transaction history (safe fields ONLY)
  const txs = db.transactions
    .filter((t) => t.customer_id === cust.id && !t.reversed)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .map((t) => ({
      id: t.id,
      type: t.type,
      amount: t.amount,
      currency: t.currency,
      note: t.note,
      timestamp: t.timestamp
    }));

  const targetMarketId = cust.market_id || link.market_id;
  const resolvedMarketName = await resolveMarketName(targetMarketId);

  res.json({
    status: 'success',
    data: {
      market_name: resolvedMarketName,
      customer_name: cust.name,
      currency: cust.currency,
      balance_iqd: balances.iqd,
      balance_usd: balances.usd,
      transactions: txs,
      updated_at: cust.updated_at
    }
  });
});

// Update Settings
app.post('/api/settings', async (req, res) => {
  const { market_name, owner_name, pin_enabled, pin_code, language, default_currency, theme } = req.body;

  if (!db.settings.is_locked_by_system) {
    if (market_name) {
      db.settings.market_name = market_name;
      const currentMarketId = getMarketId(req);
      if (db.markets && Array.isArray(db.markets)) {
        const m = db.markets.find((item: any) => item.id === currentMarketId);
        if (m) {
          m.name = market_name;
        }
      }
      if (pool && currentMarketId) {
        try {
          await pool.query('UPDATE public.markets SET name = $1 WHERE id = $2', [market_name, currentMarketId]);
          await pool.query('INSERT INTO public.market_settings (market_id, market_name, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (market_id) DO UPDATE SET market_name = EXCLUDED.market_name, updated_at = NOW()', [currentMarketId, market_name]);
        } catch (e) {
          console.error('Failed to update market name in DB:', e);
        }
      }
    }
    if (owner_name) db.settings.owner_name = owner_name;
  }
  if (typeof pin_enabled === 'boolean') db.settings.pin_enabled = pin_enabled;
  if (pin_code) db.settings.pin_code = pin_code;
  if (language) db.settings.language = language;
  if (default_currency) db.settings.default_currency = default_currency;
  if (theme) db.settings.theme = theme;

  saveDb(db);

  res.json({
    status: 'success',
    data: db.settings
  });
});

let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is required');
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// AI-powered transaction parser (Innovative AI assistant for Kurd shopkeepers)
app.post('/api/gemini/parse-transaction', async (req, res) => {
  const { text } = req.body;
  if (!text || typeof text !== 'string') {
    return res.status(400).json({
      status: 'error',
      message: 'دەق پێویستە بۆ شیکارکردن'
    });
  }

  try {
    const ai = getGeminiClient();
    const prompt = `You are an expert Kurdish debt management assistant. Please parse the following unstructured Kurdish text (which could describe adding a debt record for a customer, or receiving a debt payment) into a structured transaction. 
If the text lists items or amounts with prices (e.g. "٣٥٠٠٠ دینار قەرز و ٦٠٠٠ وەریگرتەوە" or "35000 IQD debt"), calculate the total sum.
If a currency is mentioned (e.g. "$", "دۆلار", "dollar", "دینار", "iqd", "د.ع"), classify as 'USD' or 'IQD'. Default to 'IQD' if not mentioned.

Input text: "${text}"`;

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
      config: {
        systemInstruction: "You only output valid raw JSON matching the requested schema. No markdown wrapping (like \`\`\`json). No introductory text.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            amount: {
              type: Type.INTEGER,
              description: "The total calculated numeric amount. Must be an integer."
            },
            currency: {
              type: Type.STRING,
              description: "Must be either 'IQD' or 'USD'."
            },
            note: {
              type: Type.STRING,
              description: "A beautifully structured, highly readable list of items and prices in Kurdish, e.g. '١ کیسی برنج (٣٥,٠٠٠) + ٢ زەیتی دۆنا (٦,٠٠٠)'"
            },
            is_payment: {
              type: Type.BOOLEAN,
              description: "Set to true ONLY if the text explicitly indicates a payment received from the customer (e.g., 'پارەم وەرگرت', 'بڕی ١٠٠٠٠ واسڵ کرا', 'received', 'paid'), false otherwise."
            }
          },
          required: ["amount", "currency", "note", "is_payment"]
        }
      }
    });

    const resultText = response.text?.trim() || '{}';
    const parsed = JSON.parse(resultText);

    res.json({
      status: 'success',
      data: parsed
    });
  } catch (err: any) {
    console.error('Gemini parsing error:', err);
    res.status(500).json({
      status: 'error',
      message: 'ناتوانرێت لە ئێستادا ژیری دەستکرد بەکاربهێنرێت. تکایە دڵنیابەرەوە لە ڕێکخستنی کلیل (API Key).'
    });
  }
});

// =========================================================
// AUTHENTICATION GATEWAY CONTRACT ENDPOINTS (AUTH-1)
// =========================================================

// =========================================================
// AUTHENTICATION GATEWAY CONTRACT ENDPOINTS (AUTH-1)
// =========================================================

// Canonical Auth Context Resolver Service
export interface AuthContextResult {
  identity: {
    authUserId: string;
    publicUserId: string | null;
  };
  contexts: Array<{
    persona: 'PLATFORM_OWNER' | 'MARKET_MANAGER' | 'EMPLOYEE' | 'CUSTOMER';
    context_id: string;
    tenant_id: string;
    marketId: string;
    customer_id?: string;
    customerId?: string;
    tenant_name: string;
    role: string;
    role_label_ku: string;
    permissions: string[];
  }>;
  defaultContext: any;
}

export async function resolveAuthContext(verifiedSupabaseUid: string): Promise<AuthContextResult | null> {
  if (!verifiedSupabaseUid || typeof verifiedSupabaseUid !== 'string' || !pool) {
    return null;
  }

  // 1. Query public.users for EXACT auth_user_id match
  const userRes = await pool.query(`
    SELECT id, auth_user_id, full_name, email, phone, is_active
    FROM public.users
    WHERE auth_user_id::text = $1::text AND is_active = true
  `, [verifiedSupabaseUid]);

  const user = userRes.rows[0];

  // 2. Check Platform Owner
  // Gate 4: verified Supabase UID -> public.users.auth_user_id exact match -> public.platform_access.user_id -> role = PLATFORM_OWNER -> status = ACTIVE
  let isPlatformOwner = false;
  if (user) {
    const paRes = await pool.query(`
      SELECT pa.id
      FROM public.platform_access pa
      WHERE pa.user_id::text = $1::text AND pa.role = 'PLATFORM_OWNER' AND pa.status = 'ACTIVE'
    `, [user.id]);
    isPlatformOwner = paRes.rows.length > 0;
  }

  const contexts: any[] = [];

  if (isPlatformOwner) {
    // Gate 3 & Gate 9: Platform Owner zero membership invariant check
    if (user) {
      const mmCheck = await pool.query('SELECT id FROM public.market_memberships WHERE user_id::text = $1::text', [user.id]);
      if (mmCheck.rows.length > 0) {
        console.warn(`SECURITY ALERT: Platform Owner ${user.id} has ${mmCheck.rows.length} tenant memberships. Treating tenant memberships as data corruption and denying tenant context.`);
      }
    }

    contexts.push({
      persona: 'PLATFORM_OWNER',
      context_id: 'mem-platform-owner',
      tenant_id: 'SYSTEM_GLOBAL',
      marketId: 'SYSTEM_GLOBAL',
      tenant_name: 'سیستەمی سەرەکی ژیرۆکس (Platform Owner)',
      role: 'PLATFORM_OWNER',
      role_label_ku: 'خاوەنی سیستەم (Platform Owner)',
      permissions: ['ALL']
    });

    return {
      identity: {
        authUserId: verifiedSupabaseUid,
        publicUserId: user ? user.id : null
      },
      contexts,
      defaultContext: contexts[0]
    };
  }

  // 3. Query market memberships for staff/managers
  // Gate 4, Gate 5, Gate 6, Gate 7: Strict role whitelist
  if (user) {
    const mmRes = await pool.query(`
      SELECT mm.id as context_id, mm.market_id, mm.role, mm.permissions, mm.status, m.name as market_name
      FROM public.market_memberships mm
      JOIN public.markets m ON m.id = mm.market_id
      WHERE mm.user_id::text = $1::text AND mm.status = 'ACTIVE'
    `, [user.id]);

    for (const mm of mmRes.rows) {
      let perms: string[] = [];
      if (Array.isArray(mm.permissions)) perms = mm.permissions;
      else if (typeof mm.permissions === 'string') {
        try { perms = JSON.parse(mm.permissions); } catch { perms = []; }
      }

      const roleUpper = (mm.role || '').toUpperCase();
      let persona: 'MARKET_MANAGER' | 'EMPLOYEE' | null = null;
      let roleLabelKu = '';
      let assignedPermissions: string[] = [];

      if (roleUpper === 'MARKET_MANAGER') {
        persona = 'MARKET_MANAGER';
        roleLabelKu = 'بەڕێوەبەری مارکێت';
        assignedPermissions = ['ALL', ...APPROVED_PERMISSIONS];
      } else if (roleUpper === 'EMPLOYEE') {
        persona = 'EMPLOYEE';
        roleLabelKu = 'کارمەند';
        assignedPermissions = perms; // Strictly permissions stored in DB
      } else {
        // Gate 4 & Gate 7: Fail closed on unknown or corrupted role
        console.warn(`SECURITY ALERT: Unknown or corrupt membership role '${mm.role}' in context ${mm.context_id} for user ${user.id}`);
        continue;
      }

      contexts.push({
        persona,
        context_id: mm.context_id,
        tenant_id: mm.market_id,
        marketId: mm.market_id,
        tenant_name: mm.market_name,
        role: persona,
        role_label_ku: roleLabelKu,
        permissions: assignedPermissions
      });
    }
  }

  // 4. Query customer auth links
  // Gate 8: verified Supabase UID -> ACTIVE public.customer_auth_links -> exact market_id & customer_id
  const calRes = await pool.query(`
    SELECT cal.id as context_id, cal.market_id, cal.customer_id, cal.status, m.name as market_name, c.name as customer_name
    FROM public.customer_auth_links cal
    JOIN public.markets m ON m.id = cal.market_id
    JOIN public.customers c ON c.id = cal.customer_id AND c.market_id = cal.market_id
    WHERE cal.auth_user_id::text = $1::text AND cal.status = 'ACTIVE'
  `, [verifiedSupabaseUid]);

  for (const cal of calRes.rows) {
    contexts.push({
      persona: 'CUSTOMER',
      context_id: cal.context_id,
      tenant_id: cal.market_id,
      marketId: cal.market_id,
      customer_id: cal.customer_id,
      customerId: cal.customer_id,
      tenant_name: cal.market_name,
      role: 'CUSTOMER',
      role_label_ku: 'کڕیار',
      permissions: ['VIEW_OWN_ACCOUNT']
    });
  }

  if (contexts.length === 0) {
    return null;
  }

  return {
    identity: {
      authUserId: verifiedSupabaseUid,
      publicUserId: user ? user.id : null
    },
    contexts,
    defaultContext: contexts[0]
  };
}

// Step 1: Identify phone/email (Generic non-enumerating endpoint)
app.post('/api/auth/identify', async (req, res) => {
  const { identity } = req.body;
  if (!identity || typeof identity !== 'string') {
    return res.status(400).json({
      status: 'error',
      message: 'تکایە ژمارەی مۆبایل یان ئیمەیڵ بنووسە'
    });
  }

  const trimmed = identity.trim();
  return res.json({
    status: 'success',
    data: {
      identity: trimmed,
      auth_method: 'PASSWORD'
    }
  });
});

// Helper to check foreign market authorization
function checkForeignMarketAccess(req: express.Request, res: express.Response): boolean {
  const getHeader = (name: string) => {
    const val = req.headers[name.toLowerCase()];
    return Array.isArray(val) ? val[0] : val;
  };

  const userStatus = getHeader('x-membership-status') || getHeader('x-user-status');
  const activeTenantId = getHeader('x-active-tenant-id') || getHeader('x-tenant-id') || getHeader('x-market-id');
  const requestedMarketId = req.params?.market_id || req.body?.market_id || (req.query?.market_id as string);

  if (userStatus && userStatus !== 'ACTIVE') {
    res.status(403).json({
      status: 'error',
      code: 'ACCOUNT_NOT_ACTIVATED',
      message: 'دەستگەیشتن ڕەتکرایەوە - هەژمارەکە تا ئێستا چالاک نەکراوە (403 Forbidden)'
    });
    return false;
  }

  if (activeTenantId && requestedMarketId && activeTenantId !== requestedMarketId && requestedMarketId !== 'SYSTEM_GLOBAL') {
    res.status(403).json({
      status: 'error',
      code: 'FOREIGN_MARKET_ACCESS_DENIED',
      message: 'دەستگەیشتن ڕەتکرایەوە - دراوەکان سەر بە مارکێتێکی ترن (403 Forbidden)'
    });
    return false;
  }
  return true;
}

// Canonical Login Handler Endpoint (POST /api/auth/login)
const handleLogin = async (req: express.Request, res: express.Response) => {
  const { identity, password } = req.body;
  if (!identity || !password) {
    return res.status(400).json({
      status: 'error',
      message: 'تکایە ژمارەی مۆبایل/ئیمەیڵ و وشەی نهێنی بنووسە'
    });
  }

  const trimmedIdentity = (identity || '').trim();

  if (!supabase) {
    return res.status(503).json({
      status: 'error',
      code: 'AUTH_UNAVAILABLE',
      message: 'خزمەتگوزاری چوونەژوورەوەی Supabase دەستنەکەوت'
    });
  }

  // 1. Authenticate strictly with Supabase Auth
  let sessionToken: string | null = null;
  let authUid: string | null = null;

  try {
    const isEmail = trimmedIdentity.includes('@');
    let authRes;
    if (isEmail) {
      authRes = await supabase.auth.signInWithPassword({
        email: trimmedIdentity,
        password
      });
    } else {
      authRes = await supabase.auth.signInWithPassword({
        phone: trimmedIdentity.replace(/\s+/g, ''),
        password
      });
    }

    if (authRes.data?.session?.access_token) {
      sessionToken = authRes.data.session.access_token;
      authUid = authRes.data.session.user.id;
    }
  } catch (e) {
    console.error('Supabase Auth error during login:', e);
  }

  // Gate 1 & Gate 15: If Supabase Auth fails or returns no session, return generic 401. NEVER fallback to local passwords.
  if (!sessionToken || !authUid) {
    return res.status(401).json({
      status: 'error',
      code: 'INVALID_CREDENTIALS',
      message: 'ژمارەی مۆبایل/ئیمەیڵ یان وشەی نهێنی هەڵەیە'
    });
  }

  // 2. Resolve business authorization context strictly via PostgreSQL using authUid
  const authCtx = await resolveAuthContext(authUid);
  if (!authCtx || authCtx.contexts.length === 0) {
    return res.status(403).json({
      status: 'error',
      code: 'ACCESS_DENIED',
      message: 'ئەم هەژمارە دەستگەیشتنی نییە بۆ سیستەم (403 Access Denied)'
    });
  }

  return res.json({
    status: 'success',
    data: {
      session_token: sessionToken,
      identity: trimmedIdentity,
      userName: authCtx.defaultContext.tenant_name,
      auth_uid: authUid,
      activeContext: authCtx.defaultContext,
      contexts: authCtx.contexts
    }
  });
};

app.post('/api/auth/login', handleLogin);

// Platform Owner Direct Authentication Endpoint (Gate 10: Thin wrapper delegating to handleLogin)
app.post('/api/auth/login-platform-owner', handleLogin);

// Authoritative Auth Context Resolver Endpoint (GET & POST /api/auth/context & POST /api/auth/resolve-identity)
const handleAuthContext = async (req: express.Request, res: express.Response) => {
  const token = extractBearerToken(req);
  if (!token) {
    return res.status(401).json({
      status: 'error',
      code: 'UNAUTHORIZED',
      message: 'تۆکنی چوونەژوورەوە نەدۆزرایەوە'
    });
  }

  const verifiedUser = await verifySupabaseAccessToken(token);
  if (!verifiedUser || !verifiedUser.id) {
    return res.status(401).json({
      status: 'error',
      code: 'UNAUTHORIZED_TOKEN',
      message: 'تۆکنی بەکارهێنەر ناڕاستە یان بەسەرچووە'
    });
  }

  const authCtx = await resolveAuthContext(verifiedUser.id);
  if (!authCtx || authCtx.contexts.length === 0) {
    return res.status(403).json({
      status: 'error',
      code: 'NO_ACTIVE_CONTEXT',
      message: 'ئەم هەژمارە ڕێگەپێدانی چالاکی نییە (403 Forbidden)'
    });
  }

  return res.json({
    status: 'success',
    data: {
      identity: authCtx.identity,
      contexts: authCtx.contexts,
      defaultContext: authCtx.defaultContext
    }
  });
};

app.get('/api/auth/context', handleAuthContext);
app.post('/api/auth/context', handleAuthContext);
app.post('/api/auth/resolve-identity', handleAuthContext);

// VERIFIED SUPABASE AUTHENTICATION & PLATFORM AUTHORITY HELPERS
export function extractBearerToken(req: express.Request): string | null {
  const authHeader = req.headers['authorization'];
  const headerVal = Array.isArray(authHeader) ? authHeader[0] : authHeader;
  if (!headerVal || typeof headerVal !== 'string') return null;
  if (!headerVal.startsWith('Bearer ')) return null;
  const token = headerVal.substring(7).trim();
  if (!token) return null;
  return token;
}

export async function verifySupabaseAccessToken(token: string): Promise<{ id: string } | null> {
  if (!token || typeof token !== 'string') return null;
  const trimmed = token.trim();
  if (!trimmed) return null;

  // 1. Verify against Supabase Auth server if client is configured and token has 3 parts
  if (supabase && trimmed.split('.').length === 3) {
    try {
      const { data, error } = await supabase.auth.getUser(trimmed);
      if (!error && data && data.user) {
        return { id: data.user.id };
      }
    } catch (err) {
      console.error('Supabase auth.getUser token verification error:', err);
    }
  }

  // 2. Cryptographic HMAC verification if JWT secret is configured
  const jwtSecret = process.env.SUPABASE_JWT_SECRET || process.env.JWT_SECRET;
  if (jwtSecret) {
    try {
      const parts = trimmed.split('.');
      if (parts.length === 3) {
        const payloadBuf = Buffer.from(parts[1], 'base64url');
        const payload = JSON.parse(payloadBuf.toString('utf8'));
        if (payload.exp && Date.now() / 1000 > payload.exp) {
          return null; // Token expired
        }
        const hmac = crypto.createHmac('sha256', jwtSecret);
        hmac.update(`${parts[0]}.${parts[1]}`);
        const signatureBuf = Buffer.from(hmac.digest('base64url'));
        const providedSigBuf = Buffer.from(parts[2], 'base64url');
        if (signatureBuf.length === providedSigBuf.length && crypto.timingSafeEqual(signatureBuf, providedSigBuf)) {
          if (payload.sub && typeof payload.sub === 'string') {
            return { id: payload.sub };
          }
        }
      }
    } catch (e) {
      return null;
    }
  }

  return null;
}

export async function isActorPlatformOwner(req: express.Request): Promise<boolean> {
  const token = extractBearerToken(req);
  if (!token) {
    return false;
  }

  const verifiedUser = await verifySupabaseAccessToken(token);
  if (!verifiedUser || !verifiedUser.id) {
    return false;
  }

  const authUserId = verifiedUser.id;

  // Query PostgreSQL public.platform_access joined with public.users
  if (pool) {
    try {
      const dbRes = await pool.query(`
        SELECT pa.status, u.is_active
        FROM public.users u
        JOIN public.platform_access pa ON pa.user_id = u.id
        WHERE u.auth_user_id::text = $1::text
          AND u.is_active = true
          AND pa.role = 'PLATFORM_OWNER'
          AND pa.status = 'ACTIVE'
      `, [authUserId]);

      return dbRes.rows.length > 0;
    } catch (err) {
      console.error('Error verifying platform owner authority in DB:', err);
      return false;
    }
  }

  return false;
}

export async function verifyTenantActor(req: express.Request): Promise<{
  authorized: boolean;
  code?: string;
  message?: string;
  userId?: string;
  marketId?: string;
  role?: string;
  permissions?: string[];
}> {
  const token = extractBearerToken(req);
  if (!token) {
    return { authorized: false, code: 'UNAUTHORIZED', message: 'تۆکنی چوونەژوورەوە نەدۆزرایەوە' };
  }

  const verifiedUser = await verifySupabaseAccessToken(token);
  if (!verifiedUser || !verifiedUser.id) {
    return { authorized: false, code: 'UNAUTHORIZED', message: 'تۆکنی چوونەژوورەوە ناڕاستە یان بەسەرچووە' };
  }

  // Platform owner invariant check: platform owner cannot perform tenant operations
  const isPO = await isActorPlatformOwner(req);
  if (isPO) {
    return {
      authorized: false,
      code: 'PLATFORM_OWNER_TENANT_ACCESS_DENIED',
      message: 'خاوەنی سیستەم دەستگەیشتنی نییە بۆ داتاکانی مارکێت'
    };
  }

  const requestedMarketId =
    req.params?.market_id ||
    req.body?.market_id ||
    (req.query?.market_id as string) ||
    (req.headers['x-active-tenant-id'] as string) ||
    (req.headers['x-market-id'] as string);

  if (!requestedMarketId) {
    return { authorized: false, code: 'MARKET_ID_REQUIRED', message: 'مارکێت دیاری نەکراوە' };
  }

  if (!pool) {
    return { authorized: false, code: 'DATABASE_UNAVAILABLE', message: 'بنکەی زانیاری دەستنەکەوت' };
  }

  try {
    const dbRes = await pool.query(`
      SELECT mm.role, mm.status, mm.market_id, mm.permissions, u.id as user_id, u.is_active
      FROM public.users u
      JOIN public.market_memberships mm ON mm.user_id = u.id
      WHERE u.auth_user_id::text = $1::text
        AND mm.market_id = $2::text
        AND u.is_active = true
    `, [verifiedUser.id, requestedMarketId]);

    if (dbRes.rows.length === 0) {
      return { authorized: false, code: 'MEMBERSHIP_NOT_FOUND', message: 'ئەندامێتی نەدۆزرایەوە بۆ ئەم مارکێتە' };
    }

    const member = dbRes.rows[0];
    if (member.status !== 'ACTIVE') {
      return { authorized: false, code: 'MEMBERSHIP_INACTIVE', message: 'ئەندامێتی چالاک نییە' };
    }

    const roleUpper = (member.role || '').toUpperCase();
    if (roleUpper === 'CUSTOMER') {
      return { authorized: false, code: 'CUSTOMER_ACCESS_DENIED', message: 'کڕیار ڕێگەی پێدراو نییە بۆ ڕێڕەوی کارمەندان' };
    }

    let perms: string[] = [];
    if (Array.isArray(member.permissions)) perms = member.permissions;
    else if (typeof member.permissions === 'string') {
      try { perms = JSON.parse(member.permissions); } catch { perms = []; }
    }

    if (roleUpper === 'MARKET_MANAGER') {
      return {
        authorized: true,
        userId: member.user_id,
        marketId: member.market_id,
        role: 'MARKET_MANAGER',
        permissions: ['ALL', ...APPROVED_PERMISSIONS]
      };
    }

    if (roleUpper === 'EMPLOYEE') {
      return {
        authorized: true,
        userId: member.user_id,
        marketId: member.market_id,
        role: 'EMPLOYEE',
        permissions: perms
      };
    }

    console.warn(`SECURITY ALERT: Corrupted or unwhitelisted role '${member.role}' in verifyTenantActor for user ${member.user_id}`);
    return { authorized: false, code: 'ROLE_UNAUTHORIZED', message: 'ڕۆڵی نەناسراو یان بەکارنه‌هاتوو (Access Denied)' };
  } catch (err) {
    console.error('Error verifying tenant actor in DB:', err);
    return { authorized: false, code: 'INTERNAL_ERROR', message: 'خەتای سێرڤەر ڕوویدا' };
  }
}

export const APPROVED_PERMISSIONS = [
  'ADD_DEBT',
  'RECEIVE_PAYMENT',
  'ADD_CUSTOMER',
  'REVERSE_TRANSACTION',
  'VIEW_ANALYTICS',
  'EXPORT_STATEMENTS',
  'MANAGE_CREDIT_LIMIT'
];

export async function verifyTenantPermission(
  req: express.Request,
  res: express.Response,
  requiredPermission: string,
  marketIdOverride?: string
): Promise<{
  authorized: boolean;
  userId?: string;
  marketId?: string;
  role?: string;
  permissions?: string[];
}> {
  const token = extractBearerToken(req);
  if (!token) {
    res.status(401).json({ status: 'error', code: 'UNAUTHORIZED', message: 'تۆکنی چوونەژوورەوە نەدۆزرایەوە' });
    return { authorized: false };
  }

  const verifiedUser = await verifySupabaseAccessToken(token);
  if (!verifiedUser || !verifiedUser.id) {
    res.status(401).json({ status: 'error', code: 'UNAUTHORIZED', message: 'تۆکنی چوونەژوورەوە ناڕاستە یان بەسەرچووە' });
    return { authorized: false };
  }

  const requestedMarketId =
    marketIdOverride ||
    req.params?.market_id ||
    req.body?.market_id ||
    (req.query?.market_id as string) ||
    (req.headers['x-active-tenant-id'] as string) ||
    (req.headers['x-market-id'] as string);

  // Special platform owner permission check for MANAGE_PLATFORM
  if (requestedMarketId === 'SYSTEM_GLOBAL' || requiredPermission === 'MANAGE_PLATFORM') {
    const isPO = await isActorPlatformOwner(req);
    if (isPO) {
      return {
        authorized: true,
        userId: verifiedUser.id,
        marketId: 'SYSTEM_GLOBAL',
        role: 'PLATFORM_OWNER',
        permissions: ['ALL']
      };
    } else {
      res.status(403).json({ status: 'error', code: 'PLATFORM_OWNER_REQUIRED', message: 'تەنها خاوەنی سیستەم ئەم دەسەڵاتەی هەیە' });
      return { authorized: false };
    }
  }

  // Tenant endpoints: Platform owner is NOT allowed access to tenant financial data
  const isPO = await isActorPlatformOwner(req);
  if (isPO) {
    res.status(403).json({ status: 'error', code: 'PLATFORM_OWNER_TENANT_ACCESS_DENIED', message: 'خاوەنی سیستەم دەستگەیشتنی نییە بۆ داتاکانی مارکێت' });
    return { authorized: false };
  }

  if (!requestedMarketId) {
    res.status(400).json({ status: 'error', code: 'MARKET_ID_REQUIRED', message: 'مارکێت دیاری نەکراوە' });
    return { authorized: false };
  }

  if (!pool) {
    res.status(503).json({ status: 'error', code: 'DATABASE_UNAVAILABLE', message: 'بنکەی زانیاری دەستنەکەوت' });
    return { authorized: false };
  }

  try {
    const dbRes = await pool.query(`
      SELECT mm.role, mm.permissions, mm.status, mm.market_id, u.id as user_id, u.is_active
      FROM public.users u
      JOIN public.market_memberships mm ON mm.user_id = u.id
      WHERE u.auth_user_id::text = $1::text AND mm.market_id = $2::text AND u.is_active = true
    `, [verifiedUser.id, requestedMarketId]);

    if (dbRes.rows.length === 0) {
      res.status(403).json({ status: 'error', code: 'MEMBERSHIP_NOT_FOUND', message: 'ئەندامێتی نەدۆزرایەوە برای ئەم مارکێتە' });
      return { authorized: false };
    }

    const member = dbRes.rows[0];
    if (member.status !== 'ACTIVE') {
      res.status(403).json({ status: 'error', code: 'MEMBERSHIP_INACTIVE', message: 'دەستگەیشتن ڕەتکرایەوە - ئەندامێتی چالاک نییە' });
      return { authorized: false };
    }

    const roleUpper = (member.role || '').toUpperCase();
    if (roleUpper === 'CUSTOMER') {
      res.status(403).json({ status: 'error', code: 'CUSTOMER_ACCESS_DENIED', message: 'کڕیار ڕێگەی پێدراو نییە بۆ ڕێڕەوی کارمەندان' });
      return { authorized: false };
    }

    if (roleUpper === 'MARKET_MANAGER') {
      return {
        authorized: true,
        userId: member.user_id,
        marketId: member.market_id,
        role: 'MARKET_MANAGER',
        permissions: ['ALL', ...APPROVED_PERMISSIONS]
      };
    }

    if (roleUpper === 'EMPLOYEE') {
      let dbPerms: string[] = [];
      if (Array.isArray(member.permissions)) dbPerms = member.permissions;
      else if (typeof member.permissions === 'string') {
        try { dbPerms = JSON.parse(member.permissions); } catch { dbPerms = []; }
      }

      if (dbPerms.includes(requiredPermission)) {
        return {
          authorized: true,
          userId: member.user_id,
          marketId: member.market_id,
          role: 'EMPLOYEE',
          permissions: dbPerms
        };
      } else {
        res.status(403).json({ status: 'error', code: 'PERMISSION_DENIED', message: `پێویستت بە دەسەڵاتی ${requiredPermission} هەیە` });
        return { authorized: false };
      }
    }

    console.warn(`SECURITY ALERT: Corrupted or unwhitelisted role '${member.role}' in verifyTenantPermission for user ${member.user_id}`);
    res.status(403).json({ status: 'error', code: 'ROLE_UNAUTHORIZED', message: 'ڕۆڵی نەناسراو یان بەکارنه‌هاتوو (Access Denied)' });
    return { authorized: false };
  } catch (err) {
    console.error('Error verifying tenant permission in DB:', err);
    res.status(500).json({ status: 'error', code: 'INTERNAL_ERROR', message: 'خەتای سێرڤەر ڕوویدا' });
    return { authorized: false };
  }
}

export async function requireCustomerContext(req: express.Request, res: express.Response) {
  const token = extractBearerToken(req);
  if (!token) {
    res.status(403).json({
      status: 'error',
      code: 'CUSTOMER_PORTAL_DENIED',
      message: 'دەستگەیشتن بە پۆڕتاڵی کڕیار ڕەتکرایەوە - تۆکن نەدۆزرایەوە (403 Forbidden)'
    });
    return null;
  }

  const verifiedUser = await verifySupabaseAccessToken(token);
  if (!verifiedUser || !verifiedUser.id) {
    res.status(403).json({
      status: 'error',
      code: 'CUSTOMER_PORTAL_DENIED',
      message: 'دەستگەیشتن بە پۆڕتاڵی کڕیار ڕەتکرایەوە - تۆکنی ناکارامە (403 Forbidden)'
    });
    return null;
  }

  if (!pool) {
    res.status(503).json({
      status: 'error',
      code: 'DATABASE_UNAVAILABLE',
      message: 'بنکەی زانیاری دەستنەکەوت'
    });
    return null;
  }

  try {
    const dbRes = await pool.query(`
      SELECT cal.*, c.name as customer_name, m.name as market_name
      FROM public.customer_auth_links cal
      JOIN public.customers c ON cal.market_id = c.market_id AND cal.customer_id = c.id
      JOIN public.markets m ON cal.market_id = m.id
      WHERE cal.auth_user_id::text = $1::text AND cal.status = 'ACTIVE'
    `, [verifiedUser.id]);

    if (dbRes.rows.length === 0) {
      res.status(403).json({
        status: 'error',
        code: 'CUSTOMER_PORTAL_DENIED',
        message: 'دەستگەیشتن بە پۆڕتاڵی کڕیار ڕەتکرایەوە - بەستەری هەژمار نەدۆزرایەوە (403 Forbidden)'
      });
      return null;
    }

    const link = dbRes.rows[0];
    return {
      authUserId: verifiedUser.id,
      marketId: link.market_id,
      customerId: link.customer_id,
      linkStatus: link.status,
      customerName: link.customer_name || '',
      marketName: link.market_name || ''
    };
  } catch (e) {
    console.error('Error querying customer_auth_links in DB:', e);
    res.status(503).json({
      status: 'error',
      code: 'DATABASE_ERROR',
      message: 'خەتا لە بەستەری پۆڕتاڵی کڕیار ڕوویدا'
    });
    return null;
  }
}

async function logPlatformAudit(
  marketId: string,
  userId: string,
  actionType: string,
  description: string,
  performedBy: string,
  reason?: string
) {
  const auditId = `aud-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
  const descWithReason = reason ? `${description} (هۆکار: ${reason})` : description;

  if (pool) {
    try {
      await pool.query(`
        INSERT INTO public.audit_logs (id, customer_id, market_id, action_type, description, performed_by, timestamp)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
      `, [auditId, userId || 'SYSTEM', marketId, actionType, descWithReason, performedBy]);
    } catch (err) {
      console.error('Failed to log platform audit to DB:', err);
    }
  }

  if (!db.audit_logs) db.audit_logs = [];
  db.audit_logs.push({
    id: auditId,
    customer_id: userId || 'SYSTEM',
    market_id: marketId,
    action_type: actionType,
    description: descWithReason,
    performed_by: performedBy,
    timestamp: new Date().toISOString()
  });
}

// ==================================================
// EMPLOYEE PERMISSION CENTER API ENDPOINTS
// ==================================================

// GET /api/markets/:market_id/employees
app.get('/api/markets/:market_id/employees', async (req, res) => {
  const { market_id } = req.params;
  const actorCheck = await verifyTenantActor(req);
  if (!actorCheck.authorized) {
    const status = actorCheck.code === 'UNAUTHORIZED' ? 401 : 403;
    return res.status(status).json({ status: 'error', code: actorCheck.code || 'ACCESS_DENIED', message: actorCheck.message || 'دەستگەیشتن ڕەتکرایەوە' });
  }

  let targetMarketId = actorCheck.marketId || market_id;
  if (!targetMarketId || targetMarketId === 'SYSTEM_GLOBAL') {
    return res.status(400).json({ status: 'error', message: 'مارکێت دیاری نەکراوە' });
  }

  if (pool) {
    try {
      let queryStr = `
        SELECT 
          u.id as user_id,
          u.auth_user_id,
          u.full_name,
          u.email,
          u.phone,
          mm.id as membership_id,
          mm.market_id,
          mm.role,
          mm.permissions,
          mm.status,
          mm.created_at,
          mm.updated_at,
          at.id as activation_token_id,
          at.expires_at as activation_expires_at
        FROM public.market_memberships mm
        JOIN public.users u ON u.id = mm.user_id
        LEFT JOIN public.activation_tokens at ON at.user_id = u.id AND at.status = 'READY'
        WHERE mm.role = 'EMPLOYEE' AND mm.market_id = $1
        ORDER BY mm.created_at DESC
      `;
      let dbRes = await pool.query(queryStr, [targetMarketId]);

      const employees = dbRes.rows.map(row => {
        let perms: string[] = [];
        if (Array.isArray(row.permissions)) perms = row.permissions;
        else if (typeof row.permissions === 'string') {
          try { perms = JSON.parse(row.permissions); } catch { perms = []; }
        }

        return {
          id: row.user_id,
          user_id: row.user_id,
          auth_user_id: row.auth_user_id,
          full_name: row.full_name,
          email: row.email,
          phone: row.phone,
          market_id: row.market_id,
          role: row.role,
          permissions: perms,
          status: row.status,
          created_at: row.created_at,
          updated_at: row.updated_at,
          activation_token_id: row.activation_token_id,
          activation_expires_at: row.activation_expires_at
        };
      });

      return res.json({ status: 'success', data: employees });
    } catch (err) {
      console.error('Failed to fetch market employees from DB:', err);
      return res.status(500).json({ status: 'error', message: 'خەتای سێرڤەر ڕوویدا' });
    }
  }

  const employees = (db as any).system_users?.filter((u: any) => u.market_id === targetMarketId && u.role === 'EMPLOYEE') || [];
  return res.json({ status: 'success', data: employees });
});

// POST /api/markets/:market_id/employees (Create Employee)
app.post('/api/markets/:market_id/employees', async (req, res) => {
  const { market_id } = req.params;
  const actorCheck = await verifyTenantActor(req);
  if (!actorCheck.authorized) {
    return res.status(403).json({ status: 'error', code: actorCheck.code || 'ACCESS_DENIED', message: actorCheck.message || 'دەستگەیشتن ڕەتکرایەوە' });
  }

  let targetMarketId = actorCheck.marketId || market_id;
  if (!targetMarketId || targetMarketId === 'SYSTEM_GLOBAL') {
    return res.status(400).json({ status: 'error', message: 'مارکێت دیاری نەکراوە' });
  }

  const { full_name, phone, initial_permissions } = req.body;
  if (!full_name || typeof full_name !== 'string' || !full_name.trim()) {
    return res.status(400).json({ status: 'error', message: 'ناوی کارمەند پێویستە' });
  }
  if (!phone || typeof phone !== 'string' || !phone.trim()) {
    return res.status(400).json({ status: 'error', message: 'ژمارەی مۆبایل/ناسنامەی کارمەند پێویستە' });
  }

  const rawPerms = Array.isArray(initial_permissions) ? initial_permissions : [];
  const validPermissions = rawPerms.filter(p => APPROVED_PERMISSIONS.includes(p));

  const newUserId = crypto.randomUUID();
  const newAuthUserId = crypto.randomUUID();
  const membershipId = `mem-emp-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
  
  const rawActivationToken = crypto.randomBytes(24).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawActivationToken).digest('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  if (pool) {
    try {
      await pool.query(`
        INSERT INTO public.users (id, auth_user_id, full_name, email, phone, is_active, created_at, updated_at)
        VALUES ($1, NULL, $2, $3, $4, false, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, phone = EXCLUDED.phone, updated_at = NOW();
      `, [newUserId, full_name.trim(), `${phone.trim()}@zhirox.internal`, phone.trim()]);

      await pool.query(`
        INSERT INTO public.market_memberships (id, market_id, user_id, role, permissions, status, created_at, updated_at)
        VALUES ($1, $2, $3, 'EMPLOYEE', $4::jsonb, 'PENDING_ACTIVATION', NOW(), NOW())
      `, [membershipId, market_id, newUserId, JSON.stringify(validPermissions)]);

      const tokenId = `act-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
      await pool.query(`
        INSERT INTO public.activation_tokens (id, token_hash, market_id, market_name, user_id, manager_name, manager_login_phone, status, expires_at, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'READY', $8, NOW())
      `, [tokenId, tokenHash, market_id, 'Market', newUserId, full_name.trim(), phone.trim(), expiresAt]);

      await logPlatformAudit(market_id, newUserId, 'EMPLOYEE_CREATED', `دروستکردنی کارمەندی نوێ (${full_name.trim()})`, actorCheck.userId || 'MANAGER');
      await logPlatformAudit(market_id, newUserId, 'EMPLOYEE_ACTIVATION_CREATED', `دروستکردنی بەستەری چالاککردن بۆ کارمەند (${full_name.trim()})`, actorCheck.userId || 'MANAGER');

      const baseUrl = getBaseUrlFromReq(req);
      const activationUrl = `${baseUrl}/activate/manager?token=${rawActivationToken}`;

      return res.status(201).json({
        status: 'success',
        message: 'کارمەندی نوێ بە سەرکەوتوویی زیادکرا و لینک بۆ نێردرا',
        data: {
          user_id: newUserId,
          full_name: full_name.trim(),
          phone: phone.trim(),
          role: 'EMPLOYEE',
          status: 'PENDING_ACTIVATION',
          permissions: validPermissions,
          activation_token: rawActivationToken,
          activation_url: activationUrl,
          expires_at: expiresAt
        }
      });
    } catch (err) {
      console.error('Failed to create employee in DB:', err);
      return res.status(500).json({ status: 'error', message: 'خەتای دروستکردنی کارمەند لە بنکەدراوە' });
    }
  }

  return res.status(201).json({
    status: 'success',
    data: { user_id: newUserId, role: 'EMPLOYEE', status: 'PENDING_ACTIVATION', permissions: validPermissions }
  });
});

// POST /api/markets/:market_id/employees/:employee_user_id/permissions (Live Permission Update)
app.post('/api/markets/:market_id/employees/:employee_user_id/permissions', async (req, res) => {
  const { market_id, employee_user_id } = req.params;
  const actorCheck = await verifyTenantActor(req);
  if (!actorCheck.authorized) {
    return res.status(403).json({ status: 'error', code: actorCheck.code, message: actorCheck.message });
  }

  if (actorCheck.userId && actorCheck.userId === employee_user_id) {
    return res.status(403).json({ status: 'error', message: 'بەڕێوەبەر ناتوانێت دەسەڵاتەکانی خۆی دەستکاری بکات' });
  }

  const { permissions } = req.body;
  if (!Array.isArray(permissions)) {
    return res.status(400).json({ status: 'error', message: 'لیستی دەسەڵاتەکان ناڕاستە' });
  }

  // Reject role escalation or unknown permission keys
  const hasInvalidKeys = permissions.some((p: any) => typeof p !== 'string' || !APPROVED_PERMISSIONS.includes(p));
  if (hasInvalidKeys) {
    return res.status(400).json({ status: 'error', message: 'دەسەڵاتی ناڕاست یان ڕێگەپێنەدراو لە داواکارییەکەدا هەیە (400 Bad Request)' });
  }

  const validPermissions = permissions.filter(p => APPROVED_PERMISSIONS.includes(p));

  if (pool) {
    try {
      const curRes = await pool.query(`
        SELECT permissions, role, status FROM public.market_memberships
        WHERE market_id = $1 AND user_id = $2
        FOR UPDATE
      `, [market_id, employee_user_id]);

      if (curRes.rows.length === 0) {
        return res.status(404).json({ status: 'error', message: 'کارمەند نەدۆزرایەوە لەم مارکێتەدا' });
      }

      const curRow = curRes.rows[0];
      if (curRow.role !== 'EMPLOYEE') {
        return res.status(403).json({ status: 'error', message: 'گۆڕینی دەسەڵات تەنها بۆ کارمەندان ڕێگەپێدراوە' });
      }

      let beforePerms: string[] = [];
      if (Array.isArray(curRow.permissions)) beforePerms = curRow.permissions;
      else if (typeof curRow.permissions === 'string') {
        try { beforePerms = JSON.parse(curRow.permissions); } catch { beforePerms = []; }
      }

      await pool.query(`
        UPDATE public.market_memberships
        SET permissions = $1::jsonb, updated_at = NOW()
        WHERE market_id = $2 AND user_id = $3 AND role = 'EMPLOYEE'
      `, [JSON.stringify(validPermissions), market_id, employee_user_id]);

      const added = validPermissions.filter(p => !beforePerms.includes(p));
      const removed = beforePerms.filter(p => !validPermissions.includes(p));
      const auditDesc = `گۆڕینی دەسەڵاتەکانی کارمەند (زیادکراو: [${added.join(', ')}], لابرابوو: [${removed.join(', ')}])`;

      await logPlatformAudit(
        market_id,
        employee_user_id,
        'PERMISSIONS_CHANGED',
        auditDesc,
        actorCheck.userId || 'MANAGER'
      );

      return res.json({
        status: 'success',
        message: 'دەسەڵاتەکانی کارمەند بە سەرکەوتوویی و ڕاستەوخۆ نوێکرانەوە',
        data: {
          user_id: employee_user_id,
          permissions: validPermissions,
          permissions_before: beforePerms,
          permissions_after: validPermissions
        }
      });
    } catch (err) {
      console.error('Failed to update employee permissions in DB:', err);
      return res.status(500).json({ status: 'error', message: 'خەتای سێرڤەر لە نوێکردنەوەی دەسەڵاتەکان' });
    }
  }

  return res.json({ status: 'success', data: { permissions: validPermissions } });
});

// POST /api/markets/:market_id/employees/:employee_user_id/suspend
app.post('/api/markets/:market_id/employees/:employee_user_id/suspend', async (req, res) => {
  const { market_id, employee_user_id } = req.params;
  const actorCheck = await verifyTenantActor(req);
  if (!actorCheck.authorized) {
    return res.status(403).json({ status: 'error', code: actorCheck.code, message: actorCheck.message });
  }

  if (actorCheck.userId && actorCheck.userId === employee_user_id) {
    return res.status(403).json({ status: 'error', message: 'بەڕێوەبەر ناتوانێت دۆخی خۆی بگۆڕێت' });
  }

  const { reason } = req.body;
  if (!reason || typeof reason !== 'string' || !reason.trim()) {
    return res.status(400).json({ status: 'error', message: 'هۆکاری ڕاگرتن پێویستە' });
  }

  if (pool) {
    try {
      const result = await pool.query(`
        UPDATE public.market_memberships
        SET status = 'SUSPENDED', updated_at = NOW()
        WHERE market_id = $1 AND user_id = $2 AND role = 'EMPLOYEE'
        RETURNING id
      `, [market_id, employee_user_id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ status: 'error', message: 'کارمەند نەدۆزرایەوە' });
      }

      await logPlatformAudit(
        market_id,
        employee_user_id,
        'EMPLOYEE_SUSPENDED',
        `ڕاگرتنی هەژماری کارمەند`,
        actorCheck.userId || 'MANAGER',
        reason.trim()
      );

      return res.json({ status: 'success', message: 'هەژماری کارمەند ڕاگیرا (SUSPENDED)' });
    } catch (err) {
      console.error('Failed to suspend employee in DB:', err);
      return res.status(500).json({ status: 'error', message: 'خەتای سێرڤەر' });
    }
  }

  return res.json({ status: 'success', message: 'Suspended in memory' });
});

// POST /api/markets/:market_id/employees/:employee_user_id/reactivate
app.post('/api/markets/:market_id/employees/:employee_user_id/reactivate', async (req, res) => {
  const { market_id, employee_user_id } = req.params;
  const actorCheck = await verifyTenantActor(req);
  if (!actorCheck.authorized) {
    return res.status(403).json({ status: 'error', code: actorCheck.code, message: actorCheck.message });
  }

  if (actorCheck.userId && actorCheck.userId === employee_user_id) {
    return res.status(403).json({ status: 'error', message: 'بەڕێوەبەر ناتوانێت دۆخی خۆی بگۆڕێت' });
  }

  const { reason } = req.body;

  if (pool) {
    try {
      const checkRes = await pool.query(`
        SELECT status FROM public.market_memberships
        WHERE market_id = $1 AND user_id = $2 AND role = 'EMPLOYEE'
      `, [market_id, employee_user_id]);

      if (checkRes.rows.length === 0) {
        return res.status(404).json({ status: 'error', message: 'کارمەند نەدۆزرایەوە' });
      }

      const curStatus = checkRes.rows[0].status;
      if (curStatus === 'REVOKED') {
        return res.status(400).json({
          status: 'error',
          message: 'ناتوانرێت کارمەندی فەوتاو/دەركراو (REVOKED) بە ڕێگەی ئاسایی چالاک بکرێتەوە'
        });
      }

      await pool.query(`
        UPDATE public.market_memberships
        SET status = 'ACTIVE', updated_at = NOW()
        WHERE market_id = $1 AND user_id = $2 AND role = 'EMPLOYEE'
      `, [market_id, employee_user_id]);

      await logPlatformAudit(
        market_id,
        employee_user_id,
        'EMPLOYEE_REACTIVATED',
        `چالاککردنەوەی هەژماری کارمەند`,
        actorCheck.userId || 'MANAGER',
        reason ? reason.trim() : undefined
      );

      return res.json({ status: 'success', message: 'هەژماری کارمەند بە سەرکەوتوویی چالاک کرایەوە' });
    } catch (err) {
      console.error('Failed to reactivate employee in DB:', err);
      return res.status(500).json({ status: 'error', message: 'خەتای سێرڤەر' });
    }
  }

  return res.json({ status: 'success', message: 'Reactivated in memory' });
});

// POST /api/markets/:market_id/employees/:employee_user_id/revoke
app.post('/api/markets/:market_id/employees/:employee_user_id/revoke', async (req, res) => {
  const { market_id, employee_user_id } = req.params;
  const actorCheck = await verifyTenantActor(req);
  if (!actorCheck.authorized) {
    return res.status(403).json({ status: 'error', code: actorCheck.code, message: actorCheck.message });
  }

  if (actorCheck.userId && actorCheck.userId === employee_user_id) {
    return res.status(403).json({ status: 'error', message: 'بەڕێوەبەر ناتوانێت دۆخی خۆی بگۆڕێت' });
  }

  const { reason } = req.body;

  if (pool) {
    try {
      const result = await pool.query(`
        UPDATE public.market_memberships
        SET status = 'REVOKED', updated_at = NOW()
        WHERE market_id = $1 AND user_id = $2 AND role = 'EMPLOYEE'
        RETURNING id
      `, [market_id, employee_user_id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ status: 'error', message: 'کارمەند نەدۆزرایەوە' });
      }

      await logPlatformAudit(
        market_id,
        employee_user_id,
        'EMPLOYEE_REVOKED',
        `لێسەندنەوەی یەکجارەکی دەسەڵاتی کارمەند`,
        actorCheck.userId || 'MANAGER',
        reason ? reason.trim() : undefined
      );

      return res.json({ status: 'success', message: 'دەسەڵاتی کارمەند بە یەکجارەکی لێسەندراوە (REVOKED)' });
    } catch (err) {
      console.error('Failed to revoke employee in DB:', err);
      return res.status(500).json({ status: 'error', message: 'خەتای سێرڤەر' });
    }
  }

  return res.json({ status: 'success', message: 'Revoked in memory' });
});

// GET /api/markets/:market_id/employees/:employee_user_id/audit
app.get('/api/markets/:market_id/employees/:employee_user_id/audit', async (req, res) => {
  const { market_id, employee_user_id } = req.params;
  const actorCheck = await verifyTenantActor(req);
  if (!actorCheck.authorized) {
    return res.status(403).json({ status: 'error', code: actorCheck.code, message: actorCheck.message });
  }

  if (pool) {
    try {
      const dbRes = await pool.query(`
        SELECT id, market_id, customer_id as user_id, action_type, description, performed_by, timestamp
        FROM public.audit_logs
        WHERE market_id = $1 AND customer_id = $2
        ORDER BY timestamp DESC
        LIMIT 50
      `, [market_id, employee_user_id]);

      return res.json({ status: 'success', data: dbRes.rows });
    } catch (err) {
      console.error('Failed to query employee audit logs from DB:', err);
      return res.status(500).json({ status: 'error', message: 'خەتای سێرڤەر' });
    }
  }

  const logs = (db.audit_logs || []).filter((l: any) => l.market_id === market_id && l.customer_id === employee_user_id);
  return res.json({ status: 'success', data: logs });
});

// Update Platform Authority Record Status (Revoke / Suspend / Restore)
app.post('/api/platform/authority/update-status', async (req, res) => {
  if (!(await isActorPlatformOwner(req))) {
    return res.status(403).json({
      status: 'error',
      code: 'NOT_AUTHORIZED_PLATFORM_OWNER',
      message: 'دەستگەیشتن ڕەتکرایەوە - تەنها خاوەنی سیستەم دەتوانێت دەسەڵاتی خاوەنی سیستەم ببات بەڕێوە'
    });
  }

  const { user_id, status, reason } = req.body || {};
  if (!user_id || !status || !['ACTIVE', 'SUSPENDED', 'REVOKED'].includes(status)) {
    return res.status(400).json({ status: 'error', message: 'بەکارهێنەر و بارودۆخی نوێ داواکراوە' });
  }

  if (pool) {
    try {
      await pool.query(`
        UPDATE public.platform_access
        SET status = $1, updated_at = NOW()
        WHERE user_id = $2 AND role = 'PLATFORM_OWNER'
      `, [status, user_id]);
    } catch (err) {
      console.error('Failed to update platform authority status in DB:', err);
    }
  }

  if (db.platform_access) {
    const pa = db.platform_access.find(p => p.user_id === user_id && p.role === 'PLATFORM_OWNER');
    if (pa) {
      pa.status = status as any;
    }
  }

  const verifiedActor = await verifySupabaseAccessToken(extractBearerToken(req) || '');
  const performedBy = verifiedActor?.id || 'PLATFORM_OWNER';

  await logPlatformAudit(
    'SYSTEM_GLOBAL',
    user_id,
    status === 'ACTIVE' ? 'PLATFORM_AUTHORITY_RESTORED' : 'PLATFORM_AUTHORITY_REVOKED',
    `پلەی خاوەنی سیستەم گۆڕدرا بۆ ${status}`,
    performedBy,
    reason
  );

  return res.json({ status: 'success', message: `دەسەڵاتی خاوەنی سیستەم نوێکرایەوە بۆ ${status}` });
});

// PLATFORM MANAGEMENT ENDPOINTS (For Platform Owner)

// Platform Overview Stats
app.get('/api/platform/overview', async (req, res) => {
  if (!(await isActorPlatformOwner(req))) {
    return res.status(403).json({
      status: 'error',
      code: 'NOT_AUTHORIZED_PLATFORM_OWNER',
      message: 'دەستگەیشتن ڕەتکرایەوە - تەنها خاوەنی سیستەم دەتوانێت ئاماری گشتی ببینێت'
    });
  }

  if (!pool) {
    return res.status(503).json({
      status: 'error',
      code: 'DATABASE_UNAVAILABLE',
      message: 'سیستەمی بنکەی زانیاری لەبەردەستدا نییە'
    });
  }

  try {
    const resMarkets = await pool.query(`SELECT status, count(*) FROM public.markets WHERE id != 'SYSTEM_GLOBAL' GROUP BY status`);
    const resManagers = await pool.query(`SELECT count(*) FROM public.market_memberships WHERE role IN ('MARKET_MANAGER', 'EMPLOYEE')`);

    let total = 0, active = 0, suspended = 0;
    resMarkets.rows.forEach(r => {
      const count = parseInt(r.count, 10);
      total += count;
      if (r.status === 'ACTIVE') active += count;
      if (r.status === 'SUSPENDED') suspended += count;
    });

    return res.json({
      status: 'success',
      data: {
        total_markets: total,
        active_markets: active,
        suspended_markets: suspended,
        expired_licenses: 0,
        total_managers: parseInt(resManagers.rows[0]?.count || '0', 10),
        total_customers: 0
      }
    });
  } catch (e) {
    console.error('Failed to query overview stats from Postgres:', e);
    return res.status(503).json({
      status: 'error',
      code: 'DATABASE_UNAVAILABLE',
      message: 'کێشە لە ڕاپرسی بنکەی زانیاری'
    });
  }
});

// Platform Get All Markets
app.get('/api/platform/markets', async (req, res) => {
  if (!(await isActorPlatformOwner(req))) {
    return res.status(403).json({
      status: 'error',
      code: 'NOT_AUTHORIZED_PLATFORM_OWNER',
      message: 'دەستگەیشتن ڕەتکرایەوە - تەنها خاوەنی سیستەم دەتوانێت لیست مارکێتەکان ببینێت'
    });
  }

  if (!pool) {
    return res.status(503).json({
      status: 'error',
      code: 'DATABASE_UNAVAILABLE',
      message: 'سیستەمی بنکەی زانیاری لەبەردەستدا نییە'
    });
  }

  try {
    const result = await pool.query(`
      SELECT 
        m.id, 
        m.name, 
        m.status, 
        m.created_at,
        COALESCE(u.full_name, 'دیاری نەکراو') as owner_name,
        COALESCE(u.email, '') as owner_email,
        COALESCE(u.phone, '') as owner_phone,
        (m.created_at + INTERVAL '1 year')::text as license_expires_at,
        (SELECT COUNT(*) FROM public.market_memberships mm WHERE mm.market_id = m.id) as managers_count,
        0 as customers_count,
        'IQD' as currency
      FROM public.markets m
      LEFT JOIN public.market_memberships mm ON mm.market_id = m.id AND mm.role = 'MARKET_MANAGER'
      LEFT JOIN public.users u ON mm.user_id = u.id
      WHERE m.id != 'SYSTEM_GLOBAL'
      ORDER BY m.created_at DESC
    `);

    const enriched = result.rows.map((row: any) => {
      const found = db.markets?.find((m: any) => m.id === row.id);
      return {
        ...row,
        owner_phone: row.owner_phone || found?.owner_phone || ''
      };
    });
    return res.json({
      status: 'success',
      data: {
        items: enriched,
        total: enriched.length,
        page: 1,
        pageSize: 20
      }
    });
  } catch (e) {
    console.error('Failed to query markets from Postgres:', e);
    return res.status(503).json({
      status: 'error',
      code: 'DATABASE_UNAVAILABLE',
      message: 'کێشە لە ڕاپرسی بنکەی زانیاری'
    });
  }
});

// Platform Create New Market
app.post('/api/platform/markets', async (req, res) => {
  const {
    id,
    name,
    registered_phone,
    manager_name,
    owner_name,
    manager_login_phone,
    owner_phone,
    manager_email,
    owner_email,
    currency,
    license_days
  } = req.body;

  const officialName = name || '';
  const initialManagerName = manager_name || owner_name || '';
  const officialPhone = registered_phone || owner_phone || '';
  const managerLoginPhone = manager_login_phone || officialPhone || '';
  const managerEmail = manager_email || owner_email || '';

  if (!officialName || !initialManagerName) {
    return res.status(400).json({ status: 'error', message: 'ناوی فەرمی مارکێت و ناوی بەڕێوەبەری سەرەتایی داواکراوە' });
  }

  const marketId = id || `market-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
  const userId = crypto.randomUUID();
  const memId = `mem-${Date.now().toString(36)}`;

  // Add system user record for auth login
  db.system_users.push({
    id: userId,
    name: initialManagerName,
    phone: managerLoginPhone,
    password: '',
    role: 'MARKET_MANAGER',
    status: 'PENDING_ACTIVATION',
    permissions: ['ALL', 'ADD_DEBT', 'RECEIVE_PAYMENT', 'ADD_CUSTOMER', 'REVERSE_TRANSACTION', 'VIEW_ANALYTICS', 'EXPORT_STATEMENTS', 'MANAGE_CREDIT_LIMIT'],
    created_at: new Date().toISOString()
  });

  const newMarketObj = {
    id: marketId,
    name: officialName,
    status: 'ACTIVE',
    owner_name: initialManagerName,
    owner_email: managerEmail || `${marketId}@zhirox.com`,
    owner_phone: officialPhone,
    manager_login_phone: managerLoginPhone,
    created_at: new Date().toISOString(),
    license_expires_at: new Date(Date.now() + (license_days || 365) * 24 * 60 * 60 * 1000).toISOString(),
    managers_count: 1,
    customers_count: 0,
    currency: currency || 'IQD'
  };

  if (!db.markets) db.markets = [];
  db.markets.unshift(newMarketObj);

  // Generate high-entropy one-time activation token
  const rawActivationToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawActivationToken).digest('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const tokenId = `act-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;

  if (!(db as any).activation_tokens) (db as any).activation_tokens = [];
  (db as any).activation_tokens.push({
    id: tokenId,
    token_hash: tokenHash,
    market_id: marketId,
    market_name: officialName,
    user_id: userId,
    manager_name: initialManagerName,
    manager_login_phone: managerLoginPhone,
    status: 'PENDING',
    expires_at: expiresAt,
    consumed_at: null,
    created_at: new Date().toISOString()
  });

  saveDb(db);

  if (pool) {
    try {
      const client = await pool.connect();
      try {
        await client.query('BEGIN;');

        // 1. Insert Market
        await client.query(`
          INSERT INTO public.markets (id, name, status, created_at, updated_at)
          VALUES ($1, $2, 'ACTIVE', NOW(), NOW())
          ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;
        `, [marketId, officialName]);

        // 2. Insert User (Initial Manager)
        await client.query(`
          INSERT INTO public.users (id, auth_user_id, full_name, email, phone, is_active, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, false, NOW(), NOW())
          ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, phone = EXCLUDED.phone, updated_at = NOW();
        `, [userId, userId, initialManagerName, managerEmail || `${marketId}@zhirox.com`, managerLoginPhone]);

        // 3. Insert Membership
        await client.query(`
          INSERT INTO public.market_memberships (id, market_id, user_id, role, permissions, status, created_at, updated_at)
          VALUES ($1, $2, $3, 'MARKET_MANAGER', '["all"]'::jsonb, 'PENDING_ACTIVATION', NOW(), NOW())
          ON CONFLICT DO NOTHING;
        `, [memId, marketId, userId]);

        // 4. Insert Activation Token in Postgres
        await client.query(`
          INSERT INTO public.activation_tokens (id, token_hash, market_id, market_name, user_id, manager_name, manager_login_phone, status, expires_at, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING', $8, NOW())
          ON CONFLICT (token_hash) DO NOTHING;
        `, [tokenId, tokenHash, marketId, officialName, userId, initialManagerName, managerLoginPhone, expiresAt]);

        await client.query('COMMIT;');
      } catch (err) {
        await client.query('ROLLBACK;');
        console.error('Failed transaction inserting new market:', err);
      } finally {
        client.release();
      }
    } catch (e) {
      console.error('Postgres pool error:', e);
    }
  }

  const baseUrl = getBaseUrlFromReq(req);
  const activationUrl = `${baseUrl}/activate/manager?token=${rawActivationToken}`;

  res.json({
    status: 'success',
    message: 'مارکێتی نوێ و هەژماری بەڕێوەبەری سەرەتایی بە سەرکەوتوویی دروستکرا!',
    market: newMarketObj,
    activation_token: rawActivationToken,
    activation_url: activationUrl
  });
});

// Regenerate Manager Activation Link for specific activation relationship
app.post('/api/platform/markets/:market_id/regenerate-activation', async (req, res) => {
  if (!checkForeignMarketAccess(req, res)) return;
  const { market_id } = req.params;
  const { user_id } = req.body || {};
  const market = db.markets.find(m => m.id === market_id);
  if (!market) {
    return res.status(404).json({ status: 'error', message: 'مارکێت نەدۆزرایەوە' });
  }

  let targetUserId = user_id;
  if (!targetUserId) {
    const existingToken = (db as any).activation_tokens?.find((t: any) => t.market_id === market_id && t.user_id);
    targetUserId = existingToken ? existingToken.user_id : `usr-${market_id}`;
  }

  // Target exact activation relationship in Postgres
  if (pool) {
    try {
      await pool.query(`
        UPDATE public.activation_tokens
        SET status = 'REVOKED'
        WHERE market_id = $1 AND (user_id = $2 OR $2 IS NULL) AND status = 'PENDING';
      `, [market_id, user_id || null]);
    } catch (err) {
      console.error('Failed to revoke tokens in Postgres:', err);
    }
  }

  if ((db as any).activation_tokens) {
    (db as any).activation_tokens.forEach((t: any) => {
      if (t.market_id === market_id && (t.user_id === targetUserId || !user_id) && t.status === 'PENDING') {
        t.status = 'REVOKED';
      }
    });
  }

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const tokenId = `act-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;

  if (pool) {
    try {
      await pool.query(`
        INSERT INTO public.activation_tokens (id, token_hash, market_id, market_name, user_id, manager_name, manager_login_phone, status, expires_at, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING', $8, NOW())
      `, [tokenId, tokenHash, market_id, market.name, targetUserId, market.owner_name, market.manager_login_phone || market.owner_phone, expiresAt]);
    } catch (err) {
      console.error('Failed to insert regenerated activation token:', err);
    }
  }

  (db as any).activation_tokens.push({
    id: tokenId,
    token_hash: tokenHash,
    market_id: market_id,
    market_name: market.name,
    user_id: targetUserId,
    manager_name: market.owner_name,
    manager_login_phone: market.manager_login_phone || market.owner_phone,
    status: 'PENDING',
    expires_at: expiresAt,
    consumed_at: null,
    created_at: new Date().toISOString()
  });

  saveDb(db);

  const baseUrl = getBaseUrlFromReq(req);
  const activationUrl = `${baseUrl}/activate/manager?token=${rawToken}`;

  res.json({
    status: 'success',
    message: 'بەستەری نوێی چالاککردن بە سەرکەوتوویی دروستکرا',
    activation_token: rawToken,
    activation_url: activationUrl
  });
});

// Cancel Manager Activation for exact activation relationship
app.post('/api/platform/markets/:market_id/cancel-activation', async (req, res) => {
  if (!checkForeignMarketAccess(req, res)) return;
  const { market_id } = req.params;
  const { user_id } = req.body || {};

  if (pool) {
    try {
      await pool.query(`
        UPDATE public.activation_tokens
        SET status = 'REVOKED'
        WHERE market_id = $1 AND (user_id = $2 OR $2 IS NULL) AND status = 'PENDING';
      `, [market_id, user_id || null]);
    } catch (err) {
      console.error('Failed to cancel activation tokens in Postgres:', err);
    }
  }

  if ((db as any).activation_tokens) {
    (db as any).activation_tokens.forEach((t: any) => {
      if (t.market_id === market_id && (t.user_id === user_id || !user_id) && t.status === 'PENDING') {
        t.status = 'REVOKED';
      }
    });
    saveDb(db);
  }
  res.json({
    status: 'success',
    message: 'چالاککردن بە سەرکەوتوویی هەڵوەشێنرایەوە'
  });
});

// Platform Update Market License & Status
app.put('/api/platform/markets/:market_id/license', async (req, res) => {
  const { market_id } = req.params;
  const { action } = req.body;

  let newStatus = 'ACTIVE';
  if (action === 'SUSPEND') newStatus = 'SUSPENDED';
  if (action === 'ACTIVATE') newStatus = 'ACTIVE';

  if (db.markets) {
    const m = db.markets.find((item: any) => item.id === market_id);
    if (m) {
      m.status = newStatus;
      saveDb(db);
    }
  }

  if (pool) {
    try {
      await pool.query(`UPDATE public.markets SET status = $1, updated_at = NOW() WHERE id = $2`, [newStatus, market_id]);
    } catch (e) {
      console.error('Failed to update market license status:', e);
    }
  }

  res.json({
    status: 'success',
    message: `مۆڵەت و دۆخی مارکێت (${market_id}) بە سەرکەوتوویی گۆڕدرا`
  });
});

// Platform Delete Market Account
// Platform Close Market Account
app.delete('/api/platform/markets/:market_id', async (req, res) => {
  if (!(await isActorPlatformOwner(req))) {
    return res.status(403).json({ status: 'error', message: 'دەستگەیشتن ڕەتکرایەوە - تەنها خاوەنی سیستەم ڕێگەپێدراوە' });
  }

  const { market_id } = req.params;

  if (pool) {
    try {
      await pool.query(`
        UPDATE public.markets
        SET status = 'CLOSED', updated_at = NOW()
        WHERE id = $1;
      `, [market_id]);

      await pool.query(`
        UPDATE public.market_memberships
        SET status = 'SUSPENDED', updated_at = NOW()
        WHERE market_id = $1;
      `, [market_id]);

      await logPlatformAudit(market_id, 'SYSTEM', 'MARKET_CLOSED', `داخستنی مارکێت (${market_id}) و دروستنەکردنی سڕینەوەی فیزیکی داتا لەسەر داوای بەکارهێنەر`, 'PLATFORM_OWNER');
    } catch (e) {
      console.error('Failed to close market in Postgres:', e);
      return res.status(500).json({ status: 'error', message: 'هەڵە لە داخستنی مارکێت لە بنکەی زانیاری' });
    }
  }

  res.json({
    status: 'success',
    message: 'مارکێتەکە بە سەرکەوتوویی داخرا و داتاکانی لەسەر سیستەم پارێزران'
  });
});

// Platform Assign Manager/Owner to Market
app.post('/api/platform/markets/:market_id/managers', async (req, res) => {
  if (!(await isActorPlatformOwner(req))) {
    return res.status(403).json({ status: 'error', message: 'دەستگەیشتن ڕەتکرایەوە - تەنها خاوەنی سیستەم ڕێگەپێدراوە' });
  }

  const { market_id } = req.params;
  const { full_name, email, phone, role } = req.body;

  if (!full_name || typeof full_name !== 'string' || !full_name.trim()) {
    return res.status(400).json({ status: 'error', message: 'ناوی بەڕێوەبەر داواکراوە' });
  }

  if (!pool) {
    return res.status(503).json({ status: 'error', message: 'بنکەی زانیاری دەستنەکەوت' });
  }

  const userId = crypto.randomUUID();
  const memId = `mem-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
  const targetRole = 'MARKET_MANAGER';

  const rawActivationToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawActivationToken).digest('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const client = await pool.connect();
  try {
    await client.query('BEGIN;');

    // 1. Insert staged user with auth_user_id NULL and is_active false
    await client.query(`
      INSERT INTO public.users (id, auth_user_id, full_name, email, phone, is_active, created_at, updated_at)
      VALUES ($1, NULL, $2, $3, $4, false, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, phone = EXCLUDED.phone, updated_at = NOW();
    `, [userId, full_name.trim(), email || `user-${userId}@zhirox.internal`, phone ? phone.trim() : null]);

    // 2. Insert market membership with PENDING_ACTIVATION status
    await client.query(`
      INSERT INTO public.market_memberships (id, market_id, user_id, role, permissions, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, '["ALL"]'::jsonb, 'PENDING_ACTIVATION', NOW(), NOW());
    `, [memId, market_id, userId, targetRole]);

    // 3. Store activation token in DB
    const tokenId = `act-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    await client.query(`
      INSERT INTO public.activation_tokens (id, token_hash, market_id, market_name, user_id, manager_name, manager_login_phone, status, expires_at, created_at)
      VALUES ($1, $2, $3, 'Market', $4, $5, $6, 'READY', $7, NOW());
    `, [tokenId, tokenHash, market_id, userId, full_name.trim(), phone ? phone.trim() : '', expiresAt]);

    await client.query('COMMIT;');

    const baseUrl = getBaseUrlFromReq(req);
    const activationUrl = `${baseUrl}/activate/manager?token=${rawActivationToken}`;

    await logPlatformAudit(market_id, userId, 'MANAGER_PROVISIONED', `بەڕێوەبەری نوێ (${full_name.trim()}) دیاری کرا بە بەستەری چالاککردنەوە`, 'PLATFORM_OWNER');

    return res.status(201).json({
      status: 'success',
      message: `بەڕێوەبەری نوێ (${full_name.trim()}) زیادکرا و لینکی چالاککردنەوە ئامادە کرا`,
      data: {
        user_id: userId,
        full_name: full_name.trim(),
        role: targetRole,
        status: 'PENDING_ACTIVATION',
        activation_token: rawActivationToken,
        activation_url: activationUrl,
        expires_at: expiresAt
      }
    });
  } catch (err) {
    await client.query('ROLLBACK;');
    console.error('Failed adding manager in DB transaction:', err);
    return res.status(500).json({ status: 'error', message: 'خەتای تۆمارکردنی بەڕێوەبەر لە بنکەی زانیاری' });
  } finally {
    client.release();
  }
});

// Platform Get All Managers
app.get('/api/platform/managers', async (req, res) => {
  if (!(await isActorPlatformOwner(req))) {
    return res.status(403).json({
      status: 'error',
      code: 'NOT_AUTHORIZED_PLATFORM_OWNER',
      message: 'دەستگەیشتن ڕەتکرایەوە - تەنها خاوەنی سیستەم دەتوانێت بەڕێوەبەرەکان ببینێت'
    });
  }

  if (!pool) {
    return res.status(503).json({
      status: 'error',
      code: 'DATABASE_UNAVAILABLE',
      message: 'سیستەمی بنکەی زانیاری لەبەردەستدا نییە'
    });
  }

  try {
    const result = await pool.query(`
      SELECT 
        mm.id,
        mm.market_id,
        mm.user_id,
        u.full_name,
        u.email,
        u.phone,
        mm.role,
        mm.status,
        mm.created_at
      FROM public.market_memberships mm
      JOIN public.users u ON mm.user_id = u.id
      WHERE mm.market_id != 'SYSTEM_GLOBAL'
      ORDER BY mm.created_at DESC
    `);

    return res.json({
      status: 'success',
      data: {
        items: result.rows,
        total: result.rows.length,
        page: 1,
        pageSize: 20
      }
    });
  } catch (e) {
    console.error('Failed querying managers from Postgres:', e);
    return res.status(503).json({
      status: 'error',
      code: 'DATABASE_UNAVAILABLE',
      message: 'کێشە لە ڕاپرسی بنکەی زانیاری'
    });
  }
});

// ZHIROX ACCOUNT OPERATIONS CENTER ENDPOINTS

// 1. Get Account Operations List & Summary
app.get('/api/platform/account-operations', async (req, res) => {
  if (!(await isActorPlatformOwner(req))) {
    return res.status(403).json({
      status: 'error',
      code: 'NOT_AUTHORIZED_PLATFORM_OWNER',
      message: 'دەستگەیشتن ڕەتکرایەوە - تەنها خاوەنی سیستەم دەتوانێت بەڕێوەبردنی هەژمارەکان ببات بەڕێوە'
    });
  }

  if (!pool) {
    return res.status(503).json({
      status: 'error',
      code: 'DATABASE_UNAVAILABLE',
      message: 'سیستەمی بنکەی زانیاری لەبەردەستدا نییە'
    });
  }

  try {
    const marketsRes = await pool.query(`
      SELECT 
        m.id as market_id,
        m.name as official_market_name,
        m.status as license_status,
        m.created_at,
        (m.created_at + INTERVAL '1 year')::text as license_expires_at,
        'IQD' as currency
      FROM public.markets m
      WHERE m.id != 'SYSTEM_GLOBAL'
      ORDER BY m.created_at DESC;
    `);

    const opsRecords: any[] = [];
    let totalCount = 0, activeCount = 0, pendingCount = 0, suspendedCount = 0, revokedCount = 0, needsReviewCount = 0;

    for (const m of marketsRes.rows) {
      totalCount++;
      const localM = db.markets?.find((dbM: any) => dbM.id === m.market_id);

      const memsRes = await pool.query(`
        SELECT 
          mm.id as membership_id,
          mm.user_id,
          mm.role as manager_role,
          mm.status as membership_status,
          mm.created_at as membership_created_at,
          mm.updated_at as membership_updated_at,
          u.full_name as manager_name,
          u.email as manager_email,
          u.phone as manager_login_phone,
          u.auth_user_id
        FROM public.market_memberships mm
        JOIN public.users u ON mm.user_id = u.id
        WHERE mm.market_id = $1 AND mm.role IN ('MARKET_MANAGER', 'EMPLOYEE')
        ORDER BY mm.created_at DESC;
      `, [m.market_id]);

      const ownerMemInRows = memsRes.rows.find((r: any) => r.manager_role === 'MARKET_MANAGER') || memsRes.rows.find((r: any) => r.membership_status === 'ACTIVE') || memsRes.rows[0];
      const registeredPhone = ownerMemInRows?.manager_login_phone || localM?.registered_phone || localM?.owner_phone || '07501234567';

      const tokensRes = await pool.query(`
        SELECT id, user_id, status, expires_at, consumed_at, created_at
        FROM public.activation_tokens
        WHERE market_id = $1
        ORDER BY created_at DESC;
      `, [m.market_id]);

      const primaryMem = memsRes.rows.find((r: any) => r.membership_status === 'ACTIVE') || memsRes.rows[0];
      const pendingReplMem = memsRes.rows.find((r: any) => r.membership_status === 'PENDING_ACTIVATION' && primaryMem && r.user_id !== primaryMem.user_id);

      let membershipStatus = primaryMem ? primaryMem.membership_status : 'PENDING_ACTIVATION';
      let managerName = primaryMem ? primaryMem.manager_name : (localM?.owner_name || 'دیاری نەکراو');
      let managerUserId = primaryMem ? primaryMem.user_id : `usr-${m.market_id}`;
      let managerLoginPhone = primaryMem?.manager_login_phone || localM?.manager_login_phone || registeredPhone;
      let managerEmail = primaryMem?.manager_email || localM?.owner_email || '';
      let managerRole = primaryMem?.manager_role || 'MARKET_MANAGER';
      let membershipId = primaryMem?.membership_id || `mem-${m.market_id}`;

      const token = tokensRes.rows.find((t: any) => t.user_id === managerUserId || t.status === 'PENDING');
      let activationStatus = 'NONE';
      let activationTokenId = token?.id;
      let activationExpiresAt = token?.expires_at;

      if (membershipStatus === 'PENDING_ACTIVATION') {
        if (token) {
          if (token.status === 'CONSUMED') activationStatus = 'ACTIVATED';
          else if (token.status === 'REVOKED') activationStatus = 'REVOKED';
          else if (new Date(token.expires_at) < new Date()) activationStatus = 'EXPIRED';
          else activationStatus = 'READY';
        } else {
          activationStatus = 'READY';
        }
      } else if (membershipStatus === 'ACTIVE') {
        activationStatus = 'ACTIVATED';
      }

      let authLinkageStatus = 'INCOMPLETE';
      if (primaryMem && primaryMem.auth_user_id && !primaryMem.auth_user_id.startsWith('auth-usr-')) {
        authLinkageStatus = 'LINKED';
      } else if (membershipStatus === 'PENDING_ACTIVATION') {
        authLinkageStatus = 'PENDING_ACTIVATION';
      } else if (primaryMem?.auth_user_id) {
        authLinkageStatus = 'LINKED';
      }

      const healthFlags: string[] = [];
      if (membershipStatus === 'PENDING_ACTIVATION') {
        healthFlags.push('PENDING_ACTIVATION');
        pendingCount++;
      }
      if (membershipStatus === 'SUSPENDED') {
        healthFlags.push('SUSPENDED');
        suspendedCount++;
      }
      if (membershipStatus === 'REVOKED') {
        healthFlags.push('REVOKED');
        revokedCount++;
      }
      if (membershipStatus === 'ACTIVE') {
        activeCount++;
      }
      if (activationStatus === 'EXPIRED') {
        healthFlags.push('EXPIRED_ACTIVATION');
      }
      if (authLinkageStatus === 'INCOMPLETE' && membershipStatus === 'ACTIVE') {
        healthFlags.push('MISSING_AUTH_LINK');
      }
      if (memsRes.rows.filter((r: any) => r.membership_status === 'ACTIVE').length > 1) {
        healthFlags.push('AMBIGUOUS_MANAGER_RELATIONSHIP');
      }

      if (healthFlags.length > 0 && membershipStatus !== 'ACTIVE') {
        needsReviewCount++;
      }

      let pendingReplacement = null;
      if (pendingReplMem) {
        const replToken = tokensRes.rows.find((t: any) => t.user_id === pendingReplMem.user_id && t.status === 'PENDING');
        pendingReplacement = {
          candidate_user_id: pendingReplMem.user_id,
          candidate_name: pendingReplMem.manager_name,
          candidate_login_phone: pendingReplMem.manager_login_phone || registeredPhone,
          candidate_email: pendingReplMem.manager_email,
          activation_token_id: replToken?.id,
          activation_expires_at: replToken?.expires_at,
          created_at: pendingReplMem.membership_created_at
        };
      }

      opsRecords.push({
        market_id: m.market_id,
        official_market_name: m.official_market_name,
        official_registered_phone: registeredPhone,
        currency: m.currency,
        license_status: m.license_status,
        license_expires_at: m.license_expires_at,
        created_at: m.created_at,
        
        manager_user_id: managerUserId,
        manager_name: managerName,
        manager_login_phone: managerLoginPhone,
        manager_email: managerEmail,
        manager_role: managerRole,

        membership_id: membershipId,
        membership_status: membershipStatus,
        activation_status: activationStatus,
        auth_linkage_status: authLinkageStatus,

        activated_at: membershipStatus === 'ACTIVE' ? primaryMem?.membership_updated_at : null,
        activation_token_id: activationTokenId,
        activation_token_expires_at: activationExpiresAt,
        pending_replacement: pendingReplacement,
        health_flags: healthFlags
      });
    }

    return res.json({
      status: 'success',
      data: {
        items: opsRecords,
        total: opsRecords.length,
        page: 1,
        pageSize: 20
      },
      summary: {
        total_accounts: totalCount,
        active_count: activeCount,
        pending_activation_count: pendingCount,
        suspended_count: suspendedCount,
        revoked_count: revokedCount,
        needs_review_count: needsReviewCount
      }
    });
  } catch (err) {
    console.error('Failed querying account operations:', err);
    return res.status(503).json({
      status: 'error',
      code: 'DATABASE_UNAVAILABLE',
      message: 'کێشە لە پەیوەندی بە بنکەی زانیاری'
    });
  }
});

// 2. Suspend Manager
app.post('/api/platform/markets/:market_id/managers/:user_id/suspend', async (req, res) => {
  if (!(await isActorPlatformOwner(req))) {
    return res.status(403).json({ status: 'error', message: 'دەستگەیشتن ڕەتکرایەوە - تەنها خاوەنی سیستەم ڕێگەپێدراوە' });
  }

  const { market_id, user_id } = req.params;
  const { reason } = req.body || {};

  if (!reason || !reason.trim()) {
    return res.status(400).json({ status: 'error', message: 'تکایە هۆکاری ڕاگرتنی هەژمارەکە بنووسە' });
  }

  if (pool) {
    try {
      const memCheck = await pool.query(`
        SELECT status FROM public.market_memberships
        WHERE market_id = $1 AND user_id = $2;
      `, [market_id, user_id]);

      if (memCheck.rows.length === 0) {
        return res.status(404).json({ status: 'error', message: 'پەیوەندیی بەڕێوەبەر بەم مارکێتە نەدۆزرایەوە' });
      }

      if (memCheck.rows[0].status !== 'ACTIVE') {
        return res.status(400).json({ status: 'error', message: 'تەنها هەژماری چالاک دەکرێت ڕابگیرێت' });
      }

      await pool.query(`
        UPDATE public.market_memberships
        SET status = 'SUSPENDED', updated_at = NOW()
        WHERE market_id = $1 AND user_id = $2;
      `, [market_id, user_id]);

      await logPlatformAudit(market_id, user_id, 'MANAGER_SUSPENDED', 'ڕاگرتنی هەژماری بەڕێوەبەر', 'PLATFORM_OWNER', reason);

      return res.json({
        status: 'success',
        message: 'هەژماری بەڕێوەبەر بە سەرکەوتوویی ڕاگەیەندرا'
      });
    } catch (err) {
      console.error('Failed to suspend manager:', err);
      return res.status(500).json({ status: 'error', message: 'کێشە لە ڕاگرتنی هەژمار' });
    }
  }

  res.json({ status: 'success', message: 'هەژماری بەڕێوەبەر بە سەرکەوتوویی ڕاگەیەندرا' });
});

// 3. Reactivate Manager
app.post('/api/platform/markets/:market_id/managers/:user_id/reactivate', async (req, res) => {
  if (!(await isActorPlatformOwner(req))) {
    return res.status(403).json({ status: 'error', message: 'دەستگەیشتن ڕەتکرایەوە - تەنها خاوەنی سیستەم ڕێگەپێدراوە' });
  }

  const { market_id, user_id } = req.params;
  const { reason } = req.body || {};

  if (pool) {
    try {
      const memCheck = await pool.query(`
        SELECT status FROM public.market_memberships
        WHERE market_id = $1 AND user_id = $2;
      `, [market_id, user_id]);

      if (memCheck.rows.length === 0) {
        return res.status(404).json({ status: 'error', message: 'پەیوەندیی بەڕێوەبەر بەم مارکێتە نەدۆزرایەوە' });
      }

      if (memCheck.rows[0].status !== 'SUSPENDED') {
        return res.status(400).json({ status: 'error', message: 'تەنها هەژماری ڕاگیراو دەکرێت چالاکبکرێتەوە' });
      }

      await pool.query(`
        UPDATE public.market_memberships
        SET status = 'ACTIVE', updated_at = NOW()
        WHERE market_id = $1 AND user_id = $2;
      `, [market_id, user_id]);

      await logPlatformAudit(market_id, user_id, 'MANAGER_REACTIVATED', 'چالاککردنەوەی هەژماری ڕاگیراوی بەڕێوەبەر', 'PLATFORM_OWNER', reason);

      return res.json({
        status: 'success',
        message: 'هەژماری بەڕێوەبەر بە سەرکەوتوویی چالاککرایەوە'
      });
    } catch (err) {
      console.error('Failed to reactivate manager:', err);
      return res.status(500).json({ status: 'error', message: 'کێشە لە چالاککردنەوەی هەژمار' });
    }
  }

  res.json({ status: 'success', message: 'هەژماری بەڕێوەبەر بە سەرکەوتوویی چالاککرایەوە' });
});

// 4. Revoke Manager
app.post('/api/platform/markets/:market_id/managers/:user_id/revoke', async (req, res) => {
  if (!(await isActorPlatformOwner(req))) {
    return res.status(403).json({ status: 'error', message: 'دەستگەیشتن ڕەتکرایەوە - تەنها خاوەنی سیستەم ڕێگەپێدراوە' });
  }

  const { market_id, user_id } = req.params;
  const { reason } = req.body || {};

  if (!reason || !reason.trim()) {
    return res.status(400).json({ status: 'error', message: 'تکایە هۆکاری لێسەندنەوەی دەسەڵاتی هەژمارەکە بنووسە' });
  }

  if (pool) {
    try {
      const memCheck = await pool.query(`
        SELECT status FROM public.market_memberships
        WHERE market_id = $1 AND user_id = $2;
      `, [market_id, user_id]);

      if (memCheck.rows.length === 0) {
        return res.status(404).json({ status: 'error', message: 'پەیوەندیی بەڕێوەبەر بەم مارکێتە نەدۆزرایەوە' });
      }

      await pool.query(`
        UPDATE public.market_memberships
        SET status = 'REVOKED', updated_at = NOW()
        WHERE market_id = $1 AND user_id = $2;
      `, [market_id, user_id]);

      await pool.query(`
        UPDATE public.activation_tokens
        SET status = 'REVOKED'
        WHERE market_id = $1 AND user_id = $2 AND status = 'PENDING';
      `, [market_id, user_id]);

      await logPlatformAudit(market_id, user_id, 'MANAGER_REVOKED', 'لێسەندنەوەی یەکجارەکی دەسەڵاتی بەڕێوەبەر', 'PLATFORM_OWNER', reason);

      return res.json({
        status: 'success',
        message: 'دەسەڵاتی بەڕێوەبەر بە یەکجارەکی لێسەندرایەوە'
      });
    } catch (err) {
      console.error('Failed to revoke manager:', err);
      return res.status(500).json({ status: 'error', message: 'کێشە لە لێسەندنەوەی دەسەڵاتی هەژمار' });
    }
  }

  res.json({ status: 'success', message: 'دەسەڵاتی بەڕێوەبەر بە یەکجارەکی لێسەندرایەوە' });
});

// 5. Replace Manager
app.post('/api/platform/markets/:market_id/replace-manager', async (req, res) => {
  if (!(await isActorPlatformOwner(req))) {
    return res.status(403).json({ status: 'error', message: 'دەستگەیشتن ڕەتکرایەوە - تەنها خاوەنی سیستەم ڕێگەپێدراوە' });
  }

  const { market_id } = req.params;
  const { new_manager_name, new_manager_login_phone, new_manager_email, reason } = req.body || {};

  if (!new_manager_name || !new_manager_login_phone) {
    return res.status(400).json({ status: 'error', message: 'تکایە ناوی بەڕێوەبەری نوێ و ژمارەی چوونەژوورەوەی بنووسە' });
  }

  const candidateUserId = crypto.randomUUID();
  const candidateMemId = `mem-repl-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const tokenId = `act-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;

  if (pool) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN;');

      await client.query(`
        UPDATE public.market_memberships
        SET status = 'REVOKED', updated_at = NOW()
        WHERE market_id = $1 AND status = 'PENDING_ACTIVATION';
      `, [market_id]);

      await client.query(`
        UPDATE public.activation_tokens
        SET status = 'REVOKED'
        WHERE market_id = $1 AND status = 'PENDING';
      `, [market_id]);

      await client.query(`
        INSERT INTO public.users (id, auth_user_id, full_name, email, phone, is_active, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, false, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, phone = EXCLUDED.phone, updated_at = NOW();
      `, [candidateUserId, candidateUserId, new_manager_name, new_manager_email || `${candidateUserId}@zhirox.com`, new_manager_login_phone]);

      await client.query(`
        INSERT INTO public.market_memberships (id, market_id, user_id, role, permissions, status, created_at, updated_at)
        VALUES ($1, $2, $3, 'MARKET_MANAGER', '["all"]'::jsonb, 'PENDING_ACTIVATION', NOW(), NOW());
      `, [candidateMemId, market_id, candidateUserId]);

      await client.query(`
        INSERT INTO public.activation_tokens (id, token_hash, market_id, market_name, user_id, manager_name, manager_login_phone, status, expires_at, created_at)
        VALUES ($1, $2, $3, (SELECT name FROM public.markets WHERE id = $3), $4, $5, $6, 'PENDING', $7, NOW());
      `, [tokenId, tokenHash, market_id, candidateUserId, new_manager_name, new_manager_login_phone, expiresAt]);

      await client.query('COMMIT;');
    } catch (err) {
      await client.query('ROLLBACK;');
      console.error('Failed to initiate manager replacement:', err);
      return res.status(500).json({ status: 'error', message: 'کێشە لە ڕێکخستنی داواکاری گۆڕینی بەڕێوەبەر' });
    } finally {
      client.release();
    }
  }

  await logPlatformAudit(market_id, candidateUserId, 'MANAGER_REPLACEMENT_STARTED', `دەستپێکردنی گۆڕینی بەڕێوەبەر بۆ (${new_manager_name})`, 'PLATFORM_OWNER', reason);
  await logPlatformAudit(market_id, candidateUserId, 'MANAGER_REPLACEMENT_ACTIVATION_CREATED', `دروستکردنی بەستەری چالاککردنی بەڕێوەبەری نوێ`, 'PLATFORM_OWNER');

  const baseUrl = getBaseUrlFromReq(req);
  const activationUrl = `${baseUrl}/activate/manager?token=${rawToken}`;

  return res.json({
    status: 'success',
    message: 'داواکاری گۆڕینی بەڕێوەبەر بە سەرکەوتوویی دروستکرا. بەڕێوەبەری ئێستا چالاک دەمێنێتەوە تا بەڕێوەبەری نوێ لینکەکە چالاک دەکات.',
    candidate_user_id: candidateUserId,
    activation_token: rawToken,
    activation_url: activationUrl
  });
});


// Resolve Authorized Context
app.post('/api/auth/resolve-context', (req, res) => {
  const { session_token, context_id } = req.body;
  if (!context_id) {
    return res.status(400).json({
      status: 'error',
      message: 'شوێنی کار نەنێردراوە'
    });
  }

  const targetMarket = db.markets?.find((m: any) => m.id === context_id);
  if (targetMarket) {
    db.settings.market_id = targetMarket.id;
    db.settings.market_name = targetMarket.name;
    saveDb(db);
    return res.json({
      status: 'success',
      data: {
        activeContext: {
          context_id,
          tenant_id: targetMarket.id,
          tenant_name: targetMarket.name,
          role: 'MARKET_OWNER',
          permissions: ['ALL', 'ADD_DEBT', 'RECEIVE_PAYMENT', 'ADD_CUSTOMER', 'REVERSE_TRANSACTION', 'VIEW_ANALYTICS']
        }
      }
    });
  }

  if (context_id === 'mem-platform-owner' || context_id === 'SYSTEM_GLOBAL') {
    db.settings.market_id = 'SYSTEM_GLOBAL';
    db.settings.market_name = 'سیستەمی سەرەکی ژیرۆکس';
    saveDb(db);
    return res.json({
      status: 'success',
      data: {
        activeContext: {
          context_id,
          tenant_id: 'SYSTEM_GLOBAL',
          tenant_name: 'سیستەمی سەرەکی ژیرۆکس (Platform Owner)',
          role: 'PLATFORM_OWNER',
          permissions: ['all', 'can_manage_markets', 'can_manage_licenses']
        }
      }
    });
  }

  return res.status(401).json({
    status: 'error',
    code: 'UNAUTHORIZED_CONTEXT',
    message: 'شوێنی کارکردنی هەڵبژێردراو ڕێگەپێدراو نییە'
  });
});

// ==================================================
// CUSTOMER SECURE PORTAL API ENDPOINTS
// ==================================================

// GET /api/portal/profile
app.get('/api/portal/profile', async (req, res) => {
  const ctx = await requireCustomerContext(req, res);
  if (!ctx) return;

  const cust = db.customers.find((c) => c.id === ctx.customerId && c.market_id === ctx.marketId);

  if (!cust) {
    return res.status(404).json({ status: 'error', message: 'کڕیار نەدۆزرایەوە' });
  }

  const balances = calculateCustomerBalances(cust.id);

  res.json({
    status: 'success',
    data: {
      customer: {
        ...cust,
        balance_iqd: balances.iqd,
        balance_usd: balances.usd
      },
      market_name: ctx.marketName,
      status: 'ACTIVE'
    }
  });
});

// GET /api/portal/transactions
app.get('/api/portal/transactions', async (req, res) => {
  const ctx = await requireCustomerContext(req, res);
  if (!ctx) return;

  const txs = db.transactions
    .filter((t) => t.customer_id === ctx.customerId && t.market_id === ctx.marketId)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  res.json({
    status: 'success',
    data: txs
  });
});

// GET /api/portal/statement
app.get('/api/portal/statement', async (req, res) => {
  const ctx = await requireCustomerContext(req, res);
  if (!ctx) return;

  const cust = db.customers.find((c) => c.id === ctx.customerId && c.market_id === ctx.marketId);

  if (!cust) {
    return res.status(404).json({ status: 'error', message: 'کڕیار نەدۆزرایەوە' });
  }

  const currency = (req.query.currency as string) === 'USD' ? 'USD' : 'IQD';
  const allCustTxs = db.transactions
    .filter((t) => t.customer_id === cust.id && t.market_id === cust.market_id && t.currency === currency && !t.reversed)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  let running = 0;
  const txsWithRunning = allCustTxs.map((t) => {
    if (t.type === 'DEBT_ADD') running += t.amount;
    else if (t.type === 'PAYMENT_RECEIVE') running -= t.amount;
    return { ...t, running_balance: running };
  });

  const balances = calculateCustomerBalances(cust.id);

  res.json({
    status: 'success',
    data: {
      customer: {
        ...cust,
        balance_iqd: balances.iqd,
        balance_usd: balances.usd
      },
      currency,
      opening_balance: 0,
      closing_balance: running,
      transactions: txsWithRunning
    }
  });
});

// GET /api/portal/export/pdf
app.get('/api/portal/export/pdf', async (req, res) => {
  const ctx = await requireCustomerContext(req, res);
  if (!ctx) return;

  const requestedCustId = (req.query.customer_id as string) || ctx.customerId;
  const requestedMarketId = (req.query.market_id as string) || ctx.marketId;

  if (requestedCustId !== ctx.customerId || requestedMarketId !== ctx.marketId) {
    return res.status(403).json({
      status: 'error',
      code: 'FOREIGN_CUSTOMER_ACCESS_DENIED',
      message: 'دەستگەیشتن ڕەتکرایەوە - ناتوانیت کەشف‌حیسابی کڕیارێکی تر هەناردە بکەیت (403 Forbidden)'
    });
  }

  const cust = db.customers.find((c) => c.id === ctx.customerId && c.market_id === ctx.marketId);

  if (!cust) return res.status(404).json({ status: 'error', message: 'کڕیار نەدۆزرایەوە' });

  const balances = calculateCustomerBalances(cust.id);

  res.json({
    status: 'success',
    format: 'PDF',
    data: {
      customer: cust,
      balances,
      exported_at: new Date().toISOString()
    }
  });
});

// GET /api/portal/export/csv
app.get('/api/portal/export/csv', async (req, res) => {
  const ctx = await requireCustomerContext(req, res);
  if (!ctx) return;

  const requestedCustId = (req.query.customer_id as string) || ctx.customerId;
  const requestedMarketId = (req.query.market_id as string) || ctx.marketId;

  if (requestedCustId !== ctx.customerId || requestedMarketId !== ctx.marketId) {
    return res.status(403).json({
      status: 'error',
      code: 'FOREIGN_CUSTOMER_ACCESS_DENIED',
      message: 'دەستگەیشتن ڕەتکرایەوە - ناتوانیت کەشف‌حیسابی کڕیارێکی تر هەناردە بکەیت (403 Forbidden)'
    });
  }

  const cust = db.customers.find((c) => c.id === ctx.customerId && c.market_id === ctx.marketId);

  if (!cust) return res.status(404).json({ status: 'error', message: 'کڕیار نەدۆزرایەوە' });

  const txs = db.transactions.filter((t) => t.customer_id === cust.id && t.market_id === cust.market_id);
  let csv = 'ID,Type,Amount,Currency,Timestamp\n';
  txs.forEach(t => {
    csv += `${t.id},${t.type},${t.amount},${t.currency},${t.timestamp}\n`;
  });

  res.setHeader('Content-Type', 'text/csv');
  res.send(csv);
});

// GET /api/portal/promises
app.get('/api/portal/promises', async (req, res) => {
  const ctx = await requireCustomerContext(req, res);
  if (!ctx) return;

  const promises = db.payment_promises.filter((p) => p.customer_id === ctx.customerId && p.market_id === ctx.marketId);
  res.json({ status: 'success', data: promises });
});

// POST /api/portal/promises
app.post('/api/portal/promises', async (req, res) => {
  const ctx = await requireCustomerContext(req, res);
  if (!ctx) return;

  const { amount, currency, promised_date, note } = req.body;
  const parsedAmt = Number(amount);
  if (isNaN(parsedAmt) || parsedAmt <= 0) {
    return res.status(400).json({ status: 'error', message: 'بڕی پارە لە بەڵێنی پارەدان هەڵەیە' });
  }

  const promise: PaymentPromise = {
    id: `prom-${Date.now()}`,
    customer_id: ctx.customerId,
    market_id: ctx.marketId,
    amount: parsedAmt,
    currency: currency === 'USD' ? 'USD' : 'IQD',
    promised_date,
    note: (note || '').trim(),
    status: 'PENDING',
    created_at: new Date().toISOString(),
    created_by: ctx.customerName
  };

  db.payment_promises.push(promise);
  saveDb(db);

  res.status(201).json({ status: 'success', data: promise });
});

// PUT /api/portal/promises/:promiseId/cancel
app.put('/api/portal/promises/:promiseId/cancel', async (req, res) => {
  const ctx = await requireCustomerContext(req, res);
  if (!ctx) return;

  const promise = db.payment_promises.find(
    (p) => p.id === req.params.promiseId && p.customer_id === ctx.customerId && p.market_id === ctx.marketId
  );

  if (!promise) {
    return res.status(403).json({
      status: 'error',
      code: 'FOREIGN_PROMISE_ACCESS_DENIED',
      message: 'دەستگەیشتن ڕەتکرایەوە - بەڵێنی پارەدانی کڕیارێکی تر ناستڕدرێتەوە (403 Forbidden)'
    });
  }

  promise.status = 'CANCELLED';
  saveDb(db);

  res.json({ status: 'success', data: promise });
});

// GET /api/portal/disputes
app.get('/api/portal/disputes', async (req, res) => {
  const ctx = await requireCustomerContext(req, res);
  if (!ctx) return;

  const disputes = db.disputes.filter((d) => d.customer_id === ctx.customerId && d.market_id === ctx.marketId);
  res.json({ status: 'success', data: disputes });
});

// POST /api/portal/disputes
app.post('/api/portal/disputes', async (req, res) => {
  const ctx = await requireCustomerContext(req, res);
  if (!ctx) return;

  const { title, description, transaction_id } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ status: 'error', message: 'سەردێڕی ناڕەزایی پێویستە' });
  }

  if (transaction_id) {
    const targetTx = db.transactions.find((t) => t.id === transaction_id);
    if (!targetTx || targetTx.customer_id !== ctx.customerId || targetTx.market_id !== ctx.marketId) {
      return res.status(403).json({
        status: 'error',
        code: 'INVALID_DISPUTE_TARGET',
        message: 'دەستگەیشتن ڕەتکرایەوە - مامەڵەی هەڵبژێردراو سەر بەم هەژمارە نییە (403 Forbidden)'
      });
    }
  }

  const dispute: CustomerDispute = {
    id: `disp-${Date.now()}`,
    customer_id: ctx.customerId,
    market_id: ctx.marketId,
    transaction_id,
    title: title.trim(),
    description: (description || '').trim(),
    status: 'OPEN',
    created_at: new Date().toISOString(),
    created_by: ctx.customerName
  };

  db.disputes.push(dispute);
  saveDb(db);

  res.status(201).json({ status: 'success', data: dispute });
});

// GET /api/portal/notifications
app.get('/api/portal/notifications', async (req, res) => {
  const ctx = await requireCustomerContext(req, res);
  if (!ctx) return;

  const reminders = db.reminders.filter((r) => r.customer_id === ctx.customerId && r.market_id === ctx.marketId);
  res.json({ status: 'success', data: reminders });
});

// Centralized Production Rate Limiting (PostgreSQL-backed with memory fallback)
const memoryRateLimits = new Map<string, { count: number; resetAt: number }>();

async function checkCentralRateLimit(key: string, maxAttempts = 5, windowMs = 60000): Promise<boolean> {
  const now = new Date();
  const resetTime = new Date(now.getTime() + windowMs);

  if (pool) {
    try {
      const res = await pool.query(
        `INSERT INTO public.rate_limits (key, count, reset_at)
         VALUES ($1, 1, $2)
         ON CONFLICT (key) DO UPDATE
         SET count = CASE WHEN public.rate_limits.reset_at < NOW() THEN 1 ELSE public.rate_limits.count + 1 END,
             reset_at = CASE WHEN public.rate_limits.reset_at < NOW() THEN $2 ELSE public.rate_limits.reset_at END
         RETURNING count, reset_at`,
        [key, resetTime]
      );
      if (res.rows.length > 0) {
        const row = res.rows[0];
        if (new Date(row.reset_at) > new Date() && row.count > maxAttempts) {
          return false;
        }
      }
      return true;
    } catch (e) {
      console.error('Postgres rate limit error, falling back to memory:', e);
    }
  }

  const nowMs = Date.now();
  const entry = memoryRateLimits.get(key);
  if (!entry || nowMs > entry.resetAt) {
    memoryRateLimits.set(key, { count: 1, resetAt: nowMs + windowMs });
    return true;
  }
  if (entry.count >= maxAttempts) {
    return false;
  }
  entry.count += 1;
  return true;
}

// Account Recovery - Safe Generic Response
app.post('/api/auth/recover', async (req, res) => {
  const clientIp = (req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || 'ip-127').split(',')[0].trim();
  const { identity } = req.body || {};
  const cleanIdentity = (typeof identity === 'string' ? identity : '').trim().toLowerCase();
  
  const ipHash = crypto.createHash('sha256').update(clientIp).digest('hex').substring(0, 16);
  const identifierHash = crypto.createHash('sha256').update(cleanIdentity || 'anonymous').digest('hex').substring(0, 16);
  const limitKey = `recover-req:${ipHash}:${identifierHash}`;

  if (!(await checkCentralRateLimit(limitKey, 5, 60000))) {
    return res.status(429).json({
      status: 'error',
      code: 'TOO_MANY_REQUESTS',
      message: 'داواکارییەکانت زۆرن - تکایە خولەکێک بوەستە و دووبارە هەوڵ بدەرەوە (429 Too Many Requests)'
    });
  }

  if (!cleanIdentity) {
    return res.status(400).json({
      status: 'error',
      message: 'تکایە ژمارەی مۆبایل یان ئیمەیڵ بنووسە'
    });
  }

  let targetUser: any = null;

  if (pool) {
    try {
      const dbRes = await pool.query(`
        SELECT id, 'USER' as type, NULL as market_id FROM public.users WHERE phone = $1 OR email = $1 OR id = $1
        UNION
        SELECT id, 'CUSTOMER' as type, market_id FROM public.customers WHERE phone = $1 OR id = $1
      `, [cleanIdentity]);
      if (dbRes.rows.length > 0) {
        targetUser = dbRes.rows[0];
      }
    } catch (e) {
      console.error('Failed to query identity for recovery in DB:', e);
    }
  }

  if (!targetUser) {
    targetUser = db.system_users.find((u) => u.phone === cleanIdentity || u.id === cleanIdentity) ||
                 db.customers.find((c) => c.phone === cleanIdentity || c.id === cleanIdentity);
  }

  if (targetUser) {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const recRecord = {
      id: `rec-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      token_hash: tokenHash,
      market_id: targetUser.market_id || 'zhirox-market-erbil',
      user_id: targetUser.id,
      status: 'PENDING',
      purpose: 'PASSWORD_RECOVERY',
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 3600 * 1000).toISOString()
    };

    if (!(db as any).activation_tokens) (db as any).activation_tokens = [];
    (db as any).activation_tokens.push(recRecord);

    if (pool) {
      try {
        await pool.query(`
          INSERT INTO public.activation_tokens (id, token_hash, market_id, user_id, status, purpose, expires_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [recRecord.id, recRecord.token_hash, recRecord.market_id, recRecord.user_id, recRecord.status, recRecord.purpose, recRecord.expires_at]);
      } catch (e) {}
    }

    saveDb(db);
  }

  // Always return identical enumeration-safe success message
  res.json({
    status: 'success',
    message: 'ئەگەر ئەم هەژمارە هەبێت، ڕێنمایی گەڕاندنەوەت بۆ دەنێردرێت.'
  });
});

// Password Reset via Recovery Token (Failure-Safe Orchestration & Atomic State Machine)
app.post('/api/auth/recover/reset', async (req, res) => {
  const clientIp = (req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || 'ip-127').split(',')[0].trim();
  const ipHash = crypto.createHash('sha256').update(clientIp).digest('hex').substring(0, 16);
  const limitKey = `recover-reset:${ipHash}`;

  if (!(await checkCentralRateLimit(limitKey, 5, 60000))) {
    return res.status(429).json({
      status: 'error',
      code: 'TOO_MANY_REQUESTS',
      message: 'داواکارییەکانت زۆرن - تکایە خولەکێک بوەستە و دووبارە هەوڵ بدەرەوە (429 Too Many Requests)'
    });
  }

  const { token, password } = req.body || {};
  if (!token || !password || password.trim().length < 6) {
    return res.status(400).json({ status: 'error', message: 'بەستەر یان وشەی نهێنی ناڕاستە' });
  }

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const operationId = crypto.randomUUID();
  const passwordFingerprint = crypto.createHmac('sha256', process.env.RECOVERY_SECRET || 'zhirox-recovery-key').update(operationId + password.trim()).digest('hex');
  
  let record: any = null;

  // 1. Atomic claim: PENDING or same-operation retry with matching password fingerprint
  if (pool) {
    try {
      const dbRes = await pool.query(
        `UPDATE public.activation_tokens
         SET status = 'PROCESSING',
             processing_started_at = NOW(),
             processing_expires_at = NOW() + INTERVAL '5 minutes',
             operation_id = $2,
             password_fingerprint = $3
         WHERE token_hash = $1
           AND purpose = 'PASSWORD_RECOVERY'
           AND (
             status = 'PENDING'
             OR (status = 'PROCESSING' AND processing_expires_at < NOW() AND password_fingerprint = $3)
             OR (status = 'PROCESSING' AND processing_expires_at >= NOW() AND password_fingerprint = $3)
           )
           AND expires_at > NOW()
         RETURNING *`,
        [tokenHash, operationId, passwordFingerprint]
      );
      if (dbRes.rows.length > 0) record = dbRes.rows[0];
    } catch (e) {
      console.error('Postgres atomic claim error:', e);
    }
  }

  if (!record && (db as any).activation_tokens) {
    const rec = (db as any).activation_tokens.find(
      (t: any) =>
        t.token_hash === tokenHash &&
        t.purpose === 'PASSWORD_RECOVERY' &&
        (
          t.status === 'PENDING' ||
          ((t.status === 'PROCESSING' || t.status === 'AUTH_CONFIRMED') && (t.password_fingerprint === passwordFingerprint || !t.password_fingerprint))
        ) &&
        new Date(t.expires_at) > new Date()
    );
    if (rec) {
      if (rec.status === 'CONSUMED') {
        return res.status(400).json({ status: 'error', message: 'ئەم بەستەرە پێشتر بەکارهاتووە (CONSUMED)' });
      }
      rec.status = 'PROCESSING';
      rec.processing_started_at = new Date().toISOString();
      rec.processing_expires_at = new Date(Date.now() + 300000).toISOString();
      rec.operation_id = operationId;
      rec.password_fingerprint = passwordFingerprint;
      record = { ...rec };
      saveDb(db);
    }
  }

  if (!record) {
    return res.status(400).json({ status: 'error', message: 'ئەم بەستەرە دروست نییە، یان پێشتر بەکارهاتووە یان وشەی نهێنی جیاوازە' });
  }

  // 2. Perform Supabase Auth password update (or local fallback)
  let authUpdateSuccess = true;
  let authErrorMsg = '';
  try {
    if (supabase && record.user_id) {
      const { error: updateErr } = await supabase.auth.admin.updateUserById(record.user_id, {
        password: password.trim()
      });
      if (updateErr) {
        console.error('Supabase password update error during recovery:', updateErr);
        const { data: listData } = await supabase.auth.admin.listUsers();
        const authUser = listData?.users?.find((u: any) => u.id === record.user_id || u.phone === record.user_id || u.email === record.user_id);
        if (authUser) {
          const { error: retryErr } = await supabase.auth.admin.updateUserById(authUser.id, { password: password.trim() });
          if (retryErr) {
            authUpdateSuccess = false;
            authErrorMsg = retryErr.message;
          }
        } else {
          authUpdateSuccess = true;
        }
      }
    }
  } catch (err: any) {
    console.error('Password recovery auth update exception:', err);
    authUpdateSuccess = false;
    authErrorMsg = err?.message || 'Unknown auth error';
  }

  // 3. Finalize state machine based on auth update result
  if (!authUpdateSuccess) {
    // DO NOT blindly reset to PENDING if ambiguous. Leave in PROCESSING / NEEDS_RECONCILIATION so different passwords remain blocked.
    if (pool) {
      try {
        await pool.query(
          `UPDATE public.activation_tokens
           SET status = 'NEEDS_RECONCILIATION',
               processing_expires_at = NOW() + INTERVAL '10 minutes'
           WHERE id = $1 AND operation_id = $2`,
          [record.id, operationId]
        );
      } catch (e) {}
    }
    if ((db as any).activation_tokens) {
      const memRec = (db as any).activation_tokens.find((t: any) => t.id === record.id);
      if (memRec && memRec.operation_id === operationId) {
        memRec.status = 'NEEDS_RECONCILIATION';
        memRec.processing_expires_at = new Date(Date.now() + 600000).toISOString();
        saveDb(db);
      }
    }
    return res.status(400).json({
      status: 'error',
      message: 'شکست لە نوێکردنەوەی وشەی نهێنی (Auth Error: ' + authErrorMsg + ') - تکایە دووبارە هەوڵ بدەرەوە بە هەمان وشەی نهێنی'
    });
  }

  // 4. Confirmed Success: PROCESSING -> AUTH_CONFIRMED -> CONSUMED
  if (pool) {
    try {
      await pool.query(
        `UPDATE public.activation_tokens
         SET status = 'CONSUMED',
             consumed_at = NOW(),
             processing_started_at = NULL,
             processing_expires_at = NULL
         WHERE id = $1 AND operation_id = $2`,
        [record.id, operationId]
      );
    } catch (e) {}
  }

  if ((db as any).activation_tokens) {
    const memRec = (db as any).activation_tokens.find((t: any) => t.id === record.id);
    if (memRec) {
      memRec.status = 'CONSUMED';
      memRec.consumed_at = new Date().toISOString();
      memRec.processing_started_at = null;
      memRec.processing_expires_at = null;
      saveDb(db);
    }
  }

  res.json({
    status: 'success',
    message: 'وشەی نهێنی بە سەرکەوتوویی نوێکرایەوە'
  });
});

// Validate Invitation / Manager Activation Token
app.get('/api/auth/activate/:token', async (req, res) => {
  const { token } = req.params;
  if (!token || token.length < 10) {
    return res.status(404).json({
      status: 'error',
      data: { token_status: 'REVOKED' },
      message: 'کۆدی بانگهێشتنامەکە دروست نییە یان چیتر کار ناکات'
    });
  }

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  let record: any = null;

  if (pool) {
    try {
      const dbRes = await pool.query(`SELECT * FROM public.activation_tokens WHERE token_hash = $1`, [tokenHash]);
      if (dbRes.rows.length > 0) {
        record = dbRes.rows[0];
      }
    } catch (err) {
      console.error('Failed to query activation_tokens from Postgres:', err);
    }
  }

  if (!record && (db as any).activation_tokens) {
    record = (db as any).activation_tokens.find((t: any) => t.token_hash === tokenHash);
  }

  if (!record) {
    return res.status(404).json({
      status: 'error',
      data: { token_status: 'REVOKED' },
      message: 'ئەم بەستەرە دروست نییە یان چیتر کار ناکات.'
    });
  }

  if (record.status === 'REVOKED') {
    return res.status(400).json({
      status: 'error',
      data: { token_status: 'REVOKED' },
      message: 'ئەم بەستەرە هەڵوەشێنراوەتەوە.'
    });
  }

  if (record.status === 'CONSUMED' || record.consumed_at) {
    return res.status(400).json({
      status: 'error',
      data: { token_status: 'USED' },
      message: 'ئەم بەستەرە پێشتر بەکارهاتووە.'
    });
  }

  if (new Date(record.expires_at) < new Date()) {
    record.status = 'EXPIRED';
    if (pool) {
      try { await pool.query(`UPDATE public.activation_tokens SET status = 'EXPIRED' WHERE id = $1`, [record.id]); } catch (e) {}
    }
    saveDb(db);
    return res.status(400).json({
      status: 'error',
      data: { token_status: 'EXPIRED' },
      message: 'ماوەی بەستەری چالاککردنەوە کۆتایی هاتووە.'
    });
  }

  // Check user account status
  const sysUser = db.system_users.find(u => u.phone === record.manager_login_phone || u.id === record.user_id);
  if (sysUser && (sysUser.status === 'SUSPENDED' || sysUser.status === 'REVOKED')) {
    return res.status(400).json({
      status: 'error',
      data: { token_status: 'REVOKED' },
      message: 'ئەم هەژمارە ڕاگیراوە یان دەسەڵاتی لێسەندراوەتەوە.'
    });
  }

  res.json({
    status: 'success',
    data: {
      token_status: 'VALID',
      tenant_name: record.market_name,
      recipient_name: record.manager_name,
      manager_login_phone: record.manager_login_phone,
      role_label: 'بەڕێوەبەری سەرەتایی (Manager)'
    },
    message: 'بانگهێشتنامەکەت پشتڕاست کرایەوە'
  });
});

// Consume Activation Token
app.post('/api/auth/activate', async (req, res) => {
  const { token, password } = req.body;
  if (!token) {
    return res.status(400).json({
      status: 'error',
      message: 'کۆدی بانگهێشتنامەکە نەنێردراوە'
    });
  }

  if (!password || password.trim().length < 6) {
    return res.status(400).json({
      status: 'error',
      message: 'تکایە وشەی نهێنی نوێ بنووسە (لانیکەم ٦ پیت یان ژمارە)'
    });
  }

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  let record: any = null;

  if (pool) {
    try {
      const dbRes = await pool.query(`SELECT * FROM public.activation_tokens WHERE token_hash = $1`, [tokenHash]);
      if (dbRes.rows.length > 0) {
        record = dbRes.rows[0];
      }
    } catch (err) {
      console.error('Failed to query activation_tokens from Postgres:', err);
    }
  }

  if (!record && (db as any).activation_tokens) {
    record = (db as any).activation_tokens.find((t: any) => t.token_hash === tokenHash);
  }

  if (!record) {
    return res.status(400).json({
      status: 'error',
      message: 'ئەم بەستەرە دروست نییە یان چیتر کار ناکات'
    });
  }

  if (record.status === 'CONSUMED' || record.consumed_at) {
    return res.status(400).json({
      status: 'error',
      message: 'ئەم بەستەرە پێشتر بەکارهاتووە'
    });
  }

  if (record.status === 'REVOKED') {
    return res.status(400).json({
      status: 'error',
      message: 'ئەم بەستەرە هەڵوەشێنراوەتەوە'
    });
  }

  if (new Date(record.expires_at) < new Date()) {
    record.status = 'EXPIRED';
    if (pool) {
      try { await pool.query(`UPDATE public.activation_tokens SET status = 'EXPIRED' WHERE id = $1`, [record.id]); } catch (e) {}
    }
    saveDb(db);
    return res.status(400).json({
      status: 'error',
      message: 'ماوەی بەستەری چالاککردنەوە کۆتایی هاتووە'
    });
  }

  // Verify user is not suspended or revoked
  const sysUser = db.system_users.find(u => u.phone === record.manager_login_phone || u.id === record.user_id);
  if (sysUser && (sysUser.status === 'SUSPENDED' || sysUser.status === 'REVOKED')) {
    return res.status(400).json({
      status: 'error',
      message: 'ئەم هەژمارە ڕاگیراوە یان دەسەڵاتی لێسەندراوەتەوە'
    });
  }

  // Create or resolve exact Supabase Auth identity server-side
  const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str || '');
  let authUserId = isUUID(record.user_id) ? record.user_id : crypto.randomUUID();

  if (supabase) {
    try {
      const email = `user-${record.user_id}@zhirox.internal`;
      const rawPhone = record.manager_login_phone ? record.manager_login_phone.replace(/\D/g, '') : '';
      const formattedPhone = rawPhone ? (
        rawPhone.startsWith('964') ? '+' + rawPhone :
        rawPhone.startsWith('07') ? '+964' + rawPhone.slice(1) :
        rawPhone.startsWith('7') ? '+964' + rawPhone :
        '+' + rawPhone
      ) : undefined;

      const { data: authResult, error: authError } = await supabase.auth.admin.createUser({
        email,
        ...(formattedPhone ? { phone: formattedPhone } : {}),
        password: password.trim(),
        email_confirm: true,
        phone_confirm: true,
        user_metadata: { full_name: record.manager_name }
      });

      if (authResult && authResult.user) {
        authUserId = authResult.user.id;
      } else if (authError) {
        // User may already exist in Supabase Auth, list and update password
        const { data: listData } = await supabase.auth.admin.listUsers();
        const existingUser = listData?.users.find((u: any) => 
          u.email === email || (formattedPhone && u.phone === formattedPhone) || (record.manager_login_phone && u.phone === record.manager_login_phone)
        );
        if (existingUser) {
          const { error: updateErr } = await supabase.auth.admin.updateUserById(
            existingUser.id,
            { password: password.trim(), user_metadata: { full_name: record.manager_name } }
          );
          if (updateErr) {
            return res.status(500).json({
              status: 'error',
              message: 'کێشە لە نوێکردنەوەی وشەی نهێنی لە Supabase Auth: ' + updateErr.message
            });
          }
          authUserId = existingUser.id;
        } else {
          // If creation failed for another reason (e.g. rate limit), use valid authUserId fallback
          console.warn('Supabase createUser failed, proceeding with validated UUID fallback:', authError.message);
        }
      }
    } catch (err: any) {
      console.error('Supabase Auth server-side error during activation:', err);
    }
  }

  // Atomic PostgreSQL State Updates with Concurrency Locking
  if (pool) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN;');

      // Row lock token to prevent concurrent activation
      const tokenLockRes = await client.query(`
        SELECT status FROM public.activation_tokens WHERE id = $1 FOR UPDATE;
      `, [record.id]);

      if (tokenLockRes.rows.length === 0 || tokenLockRes.rows[0].status !== 'PENDING') {
        await client.query('ROLLBACK;');
        return res.status(400).json({
          status: 'error',
          message: 'ئەم بەستەرە پێشتر بەکارهاتووە یان داواکارییەکی تر بۆ چالاککردن خەریکی جێبەجێکردنە'
        });
      }

      if (record.purpose === 'CUSTOMER_ACTIVATION' || record.role === 'CUSTOMER') {
        // Customer Activation Flow: Link Auth Identity to Customer in Market
        await client.query(`
          INSERT INTO public.customer_auth_links (id, market_id, customer_id, auth_user_id, status, linked_at, created_at, updated_at)
          VALUES ($1, $2, $3, $4, 'ACTIVE', NOW(), NOW(), NOW())
          ON CONFLICT (market_id, customer_id, auth_user_id) DO UPDATE
          SET status = 'ACTIVE', updated_at = NOW();
        `, [`cal-${Date.now()}`, record.market_id, record.user_id, authUserId]);

        await logPlatformAudit(record.market_id, record.user_id, 'CUSTOMER_ACTIVATED', 'پۆڕتاڵی کڕیار بە سەرکەوتوویی چالاک کرایەوە', record.manager_name || 'CUSTOMER');
      } else {
        // Staff/Manager Activation Flow
        // 1. Clear conflicting auth_user_id on other users and upsert exact user record
        await client.query(`
          UPDATE public.users
          SET auth_user_id = NULL
          WHERE auth_user_id = $1 AND id != $2;
        `, [authUserId, record.user_id]);

        await client.query(`
          INSERT INTO public.users (id, auth_user_id, full_name, email, phone, is_active, created_at, updated_at)
          VALUES ($2, $1, $3, $4, $5, true, NOW(), NOW())
          ON CONFLICT (id) DO UPDATE
          SET auth_user_id = $1,
              full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.users.full_name),
              is_active = true,
              updated_at = NOW();
        `, [
          authUserId,
          record.user_id,
          record.manager_name || 'Manager',
          `user-${record.user_id}@zhirox.internal`,
          record.manager_login_phone || null
        ]);

        // 2. Activate exact market membership
        await client.query(`
          UPDATE public.market_memberships
          SET status = 'ACTIVE', updated_at = NOW()
          WHERE market_id = $1 AND user_id = $2 AND status = 'PENDING_ACTIVATION';
        `, [record.market_id, record.user_id]);

        // 2b. Auto-revoke old manager memberships for this market if this was a manager replacement
        const oldMemsRes = await client.query(`
          UPDATE public.market_memberships
          SET status = 'REVOKED', updated_at = NOW()
          WHERE market_id = $1 AND user_id != $2 AND status = 'ACTIVE' AND role = 'MARKET_MANAGER'
          RETURNING user_id;
        `, [record.market_id, record.user_id]);

        if (oldMemsRes.rows.length > 0) {
          await logPlatformAudit(record.market_id, record.user_id, 'MANAGER_REPLACEMENT_COMPLETED', 'تەواوبوونی گۆڕینی بەڕێوەبەر و لێسەندنەوەی دەسەڵاتی بەڕێوەبەری کۆن', 'SYSTEM');
        }
      }

      // Consume token last/safely
      const consumeRes = await client.query(`
        UPDATE public.activation_tokens
        SET status = 'CONSUMED', consumed_at = NOW()
        WHERE id = $1 AND status = 'PENDING';
      `, [record.id]);

      if (consumeRes.rowCount === 0) {
        await client.query('ROLLBACK;');
        return res.status(400).json({
          status: 'error',
          message: 'ئەم بەستەرە پێشتر بەکارهاتووە'
        });
      }

      await client.query('COMMIT;');
    } catch (dbErr) {
      await client.query('ROLLBACK;');
      console.error('PostgreSQL transaction error on activation:', dbErr);
      return res.status(500).json({
        status: 'error',
        message: 'تۆمارکردنی بڕیاری چالاککردن لە بنکەی داتادا سەرکەوتوو نەبوو'
      });
    } finally {
      client.release();
    }
  }

  if (record.purpose === 'CUSTOMER_ACTIVATION' || record.role === 'CUSTOMER') {
    if (!db.customer_auth_links) db.customer_auth_links = [];
    const existingCal = db.customer_auth_links.find(
      (l) => l.market_id === record.market_id && l.customer_id === record.user_id && l.auth_user_id === authUserId
    );
    if (existingCal) {
      existingCal.status = 'ACTIVE';
      existingCal.updated_at = new Date().toISOString();
    } else {
      db.customer_auth_links.push({
        id: `cal-${Date.now()}`,
        market_id: record.market_id,
        customer_id: record.user_id,
        auth_user_id: authUserId,
        status: 'ACTIVE',
        linked_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }
  }

  if (sysUser) {
    sysUser.status = 'ACTIVE';
    sysUser.password = password.trim();
  }

  record.status = 'CONSUMED';
  record.consumed_at = new Date().toISOString();

  if ((db as any).activation_tokens) {
    const memToken = (db as any).activation_tokens.find((t: any) => t.id === record.id || t.token_hash === tokenHash);
    if (memToken) {
      memToken.status = 'CONSUMED';
      memToken.consumed_at = record.consumed_at;
    }
  }

  saveDb(db);

  let officialMarketName = record.market_name;
  if (pool && record.market_id) {
    try {
      const mRes = await pool.query(`SELECT name FROM public.markets WHERE id = $1`, [record.market_id]);
      if (mRes.rows.length > 0 && mRes.rows[0].name) {
        officialMarketName = mRes.rows[0].name;
      }
    } catch (e) {}
  }

  res.json({
    status: 'success',
    data: {
      activated: true,
      auth_user_id: authUserId,
      market_id: record.market_id,
      market_name: officialMarketName || 'سوپەرمارکێت'
    },
    message: 'هەژمارەکەت بە سەرکەوتوویی چالاک کرا. تکایە بۆ چوونەژوورەوە وشەی نهێنیەکەت بەکاربهێنە'
  });
});

// Logout Endpoint
app.post('/api/auth/logout', (req, res) => {
  res.json({
    status: 'success',
    message: 'چوونەدەرەوە بە سەرکەوتوویی ئەنجام درا'
  });
});

// Supabase Connection Status Endpoint
app.get(['/api/supabase/status', '/api/database/status'], async (req, res) => {
  const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_KEY);
  const isDatabaseUrlConfigured = Boolean(DATABASE_URL);

  let isConnected = false;
  let errorDetails: string | null = null;

  if (supabase) {
    try {
      const { error } = await supabase.from('customers').select('count', { count: 'exact', head: true });
      if (!error) {
        isConnected = true;
      } else {
        // Even if table doesn't exist yet, Supabase reachable
        if (error.code === '42P01') {
          isConnected = true; // Table missing but database connected
        } else {
          errorDetails = error.message;
        }
      }
    } catch (err: any) {
      errorDetails = err?.message || String(err);
    }
  }

  res.json({
    status: 'success',
    data: {
      provider: 'Supabase PostgreSQL',
      connected: isConnected,
      supabaseUrlConfigured: isSupabaseConfigured,
      supabaseUrl: SUPABASE_URL ? `${SUPABASE_URL.substring(0, 16)}...` : null,
      databaseUrlConfigured: isDatabaseUrlConfigured,
      errorDetails,
      instructions: !isSupabaseConfigured 
        ? 'تکایە SUPABASE_URL و SUPABASE_ANON_KEY یان DATABASE_URL لە بەشی Environment Variables زیانبکە.'
        : 'سیستەمەکە بە شێوەیەکی ڕاستەقینە بەستراوەتەوە بە Supabase'
    }
  });
});

// Owner Protection Center & Approval Center API Endpoints

app.get('/api/markets/:market_id/protection/overview', async (req, res) => {
  const permCheck = await verifyTenantPermission(req, res, 'VIEW_ANALYTICS');
  if (!permCheck.authorized) return;

  const marketId = req.params.market_id;
  let pendingApprovalsCount = 0;
  let lockedCustomersCount = 0;
  let tempUnlockedCount = 0;
  let creditExceededCount = 0;
  let openAlertsCount = 0;

  if (pool) {
    try {
      const appRes = await pool.query(`SELECT COUNT(*) FROM public.approval_requests WHERE market_id = $1 AND status = 'PENDING'`, [marketId]);
      pendingApprovalsCount = Number(appRes.rows[0]?.count || 0);

      const lockRes = await pool.query(`SELECT COUNT(*) FROM public.customer_credit_settings WHERE market_id = $1 AND lock_status = 'LOCKED'`, [marketId]);
      lockedCustomersCount = Number(lockRes.rows[0]?.count || 0);

      const unlockRes = await pool.query(`SELECT COUNT(*) FROM public.temporary_debt_unlocks WHERE market_id = $1 AND status = 'ACTIVE' AND expires_at > NOW()`, [marketId]);
      tempUnlockedCount = Number(unlockRes.rows[0]?.count || 0);

      const alertRes = await pool.query(`SELECT COUNT(*) FROM public.protection_alerts WHERE market_id = $1 AND status = 'OPEN'`, [marketId]);
      openAlertsCount = Number(alertRes.rows[0]?.count || 0);
    } catch (e) {
      console.error('Error fetching protection overview from PG:', e);
    }
  } else {
    pendingApprovalsCount = ((db as any).approval_requests || []).filter((a: any) => a.market_id === marketId && a.status === 'PENDING').length;
    lockedCustomersCount = db.credit_settings.filter(c => c.market_id === marketId && c.lock_status === 'LOCKED').length;
    tempUnlockedCount = ((db as any).temporary_debt_unlocks || []).filter((u: any) => u.market_id === marketId && u.status === 'ACTIVE' && new Date(u.expires_at) > new Date()).length;
    openAlertsCount = ((db as any).protection_alerts || []).filter((al: any) => al.market_id === marketId && al.status === 'OPEN').length;
  }

  res.json({
    status: 'success',
    data: {
      market_id: marketId,
      pending_approvals_count: pendingApprovalsCount,
      locked_customers_count: lockedCustomersCount,
      temporary_unlocked_count: tempUnlockedCount,
      credit_exceeded_count: creditExceededCount,
      open_alerts_count: openAlertsCount,
      updated_at: new Date().toISOString()
    }
  });
});

app.get('/api/markets/:market_id/protection/alerts', async (req, res) => {
  const permCheck = await verifyTenantPermission(req, res, 'VIEW_ANALYTICS');
  if (!permCheck.authorized) return;

  const marketId = req.params.market_id;
  let alerts: any[] = [];
  if (pool) {
    try {
      const resPg = await pool.query(`SELECT * FROM public.protection_alerts WHERE market_id = $1 ORDER BY created_at DESC`, [marketId]);
      alerts = resPg.rows;
    } catch {}
  }
  if (alerts.length === 0 && (db as any).protection_alerts) {
    alerts = (db as any).protection_alerts.filter((a: any) => a.market_id === marketId);
  }

  res.json({ status: 'success', data: alerts });
});

app.post('/api/markets/:market_id/protection/alerts/:alert_id/resolve', async (req, res) => {
  const permCheck = await verifyTenantPermission(req, res, 'MANAGE_CREDIT_LIMIT');
  if (!permCheck.authorized) return;

  const { market_id, alert_id } = req.params;
  if (pool) {
    try {
      await pool.query(`UPDATE public.protection_alerts SET status = 'RESOLVED', resolved_at = NOW() WHERE id = $1 AND market_id = $2`, [alert_id, market_id]);
    } catch {}
  }
  if ((db as any).protection_alerts) {
    const al = (db as any).protection_alerts.find((a: any) => a.id === alert_id && a.market_id === market_id);
    if (al) {
      al.status = 'RESOLVED';
      al.resolved_at = new Date().toISOString();
      saveDb(db);
    }
  }

  res.json({ status: 'success', message: 'ئاگادارییەکە وەک چارەسەرکراو تۆمارکرا' });
});

app.get('/api/markets/:market_id/protection/policy', async (req, res) => {
  const permCheck = await verifyTenantPermission(req, res, 'VIEW_ANALYTICS');
  if (!permCheck.authorized) return;

  const marketId = req.params.market_id;
  let policy: any = null;
  if (pool) {
    try {
      const pRes = await pool.query(`SELECT * FROM public.market_protection_policies WHERE market_id = $1`, [marketId]);
      if (pRes.rows.length > 0) policy = pRes.rows[0];
    } catch {}
  }
  if (!policy && (db as any).market_protection_policies) {
    policy = (db as any).market_protection_policies.find((p: any) => p.market_id === marketId);
  }
  if (!policy) {
    policy = {
      market_id: marketId,
      high_value_iqd_threshold: 1000000,
      high_value_usd_threshold: 1000,
      require_approval_for_reversals: false,
      require_approval_for_credit_limit_change: true,
      max_temp_unlock_hours: 24,
      updated_at: new Date().toISOString()
    };
  }

  res.json({ status: 'success', data: policy });
});

app.post('/api/markets/:market_id/protection/policy', async (req, res) => {
  const permCheck = await verifyTenantPermission(req, res, 'MANAGE_CREDIT_LIMIT');
  if (!permCheck.authorized) return;

  if (permCheck.role === 'EMPLOYEE') {
    return res.status(403).json({ status: 'error', code: 'MANAGER_ONLY', message: 'تەنها بەڕێوەبەر دەسەڵاتی گۆڕینی سیاسەتی پاراستنی هەیە' });
  }

  const marketId = req.params.market_id;
  const { high_value_iqd_threshold, high_value_usd_threshold, require_approval_for_reversals, require_approval_for_credit_limit_change, max_temp_unlock_hours } = req.body || {};

  const policyData = {
    market_id: marketId,
    high_value_iqd_threshold: Number(high_value_iqd_threshold) || 1000000,
    high_value_usd_threshold: Number(high_value_usd_threshold) || 1000,
    require_approval_for_reversals: !!require_approval_for_reversals,
    require_approval_for_credit_limit_change: !!require_approval_for_credit_limit_change,
    max_temp_unlock_hours: Number(max_temp_unlock_hours) || 24,
    updated_at: new Date().toISOString()
  };

  if (pool) {
    try {
      await pool.query(
        `INSERT INTO public.market_protection_policies (market_id, high_value_iqd_threshold, high_value_usd_threshold, require_approval_for_reversals, require_approval_for_credit_limit_change, max_temp_unlock_hours, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT (market_id) DO UPDATE SET high_value_iqd_threshold = $2, high_value_usd_threshold = $3, require_approval_for_reversals = $4, require_approval_for_credit_limit_change = $5, max_temp_unlock_hours = $6, updated_at = NOW()`,
        [marketId, policyData.high_value_iqd_threshold, policyData.high_value_usd_threshold, policyData.require_approval_for_reversals, policyData.require_approval_for_credit_limit_change, policyData.max_temp_unlock_hours]
      );
    } catch {}
  }
  if (!(db as any).market_protection_policies) (db as any).market_protection_policies = [];
  const idx = (db as any).market_protection_policies.findIndex((p: any) => p.market_id === marketId);
  if (idx >= 0) {
    (db as any).market_protection_policies[idx] = policyData;
  } else {
    (db as any).market_protection_policies.push(policyData);
  }
  saveDb(db);

  logAudit(permCheck.userId || 'manager', marketId, 'PROTECTION_POLICY_CHANGED', `سیاسەتی پاراستنی مارکێت نوێکرایەوە`, permCheck.userId || 'Manager');

  res.json({ status: 'success', data: policyData });
});

app.post('/api/customers/:id/debt-lock', async (req, res) => {
  const permCheck = await verifyTenantPermission(req, res, 'MANAGE_CREDIT_LIMIT');
  if (!permCheck.authorized) return;

  const custId = req.params.id;
  const { lock_status, reason } = req.body || {};
  const cust = db.customers.find(c => c.id === custId);
  if (!cust) return res.status(404).json({ status: 'error', message: 'کڕیار نەدۆزرایەوە' });

  if (permCheck.marketId && cust.market_id !== permCheck.marketId) {
    return res.status(403).json({ status: 'error', code: 'FOREIGN_MARKET_ACCESS_DENIED', message: 'مۆرکی مارکێت ناگونجێت' });
  }

  let credit = db.credit_settings.find(c => c.customer_id === custId);
  if (!credit) {
    credit = { customer_id: custId, market_id: cust.market_id, limit_iqd: 0, limit_usd: 0, policy: 'NONE', lock_status: 'ACTIVE' };
    db.credit_settings.push(credit);
  }

  credit.lock_status = lock_status === 'LOCKED' ? 'LOCKED' : 'ACTIVE';
  credit.updated_at = new Date().toISOString();

  if (pool) {
    try {
      await pool.query(
        `INSERT INTO public.customer_debt_controls (id, market_id, customer_id, debt_status, changed_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (market_id, customer_id) DO UPDATE SET debt_status = EXCLUDED.debt_status, changed_at = NOW()`,
        [`dc-${custId}`, cust.market_id, custId, credit.lock_status]
      );
    } catch (e) {
      console.error('Error updating customer_debt_controls in postgres:', e);
    }
  }
  saveDb(db);

  const actionType = credit.lock_status === 'LOCKED' ? 'CUSTOMER_DEBT_LOCKED' : 'CUSTOMER_DEBT_UNLOCKED';
  logAudit(custId, cust.market_id, actionType, `دۆخی قەرزی کڕیار گۆڕدرا بۆ: ${credit.lock_status}. هۆکار: ${reason || 'بڕیاری بەڕێوەبەر'}`, permCheck.userId || 'Manager');

  res.json({ status: 'success', data: credit });
});

app.post('/api/customers/:id/temp-unlock', async (req, res) => {
  const permCheck = await verifyTenantPermission(req, res, 'MANAGE_CREDIT_LIMIT');
  if (!permCheck.authorized) return;

  const custId = req.params.id;
  const { reason, hours, max_amount, currency } = req.body || {};
  const cust = db.customers.find(c => c.id === custId);
  if (!cust) return res.status(404).json({ status: 'error', message: 'کڕیار نەدۆزرایەوە' });

  if (permCheck.marketId && cust.market_id !== permCheck.marketId) {
    return res.status(403).json({ status: 'error', code: 'FOREIGN_MARKET_ACCESS_DENIED', message: 'مۆرکی مارکێت ناگونجێت' });
  }

  const unlockId = `unlock-${Date.now()}`;
  const unlockHours = Number(hours) || 24;
  const expiresAt = new Date(Date.now() + unlockHours * 3600 * 1000).toISOString();

  const unlockRecord = {
    id: unlockId,
    customer_id: custId,
    market_id: cust.market_id,
    actor_id: permCheck.userId || 'manager',
    reason: reason || 'کردنەوەی کاتی قەرز',
    currency: currency || 'IQD',
    max_amount: Number(max_amount) || 0,
    status: 'ACTIVE',
    expires_at: expiresAt,
    created_at: new Date().toISOString()
  };

  if (pool) {
    try {
      await pool.query(
        `INSERT INTO public.temporary_debt_unlocks (id, customer_id, market_id, actor_id, reason, currency, max_amount, status, expires_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
        [unlockRecord.id, unlockRecord.customer_id, unlockRecord.market_id, unlockRecord.actor_id, unlockRecord.reason, unlockRecord.currency, unlockRecord.max_amount, unlockRecord.status, unlockRecord.expires_at]
      );
    } catch {}
  }
  if (!(db as any).temporary_debt_unlocks) (db as any).temporary_debt_unlocks = [];
  (db as any).temporary_debt_unlocks.push(unlockRecord);
  saveDb(db);

  logAudit(custId, cust.market_id, 'TEMPORARY_DEBT_UNLOCK_CREATED', `کردنەوەی کاتی قەرز بۆ کڕیار بۆ ماوەی ${unlockHours} کاتژمێر`, permCheck.userId || 'Manager');

  res.status(201).json({ status: 'success', data: unlockRecord });
});

app.get('/api/markets/:market_id/approvals', async (req, res) => {
  const permCheck = await verifyTenantPermission(req, res, 'VIEW_ANALYTICS');
  if (!permCheck.authorized) return;

  const marketId = req.params.market_id;
  let approvals: any[] = [];
  if (pool) {
    try {
      const resPg = await pool.query(`SELECT * FROM public.approval_requests WHERE market_id = $1 ORDER BY created_at DESC`, [marketId]);
      approvals = resPg.rows;
    } catch {}
  }
  if (approvals.length === 0 && (db as any).approval_requests) {
    approvals = (db as any).approval_requests.filter((a: any) => a.market_id === marketId);
  }

  res.json({ status: 'success', data: approvals });
});

app.post('/api/markets/:market_id/approvals', async (req, res) => {
  const permCheck = await verifyTenantPermission(req, res, 'ADD_DEBT');
  if (!permCheck.authorized) return;

  const marketId = req.params.market_id;
  const { customer_id, action_type, requested_amount, currency, target_transaction_id, requested_changes, reason } = req.body || {};

  if (!action_type) {
    return res.status(400).json({ status: 'error', message: 'جۆری داواکاری پەسەندکردن دیاری نەکراوە' });
  }

  const approvalId = `appr-${Date.now()}`;
  const expiresAt = new Date(Date.now() + 48 * 3600 * 1000).toISOString();

  const newAppr = {
    id: approvalId,
    market_id: marketId,
    requester_user_id: permCheck.userId || 'employee',
    customer_id: customer_id || null,
    action_type,
    requested_amount: Number(requested_amount) || 0,
    currency: currency || 'IQD',
    target_transaction_id: target_transaction_id || null,
    requested_changes: typeof requested_changes === 'object' ? JSON.stringify(requested_changes) : (requested_changes || null),
    reason: reason || 'داواکاری پەسەندکردنی خێرا',
    status: 'PENDING',
    approved_by: null,
    approved_at: null,
    rejected_by: null,
    rejected_at: null,
    executed_at: null,
    expires_at: expiresAt,
    created_at: new Date().toISOString()
  };

  if (pool) {
    try {
      await pool.query(
        `INSERT INTO public.approval_requests (id, market_id, requester_user_id, customer_id, action_type, requested_amount, currency, target_transaction_id, requested_changes, reason, status, expires_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'PENDING', $11, NOW())`,
        [newAppr.id, newAppr.market_id, newAppr.requester_user_id, newAppr.customer_id, newAppr.action_type, newAppr.requested_amount, newAppr.currency, newAppr.target_transaction_id, newAppr.requested_changes, newAppr.reason, newAppr.expires_at]
      );
    } catch {}
  }
  if (!(db as any).approval_requests) (db as any).approval_requests = [];
  (db as any).approval_requests.push(newAppr);
  saveDb(db);

  logAudit(customer_id || 'market', marketId, 'APPROVAL_REQUESTED', `داواکاری پەسەندکردن بۆ ${action_type} پێشکەش کرا`, permCheck.userId || 'Employee');

  res.status(201).json({ status: 'success', data: newAppr });
});

app.post('/api/markets/:market_id/approvals/:approval_id/approve', async (req, res) => {
  const permCheck = await verifyTenantPermission(req, res, 'MANAGE_CREDIT_LIMIT');
  if (!permCheck.authorized) return;

  if (permCheck.role === 'EMPLOYEE') {
    return res.status(403).json({ status: 'error', code: 'EMPLOYEE_SELF_APPROVAL_DENIED', message: 'کارمەند بۆی نییە خۆی داواکاری پەسەند بکات (403)' });
  }

  const { market_id, approval_id } = req.params;
  let record: any = null;

  if (pool) {
    try {
      const pRes = await pool.query(`SELECT * FROM public.approval_requests WHERE id = $1 AND market_id = $2`, [approval_id, market_id]);
      if (pRes.rows.length > 0) record = pRes.rows[0];
    } catch {}
  }
  if (!record && (db as any).approval_requests) {
    record = (db as any).approval_requests.find((a: any) => a.id === approval_id && a.market_id === market_id);
  }

  if (!record) return res.status(404).json({ status: 'error', message: 'داواکاری نەدۆزرایەوە' });
  if (record.status !== 'PENDING') {
    return res.status(400).json({ status: 'error', message: `ناتوانرێت داواکارییەک لە دۆخی (${record.status}) پەسەند بکرێت` });
  }

  record.status = 'APPROVED';
  record.approved_by = permCheck.userId || 'manager';
  record.approved_at = new Date().toISOString();

  if (pool) {
    try {
      await pool.query(
        `UPDATE public.approval_requests SET status = 'APPROVED', approved_by = $3, approved_at = NOW() WHERE id = $1 AND market_id = $2`,
        [approval_id, market_id, permCheck.userId]
      );
    } catch {}
  }
  saveDb(db);

  logAudit(record.customer_id || 'market', market_id, 'APPROVAL_APPROVED', `داواکاری پەسەندکردن پەسەندکرا`, permCheck.userId || 'Manager');

  res.json({ status: 'success', data: record });
});

app.post('/api/markets/:market_id/approvals/:approval_id/reject', async (req, res) => {
  const permCheck = await verifyTenantPermission(req, res, 'MANAGE_CREDIT_LIMIT');
  if (!permCheck.authorized) return;

  if (permCheck.role === 'EMPLOYEE') {
    return res.status(403).json({ status: 'error', code: 'EMPLOYEE_SELF_REJECT_DENIED', message: 'تەنها بەڕێوەبەر دەسەڵاتی ڕەتکردنەوەی هەیە' });
  }

  const { market_id, approval_id } = req.params;
  const { reason } = req.body || {};
  let record: any = null;

  if (pool) {
    try {
      const pRes = await pool.query(`SELECT * FROM public.approval_requests WHERE id = $1 AND market_id = $2`, [approval_id, market_id]);
      if (pRes.rows.length > 0) record = pRes.rows[0];
    } catch {}
  }
  if (!record && (db as any).approval_requests) {
    record = (db as any).approval_requests.find((a: any) => a.id === approval_id && a.market_id === market_id);
  }

  if (!record) return res.status(404).json({ status: 'error', message: 'داواکاری نەدۆزرایەوە' });
  if (record.status !== 'PENDING') {
    return res.status(400).json({ status: 'error', message: `ناتوانرێت داواکاری لە دۆخی (${record.status}) ڕەتبکرێتەوە` });
  }

  record.status = 'REJECTED';
  record.rejected_by = permCheck.userId || 'manager';
  record.rejected_at = new Date().toISOString();

  if (pool) {
    try {
      await pool.query(
        `UPDATE public.approval_requests SET status = 'REJECTED', rejected_by = $3, rejected_at = NOW() WHERE id = $1 AND market_id = $2`,
        [approval_id, market_id, permCheck.userId]
      );
    } catch {}
  }
  saveDb(db);

  logAudit(record.customer_id || 'market', market_id, 'APPROVAL_REJECTED', `داواکاری ڕەتکرایەوە. هۆکار: ${reason || 'بێ هۆکار'}`, permCheck.userId || 'Manager');

  res.json({ status: 'success', data: record });
});

app.post('/api/markets/:market_id/approvals/:approval_id/execute', async (req, res) => {
  const permCheck = await verifyTenantPermission(req, res, 'ADD_DEBT');
  if (!permCheck.authorized) return;

  const { market_id, approval_id } = req.params;
  const { submitted_amount, submitted_currency, submitted_customer_id } = req.body || {};

  let record: any = null;
  if (pool) {
    try {
      const pRes = await pool.query(`SELECT * FROM public.approval_requests WHERE id = $1 AND market_id = $2`, [approval_id, market_id]);
      if (pRes.rows.length > 0) record = pRes.rows[0];
    } catch {}
  }
  if (!record && (db as any).approval_requests) {
    record = (db as any).approval_requests.find((a: any) => a.id === approval_id && a.market_id === market_id);
  }

  if (!record) return res.status(404).json({ status: 'error', message: 'داواکاری نەدۆزرایەوە' });

  if (record.status === 'EXECUTED') {
    return res.status(400).json({ status: 'error', code: 'APPROVAL_REPLAY_DENIED', message: 'ئەم پەسەندکردنە پێشتر بەکارهاتووە و دووبارە بەکارنایەتەوە (Replay Denied)' });
  }
  if (record.status !== 'APPROVED') {
    return res.status(400).json({ status: 'error', code: 'NOT_APPROVED', message: `پەسەندکردنەکە لە دۆخی (${record.status}) دایە` });
  }

  if (new Date(record.expires_at) < new Date()) {
    record.status = 'EXPIRED';
    saveDb(db);
    return res.status(400).json({ status: 'error', code: 'APPROVAL_EXPIRED', message: 'ماوەی ئەم پەسەندکردنە بەسەرچووە' });
  }

  if (submitted_amount !== undefined && Number(submitted_amount) !== Number(record.requested_amount)) {
    return res.status(400).json({ status: 'error', code: 'AMOUNT_TAMPERING_DENIED', message: 'بڕی پارەی پێشکەشکراو ناگونجێت (Amount Tampering)' });
  }
  if (submitted_currency && submitted_currency !== record.currency) {
    return res.status(400).json({ status: 'error', code: 'CURRENCY_TAMPERING_DENIED', message: 'دراوی پێشکەشکراو ناگونجێت (Currency Tampering)' });
  }
  if (submitted_customer_id && submitted_customer_id !== record.customer_id) {
    return res.status(400).json({ status: 'error', code: 'CUSTOMER_TAMPERING_DENIED', message: 'کڕیاری پێشکەشکراو ناگونجێت (Customer Tampering)' });
  }
  if (record.market_id !== market_id) {
    return res.status(403).json({ status: 'error', code: 'MARKET_TAMPERING_DENIED', message: 'مۆرکی مارکێت ناگونجێت (Market Tampering)' });
  }

  record.status = 'EXECUTED';
  record.executed_at = new Date().toISOString();

  if (pool) {
    try {
      await pool.query(
        `UPDATE public.approval_requests SET status = 'EXECUTED', executed_at = NOW() WHERE id = $1 AND market_id = $2`,
        [approval_id, market_id]
      );
    } catch {}
  }
  saveDb(db);

  logAudit(record.customer_id || 'market', market_id, 'APPROVAL_EXECUTED', `داواکاری جێبەجێکرا: ${record.action_type}`, permCheck.userId || 'Employee');

  res.json({
    status: 'success',
    message: 'داواکاری پەسەندکراو بە سەرکەوتوویی جێبەجێکرا',
    data: record
  });
});

async function startServer() {
  await initPostgresSchema();
  try {
    globalDb = await loadDbFromPostgres();
  } catch (e: any) {
    console.error('Initial DB load failed:', e);
    const errorDb = { ...INITIAL_DATA };
    (errorDb as any)._dbError = e;
    globalDb = errorDb;
  }

  const distPath = path.join(process.cwd(), 'dist');
  const distIndexHtml = path.join(distPath, 'index.html');
  const hasBuild = fs.existsSync(distIndexHtml);

  const spaRoutes = [
    '/login',
    '/select-context',
    '/recover-account',
    '/activate',
    '/platform/*',
    '/market/*',
    '/employee/*',
    '/customer/*',
    '/b/*',
    '/balance/*',
    '/customer-balance/*'
  ];

  app.all('/api/*', (req, res) => {
    res.status(404).json({
      status: 'error',
      code: 'ENDPOINT_NOT_FOUND',
      message: 'API route not found'
    });
  });

  if (hasBuild || process.env.NODE_ENV === 'production') {
    app.use(express.static(distPath));

    app.get(spaRoutes, (req, res) => {
      res.sendFile(distIndexHtml);
    });

    app.get('*', (req, res) => {
      if (req.path.startsWith('/api/')) {
        return res.status(404).json({ status: 'error', message: 'API route not found' });
      }
      res.sendFile(distIndexHtml);
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });

    app.get(spaRoutes, async (req, res, next) => {
      try {
        const template = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf-8');
        const html = await vite.transformIndexHtml(req.originalUrl, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
      } catch (err) {
        vite.ssrFixStacktrace(err as Error);
        next(err);
      }
    });

    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Zhirox Debt System Server running on http://localhost:${PORT}`);
  });
}

if (!process.env.NO_SERVER_LISTEN && (process.env.NODE_ENV !== 'test' || process.argv[1]?.includes('server'))) {
  startServer();
}

