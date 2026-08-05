# ADR Index — HMS Elite

Índice de los Architectural Decision Records del proyecto. Los ADRs documentan
decisiones estructurales y su contexto/tradeoffs. Ver `PLAN_MAESTRO_UNIFICADO_2026-02-14.md`
para el contexto de mayor nivel.

| ADR | Título | Tema |
|---|---|---|
| [ADR-0001](./ADR-0001-tenant-context-rls.md) | Tenant Context + RLS Strategy (Fase 1) | Aislamiento multi-tenant por `hotel_id` + RLS |
| [ADR-0002](./ADR-0002-api-lifecycle.md) | API Lifecycle y Gobernanza Contractual | Versionado y ciclo de vida de la API v1 |
| [ADR-001](./001-rust-axum.md) | Elección de Rust y Axum para el Backend | Stack del backend |
| [ADR-002](./002-arquitectura-hexagonal.md) | Implementación de Arquitectura Hexagonal | Puertos y adaptadores |
| [ADR-003](./003-auth-strategy.md) | Estrategia de Autenticación mediante Cookies HttpOnly y CSRF | Sesiones seguras |
| [ADR-005](./0005-operational-lifecycle-hardening.md) | Ciclo de Vida Operativo y Hardening de Dominio | Operaciones y hardening |
| [ADR-006](./0006-tenant-isolation-strategy.md) | Estrategia de Aislamiento Tenant para Escala | Aislamiento a escala |

## Nota sobre numeración

El repositorio usa dos convenciones históricas (`ADR-0001/0002` vs `001/002/003`
y `0005/0006`). Este índice es la fuente de verdad para navegación; no se han
renombrado archivos para evitar churn. El número `004` no existe actualmente.

## Convención

Al agregar un ADR nuevo: usar el formato `ADR-00XX-<slug>.md`, agregar una fila en
este índice y referenciarlo desde la decisión correspondiente.