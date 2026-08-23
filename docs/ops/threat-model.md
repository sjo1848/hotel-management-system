# Threat Model — HMS Elite

This document summarizes the application-level security boundary implemented in the repository. It is an engineering threat model, not a penetration-test or compliance certification.

## Scope

HMS Elite is a multi-hotel PMS with a Rust/Axum backend, React/TypeScript frontend and PostgreSQL persistence.

Primary assets include:

- guest identity/contact data;
- reservations and room inventory;
- invoices, payments and cash activity;
- operator accounts, sessions and capabilities;
- audit and operational events.

Primary entry points are the browser application and the versioned `/api/v1` HTTP API.

## Security boundaries

### Authentication

Browser authentication uses HttpOnly cookies, refresh-session handling and CSRF validation. Environment-specific cookie/CORS settings are validated before non-local operation.

Evidence:

- `docs/adr/003-auth-strategy.md`
- `backend/tests/csrf_authn_security.rs`
- `scripts/validate-env-profile.sh`

### Authorization

Protected actions are capability based. The backend is the authorization boundary; frontend route/action hiding is usability support rather than the security control.

The capability canon is stored in `docs/validation/rbac-canon-v1.json`, with generated frontend/backend representations and drift checks in CI.

### Tenant isolation

Tenant isolation is layered:

- required `hotel_id` on tenant-bearing entities;
- tenant-aware repository transactions;
- composite constraints and foreign keys;
- PostgreSQL RLS policies across core tenant tables;
- database-backed isolation tests.

`begin_tenant_tx(...)` configures the transaction tenant and disables RLS bypass. The `hotels` table is the tenant root and is handled separately from tenant-scoped child data.

See [`../adr/0006-tenant-isolation-strategy.md`](../adr/0006-tenant-isolation-strategy.md).

### Input and request controls

The backend applies typed request validation, request-size/configuration controls, explicit CORS, security headers, rate limiting and structured request IDs. Stable error semantics are governed through [`../errors/error-codes-v1.md`](../errors/error-codes-v1.md).

## Representative threats

| Threat | Primary control | Residual risk |
|---|---|---|
| Credential/session theft | HttpOnly cookies, refresh handling, secure profile validation | Browser/device compromise remains outside the application boundary |
| CSRF on state-changing requests | CSRF token validation + cookie policy | Misconfigured origins/cookies can weaken the boundary |
| Privilege escalation | Capability authorization + RBAC canon + regression tests | New routes require capability enforcement and drift validation |
| Cross-hotel data access | Tenant context + scoped repositories + composite FKs + RLS | New tables/queries must preserve the same isolation contract |
| Booking/billing tampering | AuthZ + transactional application services + tenant constraints | Application bugs can still violate business invariants without regression coverage |
| Brute force / request abuse | Authentication/general rate limiting | In-process limits do not replace infrastructure-level traffic controls at larger scale |
| Sensitive data in logs | Structured logging and scoped operational telemetry | Logging changes must avoid request bodies or unnecessary guest/session data |
| Repudiation of operational actions | Audit events and request identity context | Audit integrity depends on database and deployment access controls |

## Security testing

Repository evidence includes:

- authentication and CSRF regression tests;
- RBAC authorization tests;
- tenant context, relational-integrity and RLS tests;
- environment-profile security checks;
- secret scanning in GitHub Actions;
- browser E2E for protected operational journeys.

The main CI pipeline is the canonical automated gate for these controls.

## Deployment boundary

Host/network TLS termination, infrastructure firewalling, secret storage, off-host backup storage and organization-specific privacy/compliance controls are deployment concerns. The repository provides application/runtime hooks and provider-independent operational procedures without claiming those external controls as implemented by the application itself.
