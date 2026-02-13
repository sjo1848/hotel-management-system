# Registro Breve de Cambio

Objetivo:  
Permitir login usando nombre de hotel (ej: `Hotel Viena` / `hotel viena`) además de `hotel_id` UUID.

Contexto:  
La UX actual exigía UUID de hotel en login, lo que no es amigable para operación diaria. Se requiere admitir identificador humano sin perder compatibilidad.

Decisión:  
1. Backend login ahora acepta `hotel_id` como string y resuelve:
   - si es UUID válido -> flujo actual,
   - si no es UUID -> búsqueda por nombre de hotel case-insensitive.
2. Se extendió `HotelRepository` con `find_by_name_ci` e implementación en Postgres (`LOWER(name)=LOWER($1)`).
3. Frontend dejó de validar UUID estricto y actualizó campo a `Hotel (nombre o ID)`.
4. Mensaje de error `422` en cliente ahora guía a verificar hotel por nombre o ID.

Impacto:  
- Mejora fuerte de usabilidad en login multi-tenant.
- Mantiene backward compatibility con integraciones que envían UUID.
- Verificación funcional en contenedor backend:
  - `Hotel Viena` + `admin_viena` -> `200`
  - `hotel viena` + `admin_viena` -> `200`
  - `Hotel Sede Central` + `ops` -> `200`
- Quality gates:
  - Backend: `cargo clippy -- -D warnings`, `cargo test --lib` -> PASS
  - Frontend: `npm run lint`, `npm run test -- --run`, `npm run build` -> PASS

Próximo paso:  
Agregar selector/autocomplete de hoteles en login para evitar tipeo manual y reducir errores de entrada.
