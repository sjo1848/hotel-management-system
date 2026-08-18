# HMS-MOBILE-UX-PERF-001 — Human UX Acceptance Rework #1

current_status: CANDIDATE_READY_PENDING_CANONICAL_CI
branch: feature/mobile-ux-perf
scope: Lane A — Mobile Interaction / UX
write_scope: MOBILE-INTERACTION-CONTRACT.md; reservation, reception and check-in surfaces only

orchestration_mode: CALLABLE_MULTI_AGENT_LANES
base_sha: f61527051ff5f94229c79dc82753b80ed593fe1f

## Human Gate

- Architecture review approved by Sebastián; implementation may continue within the approved mobile-first scope.
- Desktop preservation, backend/API freeze and no new UI framework remain mandatory constraints.

## Implementation slice

| Lane | Scope | State | Result |
|---|---|---|---|
| Mobile shell | `DashboardLayout.tsx` mobile composition | COMPLETE | Frequent destinations first; secondary operations collapsed; desktop sidebar preserved |
| Reception | `BookingsPage.tsx` mobile header/actions | COMPLETE | Compact operational header; Nueva reserva primary; export/guide secondary; desktop branch preserved |
| Reservation | Walk-in selector/context preservation | COMPLETE | Selected guest remains visible outside filtered first results; existing task flow preserved |
| Integration | Tests, build and E2E | VALIDATED_LOCAL | Unit suite 49/322 PASS; Docker build PASS; reception smoke PASS except pre-existing billing lifecycle remains separate; focused mobile reservation PASS at 375/390/430 |

## Slice evidence

- `npm run lint`: PASS.
- `npm run test -- --run`: 49 files / 322 tests PASS.
- `docker compose exec -T frontend npm run build`: PASS.
- Focused Playwright reception reservation: PASS at 375/390/430 using host Chrome and synthetic data; menu samples recorded p50 286.3ms and requests 0 in the full smoke run.
- Full reception smoke: 7/8 passed in the first run; the reservation test became PASS after deterministic future-date fixtures and Review/focus assertions. Re-run focused PASS.
- Full guest lifecycle E2E: billing assertion remains an existing separate failure after the breakfast charge (`accountTotal` expectation); no billing code changed in this slice.
- Host Playwright direct run used `/tmp` output because Docker-owned `frontend/test-results` is not writable by the host user.

## Workers

| Worker | Scope | State | Result |
|---|---|---|---|
| Lane A | Interaction contract, Walk-in, reception, check-in | COMPLETE | Sequential mobile reservation flow; compact headers/footers; contextual help; desktop preserved |
| Lane A-Rework | Reservation/reception repair | COMPLETE | Real review summary, accessible progress, inline help, 44px CTAs |
| Lane B-Rework | Shared Radix primitives | COMPLETE | 44px Sheet close target and reduced-motion variants; no dependency changes |
| Lane C-Rework | Mobile check-in flow | COMPLETE | Four-step active-stage flow; desktop handlers and business rules preserved |
| Lane A-Rework-2 | Picker interaction | COMPLETE | Removed nested mobile Sheets; inline contained pickers with Escape/close and 44px controls |

## Critics

| Critic | Scope | Verdict | Material findings |
|---|---|---|---|
| UX Critic | Reservation, reception, check-in, interaction contract | REWORK | Review summary, nested picker risk, check-in landing, help row, touch targets |
| Performance Critic | Baseline protocol and claimed performance | REWORK | No measurable improvement yet; menu unchanged; missing task-surface timings |
| Component lane review | Sheet/Popover/Dropdown primitives | REWORK→REPAIRED | Reduced motion and close target repaired |
| UX Critic re-critique | Reservation/reception/check-in/component contract | REWORK | Nested Sheets and 40px help target; addressed in rework-2 |
| Performance Critic re-critique | Render tree and exact menu protocol | REWORK | Inactive mobile stages no longer mount; result inconclusive, not an improvement |

