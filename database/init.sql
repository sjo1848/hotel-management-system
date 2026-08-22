-- Legacy bootstrap shim (psql):
-- Este archivo se mantiene solo por compatibilidad con flujos antiguos
-- que ejecutan `psql -f database/init.sql`.
--
-- Fuente de verdad del esquema:
--   backend/migrations/*.sql (aplicadas por sqlx::migrate! en runtime).
--
-- Regla:
--   NO agregar DDL directo acá.
--   Cualquier cambio de esquema debe ir a una nueva migración SQLx.

\echo '[hms] database/init.sql está en modo compatibilidad. Aplicando migraciones SQLx...'

\ir ../backend/migrations/0001_init.sql
\ir ../backend/migrations/0002_add_booking_status.sql
\ir ../backend/migrations/0003_add_booking_overlap_constraint.sql
\ir ../backend/migrations/0004_add_guest_id_to_bookings.sql
\ir ../backend/migrations/0005_create_invoices.sql
\ir ../backend/migrations/0006_analytics_indexes.sql
\ir ../backend/migrations/0007_enable_multi_tenancy.sql
\ir ../backend/migrations/0008_add_extra_charges.sql
\ir ../backend/migrations/0009_cash_closure_and_payments.sql
\ir ../backend/migrations/0010_tenant_constraints.sql
\ir ../backend/migrations/0011_tenant_fk_integrity.sql
\ir ../backend/migrations/0012_booking_availability_perf_indexes.sql
\ir ../backend/migrations/0013_refresh_session_hardening.sql
\ir ../backend/migrations/0014_tenant_query_tuning_indexes.sql
\ir ../backend/migrations/0015_rls_phase1_tenant_policies.sql
\ir ../backend/migrations/0016_keyset_pagination_indexes.sql
\ir ../backend/migrations/0017_rls_bypass_default_false.sql
\ir ../backend/migrations/0018_refresh_token_lookup_without_rls_bypass.sql
\ir ../backend/migrations/0019_hotel_plan_tier_and_automation_flags.sql
\ir ../backend/migrations/0020_room_holds.sql
\ir ../backend/migrations/0021_room_hold_types.sql
\ir ../backend/migrations/0022_booking_operational_fields.sql
\ir ../backend/migrations/0023_invoice_payment_settlement.sql
\ir ../backend/migrations/0024_payment_entries_and_cash_shift.sql
\ir ../backend/migrations/0025_cash_shift_handoff.sql
\ir ../backend/migrations/0026_booking_arrival_exceptions.sql
\ir ../backend/migrations/0027_maintenance_cases.sql
\ir ../backend/migrations/0028_maintenance_legacy_backfill.sql
\ir ../backend/migrations/0029_rename_default_hotel_to_viena.sql
\ir ../backend/migrations/0030_rls_remaining_tenant_tables.sql

\echo '[hms] migraciones SQLx aplicadas desde database/init.sql (compat shim).'
