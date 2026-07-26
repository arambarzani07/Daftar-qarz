-- Migration: 0005_enforce_zero_trust_constraints.sql
-- Description: Enforce zero-trust database constraints, unique indexes, and single-active-owner invariant for ZHIROX

-- 1. Remove legacy market_memberships row for PLATFORM_OWNER if present
DELETE FROM public.market_memberships WHERE role = 'PLATFORM_OWNER' OR market_id = 'SYSTEM_GLOBAL';

-- 2. Enforce single active Platform Owner invariant in PostgreSQL
CREATE UNIQUE INDEX IF NOT EXISTS uq_single_active_platform_owner 
ON public.platform_access (role) 
WHERE (role = 'PLATFORM_OWNER' AND status = 'ACTIVE');

-- 3. Enforce unique user_id in platform_access
CREATE UNIQUE INDEX IF NOT EXISTS uq_platform_access_user_id 
ON public.platform_access (user_id);

-- 4. Enforce unique auth_user_id on public.users where non-null and not empty
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_auth_user_id 
ON public.users (auth_user_id) 
WHERE auth_user_id IS NOT NULL AND auth_user_id != '';

-- 5. Enforce unique (market_id, user_id) on market_memberships
CREATE UNIQUE INDEX IF NOT EXISTS uq_market_memberships_market_user 
ON public.market_memberships (market_id, user_id);

-- 6. Enforce unique (market_id, customer_id, auth_user_id) on customer_auth_links
CREATE UNIQUE INDEX IF NOT EXISTS uq_customer_auth_links_unique 
ON public.customer_auth_links (market_id, customer_id, auth_user_id);
