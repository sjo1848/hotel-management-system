-- HMS-DATA-011: Tenant query tuning for high-frequency ordered reads
-- Fecha: 2026-02-14
-- Objetivo: acelerar patrones WHERE hotel_id = ? ORDER BY <time> DESC

CREATE INDEX IF NOT EXISTS idx_bookings_hotel_created_at_desc
    ON bookings (hotel_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_users_hotel_created_at_desc
    ON users (hotel_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_guests_hotel_created_at_desc
    ON guests (hotel_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_events_hotel_created_at_desc
    ON audit_events (hotel_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_invoices_hotel_created_at_desc
    ON invoices (hotel_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cash_closures_hotel_closing_time_desc
    ON cash_closures (hotel_id, closing_time DESC);
