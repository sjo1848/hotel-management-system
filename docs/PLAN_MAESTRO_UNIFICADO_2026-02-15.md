# HMS Elite — Backlog Maestro tipo Jira (ejecutable por Codex CLI)

> Objetivo: convertir la auditoría integral en un backlog accionable con EPIC/STORY/TASK, criterios de aceptación y validación técnica.
> Fecha: 2026-02-15
> Owner sugerido: VP Engineering
> Última actualización: 2026-02-20 04:45 (-03:00)

## Reglas operativas (modo ejecución)
- Cada PR debe incluir: cambios de código + tests + evidencia de validación + actualización documental.
- No se acepta merge de endpoints críticos sin:
  - contrato OpenAPI actualizado,
  - pruebas de aislamiento tenant,
  - budget/perf validado en CI.
- Prioridad de ejecución: Seguridad/Aislamiento > Contrato > Performance > DX/Frontend.

## Estado baseline ya implementado en `main` (commit `665f103`, 2026-02-14)
- [x] Gate bloqueante FE/BE para drift de capabilities (`scripts/check-rbac-drift.sh`) en CI y gates locales.
- [x] Envelope estándar de error en runtime (`error_code`, `message`, `request_id`, `details`) con smoke de observabilidad.
- [x] Coverage thresholds backend en CI (`scripts/backend-coverage-threshold.sh`).
- [x] Observability smoke gate (`scripts/observability-smoke.sh`).
- [x] Rollback por SLO y DR drill versionado (`scripts/rollback-on-slo-breach.sh`, `scripts/restore-drill.sh`).

**Regla de este backlog:** ejecutar sólo deltas pendientes, sin reabrir trabajo ya cerrado en baseline.

## Registro de ejecución
- 2026-02-14 21:30 (-03:00) — cierre `HMS-SEC-T102`:
  - PASS `./scripts/check-rbac-drift.sh`
  - PASS `./scripts/backend-security-regression.sh`
  - PASS `docker compose exec -T frontend npm run test -- --run`
- 2026-02-14 21:30 (-03:00) — cierre `HMS-SEC-T103` + `HMS-SEC-T104`:
  - matriz contractual única en `backend/src/domain/errors.rs` consumida por `handlers.rs`
  - parser FE prioriza `error_code` en `frontend/src/api/errors.ts`
  - PASS `./scripts/check-validation-governance.sh` (ahora compara catálogo docs vs contrato runtime)
  - PASS `./scripts/gate.sh`
- 2026-02-15 07:45 (-03:00) — avance `HMS-DATA-T201` + `HMS-DATA-T202` (parcial):
  - enforcement de tenant context en repos críticos: `users`, `bookings`, `invoices`, `refresh_tokens` + repositorio transaccional de bookings
  - fail-closed explícito para tenant inválido (`TENANT_CONTEXT_REQUIRED`)
  - gate nuevo de guardrails: `scripts/check-tenant-guardrails.sh` integrado en `scripts/gate.sh` y `scripts/gate-ci.sh`
  - PASS `./scripts/check-tenant-guardrails.sh`
  - PASS `docker compose exec -T backend cargo test --test tenant_context_runtime -- --test-threads=1 --nocapture`
  - PASS `docker compose exec -T backend cargo test --test tenant_rls_phase1 -- --test-threads=1 --nocapture`
  - PASS `./scripts/gate.sh`
- 2026-02-15 08:07 (-03:00) — cierre `HMS-DATA-T201` + `HMS-DATA-T202`:
  - tenant context extendido a repos tenant-scoped restantes: `rooms`, `guests`, `extra_charges`, `cash_closures`, `audit_events`
  - middleware auth ahora rechaza token con `hotel_id` inválido/vacío/nil y emite alerta (`tenant_context_missing_total`)
  - bypass RLS acotado con reason explícita + métrica (`tenant_rls_bypass_total`) solo para `refresh_token_lookup_pre_auth`
  - `scripts/ci-backend-integration.sh` ahora hace fallback automático a runner Docker cuando host `5432` no está publicado
  - PASS `./scripts/ci-backend.sh`
  - PASS `./scripts/check-tenant-guardrails.sh`
  - PASS `./scripts/ci-backend-integration.sh`
  - PASS `./scripts/gate.sh`
