# HMS Elite — API Changelog Contractual

## v1

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
