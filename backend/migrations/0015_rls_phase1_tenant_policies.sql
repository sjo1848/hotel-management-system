-- HMS-SEC-T02: RLS phase 1 for critical tenant-scoped tables.
-- Fecha: 2026-02-14
-- Alcance: users, bookings, refresh_tokens, invoices.
--
-- Tradeoff de rollout:
-- - app.rls_bypass=true (default) mantiene compatibilidad con runtime actual.
-- - para enforcement real por tenant: app.rls_bypass=false + app.current_hotel_id=<uuid>.

CREATE OR REPLACE FUNCTION public.hms_current_hotel_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    tenant_value TEXT;
BEGIN
    tenant_value := COALESCE(
        NULLIF(current_setting('app.current_hotel_id', true), ''),
        NULLIF(current_setting('app.hotel_id', true), '')
    );
    IF tenant_value IS NULL THEN
        RETURN NULL;
    END IF;
    RETURN tenant_value::UUID;
EXCEPTION
    WHEN invalid_text_representation THEN
        RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.hms_rls_bypass_enabled()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    bypass_value TEXT;
BEGIN
    bypass_value := NULLIF(current_setting('app.rls_bypass', true), '');
    IF bypass_value IS NULL THEN
        RETURN true;
    END IF;
    RETURN bypass_value::BOOLEAN;
EXCEPTION
    WHEN invalid_text_representation THEN
        RETURN true;
END;
$$;

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS users_tenant_isolation ON users;
CREATE POLICY users_tenant_isolation
    ON users
    USING (
        public.hms_rls_bypass_enabled()
        OR hotel_id = public.hms_current_hotel_id()
    )
    WITH CHECK (
        public.hms_rls_bypass_enabled()
        OR hotel_id = public.hms_current_hotel_id()
    );

ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS bookings_tenant_isolation ON bookings;
CREATE POLICY bookings_tenant_isolation
    ON bookings
    USING (
        public.hms_rls_bypass_enabled()
        OR hotel_id = public.hms_current_hotel_id()
    )
    WITH CHECK (
        public.hms_rls_bypass_enabled()
        OR hotel_id = public.hms_current_hotel_id()
    );

ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE refresh_tokens FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS refresh_tokens_tenant_isolation ON refresh_tokens;
CREATE POLICY refresh_tokens_tenant_isolation
    ON refresh_tokens
    USING (
        public.hms_rls_bypass_enabled()
        OR hotel_id = public.hms_current_hotel_id()
    )
    WITH CHECK (
        public.hms_rls_bypass_enabled()
        OR hotel_id = public.hms_current_hotel_id()
    );

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS invoices_tenant_isolation ON invoices;
CREATE POLICY invoices_tenant_isolation
    ON invoices
    USING (
        public.hms_rls_bypass_enabled()
        OR hotel_id = public.hms_current_hotel_id()
    )
    WITH CHECK (
        public.hms_rls_bypass_enabled()
        OR hotel_id = public.hms_current_hotel_id()
    );