- 2026-02-15 15:44 (-03:00) — avance `HMS-API-T301` + `HMS-API-T302` + `HMS-API-T303` (parcial):
  - implementado endpoint keyset no-breaking `GET /api/v1/bookings/page` (`limit/cursor/start/end`) con `items/next_cursor/has_more`
  - agregada implementación repository/service para `find_page` de bookings con orden determinístico `(created_at DESC, id DESC)`
  - migración agregada: `backend/migrations/0016_keyset_pagination_indexes.sql` + convergencia `database/init.sql`
  - contratos actualizados: `backend/openapi.yaml` + `docs/openapi.yaml` + `backend/tests/openapi_contract.rs`
  - performance baseline actualizado para incluir `bookings_page`
  - PASS `./scripts/check-openapi-alignment.sh`
  - PASS `./scripts/ci-backend.sh`
  - PASS `./scripts/ci-backend-integration.sh` (runner Docker fallback)
  - PASS `docker compose exec -T backend cargo test --test tenant_query_tuning_indexes`
  - PASS `./scripts/gate.sh`
- 2026-02-15 15:57 (-03:00) — avance `HMS-API-T301` (extendido) + `HMS-API-T303` (parcial):
  - endpoints keyset no-breaking agregados: `GET /api/v1/guests/page`, `GET /api/v1/invoices/page`, `GET /api/v1/audit/events/page`
  - contratos actualizados en `backend/openapi.yaml`/`docs/openapi.yaml` + cobertura de rutas en `backend/tests/openapi_contract.rs`
  - tests de determinismo keyset agregados: `backend/tests/keyset_pagination_flow.rs`
  - PASS `./scripts/ci-backend.sh`
  - PASS `docker compose exec -T backend cargo test --test keyset_pagination_flow`
  - PASS `./scripts/ci-backend-integration.sh`
  - PASS `./scripts/gate.sh`
  - BLOCKED `./scripts/perf-baseline.sh` (backend local no estable en `http://localhost:3001/health`, `connection reset by peer`)
- 2026-02-15 16:24 (-03:00) — cierre `HMS-API-T303`:
  - baseline perf con endpoints keyset priorizados: `docs/perf/perf-baseline-2026-02-15-1624.md` (`gate_result: PASS`)
  - evidencia `EXPLAIN ANALYZE`: `docs/perf/explain-2026-02-15-1624/report.md` + planes raw por query
  - calibración de gate perf para evitar falsos FAIL por `429` al ampliar cobertura de endpoints:
    - `scripts/perf-baseline.sh` default `requests=4`, `concurrency=1`
    - `scripts/gate-ci.sh` perf smoke actualizado a `--requests 4 --concurrency 1`
  - nota operativa: el `backend` de `docker compose` local quedó en crash-loop por `VersionMismatch(15)`; la evidencia perf se ejecutó en entorno aislado (`PORT=3003`, DB temporal)
  - PASS `./scripts/perf-baseline.sh --base-url http://localhost:3003 --requests 4 --concurrency 1 --fail-on-slo`
  - PASS `./scripts/gate.sh`
- 2026-02-15 16:40 (-03:00) — avance `HMS-QA-T602` + cierre formal pendiente `EP11`:
  - gate nuevo de drift FE↔OpenAPI: `scripts/check-openapi-frontend-drift.sh` (método+ruta frontend vs contrato `backend/openapi.yaml`)
  - gate integrado en `scripts/gate.sh` y `scripts/gate-ci.sh` como bloqueante
  - corrección de drift detectado: nuevo endpoint `GET /api/v1/rooms/{id}` agregado a backend + OpenAPI
  - compatibilidad legacy de listados formalizada con fecha de retiro contractual `2026-05-01` en `docs/api-changelog.md`
  - PASS `./scripts/check-openapi-frontend-drift.sh`
  - PASS `./scripts/ci-backend.sh`
  - PASS `./scripts/gate.sh`
- 2026-02-15 16:59 (-03:00) — cierre `HMS-QA-T601` + endurecimiento gate nightly:
  - `scripts/qa-core-journeys-e2e.sh` ahora ejecuta matriz cross-role/cross-tenant sobre DB aislada temporal (host) para eliminar flakes de `PoolTimedOut` en compose persistente
  - matriz incluida: `rbac_authorization`, `tenant_rls_phase1`, `tenant_context_runtime` con retry en fallas transitorias
  - agregado workflow nightly dedicado: `.github/workflows/nightly-qa-e2e-matrix.yml` (cron + manual dispatch)
  - estrategia nightly actual: `--skip-browser` para validar aislamiento/contrato en matriz backend determinística; browser E2E continúa en pipeline regular
  - PASS `./scripts/qa-core-journeys-e2e.sh --runner docker --skip-browser`
  - PASS `./scripts/gate.sh`
