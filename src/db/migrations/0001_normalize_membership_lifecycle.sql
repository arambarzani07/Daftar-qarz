-- Migration: 0001_normalize_membership_lifecycle.sql
-- Description: Normalize public.market_memberships.status lifecycle constraint to canonical values (PENDING_ACTIVATION, ACTIVE, SUSPENDED, REVOKED)

-- 1. Migrate existing PENDING membership rows to PENDING_ACTIVATION
UPDATE public.market_memberships
SET status = 'PENDING_ACTIVATION', updated_at = NOW()
WHERE status = 'PENDING';

-- 2. Drop legacy status check constraint if present
ALTER TABLE public.market_memberships
DROP CONSTRAINT IF EXISTS market_memberships_status_check;

-- 3. Apply canonical status check constraint
ALTER TABLE public.market_memberships
ADD CONSTRAINT market_memberships_status_check
CHECK (status IN ('PENDING_ACTIVATION', 'ACTIVE', 'SUSPENDED', 'REVOKED'));
