-- HMS-SEC-T011: harden RLS bypass defaults.
-- Goal:
-- - deny-by-default when app.rls_bypass is not explicitly set.
-- - allow controlled bypass only through explicit runtime setter in repository helper.

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

