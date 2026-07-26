-- Migration: 008_disputes_attachments.sql
-- Description: Customer Disputes and File Attachment Metadata Schema

-- 1. Customer Transaction Disputes
CREATE TABLE IF NOT EXISTS customer_disputes (
    id VARCHAR(100) PRIMARY KEY,
    market_id VARCHAR(100) NOT NULL,
    customer_id VARCHAR(100) NOT NULL,
    transaction_id VARCHAR(100),
    currency VARCHAR(10) CHECK (currency IN ('IQD', 'USD')),
    disputed_amount NUMERIC(20,2),
    reason TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED')),
    resolution_notes TEXT,
    opened_by VARCHAR(100) REFERENCES users(id) ON DELETE SET NULL,
    opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_by VARCHAR(100) REFERENCES users(id) ON DELETE SET NULL,
    resolved_at TIMESTAMPTZ,

    CONSTRAINT fk_dispute_customer FOREIGN KEY (market_id, customer_id)
        REFERENCES customers(market_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_dispute_ledger_entry FOREIGN KEY (market_id, transaction_id)
        REFERENCES ledger_entries(market_id, id) ON DELETE RESTRICT
);

-- 2. Customer File Attachments Metadata (Files stored in Supabase Private Storage)
CREATE TABLE IF NOT EXISTS customer_attachments (
    id VARCHAR(100) PRIMARY KEY,
    market_id VARCHAR(100) NOT NULL,
    customer_id VARCHAR(100) NOT NULL,
    transaction_id VARCHAR(100),
    storage_bucket VARCHAR(100) NOT NULL DEFAULT 'zhirox-attachments',
    storage_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size BIGINT NOT NULL,
    checksum VARCHAR(64),
    description TEXT,
    uploaded_by VARCHAR(100) REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_attachment_customer FOREIGN KEY (market_id, customer_id)
        REFERENCES customers(market_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_attachment_ledger_entry FOREIGN KEY (market_id, transaction_id)
        REFERENCES ledger_entries(market_id, id) ON DELETE SET NULL (transaction_id)
);

CREATE INDEX IF NOT EXISTS idx_attachments_customer ON customer_attachments(market_id, customer_id);