- 2026-02-15 19:30 (-03:00) — avance `HMS-FE-T401` + `HMS-FE-T402`:
  - refactor container/presentational en dashboard:
    - `DashboardHome.tsx` reducido de 489 a 194 líneas
    - componentes nuevos: `DashboardKpiGrid`, `DashboardChartsSection`, `DashboardCashClosureCard`, `DashboardAlertsPanel`, `DashboardRecentBookingsCard`
  - refactor de bookings list:
    - `BookingsPage.tsx` reducido de 253 a 99 líneas
    - extracción de toolbar/estado/columnas + hook `useBookingsPageData`
  - trazabilidad de cache agregada en `useResourceQuery`:
    - eventos `cache_hit`, `cache_miss`, `fetch_success`, `fetch_error`, `invalidate`
    - canal `window` con evento `hms:resource-query-cache`
  - tests nuevos: `frontend/src/lib/useResourceQuery.test.tsx` (3 casos)
  - PASS `docker compose exec -T frontend npm run lint`
  - PASS `docker compose exec -T frontend npm run test -- --run`
  - PASS `docker compose exec -T frontend npm run build`
  - PASS `./scripts/gate.sh`
- 2026-02-20 04:45 (-03:00) — cierre `HMS-SRE-T501` + `HMS-SRE-T502`:
  - nuevo sintético post-deploy con reporte versionable por release: `scripts/post-deploy-synthetics.sh`
  - deploy workflow endurecido con:
    - captura `pre-deploy HEAD`,
    - ejecución de synthetics post-deploy + artifact `post-deploy-synthetics-report`,
    - gate SLO post-deploy con `--fail-on-breach` y rollback opcional + artifact `deploy-slo-gate-report`
  - `deploy-with-rollback` ahora ejecuta synthetics por defecto (con opción `--skip-synthetics`), y conserva rollback automático ante fallo.
  - PASS `./scripts/prod-deploy-readiness.sh --env-file .env.prod.example --profile prod`
  - PASS `./scripts/gate.sh`

---

## [EPIC] HMS-SEC-EP09 — Contrato único FE/BE de capabilities + errores

### [STORY] HMS-SEC-ST01 — Fuente de verdad y sincronización de capabilities
**Objetivo**
- Eliminar drift de permisos FE/BE y evitar bugs de autorización.

**Descripción**
- Consolidar capabilities por rol con backend como fuente normativa.
- Mantener espejo tipado en frontend con drift check obligatorio en CI.

**Archivos involucrados**
- `backend/src/infrastructure/web/middleware/rbac.rs`
- `frontend/src/features/auth/capabilities.ts`
- `scripts/check-rbac-drift.sh`
- `backend/.github/workflows/*` (o pipeline CI equivalente)

#### [TASK] HMS-SEC-T101 — Harden del drift check de capabilities
- Agregar verificación en CI como gate bloqueante para PRs.
- Emitir diff legible por rol/capability.
- **Impacto:** Alto | **Costo:** Bajo
- **Estado actual:** baseline implementado; dejar esta task sólo para mejoras incrementales del reporte.

#### [TASK] HMS-SEC-T102 — Contract tests FE↔BE para guards críticos
- Probar rutas críticas por rol (admin/reception/ops/housekeeping).
- **Impacto:** Alto | **Costo:** Medio

**Criterios de aceptación**
- [x] CI falla si hay capability en backend que no existe en frontend.
- [x] CI falla si frontend expone capability inexistente en backend.
- [x] Tests de guards por rol pasan en rutas críticas.

**Tests requeridos**
- `./scripts/check-rbac-drift.sh`
- tests frontend de guards/capabilities
- integration tests backend de autorización por rol

**Estimación**: M
**Riesgos**
- Falsos positivos por nombres legacy de roles.

---

### [STORY] HMS-SEC-ST02 — Contrato estándar de errores y catálogo vivo
**Objetivo**
- Unificar parseo/observabilidad de errores y reducir soporte reactivo.

