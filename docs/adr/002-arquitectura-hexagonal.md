# ADR-002: Backend Boundaries and Ports/Adapters

## Status

Accepted.

## Context

Hotel business rules should not depend directly on Axum handlers or PostgreSQL query details. Reservations, room transitions, billing and housekeeping also need to be testable independently from transport concerns.

## Decision

Structure the backend around explicit domain, application and infrastructure boundaries:

- **Domain:** business models, policies and repository/service contracts.
- **Application:** use cases and workflow orchestration.
- **Infrastructure:** PostgreSQL/SQLx repositories, HTTP handlers, authentication, telemetry and other adapters.

The architecture is implemented as a modular monolith; these boundaries do not imply separate deployable services.

## Consequences

### Benefits

- Domain and application rules remain less coupled to HTTP and persistence details.
- Repository and service contracts provide clear test seams.
- Infrastructure can evolve without moving business rules into adapters.

### Costs

- More interfaces/types than a small CRUD-oriented backend.
- Boundary discipline must be maintained as new features are added.
- Some cross-domain workflows intentionally coordinate multiple application services inside one deployment.

## Evidence

- `backend/src/domain`
- `backend/src/application`
- `backend/src/infrastructure`
