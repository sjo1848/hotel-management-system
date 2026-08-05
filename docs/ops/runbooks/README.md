# Runbooks — Índice

Índice de runbooks operativos de HMS Elite. Para el flujo operativo completo
(deploy, backup, restore, health) ver `docs/ops/operator-runbook.md`.

| Runbook | Tema | Cuándo usarlo |
|---|---|---|
| `auth-anomaly-cross-tenant.md` | Seguridad / auth | Picos de login failure, refresh unauthorized o forbidden cross-tenant (alertas `HMSAuthLoginFailureRateHigh`, `HMSAuthRefreshUnauthorizedSpike`, `HMSCrossTenantForbiddenSpike`) |
| `ci-backend-pooltimeout.md` | CI / infra | Fallo `PoolTimedOut` en los tests de integración del backend (dos fuentes de postgres) |
| `../threat-model.md` | Seguridad | Análisis de amenazas y controles del sistema |
| `../operator-runbook.md` | Operaciones | Deploy, rollback, backup/restore, health y readiness |

## Convención

Cada runbook sigue el formato: síntoma → severidad/tiempos → diagnóstico →
mitigación → criterio de cierre. Agregar un runbook nuevo aquí al crearlo.