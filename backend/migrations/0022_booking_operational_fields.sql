ALTER TABLE bookings
ADD COLUMN check_in_guests_count INTEGER,
ADD COLUMN check_in_reference VARCHAR(120),
ADD COLUMN check_in_document_verified BOOLEAN,
ADD COLUMN check_in_contact_confirmed BOOLEAN,
ADD COLUMN check_in_stay_confirmed BOOLEAN,
ADD COLUMN checked_in_at TIMESTAMP,
ADD COLUMN checked_in_by_user_id UUID,
ADD COLUMN check_out_payment_policy VARCHAR(32),
ADD COLUMN check_out_reference VARCHAR(120),
ADD COLUMN check_out_charges_reviewed BOOLEAN,
ADD COLUMN check_out_room_release_confirmed BOOLEAN,
ADD COLUMN check_out_housekeeping_handoff BOOLEAN,
ADD COLUMN checked_out_at TIMESTAMP,
ADD COLUMN checked_out_by_user_id UUID;

ALTER TABLE bookings
ADD CONSTRAINT bookings_check_out_payment_policy
CHECK (
    check_out_payment_policy IS NULL
    OR check_out_payment_policy IN ('settled', 'pending-approved')
);
