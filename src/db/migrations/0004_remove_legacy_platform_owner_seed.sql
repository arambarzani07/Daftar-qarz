-- Migration: 0004_remove_legacy_platform_owner_seed.sql
-- Description: Remove legacy default Platform Owner seed (usr-platform-owner / 07500000000) for zero-trust production fresh installs.

DELETE FROM public.platform_access WHERE id = 'pa-platform-owner' OR user_id = 'usr-platform-owner';
DELETE FROM public.users WHERE id = 'usr-platform-owner' AND phone = '07500000000';
