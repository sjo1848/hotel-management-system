CREATE TABLE maintenance_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    room_id UUID NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'OPEN',
    priority VARCHAR(16) NOT NULL DEFAULT 'MEDIUM',
    reason VARCHAR(250) NOT NULL,
    assigned_to VARCHAR(100) NOT NULL,
    reported_by_user_id UUID NOT NULL,
    reported_at TIMESTAMP NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
    resolution_note VARCHAR(250),
    resolved_by_user_id UUID,
    resolved_at TIMESTAMP,
    return_status VARCHAR(16),
    CONSTRAINT maintenance_cases_valid_status CHECK (status IN ('OPEN', 'RESOLVED')),
    CONSTRAINT maintenance_cases_valid_priority CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
    CONSTRAINT maintenance_cases_reason_length CHECK (char_length(btrim(reason)) BETWEEN 6 AND 250),
    CONSTRAINT maintenance_cases_assignee_length CHECK (char_length(btrim(assigned_to)) BETWEEN 2 AND 100),
    CONSTRAINT maintenance_cases_resolution_consistency CHECK (
        (status = 'OPEN' AND resolution_note IS NULL AND resolved_by_user_id IS NULL AND resolved_at IS NULL AND return_status IS NULL)
        OR
        (status = 'RESOLVED' AND char_length(btrim(resolution_note)) BETWEEN 6 AND 250 AND resolved_by_user_id IS NOT NULL AND resolved_at IS NOT NULL AND return_status = 'DIRTY')
    ),
    CONSTRAINT fk_maintenance_cases_hotel_room
        FOREIGN KEY (hotel_id, room_id) REFERENCES rooms (hotel_id, id),
    CONSTRAINT fk_maintenance_cases_hotel_reporter
        FOREIGN KEY (hotel_id, reported_by_user_id) REFERENCES users (hotel_id, id),
    CONSTRAINT fk_maintenance_cases_hotel_resolver
        FOREIGN KEY (hotel_id, resolved_by_user_id) REFERENCES users (hotel_id, id)
);

CREATE UNIQUE INDEX ux_maintenance_cases_open_room
    ON maintenance_cases (hotel_id, room_id)
    WHERE status = 'OPEN';

CREATE INDEX idx_maintenance_cases_hotel_status_reported
    ON maintenance_cases (hotel_id, status, reported_at DESC);

ALTER TABLE maintenance_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_cases FORCE ROW LEVEL SECURITY;
CREATE POLICY maintenance_cases_tenant_isolation
    ON maintenance_cases
    USING (
        public.hms_rls_bypass_enabled()
        OR hotel_id = public.hms_current_hotel_id()
    )
    WITH CHECK (
        public.hms_rls_bypass_enabled()
        OR hotel_id = public.hms_current_hotel_id()
    );
