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

\echo '[hms] migraciones SQLx aplicadas desde database/init.sql (compat shim).'
