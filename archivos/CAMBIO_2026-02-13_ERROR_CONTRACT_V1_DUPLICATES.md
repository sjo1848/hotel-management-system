# Registro Breve de Cambio

Objetivo:  
Extender el error contract v1 para que conflictos funcionales de duplicados no salgan como `500` de infraestructura.

Contexto:  
El hardening previo mejoró `INVOICE_NOT_FOUND`, pero todavía había casos de negocio (duplicados por constraints) que podían propagarse como `InfrastructureError`.

Decisión:  
1. Se agregaron nuevos errores de dominio:
   - `GuestAlreadyExists`
   - `UserAlreadyExists`
2. Se mapeó respuesta API en `handlers`:
   - `GUEST_ALREADY_EXISTS` -> `409 CONFLICT`
   - `USER_ALREADY_EXISTS` -> `409 CONFLICT`
3. Se implementó traducción de errores de repositorio a dominio:
   - `GuestService::create_guest` ahora traduce violaciones de unicidad a `GuestAlreadyExists`.
   - `RoomService::create_room` ahora traduce violaciones de unicidad a `RoomAlreadyExists` (cubre condición de carrera).
   - `create_user_handler` traduce violaciones de unicidad a `UserAlreadyExists`.

Impacto:  
- Menos `500` en escenarios de conflicto funcional esperable.
- Semántica HTTP más correcta (`409` en lugar de `500`).
- Mejor trazabilidad para frontend y observabilidad (error_code explícito por caso).

Verificación técnica:  
- `cargo clippy -- -D warnings` -> PASS
- `cargo test --lib` -> PASS
- `docker compose exec backend cargo test` -> PASS (suite completa)

Próximo paso:  
Continuar migración de casos funcionales restantes a domain errors explícitos y consolidar tabla completa `DomainError -> status -> error_code` en documentación técnica.
