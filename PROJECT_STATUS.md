# HMS Elite - Estado, Issues y Sprints

## Resumen Ejecutivo
El sistema ya levanta con backend y frontend integrados en Auth, Rooms y Bookings. El login funciona y la UI consume APIs reales. Se corrigieron errores críticos de compilación y CORS, y se agregó una migración para `bookings.status`.

## Avances Confirmados
1. Backend compila y arranca.
2. Auth funcional: login, refresh, logout, me.
3. Frontend consume backend real para Auth, Rooms y Bookings.
4. CORS estable con lista de orígenes.
5. Migración aplicada para `bookings.status`.
6. Middleware de auth corrige `/api/auth/me`.

## Issues Actuales
1. Migraciones: solo existía `0001_init` en DB, se agregó `0002_add_booking_status.sql` y ya se aplicó. Validar que el entorno de prod tenga este cambio.
2. Datos semilla: si no hay rooms, RoomsPage no muestra resultados ni permite reservas.
3. BookingDrawer pide `guest_email` pero backend no lo usa. Riesgo de confusión en UX.
4. `/api/bookings` no incluye lógica de cálculo de precio total ni validación avanzada de solapamientos desde UI.
5. Manejo de sesión: `localStorage` + cookies. Necesario definir un estándar único.
6. CORS y cookies: si se usa producción con dominio distinto, validar `COOKIE_SECURE` y `SameSite`.

## Riesgos
1. Inconsistencias de schema entre entornos si no se ejecutan migraciones.
2. Rate limiting sin observabilidad de métricas.
3. Falta de tests de integración en Auth y Bookings.
4. Falta de validaciones de datos en frontend para fechas y formatos.

## Propuesta de Sprints

### Sprint 1: Estabilidad + Observabilidad
Objetivo: asegurar que la base sea confiable.
1. Verificación automática de migraciones en arranque.
2. Seed de habitaciones de demo.
3. Logs de auth y errores con IDs de request.
4. Añadir health checks para DB.
5. Documentación de variables de entorno.

### Sprint 2: Flujo Operativo
Objetivo: operación real desde la UI.
1. Rooms: disponibilidad con rango y estados.
2. Bookings: crear, editar, cancelar con feedback y recarga.
3. Guests: listado y creación real desde UI.
4. Usuarios: listado y alta (solo admin).

### Sprint 3: Producto y UX
Objetivo: UX consistente y lista para demo.
1. Unificar manejo de sesión y expiración.
2. Estados vacíos y errores coherentes.
3. Dashboard con KPIs reales (ocupación, reservas activas).
4. Ajustes visuales para mobile.

## Buenas Ideas para Avanzar
1. Crear un cliente API tipado y centralizado con `services` + `hooks`.
2. Implementar `seed` opcional al boot si no hay rooms.
3. Definir contrato de status de booking y mapearlo en UI.
4. Unificar Auth en cookies o Bearer, no ambos.
5. Agregar endpoint `/api/rooms/seed` protegido para demo rápido.
6. Crear pruebas mínimas: login, list rooms, create booking.
7. Crear un script `scripts/smoke.sh` para validar endpoints.

## Próximo Paso Recomendado
Implementar el seed de habitaciones y completar Guests + Users en UI. Eso desbloquea un demo completo.
