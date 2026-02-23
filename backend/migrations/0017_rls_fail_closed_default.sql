-- HMS-SEC-011B:
-- enforce fail-closed behavior when app.rls_bypass is not explicitly set.
-- previous phase allowed implicit bypass=true for rollout compatibility.

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
        RETURN false;
    END IF;
    RETURN bypass_value::BOOLEAN;
EXCEPTION
    WHEN invalid_text_representation THEN
        RETURN false;
END;
$$;
