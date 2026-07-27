-- Migration 0009: Canonical Role Whitelist
-- Description: Forward-only migration to normalize legacy manager roles in public.market_memberships to MARKET_MANAGER and restrict role domain to MARKET_MANAGER and EMPLOYEE.

-- 1. PRE-FLIGHT SAFETY CHECKS
DO $$
BEGIN
  -- A. Detect any public.market_memberships row belonging to an ACTIVE PLATFORM_OWNER
  IF EXISTS (
    SELECT 1 
    FROM public.market_memberships mm
    JOIN public.users u ON mm.user_id = u.id
    JOIN public.platform_access pa ON pa.user_id = u.id
    WHERE pa.role = 'PLATFORM_OWNER' AND pa.status = 'ACTIVE'
  ) THEN
    RAISE EXCEPTION 'MIGRATION 0009 ABORTED: Found market_memberships row belonging to an ACTIVE PLATFORM_OWNER!';
  END IF;

  -- B. Detect unknown membership roles outside legitimate domain (OWNER, MARKET_OWNER, MANAGER, MARKET_MANAGER, EMPLOYEE)
  IF EXISTS (
    SELECT 1 
    FROM public.market_memberships 
    WHERE role NOT IN ('OWNER', 'MARKET_OWNER', 'MANAGER', 'MARKET_MANAGER', 'EMPLOYEE')
  ) THEN
    RAISE EXCEPTION 'MIGRATION 0009 ABORTED: Found unknown or corrupted role in public.market_memberships!';
  END IF;

  -- C. Detect orphan user_id or market_id in public.market_memberships
  IF EXISTS (
    SELECT 1 FROM public.market_memberships mm
    LEFT JOIN public.users u ON mm.user_id = u.id
    WHERE u.id IS NULL
  ) THEN
    RAISE EXCEPTION 'MIGRATION 0009 ABORTED: Found orphan user_id in public.market_memberships!';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.market_memberships mm
    LEFT JOIN public.markets m ON mm.market_id = m.id
    WHERE m.id IS NULL
  ) THEN
    RAISE EXCEPTION 'MIGRATION 0009 ABORTED: Found orphan market_id in public.market_memberships!';
  END IF;

  -- D. Detect duplicate market_id + user_id relationships or multiple ACTIVE memberships
  IF EXISTS (
    SELECT market_id, user_id, COUNT(*)
    FROM public.market_memberships
    GROUP BY market_id, user_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'MIGRATION 0009 ABORTED: Found duplicate market_id + user_id memberships!';
  END IF;
END $$;

-- 2. Normalize legacy roles (OWNER, MARKET_OWNER, MANAGER) to MARKET_MANAGER
UPDATE public.market_memberships
SET role = 'MARKET_MANAGER'
WHERE role IN ('OWNER', 'MARKET_OWNER', 'MANAGER');

-- 3. Enforce strict role CHECK constraint on public.market_memberships
ALTER TABLE public.market_memberships DROP CONSTRAINT IF EXISTS market_memberships_role_check;
ALTER TABLE public.market_memberships ADD CONSTRAINT market_memberships_role_check CHECK (role IN ('MARKET_MANAGER', 'EMPLOYEE'));

-- 4. POST-MIGRATION VERIFICATION
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.market_memberships WHERE role NOT IN ('MARKET_MANAGER', 'EMPLOYEE')
  ) THEN
    RAISE EXCEPTION 'MIGRATION 0009 VERIFICATION FAILED: Un-whitelisted role remains post-migration!';
  END IF;

  IF EXISTS (
    SELECT 1 
    FROM public.market_memberships mm
    JOIN public.users u ON mm.user_id = u.id
    JOIN public.platform_access pa ON pa.user_id = u.id
    WHERE pa.role = 'PLATFORM_OWNER' AND pa.status = 'ACTIVE'
  ) THEN
    RAISE EXCEPTION 'MIGRATION 0009 VERIFICATION FAILED: PLATFORM_OWNER membership exists post-migration!';
  END IF;
END $$;
