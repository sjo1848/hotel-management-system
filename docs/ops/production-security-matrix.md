# Production security evidence matrix (provider-agnostic)

Status: audit evidence only. This document does not claim infrastructure,
provider, deployment, TLS, secret-store, backup, or network controls. Fixtures
and examples are synthetic; no production data is used.

## Scope and evidence rule

The audit covers every material table declared by `backend/migrations/*.sql`,
the capability source of truth in `docs/validation/rbac-canon-v1.json`, and the
existing authentication/CSRF/security regression tests. A control is marked
**PASS** only when a repository artifact directly demonstrates it. Application
query discipline is not treated as a substitute for database isolation.

## Tenant isolation matrix

| Table | Tenant key | Cross-tenant FK evidence | FORCE RLS + policy evidence | Existing automated evidence | Status / gap |
|---|---|---|---|---|---|
| `hotels` | — (tenant root) | n/a | No | Schema/migration inspection only | **GAP**: root access boundary is not policy-tested |
| `rooms` | `hotel_id` | `room_id` composite references in `0011` | Yes: `rooms_tenant_isolation` in `0030` | `tenant_rls_remaining.rs` policy/read/write/insert test (SQLx execution pending) | **PENDING**: runtime SQLx validation blocked when DB is unavailable |
| `guests` | `hotel_id` | `guest_id` composite reference in `0011` | Yes: `guests_tenant_isolation` in `0030` | `tenant_rls_remaining.rs` policy/read/write/insert test (SQLx execution pending) | **PENDING**: runtime SQLx validation blocked when DB is unavailable |
| `users` | `hotel_id` | composite references in `0011` | Yes: `users_tenant_isolation` | `tenant_rls_phase1.rs` read/write/insert; tenant FK tests | PASS for current policy scope |
| `refresh_tokens` | `hotel_id` | `user_id` and composite integrity | Yes: tenant policy + pre-auth lookup policy | `tenant_rls_phase1.rs`; auth/CSRF integration tests | PASS for current policy scope |
| `audit_events` | `hotel_id` | user composite reference in `0011` | Yes: `audit_events_tenant_isolation` in `0030` | Policy coverage in `tenant_rls_remaining.rs` (SQLx execution pending) | **PENDING**: runtime SQLx validation blocked; append-only evidence remains absent |
| `bookings` | `hotel_id` | room/guest/user composite references | Yes: `bookings_tenant_isolation` | `tenant_rls_phase1.rs`; booking integrity tests | PASS for current policy scope |
| `invoices` | `hotel_id` | booking composite reference | Yes: `invoices_tenant_isolation` | `tenant_rls_phase1.rs`; billing flow tests | PASS for current policy scope |
| `extra_charges` | `hotel_id` | booking reference is not evidenced as composite in migration history | Yes: `extra_charges_tenant_isolation` in `0030` | Policy coverage in `tenant_rls_remaining.rs` (SQLx execution pending) | **PENDING**: runtime SQLx validation blocked; composite FK evidence remains absent |
| `cash_closures` | `hotel_id` | user reference is not evidenced as composite in migration history | Yes: `cash_closures_tenant_isolation` in `0030` | Policy coverage in `tenant_rls_remaining.rs` (SQLx execution pending) | **PENDING**: runtime SQLx validation blocked; composite FK evidence remains absent |
| `room_holds` | `hotel_id` | room/user references are not evidenced as composite in migration history | Yes: `room_holds_tenant_isolation` in `0030` | Policy coverage in `tenant_rls_remaining.rs` (SQLx execution pending) | **PENDING**: runtime SQLx validation blocked; composite FK evidence remains absent |
| `payment_entries` | `hotel_id` | invoice/booking/user composite references in `0024` | Yes: `payment_entries_tenant_isolation` | Migration policy exists; no dedicated anti-escape test found | **PARTIAL**: add bounded read/write test before relying on it |
| `maintenance_cases` | `hotel_id` | room/user composite references in `0027` | Yes: `maintenance_cases_tenant_isolation` | Policy migration exists; current RLS test checks policy existence but not cross-tenant rows | **PARTIAL**: add bounded read/write test before relying on it |

