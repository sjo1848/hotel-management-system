# WF-018 Housekeeping Shift Workspace Evidence

## Scope

- Branch: `feature/wf-018-housekeeping-shift-workspace`
- Base SHA: `424689b`
- Final implementation commit: `7721d21`
- Backend, API v1, OpenAPI, migrations and RBAC canon: unchanged
- Excluded: assignment entities, SLA/checklists, photos, chat, bulk actions, drag/drop, realtime and new APIs

## Implementation

- Replaced the long Housekeeping landing page with a compact shift queue and progressive room detail.
- Added `buildHousekeepingQueue`, operational local date handling, priority ordering, translated search and orphan-departure exceptions.
- Added exact filters: Turno, Por limpiar, En limpieza, Listas and Mantenimiento.
- Integrated turnover/departure context, checked-in blockers and maintenance priority without changing API enums.
- Moved room actions and `MaintenanceCaseActions` into the selected-room detail; rows contain no forms.
- Added per-room mutation loading and duplicate-submit protection.
- Preserved guided mode state and made guide CTAs select filters/rooms without invoking APIs.
- Added mobile bottom-sheet detail behavior with close/focus restoration and desktop inline detail.

## Acceptance Criteria

| Criteria | Result |
| --- | --- |
| AC-01..AC-10: default/filter/count/queue order/legacy/search/Spanish copy | PASS |
| AC-11..AC-18: responsive list/detail and valid transitions | PASS |
| AC-19..AC-23: capability gating, loading, success/error and refresh | PASS |
| AC-24..AC-30: guided navigation, no automatic mutations, persistence and single toggle | PASS |
| AC-31..AC-34: maintenance validation, resolution and legacy case handling | PASS |
| AC-35..AC-40: orphan departure, operational date, retry/loading/empty states | PASS |
| AC-41..AC-48: read-only behavior, RBAC route, responsive/accessibility/focus | PASS in automated coverage; manual visual review remains recommended |
| AC-49..AC-51: no dependencies/API changes and validation gates | PASS |

## Validation

| Command | Result |
| --- | --- |
| `docker compose exec -T frontend npm run lint` | PASS |
| `docker compose exec -T frontend npm run test -- --run` | PASS, 48 files / 319 tests |
| Focused Housekeeping tests | PASS, 6 files / 21 tests including guide and maintenance regression |
| `docker compose exec -T frontend npm run build` | PASS |
| `E2E_USERNAME=housekeeping_demo E2E_PASSWORD=demo2026pass docker compose --profile qa run --rm playwright npx playwright test e2e/housekeeping-role-smoke.spec.ts --retries 0 --workers 1` | PASS, 4/4 |
| `./scripts/check-openapi-alignment.sh` | PASS |
| `./scripts/qa-core-journeys.sh` | PASS |
| `./scripts/gate.sh` | PASS; its business KPI runtime subcheck reports the existing non-blocking feature-flags data-quality FAIL while the gate exits successfully |
| `git diff --check` | PASS |

## Security and Review

- Critical: none found.
- High: none found.
- Medium: none found.
- Low: existing unrelated React `act(...)` warnings remain in Rooms/Dashboard tests.
- Mutations are rendered only for `housekeeping.write`; backend remains authoritative.
- Maintenance always resolves through the existing return-to-Dirty endpoint; no direct Available transition exists.
- Orphan departures are visible as review-only exceptions and never receive invented room actions.
- Search is local and does not send terms to telemetry.
- No guest data was added outside the existing board payload.

## DoD

- [x] Gate 0 branch created from clean `424689b`.
- [x] Compact queue and progressive detail implemented.
- [x] All five filters and priority ordering implemented.
- [x] Turnover, blockers and orphan departures represented.
- [x] Dirty/Cleaning/Maintenance transitions constrained.
- [x] Maintenance form moved out of queue rows.
- [x] Per-room loading and retry/error behavior preserved.
- [x] Guided mode reused without automatic mutations.
- [x] Mobile sheet, desktop detail, keyboard targets and focus return covered.
- [x] Existing maintenance and guided tests retained.
- [x] Frontend, E2E, contract, core journey and repository gates executed.
