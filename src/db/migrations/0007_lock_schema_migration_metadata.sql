-- Migration 0007: Lock schema_migrations metadata constraints
-- Enforces non-nullability, checksum format, status domains, and execution uniqueness.

-- 1. Ensure default values
ALTER TABLE public.schema_migrations
  ALTER COLUMN status SET DEFAULT 'APPLIED',
  ALTER COLUMN applied_at SET DEFAULT NOW();

-- 2. Enforce NOT NULL constraints
ALTER TABLE public.schema_migrations
  ALTER COLUMN filename SET NOT NULL,
  ALTER COLUMN checksum_sha256 SET NOT NULL,
  ALTER COLUMN execution_order SET NOT NULL,
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN applied_at SET NOT NULL;

-- 3. Add CHECK constraint for 64 hex char sha256 checksum
ALTER TABLE public.schema_migrations
  DROP CONSTRAINT IF EXISTS chk_schema_migrations_checksum_sha256,
  ADD CONSTRAINT chk_schema_migrations_checksum_sha256 CHECK (checksum_sha256 ~ '^[0-9a-f]{64}$');

-- 4. Add CHECK constraint for status values
ALTER TABLE public.schema_migrations
  DROP CONSTRAINT IF EXISTS chk_schema_migrations_status,
  ADD CONSTRAINT chk_schema_migrations_status CHECK (status IN ('APPLIED', 'FAILED', 'ROLLED_BACK'));

-- 5. Ensure UNIQUE constraints on filename and execution_order
ALTER TABLE public.schema_migrations
  DROP CONSTRAINT IF EXISTS uq_schema_migrations_filename,
  ADD CONSTRAINT uq_schema_migrations_filename UNIQUE (filename);

ALTER TABLE public.schema_migrations
  DROP CONSTRAINT IF EXISTS uq_schema_migrations_execution_order,
  ADD CONSTRAINT uq_schema_migrations_execution_order UNIQUE (execution_order);
