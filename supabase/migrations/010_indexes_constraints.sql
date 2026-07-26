-- Migration: 010_indexes_constraints.sql
-- Description: Composite Performance Indexes and Financial Query Optimization

-- Composite Ledger Query Index
CREATE INDEX IF NOT EXISTS idx_ledger_tenant_cust_curr_date 
    ON ledger_entries (market_id, customer_id, currency, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_ledger_tenant_date 
    ON ledger_entries (market_id, occurred_at DESC);

-- Customer Lookup Optimization
CREATE INDEX IF NOT EXISTS idx_customers_latin_name 
    ON customers (market_id, latin_name) 
    WHERE latin_name IS NOT NULL;

-- Customer Balance Optimization
CREATE INDEX IF NOT EXISTS idx_balances_currency 
    ON customer_balances (market_id, currency, balance DESC);
