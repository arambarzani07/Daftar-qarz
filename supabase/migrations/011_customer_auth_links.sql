-- Migration: 011_customer_auth_links.sql
-- Description: Customer Portal Authentication Mapping Schema

CREATE TABLE IF NOT EXISTS customer_auth_links (
    id VARCHAR(100) PRIMARY KEY,
    market_id VARCHAR(100) NOT NULL,
    customer_id VARCHAR(100) NOT NULL,
    auth_user_id VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'REVOKED', 'PENDING')),
    linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_customer_auth_link_customer FOREIGN KEY (market_id, customer_id)
        REFERENCES customers(market_id, id) ON DELETE RESTRICT,
    CONSTRAINT uq_customer_auth_link_unique UNIQUE (market_id, customer_id, auth_user_id)
);

CREATE INDEX IF NOT EXISTS idx_customer_auth_links_auth_user ON customer_auth_links (auth_user_id, status);
CREATE INDEX IF NOT EXISTS idx_customer_auth_links_customer ON customer_auth_links (market_id, customer_id);

-- Enable RLS on customer_auth_links
ALTER TABLE customer_auth_links ENABLE ROW LEVEL SECURITY;
