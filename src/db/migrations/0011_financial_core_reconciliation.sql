-- Migration 0011: Financial Core Reconciliation & Reversal Hardening
-- Description: Enforce strict canonical entry_type domain and composite reversal foreign key.

-- 1. Re-align entry_type domain: remove generic ADJUSTMENT, keep canonical types
ALTER TABLE public.ledger_entries DROP CONSTRAINT IF EXISTS ledger_entries_entry_type_check;
ALTER TABLE public.ledger_entries DROP CONSTRAINT IF EXISTS chk_ledger_entry_type_valid;

ALTER TABLE public.ledger_entries
  ADD CONSTRAINT chk_ledger_entry_type_valid 
  CHECK (entry_type IN (
    'DEBT_ADD', 
    'PAYMENT_RECEIVE', 
    'OPENING_BALANCE', 
    'FORGIVENESS', 
    'REVERSAL', 
    'ADJUSTMENT_DEBIT', 
    'ADJUSTMENT_CREDIT'
  ));

-- 2. Ensure composite unique constraint on (market_id, id) for ledger_entries
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_ledger_entries_market_id'
  ) THEN
    ALTER TABLE public.ledger_entries
      ADD CONSTRAINT uq_ledger_entries_market_id UNIQUE (market_id, id);
  END IF;
END $$;

-- 3. Re-enforce composite tenant-safe reversal FK constraint
ALTER TABLE public.ledger_entries DROP CONSTRAINT IF EXISTS fk_ledger_reversal_entry;

ALTER TABLE public.ledger_entries
  ADD CONSTRAINT fk_ledger_reversal_entry
  FOREIGN KEY (market_id, reversal_of_entry_id)
  REFERENCES public.ledger_entries(market_id, id)
  ON DELETE RESTRICT;

-- 4. Ensure uq_ledger_single_reversal index exists
CREATE UNIQUE INDEX IF NOT EXISTS uq_ledger_single_reversal
ON public.ledger_entries (reversal_of_entry_id)
WHERE reversal_of_entry_id IS NOT NULL;
