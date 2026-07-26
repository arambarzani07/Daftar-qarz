-- Migration: 007_promises_reminders.sql
-- Description: Payment Promises and Customer Reminders Schema

-- 1. Payment Promises
CREATE TABLE IF NOT EXISTS payment_promises (
    id VARCHAR(100) PRIMARY KEY,
    market_id VARCHAR(100) NOT NULL,
    customer_id VARCHAR(100) NOT NULL,
    currency VARCHAR(10) NOT NULL CHECK (currency IN ('IQD', 'USD')),
    promised_amount NUMERIC(20,2) NOT NULL CHECK (promised_amount > 0),
    promise_date DATE NOT NULL,
    note TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'KEPT', 'BROKEN', 'CANCELLED')),
    created_by VARCHAR(100) REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fulfilled_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,

    CONSTRAINT fk_promise_customer FOREIGN KEY (market_id, customer_id)
        REFERENCES customers(market_id, id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_promises_pending ON payment_promises (market_id, status, promise_date) WHERE status = 'PENDING';

-- 2. Customer Reminders
CREATE TABLE IF NOT EXISTS customer_reminders (
    id VARCHAR(100) PRIMARY KEY,
    market_id VARCHAR(100) NOT NULL,
    customer_id VARCHAR(100) NOT NULL,
    remind_at TIMESTAMPTZ NOT NULL,
    note TEXT NOT NULL,
    priority VARCHAR(20) NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COMPLETED', 'DISMISSED', 'EXPIRED')),
    created_by VARCHAR(100) REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,

    CONSTRAINT fk_reminder_customer FOREIGN KEY (market_id, customer_id)
        REFERENCES customers(market_id, id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_reminders_pending ON customer_reminders (market_id, status, remind_at) WHERE status = 'PENDING';
