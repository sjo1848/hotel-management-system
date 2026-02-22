-- Sprint 6 (SCALE-062):
-- Plan tiers por hotel para habilitar feature flags sin redeploy.

ALTER TABLE hotels
    ADD COLUMN IF NOT EXISTS plan_tier VARCHAR(16) NOT NULL DEFAULT 'BASIC';

ALTER TABLE hotels
    DROP CONSTRAINT IF EXISTS ck_hotels_plan_tier;

ALTER TABLE hotels
    ADD CONSTRAINT ck_hotels_plan_tier
    CHECK (plan_tier IN ('BASIC', 'PRO', 'ENTERPRISE'));

CREATE INDEX IF NOT EXISTS idx_hotels_plan_tier ON hotels (plan_tier);
