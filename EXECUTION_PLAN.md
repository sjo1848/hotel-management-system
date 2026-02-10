# HMS Elite - Plan de Ejecución (Sprints + Tickets)

Fecha: 2026-02-10

## Objetivo
Endurecer seguridad e integridad de datos para preparar el sistema a producción, sin frenar el avance funcional.

## Supuestos
1. Prioridad máxima: integridad de reservas (anti-overbooking).
2. Estrategia de auth unificada (cookie-only recomendada).
3. Cambios con impacto en frontend deben coordinarse con backend en el mismo sprint.

## Sprints Propuestos

### Sprint 1: Seguridad + Integridad (bloqueante)
Objetivo: eliminar riesgos críticos de sobreventa y sesión insegura.

#### Ticket S1-1: Exclusion constraint anti-overbooking
Estimación: M
Descripción: agregar constraint en `bookings` con `daterange` y `btree_gist`, excluyendo `status='CANCELLED'`.
Cambio realizado: ✅ Completado (2026-02-10)
Criterios de aceptación:
1. Dos inserts concurrentes para misma habitación y rango fallan en uno con error de constraint.
2. Reservas `CANCELLED` no bloquean disponibilidad.
3. Migración forward-only con rollback manual documentado.
Archivos: `backend/migrations/*`, `backend/src/infrastructure/repository/postgres_booking.rs`
Tests: integración con concurrencia.

#### Ticket S1-2: Manejo de error de overlap
Estimación: S
Descripción: mapear error DB a `DomainError::RoomNotAvailable` con código específico.
Cambio realizado: ✅ Completado (2026-02-10)
Criterios de aceptación:
1. Respuesta HTTP estandarizada ante overlap.
2. Frontend muestra mensaje coherente.
Archivos: `backend/src/infrastructure/repository/postgres_booking.rs`, `backend/src/domain/errors.rs`

#### Ticket S1-3: Auth cookie-only (eliminar localStorage)
Estimación: M
Descripción: no persistir access token en `localStorage`, depender de HttpOnly cookie + refresh.
Cambio realizado: ✅ Completado (2026-02-10)
Criterios de aceptación:
1. No hay tokens en `localStorage`.
2. Login/refresh/logout funcionan.
3. UI mantiene sesión tras refresh.
Archivos: `frontend/src/api/client.ts`, `frontend/src/features/auth/*`
Tests: E2E login/refresh/logout.

#### Ticket S1-4: Protección CSRF
Estimación: M
Descripción: implementar CSRF token (double-submit) en mutaciones.
Cambio realizado: ✅ Completado (2026-02-10)
Criterios de aceptación:
1. POST/PATCH/DELETE rechazan requests sin token.
2. Token se inyecta desde frontend.
Archivos: `backend/src/infrastructure/web/*`, `frontend/src/api/client.ts`

#### Ticket S1-5: Defaults inseguros (fail-fast)
Estimación: S
Descripción: fallar arranque si `JWT_SECRET` o `ADMIN_PASSWORD` son defaults en prod.
Cambio realizado: ✅ Completado (2026-02-10)
Criterios de aceptación:
1. En `ENV=prod`, arranque falla con mensaje explícito.
2. En `ENV=dev`, se permiten defaults.
Archivos: `backend/src/config.rs`

---

### Sprint 2: Contrato + Observabilidad
Objetivo: estabilizar API y preparar operación.

#### Ticket S2-1: Error envelope + request_id
Estimación: M
Descripción: response estándar `{ error_code, message, request_id, details }`.
Criterios de aceptación:
1. Todos los errores devuelven el mismo schema.
2. `request_id` presente en logs y respuesta.
Archivos: `backend/src/infrastructure/web/handlers.rs`, middleware.

#### Ticket S2-2: Versionado `/api/v1`
Estimación: S
Descripción: añadir prefijo de versión sin romper rutas actuales.
Cambio realizado: ✅ Completado (2026-02-10)
Criterios de aceptación:
1. `/api/v1/*` funciona igual que `/api/*`.
2. Frontend migrado a `/api/v1`.
Archivos: `backend/src/main.rs`, `frontend/src/api/client.ts`

#### Ticket S2-3: OpenAPI inicial
Estimación: M
Descripción: OpenAPI v1 con auth, rooms, bookings, guests, users.
Cambio realizado: ✅ Completado (2026-02-10)
Criterios de aceptación:
1. Archivo generado y validado.
2. Incluye modelos y errores estándar.

---

### Sprint 3: Calidad + Operación
Objetivo: CI con gates y métricas mínimas.

#### Ticket S3-1: CI Quality Gates
Estimación: M
Descripción: `cargo fmt`, `clippy -D warnings`, `cargo test`, `npm run build`.
Criterios de aceptación:
1. Pipeline bloquea merge si falla cualquiera.

#### Ticket S3-2: Métricas básicas
Estimación: M
Descripción: `/metrics` con errores, latencias y rate limit.
Criterios de aceptación:
1. Prometheus scrape OK.
2. Métricas documentadas.

#### Ticket S3-3: Runbook + rollback
Estimación: S
Descripción: guía mínima de rollback y pasos de incidentes.
Criterios de aceptación:
1. Documento en repo.

---

## Dependencias
1. S1-1 debe completarse antes de habilitar reservas en producción.
2. S1-3 y S1-4 coordinados con frontend.
3. S2-1 antes de OpenAPI final.

## Riesgos y Mitigación
1. Exclusion constraint puede afectar performance: usar índice `btree_gist` y testear con carga.
2. Auth cookie-only puede romper UX si el refresh falla: agregar manejo de sesión claro en UI.
3. CSRF puede romper integraciones: documentar token y hacer rollout gradual.
