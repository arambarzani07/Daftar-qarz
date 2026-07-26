-- Migration: 005_credit_protection.sql
-- Description: Credit Control Settings, Debt Lock Controls, and Temporary Unlocks

-- 1. Per-Currency Credit Settings
CREATE TABLE IF NOT EXISTS customer_credit_settings (
    id VARCHAR(100) PRIMARY KEY,
    market_id VARCHAR(100) NOT NULL,
    customer_id VARCHAR(100) NOT NULL,
    currency VARCHAR(10) NOT NULL CHECK (currency IN ('IQD', 'USD')),
    limit_mode VARCHAR(20) NOT NULL DEFAULT 'NO_LIMIT' CHECK (limit_mode IN ('NO_LIMIT', 'SOFT_LIMIT', 'HARD_LIMIT')),
    limit_amount NUMERIC(20,2) NOT NULL DEFAULT 0.00,
    warning_threshold NUMERIC(20,2) NOT NULL DEFAULT 0.00,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_by VARCHAR(100) REFERENCES users(id) ON DELETE SET NULL,
    updated_by VARCHAR(100) REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_credit_settings_currency UNIQUE (market_id, customer_id, currency),
    CONSTRAINT fk_credit_customer FOREIGN KEY (market_id, customer_id)
        REFERENCES customers(market_id, id) ON DELETE RESTRICT
);

-- 2. Customer Debt Status Controls
CREATE TABLE IF NOT EXISTS customer_debt_controls (
    id VARCHAR(100) PRIMARY KEY,
    market_id VARCHAR(100) NOT NULL,
    customer_id VARCHAR(100) NOT NULL,
    debt_status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (debt_status IN ('ACTIVE', 'SOFT_WARNING', 'LOCKED')),
    lock_reason TEXT,
    changed_by VARCHAR(100) REFERENCES users(id) ON DELETE SET NULL,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_debt_controls_cust UNIQUE (market_id, customer_id),
    CONSTRAINT fk_debt_control_customer FOREIGN KEY (market_id, customer_id)
        REFERENCES customers(market_id, id) ON DELETE RESTRICT
);

-- 3. Temporary Debt Unlocks / Overrides
CREATE TABLE IF NOT EXISTS temporary_debt_unlocks (
    id VARCHAR(100) PRIMARY KEY,
    market_id VARCHAR(100) NOT NULL,
    customer_id VARCHAR(100) NOT NULL,
    currency VARCHAR(10) CHECK (currency IN ('IQD', 'USD')),
    scope_type VARCHAR(30) NOT NULL CHECK (scope_type IN ('ONE_TRANSACTION', 'UNTIL_TIME', 'UNTIL_AMOUNT', 'MANUAL_REVOKE')),
    maximum_amount NUMERIC(20,2),
    reason TEXT NOT NULL,
    approved_by VARCHAR(100) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'CONSUMED', 'EXPIRED', 'REVOKED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    consumed_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,

    CONSTRAINT fk_unlock_customer FOREIGN KEY (market_id, customer_id)
        REFERENCES customers(market_id, id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_unlocks_active ON temporary_debt_unlocks (market_id, customer_id, status) WHERE status = 'ACTIVE';
