ALTER TABLE bookings
ADD COLUMN terminal_reason VARCHAR(250),
ADD COLUMN terminal_recorded_at TIMESTAMP,
ADD COLUMN terminal_recorded_by_user_id UUID,
ADD COLUMN late_arrival_eta TIMESTAMP,
ADD COLUMN late_arrival_note VARCHAR(250),
ADD COLUMN late_arrival_recorded_at TIMESTAMP,
ADD COLUMN late_arrival_recorded_by_user_id UUID;

ALTER TABLE bookings
DROP CONSTRAINT IF EXISTS bookings_no_overlap;

ALTER TABLE bookings
ADD CONSTRAINT bookings_no_overlap
EXCLUDE USING gist (
    room_id WITH =,
    daterange(check_in, check_out, '[)') WITH &&
)
WHERE (status NOT IN ('CANCELLED', 'NO_SHOW'));
