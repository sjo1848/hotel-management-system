# ADR 005: Ciclo de Vida Operativo y Hardening de Dominio

## Estado
Aceptado

## Contexto
El sistema HMS Elite requiere una trazabilidad estricta de las habitaciones para evitar errores operativos (ej: asignar una habitación sucia a un huésped). Anteriormente, la lógica de estados era laxa y se gestionaba directamente en los controladores o repositorios.

## Decisión
Hemos centralizado la lógica de transición de estados en el dominio (`RoomStatus`) y en el `RoomService`.
1.  **Transiciones Validadas**: Una habitación no puede pasar de `Occupied` a `Available` directamente; debe pasar por `Dirty` y luego por un proceso de limpieza (`Cleaning`).
2.  **Validación de Reserva**: Solo se permiten reservas en habitaciones con estado `Available`.
3.  **Auditoría Centralizada**: Se creó un `AuditService` inyectable para eliminar la duplicación de código y garantizar que toda acción operativa quede registrada en la base de datos de auditoría.
4.  **Inyección de Dependencias**: Los servicios de alto nivel (`BookingService`, `HousekeepingService`) ahora dependen de `RoomService` para realizar cambios de estado, garantizando que no se salten las reglas de negocio.

## Consecuencias
- **Positivas**: Mayor robustez del sistema, prevención de errores humanos en la asignación de habitaciones, código más limpio y mantenible (DRY).
- **Negativas**: Mayor acoplamiento entre servicios (mitigado mediante el uso de interfaces y Arc).
