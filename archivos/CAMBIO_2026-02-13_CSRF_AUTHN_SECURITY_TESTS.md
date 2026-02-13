# Registro Breve de Cambio

Objetivo:  
Agregar regresión de seguridad para contrato CSRF/AuthN en endpoints de sesión y rutas protegidas.

Contexto:  
El plan de cierre pedía pruebas automatizadas de seguridad (CSRF/authz/authn). Ya existía regresión RBAC (authz), pero faltaba validar comportamiento de CSRF y autenticación en `/auth/refresh`, `/auth/logout` y acceso sin token.

Decisión:  
1. Se creó `backend/tests/csrf_authn_security.rs` como test de integración con router real (`create_router`) y DB temporal `sqlx::test`.
2. El test valida:
   - `POST /api/v1/auth/login` sin CSRF -> `200` (endpoint bootstrap de sesión)
   - `POST /api/v1/auth/refresh` sin CSRF -> `400`
   - `POST /api/v1/auth/refresh` con CSRF inválido -> `400`
   - `POST /api/v1/auth/refresh` con CSRF válido -> `200`
   - `GET /api/v1/users` sin token -> `401`
   - `POST /api/v1/auth/logout` sin CSRF -> `400`
   - `POST /api/v1/auth/logout` con CSRF válido -> `200`
3. Se reutilizó construcción completa de `AppState` para ejecutar middleware y handlers reales end-to-end.

Impacto:  
- Queda blindado el contrato de seguridad de sesión con evidencia automatizada.
- Se reduce riesgo de regresión en middleware CSRF/Auth en futuros refactors.
- Validación técnica:
  - `cargo clippy --tests -- -D warnings` -> PASS
  - `docker compose exec backend cargo test --test csrf_authn_security` -> PASS
  - `docker compose exec backend cargo test` -> PASS (suite completa)

Próximo paso:  
Integrar esta suite de seguridad (RBAC + CSRF/AuthN) en pipeline CI obligatorio por PR para cerrar el pendiente de “pruebas de seguridad en CI”.
