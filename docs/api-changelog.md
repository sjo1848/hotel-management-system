# HMS Elite — API Changelog Contractual

## v1

### 2026-08-01
- Los schemas de respuesta `Room`, `Booking` y `Guest` declaran como requeridos los campos que el backend siempre serializa, incluso cuando su valor puede ser `null`.
- `Room` y `Guest` incorporan `hotel_id`; `Guest` incorpora `created_at`, corrigiendo omisiones documentales frente a la respuesta runtime.
- No cambian payloads ni rutas API v1: es una correccion aditiva/precisa del contrato publicado y del cliente generado.
- `POST /api/v1/housekeeping/{id}/maintenance` acepta evidencia opcional de apertura (`reason`, `priority`, `assigned_to`) y devuelve el `MaintenanceCase` persistido.
- `POST /api/v1/housekeeping/{id}/dirty` acepta `resolution_note`, cierra el caso abierto y devuelve siempre la habitacion a `Dirty`; actor, timestamps y auditoria se guardan en la misma transaccion.
- `GET /api/v1/housekeeping/board` expone el caso abierto de cada habitacion mediante `maintenance_case`.
- Los cambios de estado genericos y masivos ya no pueden entrar ni salir de `Maintenance`; ese estado queda reservado al workflow de housekeeping.
- No hay breaking change de rutas v1: ambos cuerpos siguen siendo opcionales para clientes existentes y el backend genera evidencia legacy segura cuando faltan.
- `PATCH /api/v1/bookings/{id}` incorpora el estado terminal `NoShow`, separado de `Cancelled`.
- Cancelacion y no-show exigen `front_desk.terminal_reason`; no-show solo se admite desde la fecha de llegada. Ambas acciones persisten actor y timestamp y liberan disponibilidad.
- `front_desk.late_arrival_eta` y `front_desk.late_arrival_note` registran una llegada tardia sin sacar la reserva de `Confirmed`; la ETA debe ser futura y quedar dentro de la estadia.
- `Booking.operational_data` expone motivo y evidencia de la accion terminal, junto con ETA, nota, actor y timestamp de llegada tardia.
- No hay breaking change de forma en API v1: se agregan un valor de enum y campos opcionales. Los consumidores que hagan exhaustividad sobre estados deben contemplar `NoShow`.
- `PATCH /api/v1/bookings/{id}` aplica en backend la secuencia `Confirmed -> CheckedIn -> CheckedOut` y `Confirmed -> Cancelled`.
- Check-in exige cantidad de huespedes e identidad, contacto y estadia confirmados; checkout exige habitacion ocupada, checklist de salida y politica de saldo.
- La politica `settled` exige cuenta totalmente cobrada; `pending-approved` exige referencia operativa de al menos 6 caracteres.
- Los intentos que omiten estas invariantes fallan con `400` dentro de la transaccion, sin efectos parciales sobre reserva, habitacion, factura o auditoria.
- La forma del contrato API v1 se preserva; se endurece la semantica fail-closed ya representada por `front_desk`.
- Se agrega la capability `bookings.checkout.override`, asignada solo a `admin`; `pending-approved` devuelve `403` para roles sin esa capability.
- Cada override persiste actor, reserva, saldo pendiente y referencia dentro de la misma transaccion de checkout.
- `POST /api/v1/billing/close-cash` agrega de forma opcional `expected_cash_amount_cents`, `counted_cash_amount_cents` y `handoff_to`; `notes` documenta novedades de entrega.
- `CashClosure` agrega `counted_cash_amount_cents`, `cash_difference_cents` y `handoff_to` para conciliacion por turno.
- Cobros y cierres se serializan por hotel: un cierre stale falla con `400` y un cobro concurrente se asigna a la ventana siguiente.
- No hay breaking change: clientes v1 existentes conservan el cierre con efectivo esperado y handoff generico cuando omiten los campos nuevos.
- La autorizacion de `GET/POST /api/v1/hotels`, `GET /api/v1/hotels/network-kpis` y `PATCH /api/v1/hotels/{id}/plan` queda reservada a `saas_admin`; el rol tenant `admin` recibe `403`.
- No se eliminan endpoints ni schemas v1; se corrige la frontera de privilegios tenant/plataforma de acuerdo con el canon RBAC.
- `POST /api/v1/users` rechaza `role=saas_admin` con `400`; un administrador tenant no puede autoprovisionar un principal de plataforma.
- `POST /api/v1/users` acepta y normaliza los cuatro roles tenant documentados: `admin`, `ops`, `receptionist` y `housekeeping`; la auditoria identifica al administrador actor, al usuario creado y su rol.
- `GET /api/v1/users` omite identidades `saas_admin` y `DELETE /api/v1/users/{id}` las protege con `403`, evitando que la administracion tenant gestione principales de plataforma.
- No hay breaking change de forma en API v1: se alinea la semantica de administracion de usuarios con el enum tenant y la frontera RBAC vigente.

