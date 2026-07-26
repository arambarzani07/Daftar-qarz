-- Migration: 0003_create_customer_auth_links.sql
-- Description: Customer Portal Authentication Mapping Schema & Status Constraints

CREATE TABLE IF NOT EXISTS public.customer_auth_links (
    id TEXT PRIMARY KEY,
    market_id TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    auth_user_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('PENDING_INVITATION', 'ACTIVE', 'SUSPENDED', 'REVOKED')),
    linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_customer_auth_link_unique UNIQUE (market_id, customer_id, auth_user_id)
);

CREATE INDEX IF NOT EXISTS idx_customer_auth_links_auth_user ON public.customer_auth_links (auth_user_id, status);
CREATE INDEX IF NOT EXISTS idx_customer_auth_links_customer ON public.customer_auth_links (market_id, customer_id);
