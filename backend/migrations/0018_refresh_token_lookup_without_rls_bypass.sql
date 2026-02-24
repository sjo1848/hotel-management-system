-- HMS-SEC-011 final hardening:
-- remove runtime dependency on app.rls_bypass=true for pre-auth refresh token lookup.
-- The lookup is now constrained by token_hash session context.

CREATE OR REPLACE FUNCTION public.hms_refresh_token_hash()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    token_hash_value TEXT;
BEGIN
    token_hash_value := NULLIF(current_setting('app.refresh_token_hash', true), '');
    RETURN token_hash_value;
END;
$$;

ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE refresh_tokens FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS refresh_tokens_tenant_isolation ON refresh_tokens;
DROP POLICY IF EXISTS refresh_tokens_preauth_lookup ON refresh_tokens;

CREATE POLICY refresh_tokens_tenant_isolation
    ON refresh_tokens
    FOR ALL
    USING (hotel_id = public.hms_current_hotel_id())
    WITH CHECK (hotel_id = public.hms_current_hotel_id());

CREATE POLICY refresh_tokens_preauth_lookup
    ON refresh_tokens
    FOR SELECT
    USING (
        public.hms_refresh_token_hash() IS NOT NULL
        AND token_hash = public.hms_refresh_token_hash()
    );
