# Architecture Decision Records — HMS Elite

The ADRs capture current architectural decisions and their trade-offs. Historical implementation plans and superseded decision notes are not kept in this index.

| ADR | Decision | Area |
|---|---|---|
| [ADR-001](001-rust-axum.md) | Rust + Axum backend | Backend stack |
| [ADR-002](002-arquitectura-hexagonal.md) | Hexagonal/modular backend boundaries | Architecture |
| [ADR-003](003-auth-strategy.md) | Browser authentication and CSRF strategy | Security |
| [ADR-005](0005-operational-lifecycle-hardening.md) | Operational lifecycle hardening | Domain |
| [ADR-006](0006-tenant-isolation-strategy.md) | Layered tenant isolation | Multi-tenancy / security |
| [ADR-0002](ADR-0002-api-lifecycle.md) | API lifecycle and contractual governance | API |
| [ADR-0007](ADR-0007-mobile-composition.md) | Mobile task composition | Frontend / UX architecture |

## Convention

New ADRs use `ADR-00XX-<slug>.md`. Existing filenames are preserved to avoid unnecessary churn in historical links.

A decision remains in this directory only while it describes the current architecture or a deliberate long-lived constraint. Superseded planning documents should be removed or replaced by the decision that actually governs `main`.