## Loops

| Lane | Cause | Rework count | Repair | Re-critique |
|---|---|---:|---|---|
| A | Human acceptance identified desktop-compressed mobile interaction | 2 | Added task flow, real review, inline help, compact operational surfaces | PASS after documentation rework |
| B | Critic found small touch targets and reduced-motion gap | 1 | Hardened shared Radix primitives without API/dependency changes | PASS after documentation rework |
| C | Check-in remained a long mobile landing | 1 | Added active-stage mobile check-in flow | PASS after documentation rework |
| A | Nested Sheets remained inside task Sheet | 1 | Replaced mobile pickers with inline contained regions | PASS after documentation rework |

## Integration

integration_status: PHASE_2_AUDIT_INTEGRATED
gaps_detected: UX friction reduction, focus return, physical-device comfort, and complete mobile workflows outside reception remain unvalidated; exact performance comparison remains INCONCLUSIVE/POSSIBLE_REGRESSION (268.7ms baseline vs 295.4ms prior post-change, same prior protocol)
final_verdict: READY_FOR_MOBILE_ARCHITECTURE_REVIEW

## Phase 1 stabilization evidence

- Desktop regression classified as IMPLEMENTATION_DEFECT: `mobileStep` controlled the desktop footer and hid the direct `Crear y gestionar` submit.
- Repair: desktop now renders the pre-existing direct submit footer; mobile alone renders the sequential footer.
- Local frontend: lint PASS; build PASS; unit tests PASS (49 files, 322 tests) on isolated rerun with two workers.
- Local backend: CI/unit PASS (70 unit + 5 OpenAPI contract tests); integration PASS when rerun isolated; security regression PASS; core journey QA PASS.
- Browser E2E: desktop guest lifecycle PASS with synthetic `admin`; mobile selection journey PASS at 375/390/430 with synthetic `recepcion_demo`.
- Fixture classification: running the desktop lifecycle with `recepcion_demo`, or the reception smoke with `admin`, fails only because those helpers assert the other role's expected landing route; tests were not changed.
- Concurrent runner failures were classified as ENVIRONMENT_DEFECT (Cargo/package/build lock contention), then cleared by isolated reruns.
- Canonical run `32075045526` exposed a TEST_DEFECT in the mobile lifecycle: it reused desktop selectors, did not advance mobile check-in stages, and reused same-day room inventory after the desktop journey. The test now follows the mobile picker/task surfaces, uses isolated future synthetic dates, and passes local at 375/390/430.
- Contract correction: `POST /api/v1/bookings` now returns documented `201 Created`; stale RBAC security expectation was aligned and passed.
- Canonical run `32079554969` at `5ff365b` passed Backend, Frontend, Secret Scanning, Performance Smoke, E2E core plus reception lifecycle at 375/390/430, and CI Stability Guard.

## Phase 2 audit lanes

| Lane | Scope | State | Output |
|---|---|---|---|
| Mobile UX Auditor | All mobile routes/surfaces and task friction | COMPLETE | Systemic gaps; reservation/check-in partial; other operational workflows unvalidated |
| Mobile Interaction Architect | Shell / task flows / temporary surfaces | COMPLETE | Three-level architecture; benefits marked proposed/unvalidated |
| Component / Design System Specialist | Radix/local components and shadcn matrix | COMPLETE | Targeted reuse/adapt/import-deferred/reject decisions |
| Performance Specialist | mounts, renders, requests, lists, interaction latency | COMPLETE | Menu 0 requests; global UI performance remains unvalidated risk |

## Phase 2 critics

