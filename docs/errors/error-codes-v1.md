# HMS Elite — Error Codes v1

> Catálogo estable de `error_code` para `/api/v1`.

## Reglas
- `error_code` es estable dentro de v1.
- Mensaje puede cambiar por UX/localización, `error_code` no.
- Nuevos códigos requieren actualización de este catálogo.

## Núcleo (v1)
- `UNAUTHORIZED`
- `FORBIDDEN`
- `INVALID_INPUT`
- `INFRA_ERROR`

## Dominio Habitaciones
- `ROOM_NOT_FOUND`
- `ROOM_ALREADY_EXISTS`
- `INVALID_ROOM_STATUS_TRANSITION`
- `ROOM_NOT_AVAILABLE`

## Dominio Hoteles
- `HOTEL_NOT_FOUND`
- `HOTEL_ALREADY_EXISTS`

## Dominio Reservas
- `BOOKING_NOT_FOUND`
- `INVALID_BOOKING_DATES`

## Dominio Huéspedes
- `GUEST_NOT_FOUND`
- `GUEST_ALREADY_EXISTS`

## Dominio Usuarios
- `USER_NOT_FOUND`
- `USER_ALREADY_EXISTS`

## Dominio Facturación
- `INVOICE_NOT_FOUND`

## Gobernanza
- Owner: Principal Engineer
- Revisión: Security + QA
- Versionado: `v1`


