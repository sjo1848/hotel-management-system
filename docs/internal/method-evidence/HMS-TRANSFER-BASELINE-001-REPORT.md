# HMS-TRANSFER-BASELINE-001

**Task:** HMS-TRANSFER-BASELINE-001  
**Fecha de auditoría:** 2026-08-15  
**Repositorio canónico:** `sjo1848/hotel-management-system`  
**Alcance:** auditoría brownfield read-only. No se implementaron fixes, no se mergearon PRs y no se hizo deploy.

## 1. Executive Diagnosis

### FACT

- El producto tiene una base técnica real: backend Rust/Axum/SQLx, frontend React/TypeScript/Vite, API v1, migraciones PostgreSQL, RBAC por capabilities, tests unitarios/integración y tooling operativo.
- `origin/main` es `de805aa99ec5c4a324db47c87ab0d0e56b291709`.
- El checkout está en `fix/mobile-checkin-layout` (`7813ee0e739d7df8d2120c6fff9e74518809ab1c`) y conserva dos modificaciones locales no commiteadas en specs E2E.
- El backend fast gate pasó: fmt, clippy, 70 unit tests y 5 contract tests OpenAPI.
- Los gates de alineación OpenAPI, RBAC canon/drift, tenant-helper y perfiles de entorno pasaron.
- El frontend no pudo ejecutarse en este entorno porque no están instaladas las dependencias (`tsc: not found`, `vitest: not found`).
- El gate de integración no pudo ejecutarse porque el runner host no tiene `psql`; el security regression no produjo evidencia válida y expiró por timeout en ese entorno.
- El PR #27 tiene 14/15 E2E pasantes y falla el journey completo de huésped en una expectativa UI; está `OPEN` y `UNSTABLE`. El PR #26 también está `OPEN` y `UNSTABLE`.
- La RLS existente es explícitamente “phase 1” y cubre `users`, `bookings`, `refresh_tokens` e `invoices`; otras tablas dependen de helper/contexto y constraints.

### INFERENCE

HMS es portfolio-grade y técnicamente prometedor, pero no hay evidencia suficiente para considerarlo listo para un piloto con usuarios y datos reales. El principal riesgo no es la ausencia de módulos: es la distancia entre código/gates parciales y una prueba completa de workflows reales, superficies mobile, integración de base de datos y operación canónica.

### RECOMMENDATION

La próxima fase debe cerrar evidencia de un único slice operativo —recepción completo con checkout y handoff de habitación— sobre `main`, con frontend E2E reproducible, integración PostgreSQL y revisión explícita de límites de tenant. No conviene iniciar un rewrite ni ampliar arquitectura.

## 2. Canonical Repository State

| Campo | Evidencia | Estado |
|---|---|---|
| Repository | `gh repo view`; `sjo1848/hotel-management-system` | FACT: canónico, público |
| Default branch | GitHub metadata | FACT: `main` |
| Local branch | `git branch --show-current` | FACT: `fix/mobile-checkin-layout` |
| Local HEAD | `git rev-parse HEAD` | FACT: `7813ee0...` |
| `origin/main` | `git rev-parse origin/main` | FACT: `de805aa...` |
| Working tree | `git status --short` | FACT: modified `frontend/e2e/guest-lifecycle.spec.ts` y `frontend/e2e/reception-role-smoke.spec.ts`; sin untracked files |
| Branch relation | `git rev-list --left-right --count HEAD...origin/fix/mobile-checkin-layout` | FACT: alineada con su remoto; la rama contiene 2 commits sobre `origin/main` |
| Open PRs | `gh pr list --state open` | FACT: #27 y #26 |
| Recent main CI | `gh run list --branch main --limit 20` | FACT: último `full-stack-ci` falló con backend PASS y jobs restantes cancelados; último deploy workflow falló sin jobs/log disponible |
| Local work preservation | status/diff inspection | FACT: no se borró ni sobrescribió trabajo previo |

El baseline de producto se interpreta contra `origin/main` cuando corresponde. Los cambios de PR #27 y las modificaciones locales se reportan como delta y no como evidencia de `main`.

