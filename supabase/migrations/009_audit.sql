-- Migration: 009_audit.sql
-- Description: Immutable Audit Log Schema for Financial and Security Trail

CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(100) PRIMARY KEY,
    market_id VARCHAR(100) NOT NULL REFERENCES markets(id) ON DELETE RESTRICT,
    actor_user_id VARCHAR(100) REFERENCES users(id) ON DELETE SET NULL,
    actor_name_snapshot VARCHAR(200),
    customer_id VARCHAR(100),
    event_type VARCHAR(100) NOT NULL,
    reason TEXT,
    before_state JSONB,
    after_state JSONB,
    related_approval_id VARCHAR(100),
    related_ledger_entry_id VARCHAR(100),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_audit_customer FOREIGN KEY (market_id, customer_id)
        REFERENCES customers(market_id, id) ON DELETE SET NULL (customer_id),
    CONSTRAINT fk_audit_approval FOREIGN KEY (market_id, related_approval_id)
        REFERENCES approval_requests(market_id, id) ON DELETE SET NULL (related_approval_id),
    CONSTRAINT fk_audit_ledger FOREIGN KEY (market_id, related_ledger_entry_id)
        REFERENCES ledger_entries(market_id, id) ON DELETE SET NULL (related_ledger_entry_id)
);

CREATE INDEX IF NOT EXISTS idx_audit_market_date ON audit_logs (market_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_customer ON audit_logs (market_id, customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_event_type ON audit_logs (market_id, event_type);

-- Enforce Immutability (Append-Only) for Audit Logs
CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit log entries are immutable and cannot be updated or deleted.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_audit_mutation ON audit_logs;
CREATE TRIGGER trg_prevent_audit_mutation
    BEFORE UPDATE OR DELETE ON audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION prevent_audit_log_mutation();
