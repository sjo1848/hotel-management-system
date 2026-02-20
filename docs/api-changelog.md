# HMS Elite — API Changelog Contractual

## v1

### 2026-02-20 04:20 (-03:00)
- Hardening no-breaking del contrato OpenAPI en analítica/reportes:
  - `RevenueReport`, `OccupancyReport`, `DashboardKpis` y `BookingAlert` ahora definen `required` explícito y `additionalProperties: false`.
- Se explicitan enums de estado en contrato core para reducir drift FE/BE:
  - `Room.status`, `Booking.status`, `BookingAlert.status`.
  - `PATCH /api/v1/rooms/{id}/status` enum explícito del payload.

### 2026-02-15 16:40 (-03:00)
- Se agrega endpoint `GET /api/v1/rooms/{id}` para alinear contrato FE/BE en detalle de habitación.
- Se formaliza ventana de compatibilidad para endpoints legacy de listado completo:
  - `GET /api/v1/bookings`
  - `GET /api/v1/guests`
  - `GET /api/v1/invoices`
  - `GET /api/v1/audit/events`
- Fecha objetivo de retiro de los endpoints legacy listados: **2026-05-01**.

### 2026-02-15 15:57 (-03:00)
- Se agrega endpoint paginado no-breaking `GET /api/v1/bookings/page` con contrato `limit/cursor/start/end` y respuesta `items/next_cursor/has_more`.
- Se agregan endpoints paginados no-breaking:
  - `GET /api/v1/guests/page`
  - `GET /api/v1/invoices/page`
  - `GET /api/v1/audit/events/page`
- Se mantiene compatibilidad temporal con `GET /api/v1/bookings` (lista completa) durante migración a keyset.
- Se mantiene compatibilidad temporal con endpoints legacy de lista completa: `GET /api/v1/guests`, `GET /api/v1/invoices`, `GET /api/v1/audit/events`.
- Se incorporan índices compuestos keyset para listados tenant-scoped de alto volumen:
  - `idx_bookings_hotel_created_at_id_desc`
  - `idx_guests_hotel_created_at_id_desc`
  - `idx_invoices_hotel_created_at_id_desc`
  - `idx_audit_events_hotel_created_at_id_desc`
- Se actualiza baseline de performance para incluir endpoint paginado (`scripts/perf-baseline.sh`).

### 2026-02-15 08:07 (-03:00)
- Se endurece validación de tenant context en requests autenticados (rechazo de `hotel_id` vacío/inválido/nil).
- Se aplica tenant context fail-closed en repos tenant-scoped adicionales (`rooms`, `guests`, `extra_charges`, `cash_closures`, `audit_events`).
- Se acota bypass RLS a flujo controlado de refresh token con razón explícita y métrica de auditoría.

### 2026-02-14 21:30 (-03:00)
- Se consolida matriz única `DomainError -> HTTP/error_code/message/details` en `backend/src/domain/errors.rs`.
- El parser frontend prioriza `error_code` como clave contractual (`frontend/src/api/errors.ts`).
- Se endurece la gobernanza documental: `scripts/check-validation-governance.sh` ahora compara catálogo (`docs/errors/error-codes-v1.md`) contra contrato runtime.

### 2026-02-14
- Se formaliza la política de lifecycle API (ADR-0002).
- Se define catálogo estable de errores v1 y proceso de actualización.