### Interpretation

The existing `begin_tenant_tx(...)` and fail-closed tenant context reduce the
application-layer escape surface, while migrations `0015` and `0030` provide
database RLS coverage for the material tenant-bearing tables. The provider-
independent blocker remains open because runtime SQLx validation is pending,
`payment_entries` and `maintenance_cases` still lack bounded cross-tenant
read/write tests, and composite-FK and append-only evidence gaps remain as
listed above. This audit does not treat policy existence alone as runtime
isolation proof.

## RBAC capability matrix

Source: `docs/validation/rbac-canon-v1.json`; generated implementation:
`backend/src/infrastructure/web/middleware/rbac_generated.rs`. Unknown roles
deny by default. An empty cell means the capability is denied.

| Capability family | admin | saas_admin | ops | receptionist | housekeeping |
|---|:---:|:---:|:---:|:---:|:---:|
| Rooms read/search/write/status | ✓ |  | read/search/status | read/search |  |
| Bookings read/write/update | ✓ |  | ✓ | ✓ |  |
| Checkout override | ✓ |  |  |  |  |
| Extra charges read/write | ✓ |  | ✓ | ✓ |  |
| Guests read/write | ✓ |  | ✓ | ✓ |  |
| Housekeeping read/write | ✓ |  | ✓ |  | ✓ |
| Billing balance/invoice(s) read | ✓ |  | ✓ | balance + invoice |  |
| Cash close | ✓ |  | ✓ |  |  |
| Analytics KPIs | ✓ |  | ✓ |  |  |
| Reports revenue/occupancy | ✓ |  | ✓ |  |  |
| Audit events read | ✓ |  | ✓ |  |  |
| Users read/write/delete | ✓ |  |  |  |  |
| SaaS hotels read/write |  | ✓ |  |  |  |

Evidence already present:

- `backend/tests/rbac_authorization.rs` exercises the canonical role matrix,
  deny paths, checkout override, and tenant-user management rules.
- `backend/tests/csrf_authn_security.rs` covers refresh/logout CSRF enforcement,
  authentication, and token rotation behavior.
- `backend/src/infrastructure/web/middleware/rbac_generated.rs` returns false
  for unknown roles/capabilities.

## Provider-independent security gates

| Area | Evidence | Result |
|---|---|---|
| Auth/CSRF | `backend/tests/csrf_authn_security.rs` | Covered; run focused test |
| RBAC | canonical JSON + generated map + `rbac_authorization.rs` | Covered; run focused test |
| Tenant context | `tenant_context_runtime.rs`, `tenant_fk_integrity.rs` | Covered at application/FK layer |
| Database RLS | `tenant_rls_phase1.rs`, `tenant_rls_remaining.rs`, and migrations `0015`/`0030` | Partial; runtime SQLx validation is pending, and payment_entries/maintenance_cases cross-tenant tests plus FK/append-only gaps remain |
| CORS/cookie/security headers | `config.rs` unit tests and security-header tests | Preserved; no changes in this ticket |
| Secret defaults | existing security regression gate | Preserved; no infrastructure changes |

## Validation record

Commands to run from repository root:

```text
cargo test --manifest-path backend/Cargo.toml --test tenant_rls_phase1 --test rbac_authorization --test csrf_authn_security
./scripts/backend-security-regression.sh
./scripts/check-openapi-alignment.sh
```

Execution record for this workspace: the focused SQLx command was **FAIL**
because the test database hostname could not be resolved; the security
regression runner was **FAIL** because PostgreSQL rejected the configured
`admin` password (`28P01`). `./scripts/check-openapi-alignment.sh` was **PASS**
and `git diff --check` was **PASS**. These are environment/configuration
blockers for test execution, not evidence that the controls passed.

The unresolved provider-independent blocker is runtime SQLx validation of the
new `0030` policies while the test database is unavailable. Composite FK gaps
and append-only evidence noted above also remain open; infrastructure readiness
and provider-specific controls remain explicitly out of scope.