## 3. Architecture Reality

### FACT

- El backend está organizado en `domain`, `application`, `infrastructure/repository` e `infrastructure/web`, con servicios separados para auth, bookings, front desk, billing, invoices, cash closure, housekeeping, rooms, users, guests, audit, analytics y reporting.
- La API se monta bajo `/api/v1` en `backend/src/infrastructure/web/routes/mod.rs`.
- El frontend tiene rutas para login, dashboard, recepción/bookings, rooms, calendar, guests, housekeeping, users, network y reports en `frontend/src/App.tsx` y navegación role-aware en `DashboardLayout.tsx`.
- Existen 29 migraciones (`0001`–`0029`) y `database/init.sql` las encadena.
- Hay `docs/adr`, threat model, operator runbook, workflow docs, OpenAPI y scripts de gates.

### INFERENCE

La arquitectura hexagonal está suficientemente representada para el alcance actual. La complejidad principal está concentrada en el dominio operativo y la validación de tenant, no en una fragmentación de servicios.

## 4. Product Capability Matrix

| Requirement / Workflow | Expected Surface | Current Evidence | Gap | Classification |
|---|---|---|---|---|
| Authentication/session | UI login + API + cookies/refresh + CSRF | `LoginPage.tsx`; auth handlers; refresh rotation in `auth_service.rs`; `csrf_authn_security.rs`; 70 unit tests | No successful DB-backed security run in this environment; no real-user acceptance | TECHNICALLY_PROVEN |
| Reception/front desk | Reception workspace, booking board, arrival exceptions | `ReceptionWorkspace.tsx`; front desk routes; `core-journeys.spec.ts`; role smoke specs | Full browser run not reproducible locally; current PR E2E failure | PARTIALLY_PROVEN |
| Walk-in/booking/guest/room | Walk-in sheet, guest form, room selection, booking API | `WalkInBookingSheet.tsx`; booking/guest/room handlers; `booking_flow.rs`; frontend component tests | Complete UI journey needs green browser evidence on canonical commit | PARTIALLY_PROVEN |
| Check-in | Operational checklist + booking transition + audit | `BookingCheckInSection.tsx`; transactional service; `booking_transactional_integrity.rs` | Integration gate unavailable locally; mobile completion not proven | PARTIALLY_PROVEN |
| Charges/invoice/payment | Billing tabs, invoice/payment API, settlement | billing/invoice/payment services; migrations `0005`, `0008`, `0009`, `0023`, `0024`; financial tests | No DB-backed execution in this audit; real payment/accounting acceptance absent | TECHNICALLY_PROVEN |
| Check-out/room release | Checkout checklist, payment policy, housekeeping handoff | `BookingCheckOutSection.tsx`; transactional integrity tests; guest lifecycle E2E | PR #27 fails before completing this browser journey | UX_RISK |
| Rooms/inventory/holds | Rooms workspace, availability, holds, status transitions | `RoomsPage.tsx`; room/hold routes; room management tests; role E2E source | Browser evidence unavailable in this run | PARTIALLY_PROVEN |
| Housekeeping | Dirty → cleaning → available/maintenance | `HousekeepingPage.tsx`; housekeeping service/routes; `maintenance_workflow.rs`; housekeeping E2E source | No successful integration/browser run in this audit | PARTIALLY_PROVEN |
| Users/RBAC | Role-specific navigation and capability enforcement | generated RBAC canon; `rbac_authorization.rs`; DashboardLayout guards; RBAC gates PASS | No live role journey run in this environment | TECHNICALLY_PROVEN |
| Billing/cash closure | Cash balance, close sheet, handoff | dashboard cash components; cash closure service; `cash_shift_handoff.rs`; dashboard E2E source | Real operational reconciliation and DB execution not proven | PARTIALLY_PROVEN |
| Analytics/reports | Dashboard KPIs and revenue/occupancy reports | analytics/reporting services, routes, `analytics_flow.rs`, ReportsPage | No browser or production-data validation | TECHNICALLY_PROVEN |
| Audit trail | API read + persisted audit events | audit repository/service, audit route, migrations, tests and runbook | Immutability/retention/operational review not proven | PARTIALLY_PROVEN |
| Multi-hotel/network | Platform network UI + hotel plan operations | hotel routes/service, `/network`, `saas_admin` capability tests | Cross-tenant end-to-end execution unavailable; RLS coverage partial | SECURITY_RISK |
| API v1 contract | Routes, DTOs, error contract, OpenAPI mirror | alignment gate PASS; 5 `openapi_contract` tests PASS; `backend/openapi.yaml` equals `docs/openapi.yaml` | Generated client/frontend runtime not independently exercised here | TECHNICALLY_PROVEN |

