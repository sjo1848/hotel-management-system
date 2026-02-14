# ADR-0001: Tenant Context + RLS Strategy (Fase 1)

## Estado
Aceptado (pendiente ejecución Sprint 1)

## Contexto
El sistema opera multi-tenant con `hotel_id` y constraints/FKs compuestas. Para reducir riesgo residual de fugas cross-tenant, RLS fase 1 requiere una convención única de contexto tenant por request.

## Decisión
Se adopta el mecanismo estándar:
1. En cada request autenticado, la capa de acceso a datos debe ejecutar:
   - `SET LOCAL app.hotel_id = '<uuid>'`
2. Las policies RLS deben evaluar tenant por:
   - `current_setting('app.hotel_id', true)`
3. Si `app.hotel_id` no está seteado:
   - denegar acceso por defecto (fail-closed).

## Alcance Fase 1
- Tablas críticas: `bookings`, `users`, `refresh_tokens`, `invoices` (y relacionadas según dependencia directa).

## Guardrails obligatorios
1. Ninguna consulta tenant-scoped sin tenant context activo.
2. Ninguna policy con bypass para roles de aplicación comunes.
3. Tests anti-escape read/write obligatorios en CI.
4. Métrica/perf baseline pre/post RLS en queries críticas.

## Tradeoffs
- ✅ Seguridad de aislamiento significativamente superior.
- ✅ Menor dependencia de disciplina manual de filtros `hotel_id`.
- ⚠️ Complejidad adicional en conexión/transacciones y debugging.
- ⚠️ Posible impacto de performance sin tuning de índices/policies.

## Validación
- Integration tests anti-escape tenant (read/write cruzados).
- Smoke funcional de flujos core.
- Reporte `EXPLAIN ANALYZE` en queries acordadas.

## Rollback
- Revert de migración RLS fase 1 + fallback controlado a constraints/FKs mientras se corrige policy.

