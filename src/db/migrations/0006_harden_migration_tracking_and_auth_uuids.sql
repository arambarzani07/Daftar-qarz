-- Migration 0006: Harden Migration Tracking and Enforce PostgreSQL UUIDs on Auth User IDs

-- 1. Harden schema_migrations table
ALTER TABLE public.schema_migrations
  ADD COLUMN IF NOT EXISTS filename TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS checksum_sha256 VARCHAR(64) CONSTRAINT chk_checksum_sha256_length CHECK (checksum_sha256 IS NULL OR LENGTH(checksum_sha256) = 64),
  ADD COLUMN IF NOT EXISTS execution_order INTEGER UNIQUE,
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'APPLIED' CONSTRAINT chk_migration_status CHECK (status IN ('APPLIED', 'FAILED', 'ROLLED_BACK'));

-- 2. Drop dependent policies before altering column type
DROP POLICY IF EXISTS users_self_select ON public.users;
DROP POLICY IF EXISTS customer_auth_links_select ON public.customer_auth_links;

-- 3. Convert public.users.auth_user_id to PostgreSQL UUID
ALTER TABLE public.users
  ALTER COLUMN auth_user_id TYPE UUID
  USING NULLIF(auth_user_id, '')::UUID;

-- 4. Convert public.customer_auth_links.auth_user_id to PostgreSQL UUID
ALTER TABLE public.customer_auth_links
  ALTER COLUMN auth_user_id TYPE UUID
  USING NULLIF(auth_user_id, '')::UUID;

-- 5. Re-create RLS policies with UUID compatibility
CREATE POLICY users_self_select ON public.users
  FOR SELECT USING (auth_user_id = auth.uid());

CREATE POLICY customer_auth_links_select ON public.customer_auth_links
  FOR SELECT USING ((auth_user_id = auth.uid() AND status = 'ACTIVE') OR auth_user_can_manage_customer_auth_links(market_id));
