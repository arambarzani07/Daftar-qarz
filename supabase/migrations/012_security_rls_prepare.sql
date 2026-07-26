-- Migration: 012_security_rls_prepare.sql
-- Description: Preparation of Row-Level Security (RLS) Policies for Multi-Tenant Defense

-- Enable RLS on all Tenant Tables
ALTER TABLE markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_credit_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_debt_controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE temporary_debt_unlocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_promises ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_auth_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Security Policy Helper Functions
CREATE OR REPLACE FUNCTION auth_user_has_market_access(target_market_id VARCHAR)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.market_memberships mm
    JOIN public.users u ON mm.user_id = u.id
    WHERE mm.market_id = target_market_id 
      AND u.auth_user_id = auth.uid()::text 
      AND u.is_active = true
      AND mm.status = 'ACTIVE'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION auth_user_has_market_role(target_market_id VARCHAR, allowed_roles VARCHAR[])
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.market_memberships mm
    JOIN public.users u ON mm.user_id = u.id
    WHERE mm.market_id = target_market_id 
      AND u.auth_user_id = auth.uid()::text 
      AND u.is_active = true
      AND mm.role = ANY(allowed_roles)
      AND mm.status = 'ACTIVE'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION auth_user_can_manage_customer_auth_links(target_market_id VARCHAR)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.market_memberships mm
    JOIN public.users u ON mm.user_id = u.id
    WHERE mm.market_id = target_market_id 
      AND u.auth_user_id = auth.uid()::text 
      AND u.is_active = true
      AND mm.status = 'ACTIVE'
      AND (
        mm.role = 'OWNER'
        OR (
          mm.role = 'MANAGER' AND (
            mm.permissions @> jsonb_build_array('can_manage_customer_auth_links')
            OR (mm.permissions->>'can_manage_customer_auth_links')::boolean = true
          )
        )
      )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Draft Policies for all Tenant Tables
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation_markets') THEN
        CREATE POLICY tenant_isolation_markets ON markets FOR SELECT USING (auth_user_has_market_access(id));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation_market_memberships') THEN
        CREATE POLICY tenant_isolation_market_memberships ON market_memberships FOR SELECT USING (auth_user_has_market_access(market_id));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation_customers') THEN
        CREATE POLICY tenant_isolation_customers ON customers FOR ALL USING (auth_user_has_market_access(market_id));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation_ledger') THEN
        CREATE POLICY tenant_isolation_ledger ON ledger_entries FOR ALL USING (auth_user_has_market_access(market_id));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation_balances') THEN
        CREATE POLICY tenant_isolation_balances ON customer_balances FOR ALL USING (auth_user_has_market_access(market_id));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation_credit_settings') THEN
        CREATE POLICY tenant_isolation_credit_settings ON customer_credit_settings FOR ALL USING (auth_user_has_market_access(market_id));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation_debt_controls') THEN
        CREATE POLICY tenant_isolation_debt_controls ON customer_debt_controls FOR ALL USING (auth_user_has_market_access(market_id));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation_temp_unlocks') THEN
        CREATE POLICY tenant_isolation_temp_unlocks ON temporary_debt_unlocks FOR ALL USING (auth_user_has_market_access(market_id));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation_approvals') THEN
        CREATE POLICY tenant_isolation_approvals ON approval_requests FOR ALL USING (auth_user_has_market_access(market_id));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation_promises') THEN
        CREATE POLICY tenant_isolation_promises ON payment_promises FOR ALL USING (auth_user_has_market_access(market_id));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation_reminders') THEN
        CREATE POLICY tenant_isolation_reminders ON customer_reminders FOR ALL USING (auth_user_has_market_access(market_id));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation_disputes') THEN
        CREATE POLICY tenant_isolation_disputes ON customer_disputes FOR ALL USING (auth_user_has_market_access(market_id));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation_attachments') THEN
        CREATE POLICY tenant_isolation_attachments ON customer_attachments FOR ALL USING (auth_user_has_market_access(market_id));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation_audit_logs') THEN
        CREATE POLICY tenant_isolation_audit_logs ON audit_logs FOR ALL USING (auth_user_has_market_access(market_id));
    END IF;

    -- Least-Privilege Policies for customer_auth_links
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'customer_auth_links_select') THEN
        CREATE POLICY customer_auth_links_select ON customer_auth_links FOR SELECT 
        USING (
            (auth_user_id = auth.uid()::text AND status = 'ACTIVE') 
            OR auth_user_can_manage_customer_auth_links(market_id)
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'customer_auth_links_insert') THEN
        CREATE POLICY customer_auth_links_insert ON customer_auth_links FOR INSERT 
        WITH CHECK (auth_user_can_manage_customer_auth_links(market_id));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'customer_auth_links_update') THEN
        CREATE POLICY customer_auth_links_update ON customer_auth_links FOR UPDATE 
        USING (auth_user_can_manage_customer_auth_links(market_id))
        WITH CHECK (auth_user_can_manage_customer_auth_links(market_id));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'customer_auth_links_delete') THEN
        CREATE POLICY customer_auth_links_delete ON customer_auth_links FOR DELETE 
        USING (false);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'users_self_select') THEN
        CREATE POLICY users_self_select ON users FOR SELECT 
        USING (auth_user_id = auth.uid()::text);
    END IF;
END $$;
