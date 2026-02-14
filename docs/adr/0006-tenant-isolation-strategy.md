# ADR 006: Estrategia de Aislamiento Tenant para Escala

## Estado
Aceptado

## Contexto
HMS Elite ya opera en modo multi-tenant con `hotel_id`, unicidad por tenant y FKs compuestas tenant-scoped.
Para escalar a enterprise, necesitábamos cerrar una decisión vinculante entre:

1. DB por tenant
2. Schema por tenant
3. Shared DB + shared schema con control estricto por tenant
4. Shared DB + shared schema + RLS

La base actual y el costo operativo favorecen una evolución incremental sin detener entregas de producto.

## Decisión
Adoptamos como estrategia oficial:

- **Fase actual (vinculante):** `shared database + shared schema` con aislamiento duro por:
  - `hotel_id` obligatorio en entidades tenant-scoped.
  - unicidad compuesta por tenant.
  - FKs compuestas `(hotel_id, id)` para impedir cruces entre hoteles.
  - validaciones y tests de integridad tenant.
- **Fase de escala (roadmap Sprint 7+):** habilitar RLS de forma progresiva en tablas críticas, detrás de rollout controlado.

No adoptamos `schema-per-tenant` ni `db-per-tenant` en esta etapa por costo de operación, complejidad de migraciones y riesgo de fragmentación operativa.

## Consecuencias
- **Positivas**
  - Mantiene simplicidad operativa y velocidad de entrega.
  - Aislamiento consistente ya verificable por constraints + tests.
  - Permite transición a RLS sin reescritura completa del modelo.
- **Negativas**
  - Riesgo residual si una query nueva omite `hotel_id` (mitigado con revisión y tests).
  - RLS no protege todavía todas las rutas por defecto.

## Guardrails obligatorios
1. Ninguna tabla tenant-scoped nueva sin `hotel_id NOT NULL`.
2. Toda FK entre entidades tenant-scoped debe ser compuesta por `hotel_id`.
3. Toda query de lectura/escritura en repositorios tenant-scoped debe filtrar por `hotel_id`.
4. Toda migración estructural debe incluir validación anti-cruce tenant cuando aplique.

## Plan de implementación asociado
- HMS-DATA-011: tuning de índices para queries críticas tenant-scoped.
- Sprint 7+: plan de adopción RLS por dominio (bookings, billing, users, refresh tokens, audit).
