# WF-017 Calendar Planning Board Evidence

## Scope

- Branch: `feature/wf-017-calendar-planning-board`
- Base SHA: `d9020b6`
- Final SHA: `2a0f5d8`
- API v1, OpenAPI, RBAC canon and backend: unchanged
- Scope excludes drag/drop, booking creation from empty cells, hold editing, monthly view and realtime

## Implementation

- `CalendarPage` owns the rooms, bookings and holds queries with exact range keys.
- `calendarModel` uses semi-open intervals, indexed allocations and explicit conflicts.
- `CalendarTimeline` provides semantic headers, sticky room column, keyboard-operable bars, holds and current room status.
- `CalendarAgenda` provides the mobile/day presentation from the same derived model.
- Booking detail reuses `BookingDetailsSheet`; hold/context panels remain read-only.
- Partial bookings/holds errors preserve the remaining data and expose local retry.

## Validation

| Command | Result |
| --- | --- |
| `docker compose exec -T frontend npm run lint` | PASS |
| `docker compose exec -T frontend npm run test -- --run` | PASS, 45 files / 310 tests |
| `docker compose exec -T frontend npm run build` | PASS |
| `docker compose --profile qa run --rm playwright ... calendar-role-smoke.spec.ts` | PASS, 22/22 scenarios |
| `./scripts/check-openapi-alignment.sh` | PASS |
| `./scripts/qa-core-journeys.sh` | PASS |
| `./scripts/gate.sh` | PASS; business KPI runtime report contains the existing non-blocking data-quality FAIL while the gate command passed |

## Coverage

- Range navigation: previous, next, today and 7/14/30 days.
- Desktop Timeline and mobile Agenda.
- Checkout-exclusive occupancy, cancelled/no-show filtering, holds and booking/hold conflicts.
- Search and conflict/out-of-service filters with clear action.
- Booking detail permissions and focus restoration.
- Housekeeping route protection and receptionist read access.
- Partial bookings/holds errors, retry, keyboard operation and overflow at 390/768/1024/1280/1440.

## Review

- Critical: none found.
- High: none found.
- Medium: none found.
- Low: existing unrelated `act(...)` warnings in prior detail/dashboard tests remain.
- Residual risk: the E2E harness reuses auth cookies because the backend login rate limiter intentionally limits repeated login attempts.

## DoD

- [x] Gate 0 and dedicated feature branch.
- [x] Single source of rooms/bookings/holds data.
- [x] Functional temporal navigation and 7/14/30 ranges.
- [x] Timeline and Agenda presentations.
- [x] Semi-open temporal semantics and indexed model.
- [x] Conflicts and read-only holds.
- [x] Shared booking detail.
- [x] Partial errors and retries.
- [x] RBAC preserved; no API/RBAC changes.
- [x] Mobile overflow and keyboard coverage.
- [x] Frontend tests, lint, build, E2E and repository gates.
