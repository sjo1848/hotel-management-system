-- HMS Elite - Hardening multi-tenant (constraints + performance indexes)
-- Fecha: 2026-02-13

-- 1) Validación preventiva: no continuar si existen duplicados por hotel.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM (
            SELECT hotel_id, username
            FROM users
            GROUP BY hotel_id, username
            HAVING COUNT(*) > 1
        ) t
    ) THEN
        RAISE EXCEPTION 'Duplicados detectados en users(hotel_id, username).';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM (
            SELECT hotel_id, room_number
            FROM rooms
            GROUP BY hotel_id, room_number
            HAVING COUNT(*) > 1
        ) t
    ) THEN
        RAISE EXCEPTION 'Duplicados detectados en rooms(hotel_id, room_number).';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM (
            SELECT hotel_id, email
            FROM guests
            GROUP BY hotel_id, email
            HAVING COUNT(*) > 1
        ) t
    ) THEN
        RAISE EXCEPTION 'Duplicados detectados en guests(hotel_id, email).';
    END IF;
END $$;

-- 2) Reemplazo de unicidad global por unicidad tenant-scoped.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_username_key;
ALTER TABLE rooms DROP CONSTRAINT IF EXISTS rooms_room_number_key;
ALTER TABLE guests DROP CONSTRAINT IF EXISTS guests_email_key;

CREATE UNIQUE INDEX IF NOT EXISTS ux_users_hotel_username
    ON users (hotel_id, username);

CREATE UNIQUE INDEX IF NOT EXISTS ux_rooms_hotel_room_number
    ON rooms (hotel_id, room_number);

CREATE UNIQUE INDEX IF NOT EXISTS ux_guests_hotel_email
    ON guests (hotel_id, email);

-- 3) Índices compuestos operativos recomendados.
CREATE INDEX IF NOT EXISTS idx_bookings_hotel_dates_status
    ON bookings (hotel_id, check_in, check_out, status);

CREATE INDEX IF NOT EXISTS idx_invoices_hotel_status_created_at
    ON invoices (hotel_id, status, created_at);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hotel_user_revoked_expires
    ON refresh_tokens (hotel_id, user_id, revoked_at, expires_at);
