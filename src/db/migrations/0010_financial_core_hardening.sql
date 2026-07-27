-- Migration 0010: Financial Core Hardening
-- Description: Add strict database-level invariants for ledger entries and customer balances.

-- 1. Ensure amount > 0 on ledger_entries
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_ledger_amount_positive'
  ) THEN
    ALTER TABLE public.ledger_entries
    ADD CONSTRAINT chk_ledger_amount_positive CHECK (amount > 0);
  END IF;
END $$;

-- 2. Ensure currency domain on ledger_entries
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_ledger_currency_valid'
  ) THEN
    ALTER TABLE public.ledger_entries
    ADD CONSTRAINT chk_ledger_currency_valid CHECK (currency IN ('IQD', 'USD'));
  END IF;
END $$;

-- 3. Ensure currency domain on customer_balances
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_balances_currency_valid'
  ) THEN
    ALTER TABLE public.customer_balances
    ADD CONSTRAINT chk_balances_currency_valid CHECK (currency IN ('IQD', 'USD'));
  END IF;
END $$;

-- 4. Ensure valid entry_type on ledger_entries
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_ledger_entry_type_valid'
  ) THEN
    ALTER TABLE public.ledger_entries
    ADD CONSTRAINT chk_ledger_entry_type_valid CHECK (entry_type IN ('DEBT_ADD', 'PAYMENT_RECEIVE', 'OPENING_BALANCE', 'ADJUSTMENT', 'FORGIVENESS', 'REVERSAL'));
  END IF;
END $$;
