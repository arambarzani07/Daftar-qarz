-- Migration: 006_approvals.sql
-- Description: Money Protection Approval Workflow Schema

CREATE TABLE IF NOT EXISTS approval_requests (
    id VARCHAR(100) PRIMARY KEY,
    market_id VARCHAR(100) NOT NULL,
    customer_id VARCHAR(100) NOT NULL,
    request_type VARCHAR(50) NOT NULL CHECK (request_type IN (
        'CREDIT_LIMIT_OVERRIDE', 
        'DEBT_LOCK_OVERRIDE', 
        'TEMPORARY_UNLOCK', 
        'CREDIT_LIMIT_CHANGE', 
        'HIGH_RISK_DEBT_APPROVAL', 
        'SENSITIVE_TRANSACTION_OVERRIDE'
    )),
    requested_by VARCHAR(100) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reason TEXT NOT NULL,

    currency VARCHAR(10) CHECK (currency IN ('IQD', 'USD')),
    requested_amount NUMERIC(20,2),

    current_balance_snapshot NUMERIC(20,2),
    projected_balance_snapshot NUMERIC(20,2),
    credit_limit_snapshot NUMERIC(20,2),
    blocking_reason TEXT,

    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN (
        'PENDING', 
        'APPROVED', 
        'REJECTED', 
        'CANCELLED', 
        'EXPIRED', 
        'CONSUMED'
    )),

    decision_by VARCHAR(100) REFERENCES users(id) ON DELETE SET NULL,
    decision_at TIMESTAMPTZ,
    decision_reason TEXT,

    expires_at TIMESTAMPTZ,
    consumed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,

    related_transaction_id VARCHAR(100),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

    CONSTRAINT uq_approval_requests_market_id UNIQUE (market_id, id),
    CONSTRAINT fk_approval_customer FOREIGN KEY (market_id, customer_id)
        REFERENCES customers(market_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_approval_ledger_entry FOREIGN KEY (market_id, related_transaction_id)
        REFERENCES ledger_entries(market_id, id) ON DELETE SET NULL (related_transaction_id)
);

CREATE INDEX IF NOT EXISTS idx_approvals_pending ON approval_requests (market_id, status, requested_at DESC) WHERE status = 'PENDING';
