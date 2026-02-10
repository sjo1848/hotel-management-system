# Summary for Handoff

## Estado actual
- Backend: **operativo** (compila y levanta, health OK).
- Frontend: cambios listos en repo, depende del backend.

## Causa raíz
Errores de compilación Rust en backend:
- `AppState` importado mal.
- Uso incorrecto de `tower_governor`.
- Falta de `State` en imports.
- Inferencia de tipos en handlers (E0282).
- `sqlx::query!` sin metadata (migrado a runtime).

## Fixes ya aplicados y subidos
1. Repos SQLx -> runtime queries:
   - `backend/src/infrastructure/repository/postgres.rs`
   - `backend/src/infrastructure/repository/postgres_booking.rs`
   - `backend/src/infrastructure/repository/postgres_guest.rs`
2. `AppState` movido a lib:
   - `backend/src/app_state.rs`
   - `backend/src/lib.rs`
3. `main.rs`:
   - `use hms_backend::app_state::AppState`
   - `use tower_governor::{governor::GovernorConfigBuilder, GovernorLayer}`
   - `GovernorLayer { config: ... }` + `GovernorConfigBuilder::period(...)` (v0.4.3)
   - `use axum::extract::State`
   - `decode_token(&token, ...)`
4. Tipos explícitos en handlers para E0282.
5. Fix move de `guest.phone`.
6. Fix duplicación de crate (bin + lib): `main.rs` usa `hms_backend::...` y elimina `mod ...`.
7. CORS sin panic: `AllowOrigin::exact(...)` + `allow_headers` explícitos.
8. `ready` permitido sin auth en middleware.

## Commits clave
- `fix: use runtime sqlx queries for repositories`
- `fix: add explicit types in handlers`
- `fix: move AppState to library and fix guest insert`
- `fix: resolve build errors in main and handlers`

## Qué falta
Nada bloqueante. Opcional: limpiar warnings y ajustar CORS si se necesita multiorigen.

## Comandos recomendados
```bash
docker compose up -d --build
docker compose logs backend --tail=200
curl -s http://localhost:3000/health
curl -s http://localhost:3000/ready
```

Si hay cache vieja:
```bash
docker compose build --no-cache backend
```

## Riesgos
- Dependencias Rust requieren red para descargar crates.
- Docker puede estar usando cache vieja.
- CORS usa `AllowOrigin::exact` por URL única; si se necesita más de un origen, ajustar a lista.
