-- HMS-SEC-T12: close the remaining tenant-table database isolation gaps.
-- hotels remains the tenant root and intentionally has no tenant policy.

DO $$
DECLARE
    tenant_table TEXT;
BEGIN
    FOREACH tenant_table IN ARRAY ARRAY[
        'rooms', 'guests', 'audit_events', 'extra_charges', 'cash_closures', 'room_holds'
    ] LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tenant_table);
        EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tenant_table);
        EXECUTE format(
            'DROP POLICY IF EXISTS %I ON %I',
            tenant_table || '_tenant_isolation', tenant_table
        );
        EXECUTE format(
            'CREATE POLICY %I ON %I
             USING (public.hms_rls_bypass_enabled()
                    OR hotel_id = public.hms_current_hotel_id())
             WITH CHECK (public.hms_rls_bypass_enabled()
                         OR hotel_id = public.hms_current_hotel_id())',
            tenant_table || '_tenant_isolation', tenant_table
        );
    END LOOP;
END $$;
