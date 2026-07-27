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
    ADD CONSTRAINT chk_ledger_entry_type_valid CHECK (entry_type IN ('DEBT_ADD', 'PAYMENT_RECEIVE', 'OPENING_BALANCE', 'FORGIVENESS', 'REVERSAL', 'ADJUSTMENT_DEBIT', 'ADJUSTMENT_CREDIT', 'ADJUSTMENT'));
  END IF;
END $$;

-- 5. IQD whole-number invariant
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_ledger_iqd_whole'
  ) THEN
    ALTER TABLE public.ledger_entries
    ADD CONSTRAINT chk_ledger_iqd_whole CHECK (currency != 'IQD' OR amount = TRUNC(amount));
  END IF;
END $$;

-- 6. USD max 2 decimal places invariant
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_ledger_usd_precision'
  ) THEN
    ALTER TABLE public.ledger_entries
    ADD CONSTRAINT chk_ledger_usd_precision CHECK (currency != 'USD' OR amount = ROUND(amount, 2));
  END IF;
END $$;

-- 7. Idempotency unique index per market
CREATE UNIQUE INDEX IF NOT EXISTS uq_ledger_market_idempotency
ON public.ledger_entries (market_id, idempotency_key)
WHERE idempotency_key IS NOT NULL;

-- 8. Single reversal per original entry unique index
CREATE UNIQUE INDEX IF NOT EXISTS uq_ledger_single_reversal
ON public.ledger_entries (reversal_of_entry_id)
WHERE reversal_of_entry_id IS NOT NULL AND entry_type = 'REVERSAL';

-- 9. Reversal foreign key constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_ledger_reversal_entry'
  ) THEN
    ALTER TABLE public.ledger_entries
    ADD CONSTRAINT fk_ledger_reversal_entry FOREIGN KEY (reversal_of_entry_id) REFERENCES public.ledger_entries(id);
  END IF;
END $$;

-- 10. Customer foreign key constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_ledger_customer'
  ) THEN
    ALTER TABLE public.ledger_entries
    ADD CONSTRAINT fk_ledger_customer FOREIGN KEY (customer_id) REFERENCES public.customers(id);
  END IF;
END $$;

-- 11. Market foreign key constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_ledger_market'
  ) THEN
    ALTER TABLE public.ledger_entries
    ADD CONSTRAINT fk_ledger_market FOREIGN KEY (market_id) REFERENCES public.markets(id);
  END IF;
END $$;
