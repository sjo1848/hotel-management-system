# HMS Elite — Implementation Status

Last reviewed: **2026-08-21**

This document records the current repository state. `Implemented` means the repository contains code plus reviewable or executable evidence; it does not imply production certification or real-user adoption.

## Status legend

- **Implemented:** code and supporting evidence are present.
- **Partial:** implemented in part or dependent on an explicitly documented boundary.
- **Pending:** not yet available as current evidence.

## Product capabilities

| Capability | Status | Evidence / note |
|---|---|---|
| Authentication, refresh and logout | Implemented | Auth routes, session handling and security regressions |
| Rooms and availability | Implemented | Inventory, status changes, holds and availability flows |
| Guests and bookings | Implemented | API, application services, persistence and browser journeys |
| Reception lifecycle | Implemented | Reservation/walk-in → check-in → stay operations → checkout → room release |
| Room changes during active reservations | Implemented | Transactional reservation path and accepted reception flow |
| Housekeeping | Implemented | Dirty-room queue, cleaning transitions and room handoff |
| Users and capability-based RBAC | Implemented | Backend enforcement, frontend protection and drift checks |
| Billing, invoices and payments | Implemented | Charges, balances, invoice/payment flows and persistence |
| Cash closure | Implemented | Close-cash workflow and persistence |
| Occupancy/revenue reporting | Implemented | Reporting and analytics services plus UI surfaces |
| Multi-hotel administration | Implemented | Hotel-scoped data and network administration surfaces |
| Tenant isolation | Partial | Layered repository scoping, constraints and targeted RLS; RLS is not claimed for every tenant table |
| Audit events | Implemented | Persistence and tenant-scoped access |
| Verified product screenshots | Implemented | `docs/screenshots/` |
| Stable tagged snapshot | Implemented | `v0.1.0` |
| Public hosted demo | Pending | No public demonstration URL is linked yet |
| Real hotel-user validation | Pending | Requires representative operational use |

## Architecture and API

| Area | Status | Evidence / note |
|---|---|---|
| Modular monolith | Implemented | One deployable backend with internal boundaries |
| Domain/application/infrastructure separation | Implemented | `backend/src/domain`, `application`, `infrastructure` |
| PostgreSQL migrations | Implemented | Versioned migrations in `backend/migrations` |
| Versioned REST API | Implemented | `/api/v1` |
| OpenAPI contract | Implemented | `backend/openapi.yaml` plus alignment checks |
| Frontend feature organization | Implemented | React feature modules and centralized API handling |
| Deny-by-default protected routes | Implemented | Capability-based frontend guards |
| Architecture decision records | Implemented | `docs/adr/README.md` and individual ADRs |

## Quality assurance

| Gate | Status | Evidence / note |
|---|---|---|
| Rust format and Clippy | Implemented | Backend CI |
| Backend unit tests | Implemented | Rust test suites |
| PostgreSQL / SQLx integration | Implemented | Database-backed CI gate |
| Authentication / authorization regressions | Implemented | Security test suites |
| Tenant regression checks | Implemented | Scoped tenant/security tests and helper checks |
| Frontend type checks and tests | Implemented | CI frontend job |
| Production frontend build | Implemented | CI build gate |
| Browser E2E | Implemented | Playwright core journeys |
| Mobile reception lifecycle | Implemented | Browser journey checks at 375, 390 and 430 px plus human acceptance |
| Accessibility audit | Implemented | axe-core browser gate |
| Performance smoke baseline | Implemented | SLO-aware CI gate |
| Secret scanning | Implemented | Gitleaks |
| CI stability guard | Implemented | Required branch check |
| Representative-user usability validation | Pending | Needs operational user scenarios beyond development acceptance |

## Security controls

The repository includes password hashing, access/refresh session handling, capability authorization, CSRF checks, CORS controls, security headers, request-size limits, rate limiting, request IDs, audit events and environment security preflight checks.

Tenant protection is intentionally described as layered rather than absolute. Some tables use RLS while others rely on scoped repositories, tenant context and relational constraints. See [`docs/ops/threat-model.md`](ops/threat-model.md) and [`docs/ENGINEERING_CASE_STUDY.md`](ENGINEERING_CASE_STUDY.md) for the current boundary.

These controls are engineering evidence, not a penetration-test or compliance certification.

## Observability and operations

| Capability | Status | Evidence / note |
|---|---|---|
| Health and readiness | Implemented | `/health`, `/ready` |
| Prometheus metrics | Implemented | Backend metrics and monitoring configuration |
| Grafana dashboards | Implemented | `monitoring/` |
| Distributed tracing | Implemented | Tempo and OpenTelemetry configuration |
| Backup and restore tooling | Implemented | Operational scripts |
| Deploy/rollback tooling | Implemented | Deployment scripts |
| Production-profile validation | Implemented | Environment and readiness checks |
| Operator runbook | Implemented | `docs/ops/operator-runbook.md` |
| Public production environment | Pending | No environment is linked from the repository |

## Current limitations

- No public hosted demo is linked yet.
- Real hotel-user validation is still required.
- RLS does not cover every tenant-scoped table; the layered boundary is documented and tested where implemented.
- Production deployment requires environment-specific secret management, privacy, infrastructure and support decisions.
- Observability and operational tooling add maintenance cost and should not expand without a concrete operational need.

## Next product evidence

1. Publish a constrained demo environment once production infrastructure is ready.
2. Record a short end-to-end reception walkthrough using the same accepted workflow as the browser tests.
3. Validate the workflow with representative hotel users and record concrete findings.
4. Decide whether operational evidence justifies expanding database RLS coverage to additional tenant tables.
