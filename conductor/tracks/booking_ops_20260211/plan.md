# Plan de Implementación: Gestión Operativa de Reservas y Huéspedes

## Track ID: booking_ops_20260211

### Fase 1: Integración del Calendario (Tape Chart)
- [x] Task: Consumir reservas reales en `TapeChart.tsx`.
    - [x] Implement to Pass: Modificar `TapeChart.tsx` para usar el `bookingService` y mostrar bloques de reserva reales.
- [x] Task: Optimizar carga de datos por rango de fechas.
    - [x] Implement to Pass: Añadir filtros de fecha en la petición al backend para no saturar el calendario.

### Fase 2: Flujo de Reserva y Huéspedes
- [x] Task: Vincular Reservas con Huéspedes (Data Model).
    - [x] Migration: Crear migración `0004_add_guest_id_to_bookings.sql`.
    - [x] Backend: Actualizar modelo `Booking` y repositorio para incluir `guest_id`.
- [x] Task: Formulario de reserva con búsqueda predictiva.
    - [x] Frontend: Integrar búsqueda de huéspedes en el `BookingDrawer`.
    - [x] Logic: Si el huésped no existe, crearlo automáticamente antes de confirmar la reserva.
- [ ] Task: Validación de disponibilidad visual.
    - [ ] Implement to Pass: Bloquear fechas ya reservadas en el selector de calendario del frontend.

### Fase 3: Ciclo de Vida (Check-in/Out) y Pulido Visual
- [x] Task: Acciones rápidas en la reserva.
    - [x] Implement to Pass: Añadir botones de "Check-in" y "Check-out" que actualicen el estado en la DB.
- [x] Task: Refuerzo visual y solidez.
    - [x] Implement to Pass: Eliminar transparencias, mejorar contraste y añadir código de colores por estado en el calendario.
- [ ] Task: Verificación de pagos pendientes.
    - [ ] Implement to Pass: Mostrar una alerta si se intenta hacer check-out con saldo pendiente (lógica básica).
