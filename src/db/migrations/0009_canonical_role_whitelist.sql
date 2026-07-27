-- Migration 0009: Canonical Role Whitelist
-- Description: Forward-only migration to normalize legacy manager roles in public.market_memberships to MARKET_MANAGER and restrict role domain to MARKET_MANAGER and EMPLOYEE.

-- 1. Ensure audit_logs foreign keys are dropped if present
ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS fk_audit_customer;
ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS fk_audit_approval;
ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS fk_audit_ledger;

-- 2. Normalize legacy roles (OWNER, MARKET_OWNER, MANAGER) to MARKET_MANAGER
UPDATE public.market_memberships
SET role = 'MARKET_MANAGER'
WHERE role IN ('OWNER', 'MARKET_OWNER', 'MANAGER');

-- 3. Enforce strict role CHECK constraint on public.market_memberships
ALTER TABLE public.market_memberships DROP CONSTRAINT IF EXISTS market_memberships_role_check;
ALTER TABLE public.market_memberships ADD CONSTRAINT market_memberships_role_check CHECK (role IN ('MARKET_MANAGER', 'EMPLOYEE'));
