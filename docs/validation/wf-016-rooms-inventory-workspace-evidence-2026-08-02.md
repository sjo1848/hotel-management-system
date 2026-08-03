# WF-016 Rooms Inventory Workspace Evidence

## Scope

- Branch: `feature/wf-016-rooms-inventory-workspace`
- Base SHA: `25f447a`
- Implementation SHA before closeout: `143d5cd`
- Final SHA: `014c5e3`
- API v1/OpenAPI/RBAC canon: unchanged
- Backend Rust/migrations: unchanged

## Implemented

- Workspace tabs: Inventario, Disponibilidad, Planificador, Bloqueos.
- Inventory filtering, status chips, responsive detail, bulk validation and confirmation.
- Availability isolated from inventory counters and explicit search submission.
- Seven-day planner with bookings and holds, numeric room ordering, mobile day selector and no floor inference.
- Holds timeline with 31-day limit, room/type filters, loading and empty states.
- Mobile sheet focus restoration and accessible navigation.

## Validation

| Command | Result |
| --- | --- |
| `docker compose exec -T frontend npm run lint` | PASS |
| `docker compose exec -T frontend npm run test -- --run` | PASS, 41 files / 293 tests |
| `docker compose exec -T frontend npm run build` | PASS |
| `./scripts/check-openapi-alignment.sh` | PASS |
| `./scripts/qa-core-journeys.sh` | PASS |
| `./scripts/gate.sh` | PASS; business KPI runtime report contains a non-blocking data-quality FAIL while the gate command passed |
| `docker compose --profile qa run --rm playwright ... rooms-role-smoke` | 20/20 PASS across isolated and final reruns; one full-run mobile load was transient and passed on isolated rerun |

## E2E Coverage

`frontend/e2e/rooms-role-smoke.spec.ts` covers admin, ops and receptionist paths, lazy planner/holds requests, bulk validation, availability isolation, partial failures, Maintenance routing, keyboard tabs, 390px overflow, mobile planner and focus restoration.

The demo environment was reseeded with `./scripts/seed-demo-data.sh`. A stale maintenance-case foreign key required deleting the demo tenant's old `maintenance_cases` row before reseeding; no product schema or migration was changed.

## Review

- Critical: none found.
- High: none found.
- Medium: none found.
- Low: existing unrelated React `act(...)` warnings remain in dashboard/detail tests.
- Residual risk: Playwright login rate limiting requires cookie reuse within the worker; isolated retries are stable after backend restart.

## DoD

- [x] Responsive desktop/tablet/mobile workspace.
- [x] Capability-gated mutations and holds management.
- [x] Explicit confirmation for bulk status changes.
- [x] Partial-error resilience.
- [x] Unit/component coverage and E2E role smoke coverage.
- [x] Lint, build, contract and repository gates recorded.
- [x] No API v1, OpenAPI, RBAC canon, backend or migration changes.
