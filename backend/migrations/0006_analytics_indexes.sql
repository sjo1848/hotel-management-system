-- Migration 0006: Analytics and Operational Indexes
-- Purpose: Improve performance for dashboards, reports, and audit logs.

-- Indexes for operational dashboards and room status
CREATE INDEX IF NOT EXISTS idx_bookings_status_checkin ON bookings(status, check_in);

-- Index for temporal reports (revenue, occupancy)
CREATE INDEX IF NOT EXISTS idx_bookings_created_at ON bookings(created_at);

-- Indexes for audit trail performance
CREATE INDEX IF NOT EXISTS idx_audit_events_created_at_desc ON audit_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_action_created_at ON audit_events(action, created_at DESC);

-- Partial index for active refresh tokens (optimizes login/refresh flow)
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_active_user ON refresh_tokens(user_id) WHERE revoked_at IS NULL;