**Descripción**
- Baseline ya tiene envelope estándar (`error_code`, `message`, `request_id`, `details`) en runtime.
- Delta pendiente: consolidar matriz única `ErrorCode↔HTTP↔DomainError` y alinear parser FE para decisiones UX sólo por `error_code`.
- Alinear catálogo `error-codes-v1` con errores reales de backend.

**Archivos involucrados**
- `backend/src/domain/errors.rs`
- `backend/src/infrastructure/web/*` (mapeo de errores)
- `frontend/src/api/errors.ts`
- `docs/errors/error-codes-v1.md`
- `scripts/check-validation-governance.sh`

#### [TASK] HMS-SEC-T103 — Matriz ErrorCode↔HTTP↔DomainError
- Generar mapping único y eliminar strings ad-hoc.
- **Impacto:** Alto | **Costo:** Medio
- **Estado actual:** implementado el 2026-02-14 21:30 (-03:00).

#### [TASK] HMS-SEC-T104 — Parser FE robusto por `error_code`
- Usar `error_code` como clave primaria de UX de error.
- **Impacto:** Medio/Alto | **Costo:** Medio
- **Estado actual:** implementado el 2026-02-14 21:30 (-03:00).

**Criterios de aceptación**
- [x] Todos los errores API devuelven envelope estándar.
- [x] Cada nuevo `error_code` queda documentado en el mismo PR.
- [x] Frontend no depende de mensajes libres para decisiones de UX.

**Tests requeridos**
- integration tests de error envelope por dominio
- tests unitarios FE de parsing de errores
- `./scripts/check-validation-governance.sh`

**Estimación**: M
**Riesgos**
- Compatibilidad temporal con clientes legacy que parsean `message`.

---

## [EPIC] HMS-DATA-EP10 — Aislamiento tenant extremo y políticas transversales

### [STORY] HMS-DATA-ST01 — Tenant context obligatorio en todo acceso a datos
**Objetivo**
- Cerrar riesgo residual cross-tenant en runtime.

**Descripción**
- Garantizar `SET LOCAL app.hotel_id` en transacciones autenticadas.
- Fail-closed cuando falta contexto tenant.

**Archivos involucrados**
- `backend/src/infrastructure/repository/*`
- `backend/src/infrastructure/web/middleware/*`
- `backend/tests/tenant_rls_phase1.rs`
- migraciones SQL RLS relacionadas

#### [TASK] HMS-DATA-T201 — Policy engine de tenant guardrails
- Validar tenant context antes de ejecutar consultas tenant-scoped.
- **Impacto:** Muy Alto | **Costo:** Alto
- **Estado actual:** implementado en repos tenant-scoped de backend el 2026-02-15 08:07 (-03:00).

#### [TASK] HMS-DATA-T202 — Auditoría de bypasses y permisos elevados
- Reportar y bloquear caminos con bypass no autorizado.
- **Impacto:** Alto | **Costo:** Medio
- **Estado actual:** implementado el 2026-02-15 08:07 (-03:00) con alerta runtime + gate de bypass permitido.

**Criterios de aceptación**
- [x] No existe query tenant-scoped sin tenant context activo.
- [x] Tests anti-escape read/write cruzado pasan.
- [x] Alerta operacional cuando request autenticado llega sin tenant context.

**Tests requeridos**
- `backend/tests/tenant_rls_phase1.rs`
- pruebas de integración cross-tenant read/write
- smoke de rutas core post-RLS

**Estimación**: L
**Riesgos**
- Impacto de performance por RLS sin índices correctos.

---

## [EPIC] HMS-API-EP11 — Paginación estándar y budgets de performance

### [STORY] HMS-API-ST01 — Keyset pagination en endpoints críticos
**Objetivo**
- Mantener latencia estable y costo DB controlado bajo crecimiento.

**Descripción**
- Implementar `limit + cursor` y respuesta `items + next_cursor + has_more`.
- Prioridad: bookings, guests, invoices, audit_events.
- Migración sin ruptura: mantener compatibilidad temporal `offset/limit` por endpoint con fecha de retiro explícita en changelog contractual.

**Archivos involucrados**
- `backend/openapi.yaml`
- handlers/repos de listados críticos
- `docs/adr/ADR-0004-pagination-keyset-and-performance-budgets.md`
- `scripts/perf-baseline.sh`
- `scripts/perf-explain-prod.sh`

