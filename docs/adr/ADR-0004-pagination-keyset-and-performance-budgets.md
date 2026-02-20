# ADR-0004: Estándar de Paginación y Performance Budgets para Endpoints List

- Fecha: `2026-02-14 21:10:33 -0300`
- Estado: Aceptado

## Contexto
Los endpoints de listados/reporting presentan riesgo de degradación a medida que crece el volumen por tenant. Se requiere política uniforme de paginación, límites y verificación de performance para proteger latencia y costo de base de datos.

## Decisión
1. Estrategia de paginación:
   - Adoptar paginación por cursor/keyset como estándar para endpoints de alto volumen.
   - Mantener `offset/limit` solo para casos administrativos de bajo volumen o compatibilidad temporal.
2. Contrato mínimo por endpoint list:
   - Parámetros: `limit`, `cursor`.
   - Respuesta: `items`, `next_cursor`, `has_more`.
   - `limit` con máximo hard por endpoint (definido y documentado en OpenAPI).
3. Índices obligatorios:
   - Todo endpoint keyset debe tener índice compuesto alineado al patrón de orden y filtro tenant.
   - Ejemplo base: `(hotel_id, created_at DESC, id DESC)` según agregado.
4. Budgets y gates:
   - Definir budget p95 por endpoint crítico y dataset de referencia.
   - Integrar verificación periódica en scripts de performance (`perf-baseline`/`EXPLAIN`).
5. Rollout gradual:
   - Prioridad: bookings, guests, invoices, audit_events.
   - Mantener compatibilidad temporal con clientes existentes durante la transición.

## Tradeoffs
- Escala mejor que `offset` en tablas grandes y reduce scans costosos.
- Latencia más estable por tenant y por página.
- Complejidad mayor en cliente (manejo de cursor) y en contrato inicial.

## Impacto y costo
- Impacto: Alto (performance, costos DB, UX de listados).
- Costo: Medio (ajustes de API, frontend e índices por endpoint).

## Validación
- `EXPLAIN ANALYZE` por endpoint priorizado.
- Performance regression checks con budgets definidos.
- Contract tests FE↔OpenAPI para evitar drift de parámetros/respuesta.

## Rollback
- Permitir fallback temporal a `offset/limit` solo en endpoints degradados mientras se corrigen índices/queries, con fecha límite de retiro documentada.
