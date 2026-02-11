# Plan de Implementación: Housekeeping y Mantenimiento

## Track ID: housekeeping_ops_20260211

### Fase 1: Motor de Estados (Backend)
- [x] Task: Endpoint `PATCH /api/v1/rooms/:id/status` para cambios manuales.
- [x] Task: Integración en `BookingService` para disparar limpieza tras Check-out.
- [x] Task: **QA**: Test de integración de disponibilidad con bloqueos de mantenimiento.

### Fase 2: Panel de Gestión (Frontend)
- [x] Task: Crear página `/housekeeping` con tarjetas de estado compactas.
- [x] Task: Implementar filtros por piso o por estado (Sucia/Limpia).
- [x] Task: **UX/UI**: Optimizar la vista para uso móvil/tablet con botones grandes.

### Fase 3: Visibilidad en Recepción
- [x] Task: Mostrar icono de "Habitación Sucia" en el Tape Chart.
- [x] Task: Advertencia al recepcionista si intenta hacer Check-in en una habitación no limpia.
- [x] Task: **Revisión y Mejora**: Pulido final de transiciones y animaciones.
