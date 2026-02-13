-- Enterprise session hardening:
-- 1) explicit session/device metadata in refresh tokens
-- 2) indexes for device/session revocation and rotation flows

ALTER TABLE refresh_tokens
    ADD COLUMN IF NOT EXISTS session_id UUID DEFAULT gen_random_uuid();

UPDATE refresh_tokens
SET session_id = gen_random_uuid()
WHERE session_id IS NULL;

ALTER TABLE refresh_tokens
    ALTER COLUMN session_id SET NOT NULL;

ALTER TABLE refresh_tokens
    ADD COLUMN IF NOT EXISTS device_id VARCHAR(128) DEFAULT 'unknown';

UPDATE refresh_tokens
SET device_id = 'unknown'
WHERE device_id IS NULL OR btrim(device_id) = '';

ALTER TABLE refresh_tokens
    ALTER COLUMN device_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hotel_user_device_revoked
    ON refresh_tokens (hotel_id, user_id, device_id, revoked_at, expires_at);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hotel_user_session_revoked
    ON refresh_tokens (hotel_id, user_id, session_id, revoked_at, expires_at);