### 2026-07-31
- Se agrega `GET /api/v1/rooms/{id}` para consultar una habitación dentro del tenant autenticado.
- `CreateBookingRequest` documenta el campo opcional `guest_id`, ya aceptado por el backend y requerido por el flujo walk-in.
- Se corrige la plantilla OpenAPI de holds a `/api/v1/rooms/{id}/holds/{hold_id}` para representar ambos parámetros sin ambigüedad.
- No hay breaking change: se agrega una lectura y se corrige documentación contractual de operaciones existentes.

### 2026-03-08
- `GET /api/v1/front-desk/board` ahora expone `action_queue` como cola priorizada contractual de recepcion.
- Se incorporan los schemas `FrontDeskQueueItem` y `FrontDeskActionKind`.
- La cola incluye `lane`, `title`, `detail`, `primary_label` y `action_kind` para que frontend no dependa de heuristicas locales al ordenar el turno.
- No hay breaking change: el contrato v1 solo agrega metadata operativa al board existente.
- Se agrega `POST /api/v1/bookings/{id}/settle-payment` para liquidar y cobrar una reserva usando la `Invoice` del booking.
- Se agregan endpoints de cobro incremental por reserva:
  - `GET /api/v1/bookings/{id}/payments`
  - `POST /api/v1/bookings/{id}/payments`
- Se incorpora el schema `RegisterBookingPaymentRequest` para registrar pagos parciales o totales con `amount_cents`, `payment_method`, `payment_reference` y `note`.
- `Invoice` ahora expone metadata contable adicional:
  - `payment_method`
  - `payment_reference`
  - `paid_at`
- `Invoice` ahora expone `paid_amount_cents` para representar el monto cobrado acumulado aun cuando la reserva siga con saldo pendiente.
- Caja y cierres usan el momento real de cobro (`paid_at`) en lugar de depender solo de la fecha de emision de la factura.
- `GET /api/v1/billing/balance` amplía la respuesta con `payment_count`, `opening_time`, `pending_amount_cents` y `pending_bookings_count`.
- `CashClosure` ahora expone `payment_count` para reflejar cantidad real de cobros del turno cerrado.
- Se incorpora el schema `PaymentEntry` para listar movimientos de cobro por reserva.
- No hay breaking change: se amplia el contrato v1 con settlement completo de factura sin alterar endpoints existentes.
- Se agrega `GET /api/v1/billing/closures` para listar cierres de caja recientes desde reportes y operaciones.
- Se corrige el mapping de `created_at` en `RoomHoldBoardEntry` para que front desk reciba timestamps reales de holds activos.
- Se amplía el dataset demo local con cierres de caja, más facturas pagas y reservas históricas para dashboard/reportes.
- Se agrega el endpoint `PATCH /api/v1/rooms/{id}` para actualizar configuracion administrativa de habitaciones.
- Se incorpora el schema `UpdateRoomRequest` con `room_number`, `room_type` y `price_cents`.
- No hay breaking change: se amplia el contrato v1 de rooms sin alterar endpoints existentes.
- Se amplia `PATCH /api/v1/bookings/{id}` para soportar `room_id` y `operational_note`.
- Esto habilita reasignacion transaccional de habitaciones y auditoria operativa de excepciones admin desde el centro operativo de reservas.
- No hay breaking change: el contrato v1 de reservas solo agrega campos opcionales al payload existente.
- Se agregan endpoints de bloqueos temporales por fechas:
  - `GET /api/v1/rooms/{id}/holds`
  - `POST /api/v1/rooms/{id}/holds`
  - `DELETE /api/v1/rooms/{id}/holds/{hold_id}`
