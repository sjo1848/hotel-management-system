ALTER TABLE cash_closures
ADD COLUMN IF NOT EXISTS counted_cash_amount_cents BIGINT NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS cash_difference_cents BIGINT NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS handoff_to VARCHAR(120) NOT NULL DEFAULT 'Siguiente turno';

UPDATE cash_closures
SET counted_cash_amount_cents = cash_amount_cents,
    cash_difference_cents = 0
WHERE counted_cash_amount_cents = 0
  AND cash_amount_cents <> 0;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'cash_closures_counted_cash_non_negative'
    ) THEN
        ALTER TABLE cash_closures
            ADD CONSTRAINT cash_closures_counted_cash_non_negative
            CHECK (counted_cash_amount_cents >= 0);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'cash_closures_handoff_to_not_blank'
    ) THEN
        ALTER TABLE cash_closures
            ADD CONSTRAINT cash_closures_handoff_to_not_blank
            CHECK (length(btrim(handoff_to)) > 0);
    END IF;
END $$;
