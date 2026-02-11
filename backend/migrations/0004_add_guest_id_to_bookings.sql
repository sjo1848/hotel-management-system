-- backend/migrations/0004_add_guest_id_to_bookings.sql
ALTER TABLE bookings ADD COLUMN guest_id UUID REFERENCES guests(id);
CREATE INDEX IF NOT EXISTS idx_bookings_guest_id ON bookings (guest_id);
