# HMS Elite Changelog

This changelog records public release-level product and engineering changes. Internal task IDs, orchestration history and implementation notes are intentionally excluded.

## 0.1.0 — 2026-08-03

### Product

- Reception workspace with reservation, check-in and checkout flows.
- Operations dashboard with occupancy, arrivals, departures and revenue indicators.
- Room inventory with operational states and transitions.
- Reservation calendar and planning board.
- Housekeeping workflow with cleaning states and maintenance context.
- Guest, billing, reporting, user/RBAC and multi-hotel administration surfaces.

### Engineering

- Rust/Axum backend with PostgreSQL/SQLx persistence and versioned migrations.
- React + TypeScript frontend with feature-oriented organization.
- Versioned `/api/v1` contract with OpenAPI governance.
- Capability-based authorization and tenant-scoped data controls.
- Full-stack CI covering backend, frontend, browser journeys, security checks and performance smoke tests.
- Docker-based local runtime and operational tooling for health, backup, restore and rollback procedures.

Subsequent changes on `main` continue to be validated by the repository CI; release entries are added here when a public release is cut.
