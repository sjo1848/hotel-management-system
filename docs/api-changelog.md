# HMS Elite — API Changelog Contractual

## v1

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