| Critic | Scope | State | Verdict |
|---|---|---|---|
| UX Critic | systemic mobile interaction findings | COMPLETE | REWORK → documented: severities/evidence/focus and task metrics bounded |
| Technical / Design System Critic | dependencies, primitives, a11y, desktop risk | COMPLETE | REWORK → documented: ARIA, toast, AlertDialog deferred, desktop isolation |
| Product Workflow Critic | operational steps and cognitive load | COMPLETE | REWORK → documented: proven/partial/unknown and slice DoD |
| Final Integration Reviewer | all three artifacts, canonical state, orphan requirements | COMPLETE | REWORK → documented and rechecked |

## Human Gate

required: yes
reason: Sebastián must review the proposed mobile architecture and later perform UX acceptance on a phone; no technical coordination is required before that gate.

## Human UX Acceptance Rework continuation — 2026-08-18

### Workers

| worker_id | role / model policy | scope | status | result |
|---|---|---|---|---|
| `01a012a3-7961-7ae3-be5f-4b0f4533acdf` | Request verification / Luna LOW | Reception request storm | COMPLETE | Identified duplicate invalidate/refetch and parent/child refresh ownership |
| `01a012b1-f5cc-7212-aed6-dfe3a7d2ae1a` | Regression tests / Luna LOW | Booking A→B stale data | COMPLETE | Produced failing race tests before production repair |
| `01a012b9-4908-75b0-a355-58696164956d` | UX repair / Luna LOW | Picker close, resize and focus | COMPLETE | Accessible close and breakpoint behavior; later wiring reworked |
| `01a012b9-4c60-7573-96dd-a5ec8617b549` | Data/performance repair / Luna LOW | Billing guards and duplicate fetch | COMPLETE | Generation guards, same-booking fallbacks, single refresh owner |
| `01a012c3-ea01-77c3-9779-4ab4bdc4c59d` | Race repair / Luna LOW | Operational refresh A→B | COMPLETE | Current-booking guard plus deferred regression |
| `01a012c3-e633-7e72-9d7b-3482cc44d335` | Focus repair / Luna LOW | Real desktop focus target | COMPLETE | Separate mobile/desktop refs and integration test |

### Critics and loops

| lane | critic | rework_count | final state | material result |
|---|---|---:|---|---|
| Mobile UX / accessibility | `01a0127f-4d84-7042-8eb8-a28a48f1e5b4` / MEDIUM | 4 | PASS | Removed nested modal, separated close/menu/help, preserved focus across task exit and resize |
| Performance / stale data | `01a0127f-4e0e-70f0-8f67-20365fb35860` / MEDIUM | 3 | PASS | Removed request cascade and blocked late A responses from contaminating B |
| Final integration | `01a012cb-3e46-7261-a334-2bc8ccd1f1c5` / Terra MEDIUM | 0 | PASS | No orphan requirements or material regressions |

### Current evidence

- Frontend lint: PASS.
- Frontend unit/component: 54 files / 333 tests PASS.
- Frontend production build: PASS, 3666 modules.
- Reception lifecycle: desktop PASS; 375/390/430 PASS; final 390 rerun PASS.
- Reception smoke: 7 functional tests PASS; menu performance was flaky under suite load, isolated same-protocol sample PASS with 10 samples, p50 234.3 ms, p95 362.4 ms, requests 0. No performance improvement is claimed.
- Request cascade evidence: board reads 16 → 4; booking-list reads 24 → 11 in the dev runner; zero 429 after repair.
- Backend CI: 70 unit + 5 OpenAPI contract PASS.
- PostgreSQL integration, booking transactional integrity, tenant RLS/FKs, security regression and core journeys: PASS.
- Dependency triage: npm advisories are in the Vite/PostCSS/Rollup build toolchain; no runtime-reachable pilot exploit was established. Breaking mass upgrade deferred. `cargo-audit` is unavailable locally; canonical CI remains required.

integration_status: PASS_PENDING_CANONICAL_CI
open_gaps: candidate commit, PR #29 push, canonical Actions and Human Mobile Acceptance
human_gate_required: yes — Sebastián validates speed, clarity and comfort on a real phone after CI; no merge is authorized.
