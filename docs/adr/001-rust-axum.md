# ADR-001: Rust and Axum for the Backend

## Status

Accepted.

## Context

HMS Elite needs predictable server behavior, strong type safety and explicit control over concurrent database-backed workflows. The backend also benefits from an ecosystem that integrates cleanly with async I/O, middleware and PostgreSQL.

## Decision

Use **Rust** with **Axum/Tokio** for the backend API.

Reasons:

- Rust provides compile-time memory and type safety without a garbage collector.
- Tokio/Axum provide an async HTTP stack built around composable `tower` middleware.
- SQLx integrates PostgreSQL access with Rust types and async execution.
- The stack supports the repository's modular domain/application/infrastructure separation without requiring a distributed architecture.

## Consequences

### Benefits

- Strong compile-time guarantees around application code and data handling.
- Predictable runtime characteristics for API and workflow execution.
- Good fit for explicit middleware, tracing and database integration.

### Costs

- Higher learning curve than many dynamic-language web stacks.
- More explicit type/model work at API and persistence boundaries.
- Compile times and Rust-specific tooling become part of the development/CI cost.

## Evidence

- `backend/Cargo.toml`
- `backend/src`
- `.github/workflows/full-stack-ci.yml`
