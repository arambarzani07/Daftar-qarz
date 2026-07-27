-- Migration 0012: Customer Recovery and Debt Protection Layer
-- Date: 2026-07-27

BEGIN;

-- 1. Create recovery_cases table
CREATE TABLE IF NOT EXISTS public.recovery_cases (
  id VARCHAR(128) PRIMARY KEY,
  market_id VARCHAR(128) NOT NULL REFERENCES public.markets(id),
  customer_id VARCHAR(128) NOT NULL REFERENCES public.customers(id),
  status VARCHAR(32) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'IN_PROGRESS', 'WAITING', 'RESOLVED', 'CLOSED')),
  priority VARCHAR(32) NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
  assigned_user_id VARCHAR(128) REFERENCES public.users(id) ON DELETE SET NULL,
  reason TEXT,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_recovery_case_market_cust UNIQUE (market_id, customer_id),
  CONSTRAINT fk_recovery_case_cust FOREIGN KEY (market_id, customer_id) REFERENCES public.customers(market_id, id) ON DELETE RESTRICT
);

-- 2. Create recovery_activities table
CREATE TABLE IF NOT EXISTS public.recovery_activities (
  id VARCHAR(128) PRIMARY KEY,
  case_id VARCHAR(128) NOT NULL REFERENCES public.recovery_cases(id) ON DELETE CASCADE,
  market_id VARCHAR(128) NOT NULL REFERENCES public.markets(id),
  customer_id VARCHAR(128) NOT NULL REFERENCES public.customers(id),
  activity_type VARCHAR(64) NOT NULL CHECK (activity_type IN ('CALL_ATTEMPT', 'CUSTOMER_CONTACT', 'PROMISE_CREATED', 'PROMISE_BROKEN', 'NOTE', 'ESCALATION', 'PAYMENT_OBSERVED')),
  note TEXT,
  created_by VARCHAR(128) REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Expand approval_requests request_type check constraint
ALTER TABLE public.approval_requests DROP CONSTRAINT IF EXISTS approval_requests_request_type_check;
ALTER TABLE public.approval_requests ADD CONSTRAINT approval_requests_request_type_check 
  CHECK (request_type IN (
    'CREDIT_LIMIT_OVERRIDE',
    'LOCKED_CUSTOMER_DEBT',
    'HIGH_RISK_DEBT',
    'MANUAL_UNLOCK',
    'DEBT_REVERSAL',
    'PAYMENT_REVERSAL',
    'FORGIVENESS',
    'ADJUSTMENT_DEBIT',
    'ADJUSTMENT_CREDIT',
    'CREDIT_LIMIT_CHANGE',
    'DEBT_LOCK_OVERRIDE',
    'TEMPORARY_UNLOCK',
    'HIGH_RISK_DEBT_APPROVAL',
    'SENSITIVE_TRANSACTION_OVERRIDE'
  ));

-- 4. Expand payment_promises status check constraint
ALTER TABLE public.payment_promises DROP CONSTRAINT IF EXISTS payment_promises_status_check;
ALTER TABLE public.payment_promises ADD CONSTRAINT payment_promises_status_check
  CHECK (status IN ('PENDING', 'KEPT', 'PARTIALLY_KEPT', 'BROKEN', 'CANCELLED', 'EXPIRED', 'FULFILLED'));

-- 5. Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_recovery_cases_market ON public.recovery_cases(market_id);
CREATE INDEX IF NOT EXISTS idx_recovery_activities_case ON public.recovery_activities(case_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_status ON public.approval_requests(market_id, status);
CREATE INDEX IF NOT EXISTS idx_payment_promises_cust ON public.payment_promises(market_id, customer_id, status);

COMMIT;
