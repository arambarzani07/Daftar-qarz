-- Migration 0013: Ledger Immutability Trigger and Database Row-Level Security (RLS) Policies

-- 1. Ledger Immutability Trigger
CREATE OR REPLACE FUNCTION public.prevent_ledger_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Ledger entries are immutable and cannot be updated or deleted.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_ledger_modification ON public.ledger_entries;

CREATE TRIGGER trg_prevent_ledger_modification
BEFORE UPDATE OR DELETE ON public.ledger_entries
FOR EACH ROW
EXECUTE FUNCTION public.prevent_ledger_modification();


-- 2. Tenant Database Row Level Security (RLS) Enablement & Policies
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_promises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recovery_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recovery_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_credit_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_debt_controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_share_links ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY[
    'customers', 'ledger_entries', 'customer_balances', 'customer_disputes', 
    'payment_promises', 'customer_attachments', 'recovery_cases', 'recovery_activities', 
    'audit_logs', 'market_memberships', 'customer_credit_settings', 'customer_debt_controls',
    'approval_requests', 'customer_reminders', 'customer_share_links'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_%I ON public.%I;', tbl, tbl);
    EXECUTE format('
      CREATE POLICY tenant_isolation_%I ON public.%I
      FOR ALL
      USING (
        current_setting(''app.current_market_id'', true) IS NULL
        OR current_setting(''app.current_market_id'', true) = ''''
        OR current_setting(''app.current_market_id'', true) = ''SYSTEM_GLOBAL''
        OR market_id = current_setting(''app.current_market_id'', true)
      )
      WITH CHECK (
        current_setting(''app.current_market_id'', true) IS NULL
        OR current_setting(''app.current_market_id'', true) = ''''
        OR current_setting(''app.current_market_id'', true) = ''SYSTEM_GLOBAL''
        OR market_id = current_setting(''app.current_market_id'', true)
      );
    ', tbl, tbl);
  END LOOP;
END $$;
