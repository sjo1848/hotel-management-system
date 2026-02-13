-- HMS Elite - Tenant FK Integrity Hardening
-- Fecha: 2026-02-13
-- Objetivo: impedir cruces entre hoteles a nivel de FK en tablas relacionadas.

-- 1) Validación preventiva: detectar referencias cruzadas existentes.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM bookings b
        JOIN rooms r ON r.id = b.room_id
        WHERE b.hotel_id <> r.hotel_id
    ) THEN
        RAISE EXCEPTION 'Cruce tenant detectado: bookings(room_id) -> rooms';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM bookings b
        JOIN guests g ON g.id = b.guest_id
        WHERE b.guest_id IS NOT NULL
          AND b.hotel_id <> g.hotel_id
    ) THEN
        RAISE EXCEPTION 'Cruce tenant detectado: bookings(guest_id) -> guests';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM refresh_tokens rt
        JOIN users u ON u.id = rt.user_id
        WHERE rt.hotel_id <> u.hotel_id
    ) THEN
        RAISE EXCEPTION 'Cruce tenant detectado: refresh_tokens(user_id) -> users';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM invoices i
        JOIN bookings b ON b.id = i.booking_id
        WHERE i.hotel_id <> b.hotel_id
    ) THEN
        RAISE EXCEPTION 'Cruce tenant detectado: invoices(booking_id) -> bookings';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM extra_charges ec
        JOIN bookings b ON b.id = ec.booking_id
        WHERE ec.hotel_id <> b.hotel_id
    ) THEN
        RAISE EXCEPTION 'Cruce tenant detectado: extra_charges(booking_id) -> bookings';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM cash_closures cc
        JOIN users u ON u.id = cc.user_id
        WHERE cc.hotel_id <> u.hotel_id
    ) THEN
        RAISE EXCEPTION 'Cruce tenant detectado: cash_closures(user_id) -> users';
    END IF;
END $$;

-- 2) Índices únicos compuestos para soportar FK (hotel_id, id).
CREATE UNIQUE INDEX IF NOT EXISTS ux_rooms_hotel_id_id ON rooms (hotel_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_guests_hotel_id_id ON guests (hotel_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_users_hotel_id_id ON users (hotel_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_bookings_hotel_id_id ON bookings (hotel_id, id);

-- 3) FKs compuestas tenant-scoped (idempotente via catálogo).
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_bookings_hotel_room') THEN
        ALTER TABLE bookings
            ADD CONSTRAINT fk_bookings_hotel_room
            FOREIGN KEY (hotel_id, room_id)
            REFERENCES rooms (hotel_id, id)
            NOT VALID;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_bookings_hotel_guest') THEN
        ALTER TABLE bookings
            ADD CONSTRAINT fk_bookings_hotel_guest
            FOREIGN KEY (hotel_id, guest_id)
            REFERENCES guests (hotel_id, id)
            NOT VALID;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_refresh_tokens_hotel_user') THEN
        ALTER TABLE refresh_tokens
            ADD CONSTRAINT fk_refresh_tokens_hotel_user
            FOREIGN KEY (hotel_id, user_id)
            REFERENCES users (hotel_id, id)
            NOT VALID;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_audit_events_hotel_user') THEN
        ALTER TABLE audit_events
            ADD CONSTRAINT fk_audit_events_hotel_user
            FOREIGN KEY (hotel_id, user_id)
            REFERENCES users (hotel_id, id)
            NOT VALID;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_invoices_hotel_booking') THEN
        ALTER TABLE invoices
            ADD CONSTRAINT fk_invoices_hotel_booking
            FOREIGN KEY (hotel_id, booking_id)
            REFERENCES bookings (hotel_id, id)
            NOT VALID;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_extra_charges_hotel_booking') THEN
        ALTER TABLE extra_charges
            ADD CONSTRAINT fk_extra_charges_hotel_booking
            FOREIGN KEY (hotel_id, booking_id)
            REFERENCES bookings (hotel_id, id)
            NOT VALID;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_cash_closures_hotel_user') THEN
        ALTER TABLE cash_closures
            ADD CONSTRAINT fk_cash_closures_hotel_user
            FOREIGN KEY (hotel_id, user_id)
            REFERENCES users (hotel_id, id)
            NOT VALID;
    END IF;
END $$;

-- 4) Validación de constraints (separada para menor lock-time de escritura).
ALTER TABLE bookings VALIDATE CONSTRAINT fk_bookings_hotel_room;
ALTER TABLE bookings VALIDATE CONSTRAINT fk_bookings_hotel_guest;
ALTER TABLE refresh_tokens VALIDATE CONSTRAINT fk_refresh_tokens_hotel_user;
ALTER TABLE audit_events VALIDATE CONSTRAINT fk_audit_events_hotel_user;
ALTER TABLE invoices VALIDATE CONSTRAINT fk_invoices_hotel_booking;
ALTER TABLE extra_charges VALIDATE CONSTRAINT fk_extra_charges_hotel_booking;
ALTER TABLE cash_closures VALIDATE CONSTRAINT fk_cash_closures_hotel_user;