## 5. Critical User Journeys

| Journey | Expected Surface | Implementation | Evidence | Gap | Classification |
|---|---|---|---|---|---|
| Reception: login → walk-in → guest → room → check-in → charge/payment → checkout → release | Desktop and mobile reception workspace, sheets/drawers, API/storage/audit | Front desk, walk-in, booking operational sections, billing and transactional services | Backend unit/contract PASS; `booking_transactional_integrity.rs`; `guest-lifecycle.spec.ts`; PR #27 run: 14 pass, 1 fail at `guest-lifecycle.spec.ts:76` because expected blocking copy is no longer visible after “Crear y gestionar” | End-to-end browser completion is not green; local replacement test is uncommitted and unverified | PARTIALLY_PROVEN |
| Housekeeping: dirty → cleaning → available | Housekeeping board/list and room state API | Housekeeping page/service, dirty/board/start/finish routes, maintenance cases | `maintenance_workflow.rs`; `housekeeping-role-smoke.spec.ts`; state model tests | Integration and browser execution unavailable | PARTIALLY_PROVEN |
| Admin: login → users/roles → rooms → reports/audit | Role-scoped nav, users/rooms/reports/audit surfaces | `DashboardLayout.tsx`, UsersPage, RoomsPage, ReportsPage, audit service/route | RBAC unit tests, RBAC canon/drift PASS, admin E2E source, a11y spec source | No browser run here; production operator acceptance absent | TECHNICALLY_PROVEN |

## 6. Desktop State

### FACT

- The application has dedicated desktop route surfaces, tables, inline room detail at 1440px, dashboard and report panels.
- Existing screenshots are present under `docs/screenshots/` for login, dashboard, bookings, calendar, guests, housekeeping, network, reports, rooms and users.
- Role E2E specs include a 1440px dashboard/rooms/calendar path and desktop navigation assertions.

### INFERENCE

Desktop presentation is portfolio-grade based on repository artifacts, but screenshots and source tests do not prove current runtime completion of every operational workflow.

### Classification

`PORTFOLIO_GRADE`, with critical workflows still `PARTIALLY_PROVEN`.

## 7. Mobile State

### FACT

- E2E source explicitly checks widths including 375, 390, 430, 768, 1024 and 1440 in reception/housekeeping/calendar/rooms/dashboard suites.
- Mobile PR #25 was merged into `main`; PR #26 and #27 remain open and unstable.
- PR #27 changes tables to cards below `md`, collapses tabs into “Más”, moves booking context/actions into a menu, locks calendar timeline on mobile and adjusts touch targets.
- The current PR’s E2E failure is a real signal from the changed booking UI: the old test expects `Revisá el bloqueo y completá una sola próxima acción`, while the current surface exposes `Más opciones del caso` and a hidden `Próxima acción` path.
- No local Playwright run was completed because frontend dependencies/runtime services were unavailable.

### INFERENCE

Mobile has meaningful engineering work and targeted test intent, but it is not proven at all required widths and not proven through complete workflows. A responsive shell or no-overflow assertion is insufficient to establish mobile pilot readiness.

### Classification

`UX_RISK` for reception/check-in and `PARTIALLY_PROVEN` for the remaining mobile surfaces.

