# HMS Elite — Ops & Business KPI Contract

Status: active
Last updated: 2026-02-24 UTC

## Operational SLO contract

### M1. auth_refresh_error_rate
- Formula: `auth_refresh_4xx_5xx / auth_refresh_total * 100`
- Source: backend HTTP metrics + structured logs
- Window: rolling 1h (staging), daily (production)
- Threshold: `auth_refresh_error_rate < 0.5%`
- Validation command: `./scripts/check-auth-refresh-slo.sh`
- Owner: DevOps/SRE

### M2. p95_auth_refresh
- Formula: p95 latency for `POST /api/v1/auth/refresh`
- Source: backend HTTP histogram metrics
- Window: rolling 1h
- Threshold: `p95_auth_refresh < 250ms`
- Validation command: `./scripts/check-auth-refresh-slo.sh`
- Owner: DevOps/SRE

### M3. refresh_retry_success_rate
- Formula: `refresh_retry_success / refresh_retry_attempts * 100`
- Source: frontend UI telemetry + API retry logs
- Window: rolling 24h (staging)
- Threshold: `refresh_retry_success_rate >= 99.5%`
- Validation command: `./scripts/check-auth-refresh-slo.sh`
- Owner: Frontend + QA

### M4. change_failure_rate
- Formula: `failed_deploys / total_deploys * 100`
- Source: CI/CD deployment runs
- Window: per sprint
- Threshold: `change_failure_rate <= 10%`
- Validation command: `./scripts/check-ops-slo-contract.sh`
- Owner: DevOps/SRE

### M5. rollback_rate
- Formula: `rollbacks / total_deploys * 100`
- Source: deployment + rollback drill logs
- Window: per sprint
- Threshold: `rollback_rate <= 5%`
- Validation command: `./scripts/check-ops-slo-contract.sh`
- Owner: DevOps/SRE

### M6. mttr_prod
- Formula: average elapsed time from critical alert to service recovery
- Source: alertmanager + incident timeline
- Window: monthly
- Threshold: `mttr_prod < 30 min`
- Validation command: `./scripts/check-ops-slo-contract.sh`
- Owner: SRE + On-call lead

## Business KPI contract

### B1. kpi_hq_activation_rate
- Formula: `% enterprise tenants with >=1 weekly network_kpis_viewed event`
- Source: UI telemetry event stream
- Window: trailing 7 days
- Threshold: `kpi_hq_activation_rate >= 60%`
- Validation command: `./scripts/check-business-kpi-contract.sh`
- Owner: Product Analytics

### B2. kpi_feature_flags_usage_rate
- Formula: `tenants with feature flag reads / active tenants * 100`
- Source: feature flags API usage telemetry
- Window: trailing 7 days
- Threshold: `kpi_feature_flags_usage_rate >= 70%`
- Validation command: `./scripts/check-business-kpi-contract.sh`
- Owner: Product Analytics

### B3. kpi_plan_upgrade_rate
- Formula: `PRO->ENTERPRISE upgrades / eligible PRO tenants * 100`
- Source: plan update telemetry events + billing records
- Window: trailing 30 days
- Threshold: `kpi_plan_upgrade_rate >= 5%`
- Validation command: `./scripts/check-business-kpi-contract.sh`
- Owner: Product + Revenue Ops

### B4. kpi_critical_task_time_p95
- Formula: p95 elapsed time for check-in / booking update / close cash workflows
- Source: operational event traces + UI telemetry
- Window: trailing 7 days
- Threshold: `kpi_critical_task_time_p95 <= 120 sec`
- Validation command: `./scripts/check-business-kpi-contract.sh`
- Owner: Product Operations

### B5. kpi_churn_proxy_4w
- Formula: `% tenants with 4-week drop in premium module usage`
- Source: UI telemetry event stream
- Window: trailing 4 weeks
- Threshold: `kpi_churn_proxy_4w <= 15%`
- Validation command: `./scripts/check-business-kpi-contract.sh`
- Owner: Product Analytics

## Telemetry events required for premium KPI tracking

- revenue_cockpit_viewed
- revenue_cockpit_cta_clicked
- automation_alert_clicked
- network_kpis_viewed
- network_plan_upgrade_submitted
- network_plan_upgrade_succeeded
- network_plan_upgrade_failed
