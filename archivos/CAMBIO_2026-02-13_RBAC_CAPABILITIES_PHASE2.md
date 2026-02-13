# Registro Breve de Cambio

Objetivo:  
Extender RBAC por capacidades a endpoints operativos que aún estaban protegidos solo por autenticación.

Contexto:  
En la fase 1 se migraron endpoints administrativos/reporting a capabilities. Quedaban rutas de operación diaria (`rooms`, `bookings`, `guests`, `housekeeping`, `billing`) sin autorización granular por acción.

Decisión:  
1. Se amplió matriz de capacidades por rol en `backend/src/infrastructure/web/middleware/rbac.rs` para `admin`, `ops`, `receptionist` y `housekeeping`.
2. Se agregaron middlewares por capacidad para operaciones:
   - `rooms.read/search/status.write`
   - `bookings.read/write/update`
   - `bookings.extra_charges.read/write`
   - `guests.read/write`
   - `housekeeping.read/write`
   - `billing.balance.read`, `billing.close_cash.write`, `billing.invoice.read`
3. Se aplicó middleware por endpoint en `backend/src/infrastructure/web/routes/mod.rs` para todas las rutas operativas listadas.
4. Se ampliaron tests unitarios de matriz RBAC en `rbac.rs` para validar permisos de `ops`, `receptionist` y `housekeeping`.

Impacto:  
- Se elimina la brecha de rutas “auth-only” en operación diaria.
- Se establece un modelo explícito de permisos por acción/recurso, reduciendo riesgo de acceso excesivo.
- Verificación técnica:
  - `cargo clippy -- -D warnings` -> PASS
  - `cargo test --lib` -> PASS (13 tests)
  - `docker compose exec backend cargo test` -> PASS (unit + integration + doc-tests)

Próximo paso:  
Añadir tests de autorización por endpoint (token por rol + expected 200/403) para convertir la matriz RBAC en contrato de regresión automatizado.