## 8. Data / Multi-Tenant State

### FACT

- Migration `0011_tenant_fk_integrity.sql` adds composite tenant foreign keys and uniqueness support across bookings, rooms, guests, users, invoices, extra charges, cash closures and refresh/audit relationships.
- Migrations `0010`, `0012`, `0014` and `0016` add tenant-scoped uniqueness, availability and keyset indexes.
- `begin_tenant_tx` sets `app.rls_bypass=false` and `app.current_hotel_id`; refresh-token lookup has a separate context helper.
- Migration `0015` enables/forces RLS only on `users`, `bookings`, `refresh_tokens` and `invoices`; `0017` changes unset `app.rls_bypass` to fail closed.
- `tenant_rls_phase1.rs` tests policy existence, fail-closed default and cross-tenant reads/writes for the phase-1 tables.
- The threat model explicitly records RLS as partial and calls for extension to remaining tables.

### INFERENCE

The database has substantive tenant defenses, but “multi-tenant implemented” must not be read as “RLS covers every tenant-scoped table.” The current runtime safety depends materially on repository helper discipline and composite FKs for tables outside RLS phase 1.

### Gap / Classification

Coverage and runtime enforcement for `rooms`, `guests`, `audit_events`, `extra_charges`, `cash_closures`, `payment_entries`, `room_holds` and `maintenance_cases` require explicit acceptance evidence before real guest/financial data. Classification: `SECURITY_RISK`; security posture: `needs_triage`, not a confirmed exploit from this audit.

## 9. API State

### FACT

- `/api/v1` exposes auth, hotels/network, feature flags, rooms/holds, bookings/front desk, guests, users, analytics, audit, billing/cash, invoices/payments, housekeeping and reporting.
- `scripts/check-openapi-alignment.sh` PASS.
- `cargo test --test openapi_contract` PASS: 5 tests.
- `api_contract.rs` adds `x-api-version: v1` and a backward-compatible-within-v1 policy header.
- Errors include `error_code`, `message`, `request_id` and `details` in `handlers.rs`.

### INFERENCE / GAP

The API contract is technically well represented. It does not prove that all frontend workflows consume it successfully or that the full DB-backed runtime is safe under tenant and failure conditions.

Classification: `TECHNICALLY_PROVEN`.

## 10. Security State

### FACT

- Auth supports JWT access tokens, refresh-token rotation/revocation and cookie or bearer extraction.
- State-changing requests require CSRF except login; cookies are HttpOnly and profile-controlled Secure/SameSite.
- Production config guards reject weak JWT/admin defaults, insecure cookies, wildcard CORS, public metrics and invalid cookie domains.
- Login and general rate limiting are configured in routes/config.
- Capability RBAC is generated from a canonical source; RBAC canon and drift checks PASS.
- Security headers include CSP, X-Content-Type-Options, X-Frame-Options, Referrer-Policy and conditional HSTS.
- Request IDs and structured span fields include request, tenant, user, role and error code; metrics use normalized matched paths.
- The threat model records partial RLS and the need for anti-escape coverage.
- `backend-security-regression.sh --runner host` could not complete in this environment; `ci-backend-integration.sh --runner host` failed immediately because `psql` is unavailable.
- Dependency vulnerability status was not established: `cargo-audit` was not available and frontend dependencies were not installed.

### Classification

The controls are technically substantive and have unit/source evidence, but readiness for real guest/financial data is `UNKNOWN`/`SECURITY_RISK` until DB-backed security regression, full tenant coverage decision and operational secret validation are evidenced together. The tracked example files contain placeholders/dev defaults by design; the environment guard rejects them for staging/prod.

## 11. Testing Reality