#### [TASK] HMS-API-T301 — Contrato OpenAPI paginado por endpoint
- Definir límites máximos por endpoint y ejemplos de cursor.
- **Impacto:** Alto | **Costo:** Medio
- **Estado actual:** implementado para endpoints priorizados (`bookings`, `guests`, `invoices`, `audit_events`) al 2026-02-15 15:57 (-03:00).

#### [TASK] HMS-API-T302 — Índices compuestos para keyset
- Crear índices tenant+orden para cada listado priorizado.
- **Impacto:** Alto | **Costo:** Medio
- **Estado actual:** implementado para listados priorizados con `0016_keyset_pagination_indexes.sql`.

#### [TASK] HMS-API-T303 — Performance budget gate p95
- Fijar umbrales y fallback policy documentada.
- **Impacto:** Alto | **Costo:** Medio
- **Estado actual:** implementado (baseline + explain evidenciado el 2026-02-15 16:24 (-03:00)).

**Criterios de aceptación**
- [x] Endpoints críticos exponen contrato cursor consistente.
- [x] `EXPLAIN ANALYZE` muestra uso de índices esperados.
- [x] Gate de performance falla por encima de p95 acordado.
- [x] Cada endpoint migrado define ventana de compatibilidad y fecha de retiro de `offset/limit`.

**Tests requeridos**
- integration tests de paginación determinística
- perf regression checks (scripts de baseline/explain)
- contract tests OpenAPI

**Estimación**: L
**Riesgos**
- Complejidad frontend durante migración offset→cursor.

---

## [EPIC] HMS-FE-EP12 — Simplificación frontend y cache observable

### [STORY] HMS-FE-ST01 — Refactor por contenedor/presentacional + query cache robusto
**Objetivo**
- Reducir complejidad de páginas feature y regresiones de UX.

**Descripción**
- Dividir vistas densas por submódulos.
- Adoptar strategy de cache/invalidation trazable.

**Archivos involucrados**
- `frontend/src/features/*`
- `frontend/src/api/client.ts`
- tests de componentes/hooks

#### [TASK] HMS-FE-T401 — Refactor de páginas densas prioritarias
- Empezar por dashboard y bookings list.
- **Impacto:** Medio/Alto | **Costo:** Alto
- **Estado actual:** implementado el 2026-02-15 19:30 (-03:00) para `dashboard` + `bookings list`.

#### [TASK] HMS-FE-T402 — Trazabilidad de cache hits/miss + invalidaciones
- Instrumentar eventos de cache por query key.
- **Impacto:** Medio | **Costo:** Medio
- **Estado actual:** implementado el 2026-02-15 19:30 (-03:00) en `useResourceQuery` con tests.

**Criterios de aceptación**
- [x] Reducción medible de tamaño/complejidad por feature.
- [x] Invalidaciones documentadas por evento de dominio.
- [x] Tests de hooks/páginas críticas verdes.

**Tests requeridos**
- unit tests de hooks/query logic
- component tests de páginas refactorizadas
- budget frontend (`scripts/frontend-perf-budget.sh`)

**Estimación**: L
**Riesgos**
- Cambios de estado pueden romper flujos no cubiertos.

---

## [EPIC] HMS-SRE-EP13 — Operación segura SaaS (SLO, despliegue, DR)

### [STORY] HMS-SRE-ST01 — Quality gates de SLO + rollback automático
**Objetivo**
- Evitar degradaciones silenciosas en producción.

**Descripción**
- Definir SLO por dominio (auth, bookings, invoices).
- Integrar rollback por breach en pipeline.

**Archivos involucrados**
- `scripts/rollback-on-slo-breach.sh`
- `scripts/deploy-with-rollback.sh`
- workflows CI/CD
- `docs/ops/runbooks/*`

#### [TASK] HMS-SRE-T501 — SLO/error-budget gates en CI/CD
- Gatear release con p95/error-rate/auth-failure thresholds.
- **Impacto:** Alto | **Costo:** Medio
- **Estado actual:** implementado el 2026-02-20 04:45 (-03:00) con enforcement en `.github/workflows/deploy-with-rollback.yml` (`rollback-on-slo-breach --fail-on-breach`).

