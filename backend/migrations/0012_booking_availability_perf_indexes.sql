-- HMS Elite - Performance indexes para disponibilidad y solapamiento de reservas
-- Fecha: 2026-02-13

-- Soporta check_availability/check_availability_excluding y subqueries de disponibilidad.
CREATE INDEX IF NOT EXISTS idx_bookings_hotel_room_dates_status
    ON bookings (hotel_id, room_id, check_in, check_out, status);

-- Soporta escaneo inicial de habitaciones disponibles por hotel + estado.
CREATE INDEX IF NOT EXISTS idx_rooms_hotel_status_id
    ON rooms (hotel_id, status, id);