| Layer | Canonical evidence | Audit result |
|---|---|---|
| Backend fmt/clippy/unit | `scripts/ci-backend.sh` | PASS; 70 unit tests and OpenAPI contract passed |
| Backend integration/SQLx | `scripts/ci-backend-integration.sh` | BLOCKED; host runner has no `psql`; not classified as product failure |
| Backend security regression | `scripts/backend-security-regression.sh` | BLOCKED/INCONCLUSIVE in this environment; do not treat as PASS |
| Frontend typecheck/lint | `npm run lint` | FAIL-to-start: `tsc` unavailable because dependencies are absent |
| Frontend Vitest | `npm run test -- --run` | FAIL-to-start: `vitest` unavailable because dependencies are absent |
| Frontend build | `npm run build` | FAIL-to-start: `tsc` unavailable |
| OpenAPI alignment | `scripts/check-openapi-alignment.sh` | PASS |
| RBAC canon/drift | `scripts/check-rbac-canon.sh`, `check-rbac-drift.sh` | PASS |
| Tenant helper enforcement | `scripts/check-tenant-helper-enforcement.sh` | PASS; 14 repository files scanned |
| Accessibility | axe E2E source and historical CI artifacts | Source coverage exists; current run not reproduced |
| Playwright | `scripts/qa-core-journeys-e2e.sh` and role specs | Historical PR #27: 14/15 pass; current local run unavailable |
| Mobile-specific validation | role specs at common widths | Test intent exists; current runtime proof absent |

## 12. CI / Canonical Convergence

### FACT

- `full-stack-ci.yml` gates secret scanning, backend, frontend, E2E, performance and CI stability.
- The last `origin/main` full-stack run (`31124964626`) concluded failure: Backend CI passed; Secret Scanning, Frontend CI and Performance Smoke were cancelled; E2E and stability were skipped.
- The last `origin/main` deploy-with-rollback run (`31152328235`) concluded failure with no jobs/log available through `gh`.
- PR #27’s latest full-stack run passed Secret Scanning, Backend CI, Frontend CI and Performance Smoke, but failed E2E Browser Core Journeys; stability was skipped.
- PR #26 is open/unstable with cancelled/skipped checks.

### INFERENCE

The repository has a defined delivery system, but canonical `main` is not globally green and the latest deploy evidence is not inspectable. Local technical passes cannot be promoted to global delivery readiness.

Classification: `OPERATIONAL_RISK`.

## 13. Operations / Observability

### FACT

- Health/readiness endpoints, Docker Compose profiles, backup/restore scripts, rollback script, rollback/restore drills and operator runbooks exist.
- OpenTelemetry configuration, structured tracing, request IDs, Prometheus metrics, UI telemetry and audit events are implemented in source.
- A historical DR drill document records a restore result, but this audit did not execute a current restore/deploy drill.
- The deploy workflow uses a self-hosted runner; the latest recorded deploy attempt had no inspectable jobs/log.

### INFERENCE

The operational toolkit is portfolio-grade and likely sufficient as a starting point for a controlled synthetic-data pilot, but it is not current operational evidence for production or real-data use.

Classification: `OPERATIONAL_RISK`.

## 14. Portfolio-Grade vs Pilot-Ready

| Dimension | Assessment | Classification |
|---|---|---|
| Architecture/code organization | Coherent, modular, documented | PORTFOLIO_GRADE |
| API/contracts | Alignment and contract tests pass | TECHNICALLY_PROVEN |
| Backend domain invariants | Strong source/unit/transaction test evidence | TECHNICALLY_PROVEN |
| UI breadth | Broad route/module surface and screenshots | PORTFOLIO_GRADE |
| Desktop UX | Substantial evidence, not full runtime acceptance | PARTIALLY_PROVEN |
| Mobile workflows | Targeted work exists, critical E2E currently red | UX_RISK |
| Multi-tenant real-data safety | Partial RLS + helper discipline; DB gate unavailable | SECURITY_RISK |
| Canonical delivery | `main` CI/deploy not green/inspectable | OPERATIONAL_RISK |
| Real-user acceptance | No human product acceptance evidence in repository | UNKNOWN |

Readiness dimensions:

- `TECHNICAL_READINESS`: PARTIAL.
- `PRODUCT_READINESS`: NOT PROVEN.
- `OPERATIONAL_READINESS`: NOT PROVEN.
- `SECURITY_READINESS`: NOT PROVEN for real guest/financial data.
- `REAL_USER_READINESS`: NOT PROVEN.

