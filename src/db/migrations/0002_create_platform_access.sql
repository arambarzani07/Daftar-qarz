-- Migration: 0002_create_platform_access.sql
-- Description: Dedicated Platform Authority Table for ZHIROX Control Plane

CREATE TABLE IF NOT EXISTS public.platform_access (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'PLATFORM_OWNER',
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT platform_access_user_role_unique UNIQUE (user_id, role),
  CONSTRAINT platform_access_status_check CHECK (status IN ('ACTIVE', 'SUSPENDED', 'REVOKED'))
);

CREATE INDEX IF NOT EXISTS idx_platform_access_user_role ON public.platform_access(user_id, role, status);

-- Seed initial Platform Owner user if missing
INSERT INTO public.users (id, auth_user_id, full_name, email, phone, is_active, created_at, updated_at)
VALUES (
  'usr-platform-owner',
  'usr-platform-owner',
  'خاوەنی سیستەم (Platform Owner)',
  'admin@zhirox.com',
  '07500000000',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET is_active = true, phone = '07500000000';

-- Ensure auth_user_id and phone mapping exists
UPDATE public.users 
SET auth_user_id = 'usr-platform-owner', phone = '07500000000' 
WHERE id = 'usr-platform-owner' AND (auth_user_id IS NULL OR auth_user_id = '' OR phone IS NULL);

-- Seed platform_access record for usr-platform-owner
INSERT INTO public.platform_access (id, user_id, role, status, created_at, updated_at)
VALUES (
  'pa-platform-owner',
  'usr-platform-owner',
  'PLATFORM_OWNER',
  'ACTIVE',
  NOW(),
  NOW()
)
ON CONFLICT (user_id, role) DO UPDATE SET status = 'ACTIVE', updated_at = NOW();