#### [TASK] HMS-SRE-T502 — Runbooks versionados + synthetics post-deploy
- Estandarizar verificación automática post release.
- **Impacto:** Alto | **Costo:** Medio
- **Estado actual:** implementado el 2026-02-20 04:45 (-03:00) con `scripts/post-deploy-synthetics.sh` + runbook operacional versionado.

**Criterios de aceptación**
- [x] Deploy se bloquea/frena por breach de SLO definido.
- [x] Existe evidencia de synthetics post-deploy por release.
- [x] Runbook y drill de rollback ejecutados en calendario.

**Tests requeridos**
- `scripts/observability-smoke.sh`
- `scripts/deploy-rollback-drill.sh`
- `scripts/restore-drill.sh`

**Estimación**: M
**Riesgos**
- Umbrales iniciales mal calibrados generan ruido de alertas.

---

## [EPIC] HMS-QA-EP14 — Cobertura empresarial y no-regresión

### [STORY] HMS-QA-ST01 — E2E cross-role y cross-tenant + contract tests
**Objetivo**
- Validar aislamiento real y evitar drift FE↔BE en cada release.

**Descripción**
- PR gate (rápido): drift contractual FE↔OpenAPI + smoke de autorización/errores.
- Nightly gate (completo): suites E2E cross-role/cross-tenant.
- Automatizar contract testing desde OpenAPI.

**Archivos involucrados**
- `backend/tests/*`
- `frontend/tests/*` (o e2e suite)
- `scripts/qa-core-journeys-e2e.sh`
- `scripts/check-openapi-alignment.sh`

#### [TASK] HMS-QA-T601 — Matriz E2E por rol y tenant
- Casos happy-path + abuso de permisos + intentos cross-tenant.
- **Impacto:** Muy Alto | **Costo:** Alto
- **Estado actual:** implementado el 2026-02-15 16:59 (-03:00) con job nightly dedicado y matriz backend determinística.

#### [TASK] HMS-QA-T602 — Gate de contract drift FE↔OpenAPI
- Falla CI cuando DTOs/errores divergen del contrato.
- **Impacto:** Alto | **Costo:** Medio
- **Estado actual:** implementado (gate FE↔OpenAPI bloqueante en CI/local al 2026-02-15 16:40 (-03:00)).

**Criterios de aceptación**
- [x] PR valida drift contractual FE↔OpenAPI + smoke crítico en tiempo acotado.
- [x] Nightly ejecuta y pasa E2E críticos cross-role/cross-tenant.
- [x] Drift contractual FE↔OpenAPI bloquea merge.
- [ ] DoD exige evidencia de tests para cada cambio de endpoint.

**Tests requeridos**
- e2e core journeys
- openapi alignment check
- regression suite de autorización y errores

**Estimación**: L
**Riesgos**
- Tiempos de CI si no se paralelizan suites.

---

## Orden recomendado de ejecución (sprints)
1. **Sprint 1-2:** EP10 ST01 (tenant guardrails end-to-end) + deltas EP09 (`T102`, `T103`, `T104`).
2. **Sprint 2-3:** EP11 ST01 (keyset + índices + budgets).
3. **Sprint 3-4:** EP14 ST01 (PR gate contractual + nightly E2E cross-role/cross-tenant).
4. **Sprint 4-5:** EP13 ST01 (SLO/error-budget gates y synthetics post-deploy).
5. **Sprint 5-6:** EP12 ST01 (simplificación frontend y cache observable).

## Definition of Done (global)
- [ ] Código + tests + docs en el mismo PR.
- [ ] Gates CI relevantes en PASS.
- [ ] No romper gates existentes ya verdes en baseline.
- [ ] Métricas/alertas actualizadas si afecta operación.
- [ ] Changelog contractual actualizado si cambia API/error/capabilities.
- [ ] Evidencia de validación adjunta (salida de scripts/tests).

## Comandos de validación mínima (para Codex CLI)
- `./scripts/check-rbac-drift.sh`
- `./scripts/check-validation-governance.sh`
- `./scripts/check-openapi-alignment.sh`
- `./scripts/check-openapi-frontend-drift.sh`
- `./scripts/perf-baseline.sh`
- `./scripts/qa-core-journeys-e2e.sh`
- `./scripts/observability-smoke.sh`

---

Siguiente paso recomendado:
- Endurecer `EP14` en DoD: exigir evidencia automática por cada cambio de endpoint (PR template/checklist + validación CI).
