# Runbook — Auth Anomalies y Sospecha Cross-Tenant

## Alcance
- Alertas cubiertas:
  - `HMSAuthLoginFailureRateHigh`
  - `HMSAuthRefreshUnauthorizedSpike`
  - `HMSCrossTenantForbiddenSpike`
- Owner primario: `security`
- Owner secundario: `backend`

## Severidad y escalamiento
- `critical`:
  - responder en < 15 minutos.
  - abrir incidente y notificar on-call Security + Backend.
- `warning`:
  - responder en < 60 minutos.
  - crear ticket con evidencia y seguimiento.

## Checklist de diagnóstico
1. Confirmar ventana temporal y endpoints afectados en Prometheus/Grafana.
2. Correlacionar con logs estructurados (`request_id`, `tenant_id`, `user_id`, `error_code`).
3. Verificar si hay cambios recientes de deploy (últimas 24h).
4. Validar picos por IP/User-Agent y posibles patrones automatizados.
5. Revisar tasa de 401/403/429 y distribución por ruta.
6. Confirmar integridad de refresh/login (cookies, CSRF, rate limit, JWT).

## Acciones de mitigación
1. Si hay abuso evidente:
   - endurecer rate limit temporalmente.
   - bloquear IPs en edge/WAF.
2. Si se detecta problema de configuración:
   - rollback al último commit estable.
   - restaurar parámetros de auth (`COOKIE_*`, `CORS_ORIGIN`, `AUTH_REQUIRED`).
3. Si hay sospecha de cross-tenant:
   - activar revisión inmediata de logs + auditoría por `tenant_id`.
   - escalar a incidente de seguridad.

## Criterio de cierre
1. Métricas vuelven bajo umbral por al menos 30 minutos.
2. Causa raíz documentada.
3. Acción preventiva creada (ticket con owner y fecha).
