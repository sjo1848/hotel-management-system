CREATE TABLE IF NOT EXISTS room_holds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason VARCHAR(250) NOT NULL,
    created_by_user_id UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT room_hold_valid_dates CHECK (end_date > start_date)
);

CREATE INDEX IF NOT EXISTS idx_room_holds_room_dates
    ON room_holds (hotel_id, room_id, start_date, end_date);
