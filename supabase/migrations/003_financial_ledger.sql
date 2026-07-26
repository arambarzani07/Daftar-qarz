-- Migration: 003_financial_ledger.sql
-- Description: Authoritative Financial Ledger Entries Schema

CREATE TABLE IF NOT EXISTS ledger_entries (
    id VARCHAR(100) PRIMARY KEY,
    market_id VARCHAR(100) NOT NULL,
    customer_id VARCHAR(100) NOT NULL,
    seq_num INT,
    currency VARCHAR(10) NOT NULL CHECK (currency IN ('IQD', 'USD')),
    entry_type VARCHAR(30) NOT NULL CHECK (entry_type IN ('DEBT_ADD', 'PAYMENT_RECEIVE', 'OPENING_BALANCE', 'REVERSAL', 'ADJUSTMENT')),
    amount NUMERIC(20,2) NOT NULL CHECK (amount > 0),
    note TEXT,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by VARCHAR(100) REFERENCES users(id) ON DELETE SET NULL,
    
    -- Reversal metadata
    is_reversed BOOLEAN NOT NULL DEFAULT FALSE,
    reversed_at TIMESTAMPTZ,
    reversed_by VARCHAR(100) REFERENCES users(id) ON DELETE SET NULL,
    reversal_reason TEXT,
    reversal_of_entry_id VARCHAR(100),
    
    -- Network Idempotency protection
    idempotency_key VARCHAR(100),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- Composite Tenant Foreign Key
    CONSTRAINT uq_ledger_entries_market_id UNIQUE (market_id, id),
    CONSTRAINT fk_ledger_customer FOREIGN KEY (market_id, customer_id)
        REFERENCES customers(market_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_ledger_reversal_entry FOREIGN KEY (market_id, reversal_of_entry_id)
        REFERENCES ledger_entries(market_id, id) ON DELETE RESTRICT,

    -- Strict Money Precision Rule (IQD whole integer, USD max 2 decimal places)
    CONSTRAINT chk_money_precision CHECK (
        (currency = 'IQD' AND amount = TRUNC(amount)) OR
        (currency = 'USD' AND amount = ROUND(amount, 2))
    )
);

-- Idempotency key uniqueness per market
CREATE UNIQUE INDEX IF NOT EXISTS uq_ledger_market_idempotency 
    ON ledger_entries (market_id, idempotency_key) 
    WHERE idempotency_key IS NOT NULL;

-- Sequence number uniqueness per market if assigned
CREATE UNIQUE INDEX IF NOT EXISTS uq_ledger_market_seq 
    ON ledger_entries (market_id, seq_num) 
    WHERE seq_num IS NOT NULL;

-- Prevent duplicate reversal of the same original ledger entry
CREATE UNIQUE INDEX IF NOT EXISTS uq_ledger_single_reversal 
    ON ledger_entries (reversal_of_entry_id) 
    WHERE reversal_of_entry_id IS NOT NULL;
