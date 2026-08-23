# ADR-006: Tenant Isolation Strategy

## Status

Accepted and implemented as the current tenant-isolation architecture.

## Context

HMS Elite is a multi-hotel system using one PostgreSQL database and one shared schema. Tenant isolation therefore has to be enforced consistently across application access, relational integrity and database policy boundaries.

## Decision

HMS Elite uses **shared database + shared schema** with layered tenant isolation:

1. Tenant-scoped entities carry a required `hotel_id`.
2. Repository operations use explicit tenant context and tenant-scoped queries.
3. `begin_tenant_tx(...)` rejects a nil tenant and configures the PostgreSQL transaction with `app.current_hotel_id` / `app.hotel_id` while disabling RLS bypass.
4. Composite uniqueness and foreign keys prevent relationships from crossing hotel boundaries.
5. PostgreSQL RLS policies reinforce tenant isolation on core tenant-bearing tables.
6. The `hotels` table remains the tenant root and is intentionally handled separately from tenant-scoped child tables.

RLS rollout is represented by the actual migration history rather than a future phase plan:

- `0015_rls_phase1_tenant_policies.sql` establishes policies for users, bookings, refresh tokens and invoices;
- `0017_rls_bypass_default_false.sql` changes bypass behavior to fail closed by default;
- payment entries and maintenance cases define their policies in their creation/hardening migrations;
- `0030_rls_remaining_tenant_tables.sql` applies policies to rooms, guests, audit events, extra charges, cash closures and room holds.

## Security boundary

The frontend is not a tenant-security boundary. Tenant enforcement belongs to backend authorization, repository context, relational constraints and database policies.

RLS is also not treated as a substitute for scoped repository access or relational integrity. The layers are intentionally redundant because a PMS stores operational, financial and guest data whose cross-hotel leakage would be a high-impact defect.

## Guardrails

- No tenant-scoped repository operation without an explicit hotel context.
- No new tenant-bearing relationship without validating its cross-tenant integrity.
- RLS bypass must never be an implicit application default.
- Cross-tenant read/write behavior must remain covered by database-backed tests.
- RBAC and tenant isolation remain separate concerns: permission to perform an operation does not grant access to another hotel's data.

## Trade-offs

### Benefits

- Keeps one deployable database topology while adding defense in depth.
- Makes tenant context explicit in application transactions.
- Pushes cross-tenant protection into both schema constraints and database policy.
- Avoids schema-per-tenant and database-per-tenant migration/operations overhead.

### Costs

- Tenant-aware transactions and policies add database and debugging complexity.
- New tables and repository paths require explicit isolation review.
- RLS policies and tenant indexes must be included in performance testing as the schema evolves.

## Evidence

- Tenant context helper: `backend/src/infrastructure/repository/tenant_context.rs`
- Tenant constraints/FKs: `backend/migrations/0010_*`, `0011_*` and later domain migrations
- RLS migrations: `backend/migrations/0015_*`, `0017_*`, `0024_*`, `0027_*`, `0030_*`
- Database-backed isolation tests: `backend/tests/tenant_*`
- RBAC canon and drift checks: `docs/validation/rbac-canon-v1.json`, `scripts/check-rbac-canon.sh`
