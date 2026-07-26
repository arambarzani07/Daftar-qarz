-- Migration 0008: Baseline Tables
-- Description: Move baseline inline tables from server.ts into forward-only migration.

CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY,
  auth_user_id TEXT UNIQUE,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS auth_user_id TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

CREATE TABLE IF NOT EXISTS public.activation_tokens (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  market_id TEXT NOT NULL,
  market_name TEXT,
  user_id TEXT NOT NULL,
  manager_name TEXT,
  manager_login_phone TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING',
  processing_started_at TIMESTAMPTZ,
  processing_expires_at TIMESTAMPTZ,
  operation_id TEXT,
  password_fingerprint TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_activation_tokens_hash ON public.activation_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_activation_tokens_market_user ON public.activation_tokens(market_id, user_id);

CREATE TABLE IF NOT EXISTS public.rate_limits (
  key TEXT PRIMARY KEY,
  count INT NOT NULL DEFAULT 1,
  reset_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rate_limits_reset ON public.rate_limits(reset_at);

CREATE TABLE IF NOT EXISTS public.approval_requests (
  id TEXT PRIMARY KEY,
  market_id TEXT NOT NULL,
  requester_user_id TEXT NOT NULL,
  customer_id TEXT,
  action_type TEXT NOT NULL,
  requested_amount NUMERIC,
  currency TEXT,
  target_transaction_id TEXT,
  requested_changes TEXT,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING',
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  rejected_by TEXT,
  rejected_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.temporary_debt_unlocks (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  market_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  reason TEXT,
  currency TEXT,
  max_amount NUMERIC,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.protection_alerts (
  id TEXT PRIMARY KEY,
  market_id TEXT NOT NULL,
  alert_type TEXT NOT NULL,
  customer_id TEXT,
  employee_id TEXT,
  transaction_id TEXT,
  status TEXT NOT NULL DEFAULT 'OPEN',
  severity TEXT NOT NULL DEFAULT 'MEDIUM',
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.market_protection_policies (
  market_id TEXT PRIMARY KEY,
  high_value_iqd_threshold NUMERIC DEFAULT 1000000,
  high_value_usd_threshold NUMERIC DEFAULT 1000,
  require_approval_for_reversals BOOLEAN DEFAULT false,
  require_approval_for_credit_limit_change BOOLEAN DEFAULT true,
  max_temp_unlock_hours INT DEFAULT 24,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.market_settings (
  market_id TEXT PRIMARY KEY,
  market_name TEXT,
  owner_name TEXT,
  owner_phone TEXT,
  pin_enabled BOOLEAN DEFAULT false,
  pin_code TEXT DEFAULT '1234',
  language TEXT DEFAULT 'ku',
  default_currency TEXT DEFAULT 'IQD',
  theme TEXT DEFAULT 'dark',
  is_locked_by_system BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.customer_share_links (
  id TEXT PRIMARY KEY,
  market_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  pin_code TEXT,
  access_count INT NOT NULL DEFAULT 0,
  last_accessed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
