# HMS Elite — Contrato de ejecucion estricto (PASS/FAIL)

Estado: listo para ejecucion condicionada.
Ultima actualizacion: 2026-02-24 UTC.

## Baseline formal (obligatorio antes de Sprint 1)

Regla:
- Baseline debe ser `origin/main` + SHA exacto + fecha/hora de auditoria.

Estado actual de baseline:
- `origin/main`: disponible en entorno objetivo.
- SHA baseline objetivo: `f78f0e953eb0feb2eb04ed627c524db5e294bd28`.
- Fecha commit baseline: `2026-02-23 07:15:22 -0300`.

Comandos de revalidacion:
- `git fetch origin --prune`
- `git rev-parse origin/main`
- `git show -s --format='%ci' origin/main`

PASS/FAIL:
- PASS: SHA y timestamp coinciden con acta baseline.
- FAIL: mismatch de SHA/timestamp o baseline no registrado.

## Contrato de metricas (operativo)

### M1. auth_refresh_error_rate
- Formula: `refresh_5xx_or_4xx_auth / total_refresh_requests * 100`.
- Fuente: logs estructurados backend + metricas HTTP.
- Ventana: rolling 1h en staging; daily en produccion.
- Umbral: `auth_refresh_error_rate < 0.5%`.
- Comando: `./scripts/observability-smoke.sh --runner docker` + `./scripts/check-auth-refresh-slo.sh`.

### M2. p95_auth_refresh
- Formula: percentil 95 de latencia de `POST /api/v1/auth/refresh`.
- Fuente: metricas HTTP del backend.
- Ventana: rolling 1h.
- Umbral: `p95_auth_refresh < 250ms`.
- Comando: `./scripts/perf-baseline.sh --report /tmp/perf_auth_refresh.md` + `./scripts/check-auth-refresh-slo.sh`.

### M3. refresh_retry_success_rate
- Formula: `success_after_refresh_retry / total_retry_attempts * 100`.
- Fuente: telemetria FE + logs API.
- Ventana: rolling 24h en staging.
- Umbral: `refresh_retry_success_rate >= 99.5%`.
- Comando: `npm run test -- --run` + `npm run test:e2e` + `./scripts/qa-core-journeys-e2e.sh`.

### M4. change_failure_rate
- Formula: `failed_deploys / total_deploys * 100`.
- Umbral: `change_failure_rate <= 10%`.
- Comando: `./scripts/check-ops-slo-contract.sh`.

### M5. rollback_rate
- Formula: `rollbacks / total_deploys * 100`.
- Umbral: `rollback_rate <= 5%`.
- Comando: `./scripts/check-ops-slo-contract.sh`.

### M6. mttr_prod
- Formula: promedio de tiempo desde alerta critica a recuperacion.
- Umbral: `mttr_prod < 30 min`.
- Comando: `./scripts/check-ops-slo-contract.sh`.

## Contrato KPI de negocio (premium)

Documentacion fuente:
- `docs/validation/ops-kpi-contract.md`

Indicadores requeridos:
- `kpi_hq_activation_rate >= 60%`
- `kpi_feature_flags_usage_rate >= 70%`
- `kpi_plan_upgrade_rate >= 5%`
- `kpi_critical_task_time_p95 <= 120 sec`
- `kpi_churn_proxy_4w <= 15%`

Comando de validacion:
- `./scripts/check-business-kpi-contract.sh`

## Sprint gates (operables)

### Sprint 1 (entregables duros)
1. Tenant enforcement gate:
   - PASS: `tenant_helper_enforcement_violations = 0`.
   - Comando: `./scripts/check-tenant-helper-enforcement.sh` y `./scripts/gate-ci.sh`.
2. Suite FE critica minima:
   - PASS: >= 12 casos nuevos en auth/guards/interceptor.
3. RBAC canon v1 schema:
   - PASS: schema canónico versionado + validacion en CI.
   - Comando: `./scripts/check-rbac-canon.sh`.

### Sprint 2 (reliability FE)
1. Flaky rate E2E:
   - PASS: `failure_rate < 1%` en 30 corridas.
   - Comando: `HMS_E2E_FLAKY_CHECK=true HMS_E2E_FLAKY_RUNS=30 ./scripts/gate-ci.sh --skip-perf`.

## Regla tecnica exacta: tenant helper enforcement

Scope:
- `backend/src/infrastructure/repository/postgres*.rs`.

Regla:
- Si hay SQLx sobre tablas tenant-scoped (`users|rooms|bookings|guests|invoices|refresh_tokens|audit_events|extra_charges|cash_closures`), el archivo debe usar `begin_tenant_tx(...)` o `begin_refresh_token_lookup_tx(...)`.

Excepciones:
- `backend/src/infrastructure/repository/tenant_context.rs`.
- tests y migraciones.
- allowlist documentada en `docs/validation/tenant-helper-enforcement-allowlist.txt`.

## Checklist production-ready
- [ ] Baseline `origin/main` + SHA + timestamp registrados.
- [ ] RBAC canon v1 activo.
- [ ] Drift RBAC contra canon = 0.
- [ ] Tenant helper enforcement gate activo y en verde.
- [ ] Suite FE critica minima implementada y estable.
- [ ] SLOs con formula/fuente/ventana/comando en operacion.
- [ ] Contrato de KPIs premium versionado y validado en gate.
