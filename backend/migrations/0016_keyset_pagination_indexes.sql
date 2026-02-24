-- EP11/T302: keyset pagination indexes for high-volume tenant-scoped lists.
CREATE INDEX IF NOT EXISTS idx_bookings_hotel_created_at_id_desc
    ON bookings (hotel_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_guests_hotel_created_at_id_desc
    ON guests (hotel_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_invoices_hotel_created_at_id_desc
    ON invoices (hotel_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_audit_events_hotel_created_at_id_desc
    ON audit_events (hotel_id, created_at DESC, id DESC);