- Se incorporan los schemas `RoomHold` y `CreateRoomHoldRequest`.
- La disponibilidad de `GET /api/v1/rooms/available` y la creación/reasignación de reservas ahora respetan esos bloqueos temporales.
- Se agrega `GET /api/v1/rooms/holds/board` para ver bloqueos del inventario por rango sin recorrer habitación por habitación.
- Se agrega `PATCH /api/v1/rooms/{id}/holds/{hold_id}` para editar bloqueos existentes sin recrearlos.
- `RoomHold` y `CreateRoomHoldRequest` ahora tipan `hold_type` (`Vip|Maintenance|Owner|Compliance|Commercial|Other`).
- Se incorpora el schema `RoomHoldBoardEntry` para el tablero global de bloqueos.
- `PATCH /api/v1/bookings/{id}` ahora acepta `front_desk` con metadata operativa opcional de check-in/check-out formal.
- `Booking` ahora expone `operational_data` con evidencia persistida de recepción para dejar de depender solo de estado UI local.
- Se agrega `GET /api/v1/front-desk/board` para que recepción consulte llegadas listas, llegadas bloqueadas, salidas del día, huéspedes en casa y holds activos desde una sola respuesta.
- Se incorporan los schemas `FrontDeskBoard`, `FrontDeskBoardEntry` y `FrontDeskBlocker`.
- Se agrega `POST /api/v1/rooms/bulk-status` para mover varias habitaciones entre estados operativos en una sola acción.
- Se incorporan los schemas `BulkUpdateRoomStatusRequest` y `BulkRoomStatusUpdateResult`.
- Se agregan endpoints operativos de housekeeping:
  - `GET /api/v1/housekeeping/board`
  - `POST /api/v1/housekeeping/{id}/maintenance`
  - `POST /api/v1/housekeeping/{id}/dirty`
- Se incorporan los schemas `HousekeepingBoard`, `HousekeepingBoardRoom` y `HousekeepingDeparture`.
- No hay breaking change: se amplia el contrato v1 para soportar tablero y desvíos operativos de housekeeping.

### 2026-02-24
- Se amplía el enum de `UiTelemetryEventRequest.event` para soportar KPIs premium HQ:
  - `network_kpis_viewed`
  - `network_plan_upgrade_submitted`
  - `network_plan_upgrade_succeeded`
  - `network_plan_upgrade_failed`
- Se mantienen eventos previos de dashboard/revenue para trazabilidad de adopción.
- No hay breaking change: el endpoint `POST /api/v1/telemetry/ui` conserva contrato v1 y formato de payload.

### 2026-02-23
- Se agregan endpoints de feature flags por plan:
  - `GET /api/v1/feature-flags`
  - `PATCH /api/v1/hotels/{id}/plan`
- Se agregan schemas contractuales:
  - `UpdateHotelPlanRequest`
  - `TenantFeatureFlags`
- Se introduce `plan_tier` (`BASIC|PRO|ENTERPRISE`) como fuente de gating SaaS sin redeploy.

### 2026-02-23
- Se agrega endpoint HQ multi-hotel:
  - `GET /api/v1/hotels/network-kpis` con filtros opcionales `start`/`end`.
- Se incorporan nuevos schemas OpenAPI para consolidado de cadena:
  - `HotelNetworkSummary`
  - `HotelNetworkHotelKpi`
- Este cambio habilita benchmark y drill-down por propiedad desde frontend SaaS Admin sin romper contrato v1 existente.

### 2026-02-23
- Se tipan respuestas críticas que estaban laxas en OpenAPI v1:
  - `GET /api/v1/invoices`
  - `GET /api/v1/bookings/{id}/invoice`
  - `GET /api/v1/reports/revenue`
  - `GET /api/v1/reports/occupancy`
  - `GET /api/v1/analytics/kpis`
  - `GET/POST /api/v1/hotels`
  - `GET/POST /api/v1/bookings/{id}/extra-charges`
  - `GET /api/v1/billing/balance`
  - `POST /api/v1/billing/close-cash`
- Se agrega contrato explícito de `InvoiceStatus` (`PENDING|PAID|VOIDED`) y `PaymentMethod` (`CASH|CARD|TRANSFER`).
- Se incorpora gate de drift OpenAPI -> cliente frontend generado (`scripts/check-openapi-client-drift.sh`).

### 2026-02-14
- Se formaliza la política de lifecycle API (ADR-0002).
- Se define catálogo estable de errores v1 y proceso de actualización.
