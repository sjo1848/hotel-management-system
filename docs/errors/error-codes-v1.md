# HMS Elite — Error Codes v1

> Catálogo estable de `error_code` para `/api/v1`.
> Última actualización: 2026-02-14 21:30 (-03:00)

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

## Matriz contractual runtime (fuente: `backend/src/domain/errors.rs`)
| DomainError | HTTP | `error_code` |
|---|---:|---|
| `RoomNotFound` | 404 | `ROOM_NOT_FOUND` |
| `HotelNotFound` | 404 | `HOTEL_NOT_FOUND` |
| `HotelAlreadyExists` | 409 | `HOTEL_ALREADY_EXISTS` |
| `RoomAlreadyExists` | 409 | `ROOM_ALREADY_EXISTS` |
| `GuestAlreadyExists` | 409 | `GUEST_ALREADY_EXISTS` |
| `GuestNotFound` | 404 | `GUEST_NOT_FOUND` |
| `UserAlreadyExists` | 409 | `USER_ALREADY_EXISTS` |
| `UserNotFound` | 404 | `USER_NOT_FOUND` |
| `InvalidRoomStatusTransition` | 400 | `INVALID_ROOM_STATUS_TRANSITION` |
| `RoomNotAvailable` | 409 | `ROOM_NOT_AVAILABLE` |
| `InvalidBookingDates` | 400 | `INVALID_BOOKING_DATES` |
| `BookingNotFound` | 404 | `BOOKING_NOT_FOUND` |
| `InvoiceNotFound` | 404 | `INVOICE_NOT_FOUND` |
| `InvalidInput` | 400 | `INVALID_INPUT` |
| `Unauthorized` | 401 | `UNAUTHORIZED` |
| `Forbidden` | 403 | `FORBIDDEN` |
| `InfrastructureError` | 500 | `INFRA_ERROR` |

## Gobernanza
- Owner: Principal Engineer
- Revisión: Security + QA
- Versionado: `v1`

