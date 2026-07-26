-- Migration: 004_customer_balances.sql
-- Description: Derived Customer Balances Projection/Cache Schema

CREATE TABLE IF NOT EXISTS customer_balances (
    id VARCHAR(100) PRIMARY KEY,
    market_id VARCHAR(100) NOT NULL,
    customer_id VARCHAR(100) NOT NULL,
    currency VARCHAR(10) NOT NULL CHECK (currency IN ('IQD', 'USD')),
    balance NUMERIC(20,2) NOT NULL DEFAULT 0.00,
    total_debt_added NUMERIC(20,2) NOT NULL DEFAULT 0.00,
    total_payments_received NUMERIC(20,2) NOT NULL DEFAULT 0.00,
    transaction_count INT NOT NULL DEFAULT 0,
    last_transaction_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_customer_balance_currency UNIQUE (market_id, customer_id, currency),
    CONSTRAINT fk_balance_customer FOREIGN KEY (market_id, customer_id)
        REFERENCES customers(market_id, id) ON DELETE RESTRICT,
    CONSTRAINT chk_balance_precision CHECK (
        (currency = 'IQD' AND balance = TRUNC(balance)) OR
        (currency = 'USD' AND balance = ROUND(balance, 2))
    )
);

CREATE INDEX IF NOT EXISTS idx_customer_balances_market_cust ON customer_balances(market_id, customer_id);
