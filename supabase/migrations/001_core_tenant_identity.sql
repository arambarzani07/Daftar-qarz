-- Migration: 001_core_tenant_identity.sql
-- Description: Core Tenant, Market, User, and Membership Schema

-- 1. Markets / Tenants Root
CREATE TABLE IF NOT EXISTS markets (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED', 'ARCHIVED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Global Users Identity
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(100) PRIMARY KEY,
    auth_user_id VARCHAR(100) UNIQUE,
    email VARCHAR(255) UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Market Memberships (Tenant Authorization Boundary)
CREATE TABLE IF NOT EXISTS market_memberships (
    id VARCHAR(100) PRIMARY KEY,
    market_id VARCHAR(100) NOT NULL REFERENCES markets(id) ON DELETE RESTRICT,
    user_id VARCHAR(100) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    role VARCHAR(50) NOT NULL CHECK (role IN ('OWNER', 'MANAGER', 'EMPLOYEE', 'PLATFORM_OWNER')),
    permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED', 'REVOKED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_market_user UNIQUE (market_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_memberships_user ON market_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_market ON market_memberships(market_id);
