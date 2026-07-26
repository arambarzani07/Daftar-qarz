-- Migration: 002_customers.sql
-- Description: Hardened Customer Identity Schema (Profile & Tenant Isolation)

CREATE TABLE IF NOT EXISTS customers (
    id VARCHAR(100) NOT NULL,
    market_id VARCHAR(100) NOT NULL REFERENCES markets(id) ON DELETE RESTRICT,
    seq_num INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    latin_name VARCHAR(255),
    phone VARCHAR(50),
    whatsapp_phone VARCHAR(50),
    address TEXT,
    notes TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'ARCHIVED', 'DELETED')),
    created_by VARCHAR(100) REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    archived_at TIMESTAMPTZ,
    PRIMARY KEY (id),
    CONSTRAINT uq_customers_market_id UNIQUE (market_id, id),
    CONSTRAINT uq_customers_market_seq UNIQUE (market_id, seq_num)
);

CREATE INDEX IF NOT EXISTS idx_customers_market_status ON customers(market_id, status);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(market_id, phone);
