-- Sprint 6 (SCALE-062): feature flags por plan sin redeploy.
-- Fuente de verdad: plan_tier por hotel para habilitar gating BASIC/PRO/ENTERPRISE.

ALTER TABLE hotels
    ADD COLUMN IF NOT EXISTS plan_tier VARCHAR(20) NOT NULL DEFAULT 'PRO';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'ck_hotels_plan_tier'
    ) THEN
        ALTER TABLE hotels
            ADD CONSTRAINT ck_hotels_plan_tier
            CHECK (plan_tier IN ('BASIC', 'PRO', 'ENTERPRISE'));
    END IF;
END;
$$;

UPDATE hotels
SET plan_tier = 'PRO'
WHERE plan_tier IS NULL OR plan_tier = '';
