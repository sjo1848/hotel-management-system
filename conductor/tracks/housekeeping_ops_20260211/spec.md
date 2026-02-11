# Especificación Técnica: Housekeeping y Mantenimiento

## Track ID: housekeeping_ops_20260211

## 1. Estados de Habitación (Dominio)
Se utilizarán los siguientes estados definidos en el backend:
- **Available**: Lista para recibir huéspedes.
- **Occupied**: Huésped alojado actualmente.
- **Dirty**: Requiere limpieza (activado tras check-out).
- **Maintenance**: Bloqueada por reparaciones (no disponible para venta).

## 2. Lógica de Negocio (Backend)
- **Trigger de Suciedad**: Cuando el estado de una `Booking` cambia a `CHECKED_OUT`, el sistema debe invocar `RoomService.mark_as_dirty(room_id)`.
- **Validación de Disponibilidad**: El buscador de habitaciones debe ignorar habitaciones en estado `Maintenance`, incluso si no tienen reservas solapadas.

## 3. Interfaz de Usuario (Frontend)
- **Vista de Staff**: Lista compacta de todas las habitaciones con colores:
    - Rojo: Sucia.
    - Verde: Limpia.
    - Gris: En Mantenimiento.
- **Acciones Rápidas**: Botón "Marcar como Limpia" que devuelve la habitación al estado `Available`.

## 4. Estrategia de Calidad (QA)
- **Test Unitario**: Validar que la transición de `Occupied` a `Dirty` ocurra correctamente al cerrar una reserva.
- **Test de Integración**: Verificar que una habitación en `Maintenance` no aparezca en los resultados de búsqueda de disponibilidad.