## 15. Preserve / Do Not Touch

- Preserve the current Rust/Axum/SQLx domain/application/infrastructure split.
- Preserve the API v1 contract, OpenAPI alignment gate and error/request-id contract.
- Preserve generated RBAC canon and its drift checks.
- Preserve booking/check-in/check-out transactional invariants and their tests.
- Preserve composite tenant FKs, tenant uniqueness/indexes and the existing tenant context helpers.
- Preserve the existing frontend module boundaries and route-level role guards.
- Preserve useful Playwright role/mobile specs; repair expectations only as part of the next explicitly scoped acceptance increment.
- Preserve current CSRF, refresh rotation, cookie guards, rate limits and production env validation.
- Preserve existing backup/restore/rollback tooling and runbooks; first make their evidence current before adding infrastructure.
- Do not add microservices, Kubernetes, queues, a second database, service mesh or a major rewrite for this pilot decision.

## 16. Pilot Blockers

1. Canonical `main` is not globally green: the latest full-stack run failed/cancelled and deploy evidence is unavailable.
2. The principal reception browser journey is not green on PR #27; the failure occurs at the booking case UI before completing the flow.
3. Frontend runtime validation was not reproducible in this checkout because dependencies are absent.
4. DB-backed integration and security regression evidence is missing from this audit.
5. RLS is only phase 1; real-data tenant safety for several financial/operational tables is not proven.
6. Mobile acceptance is represented by source tests and recent fixes, not by a current green complete workflow at 375/390/430px.
7. No human product acceptance evidence establishes that the workflow matches a real hotel’s policy, roles, payment practice or privacy expectations.

## 17. Non-Blocking Debt

- Dependency audit status is unknown because audit tools/dependencies were unavailable.
- Historical debug/log artifacts exist in the working tree but are ignored/not tracked; they should not become evidence or release artifacts.
- Documentation contains broad “implemented” language; it must remain subordinate to current runtime evidence.
- CI stability and self-hosted deploy observability need cleanup, but they are secondary to proving the reception slice and tenant safety.
- Accessibility source coverage is valuable but does not substitute for role/workflow acceptance.

## 18. Project Method Transfer Findings

| Finding | Classification | Evidence | Reusable lesson |
|---|---|---|---|
| Separate technical gates from product acceptance | TRANSFER_CONFIRMED | PR #27: backend/frontend/perf PASS while one real browser workflow fails; `docs/ops/user-workflows-v1.md` distinguishes implementation from workflow | Technical PASS must never imply product PASS |
| Treat mobile as a material surface | TRANSFER_CONFIRMED | PRs #24–#27, width-specific role specs, failure in booking case UI | Responsive shell and no-overflow checks are insufficient; validate task completion at target widths |
| Use canonical contract and generated authorization | TRANSFER_CONFIRMED | OpenAPI alignment PASS; RBAC canon/drift PASS | Central sources reduce cross-layer drift and are reusable across projects |
| Repository helper discipline is not equal to DB policy coverage | TRANSFER_PARTIAL | `0015_rls_phase1_tenant_policies.sql`; threat model explicitly says RLS partial | Keep both application and database enforcement evidence separate |
| Historical screenshots and “implemented” docs can overstate readiness | METHOD_GAP | Screenshots/docs exist while current E2E/main CI evidence is not green | Every readiness claim needs current observable evidence and timestamp/SHA |
| Excessive infra escalation would be overfit | METHOD_OVERFIT | Existing Compose, rollback, restore, metrics and runbooks are already present | Preserve sufficient tooling; close evidence gaps before adding platforms |
| The missing-dependency failure is a process signal, not a product finding | METHOD_IMPROVEMENT_CANDIDATE | `tsc`/`vitest` unavailable locally while CI previously ran them | Record reproducibility prerequisites and distinguish environment-blocked from product-failed |
| Real hotel policy and privacy acceptance cannot be inferred from code | HMS_SPECIFIC | No human acceptance artifact; financial/PII surfaces in source | Add a human gate only for scope, policy, privacy and acceptance—not routine technical debugging |

