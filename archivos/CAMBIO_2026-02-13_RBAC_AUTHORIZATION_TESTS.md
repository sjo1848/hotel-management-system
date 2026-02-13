# Registro Breve de Cambio

Objetivo:  
Agregar regresión automatizada de autorización RBAC por endpoint para validar `200/403` por rol según matriz de capacidades.

Contexto:  
Tras extender RBAC a endpoints operativos, faltaba convertir la matriz en contrato de pruebas para detectar regressions de permisos en futuros cambios.

Decisión:  
1. Se añadió `backend/tests/rbac_authorization.rs` con test de integración sobre el router real (`create_router`) y base temporal `sqlx::test`.
2. El test construye estado completo de app (repos + servicios), crea usuarios por rol (`admin`, `ops`, `receptionist`, `housekeeping`), genera JWT por rol y valida respuestas esperadas por endpoint.
3. Se cubrieron casos de lectura/escritura y denegación:
   - `/api/v1/users` (admin permitido, ops denegado)
   - `/api/v1/bookings` (ops permitido)
   - `/api/v1/housekeeping/dirty` (housekeeping permitido, receptionist denegado)
   - `POST /api/v1/guests` (receptionist permitido, housekeeping denegado)
   - `POST /api/v1/billing/close-cash` (ops permitido, receptionist denegado)
4. Se agregó `tower = "0.5"` en `[dev-dependencies]` de `backend/Cargo.toml` para ejecutar requests in-process (`oneshot`).

Impacto:  
- RBAC queda protegido por test de regresión centrado en comportamiento observable HTTP.
- Se detectan rápidamente ampliaciones/restricciones accidentales de permisos por endpoint.
- Validación técnica ejecutada:
  - `cargo clippy --tests -- -D warnings` -> PASS
  - `docker compose exec backend cargo test --test rbac_authorization` -> PASS
  - `docker compose exec backend cargo test` -> PASS (suite completa)

Próximo paso:  
Expandir el set de casos RBAC a endpoints restantes de administración SaaS (`/api/v1/hotels`, `/api/v1/users/:id`, reportes) y validar explícitamente `401` para requests sin token.
