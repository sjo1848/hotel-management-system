# Registro Breve de Cambio

Objetivo:  
Implementar RBAC por capacidades en endpoints críticos y mejorar semántica de autorización/errores sin introducir regresiones de acceso.

Contexto:  
El hardening previo dejó autorización por rol global (`admin_only`) en múltiples rutas SaaS. El plan de Sprint 7 exige migrar a permisos por recurso/acción para reducir acoplamiento entre rol y endpoint.

Decisión:  
1. Se agregó middleware de capacidades (`require_capability_middleware`) con matriz inicial por rol en `backend/src/infrastructure/web/middleware/rbac.rs`.
2. Se reemplazó `admin_only` por middlewares por capacidad en rutas: hoteles, rooms create, usuarios, analytics, invoices y reportes (`backend/src/infrastructure/web/routes/mod.rs`).
3. Se incorporó `DomainError::Forbidden` con respuesta `403 FORBIDDEN` para diferenciar falta de permisos de falta de autenticación (`401`).
4. Se corrigió semántica de error en hoteles: `get_hotel` ahora devuelve `HotelNotFound` (antes devolvía `RoomNotFound`).
5. Se agregaron tests unitarios de capacidades en middleware RBAC.

Impacto:  
- Contrato de autorización más claro: `401` para no autenticado y `403` para autenticado sin permiso.
- Base explícita para evolucionar a permisos finos sin tocar handlers.
- Backend validado en verde tras cambios: `cargo clippy -- -D warnings`, `cargo test --lib` y `docker compose exec backend cargo test`.

Próximo paso:  
Expandir la matriz de capacidades a endpoints operativos restantes (bookings, housekeeping, billing close-cash) y alinear frontend para gestión de permisos por acción.