### Required questions

- Regla aprendida en Alquileres que funcionó: separar gates técnicos, evidencia de workflow y aceptación humana.
- Regla que no transfirió completamente: helper-based tenant isolation no equivale a complete DB/RLS isolation.
- Regla demasiado adaptada: asumir que existing screenshots or “implemented” workflow labels represent current product acceptance.
- Fallo invisible para un enfoque sólo técnico: the reception journey’s UI contract changed while backend and most CI gates stayed green.
- Burocracia evitable: no crear nuevos architecture layers or observability platforms before reproducing the canonical gates.
- Regla reusable candidata: every pilot claim must cite surface, current SHA, exact test/observable behavior and explicit gap.

## 19. Minimum Next Phase Proposal

**Nombre:** Pilot Evidence Closure — Reception Slice.

**Objective:** demostrar un único journey completo y usable con synthetic data: login → walk-in/booking → guest/room → check-in → charge/payment → checkout → room release, incluyendo recepción desktop y mobile.

**Exact blocking gaps:** green canonical E2E; frontend dependencies/runtime; PostgreSQL integration/security regression; current evidence at 375/390/430px; explicit tenant boundary evidence for every table touched by the slice; canonical `main` CI convergence.

**Smallest intervention:** reparar y validar sólo el contrato UI/test de ese journey, ejecutar gates existentes con sus runners correctos, y producir evidence con SHA. No ampliar módulos ni cambiar arquitectura.

**What remains frozen:** API v1, domain model, migration strategy, RBAC canon, existing security controls, housekeeping/admin/reporting modules, deployment architecture and all unrelated mobile PR changes.

**Definition of Done:**

- `main` or an explicitly selected candidate commit has a complete green `full-stack-ci`.
- Reception Playwright journey passes end-to-end, including checkout and room release.
- Targeted mobile run passes at 375, 390 and 430px with no overflow, hidden CTA, blocked sheet or incomplete action.
- SQLx booking/transaction/tenant/security tests run successfully against PostgreSQL.
- Evidence states synthetic-data scope and identifies any remaining real-data restriction.
- Product owner/operator performs human acceptance of the journey and its hotel policy assumptions.

**Autonomous work allowed:** inspect, reproduce, run existing gates, update evidence, isolate technical failures and implement only the narrowly scoped approved corrective ticket.

**Human Gates:** choose pilot hotel/scope, approve synthetic vs real guest/financial data, validate operational policy and accept the completed reception journey.

## 20. Autonomous Continuation

Allowed without escalation: repository inspection, PR/Actions inspection, local non-destructive tests, browser/runtime reproduction, contract checks, security evidence collection and report refresh. Do not escalate missing `psql`, missing Node dependencies or ordinary test failures as human matters; classify and resolve them technically in the next approved increment.

## 21. Human Gates

| Category | Gate |
|---|---|
| HUMAN_GATE | Select pilot hotel, scope, timeline and whether data is synthetic or real |
| HUMAN_GATE | Accept privacy/legal and financial handling requirements for real guest data |
| HUMAN_GATE | Product/operator acceptance of reception workflow and hotel-specific policy |
| HUMAN_ACTION | Provide/authorize pilot operator and test accounts if a controlled pilot is approved |
| HUMAN_INPUT | Confirm payment, cash closure and housekeeping handoff policies |
| CORRECTIVE_INTERVENTION | None required from a human for the current technical blockers; they are normal technical work |
| TECHNICAL_BLOCKED | Current audit environment lacks frontend dependencies, `psql` and a usable DB-backed runner; this is an environment limitation, not a product approval request |

## 22. Final Verdict

# NOT_READY

The repository is a credible portfolio-grade HMS foundation with substantial technical proof, but current evidence does not support product acceptance or a controlled real-user pilot. Stop here; do not implement the proposed next phase as part of this baseline audit.
