ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS paid_amount_cents BIGINT NOT NULL DEFAULT 0;

ALTER TABLE cash_closures
ADD COLUMN IF NOT EXISTS payment_count BIGINT NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS payment_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    amount_cents BIGINT NOT NULL,
    payment_method VARCHAR(20) NOT NULL DEFAULT 'CASH',
    payment_reference VARCHAR(120),
    note VARCHAR(250),
    received_by_user_id UUID REFERENCES users(id),
    received_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT payment_entries_positive_amount CHECK (amount_cents > 0),
    CONSTRAINT payment_entries_valid_method CHECK (payment_method IN ('CASH', 'CARD', 'TRANSFER'))
);

CREATE INDEX IF NOT EXISTS idx_payment_entries_hotel_booking_received_at
    ON payment_entries (hotel_id, booking_id, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_payment_entries_hotel_invoice_received_at
    ON payment_entries (hotel_id, invoice_id, received_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS ux_payment_entries_hotel_id_id
    ON payment_entries (hotel_id, id);

CREATE UNIQUE INDEX IF NOT EXISTS ux_invoices_hotel_id_id
    ON invoices (hotel_id, id);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM payment_entries pe
        JOIN invoices i ON i.id = pe.invoice_id
        WHERE pe.hotel_id <> i.hotel_id
    ) THEN
        RAISE EXCEPTION 'Cruce tenant detectado: payment_entries(invoice_id) -> invoices';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM payment_entries pe
        JOIN bookings b ON b.id = pe.booking_id
        WHERE pe.hotel_id <> b.hotel_id
    ) THEN
        RAISE EXCEPTION 'Cruce tenant detectado: payment_entries(booking_id) -> bookings';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM payment_entries pe
        JOIN users u ON u.id = pe.received_by_user_id
        WHERE pe.received_by_user_id IS NOT NULL
          AND pe.hotel_id <> u.hotel_id
    ) THEN
        RAISE EXCEPTION 'Cruce tenant detectado: payment_entries(received_by_user_id) -> users';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_payment_entries_hotel_invoice') THEN
        ALTER TABLE payment_entries
            ADD CONSTRAINT fk_payment_entries_hotel_invoice
            FOREIGN KEY (hotel_id, invoice_id)
            REFERENCES invoices (hotel_id, id)
            NOT VALID;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_payment_entries_hotel_booking') THEN
        ALTER TABLE payment_entries
            ADD CONSTRAINT fk_payment_entries_hotel_booking
            FOREIGN KEY (hotel_id, booking_id)
            REFERENCES bookings (hotel_id, id)
            NOT VALID;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_payment_entries_hotel_user') THEN
        ALTER TABLE payment_entries
            ADD CONSTRAINT fk_payment_entries_hotel_user
            FOREIGN KEY (hotel_id, received_by_user_id)
            REFERENCES users (hotel_id, id)
            NOT VALID;
    END IF;
END $$;

ALTER TABLE payment_entries VALIDATE CONSTRAINT fk_payment_entries_hotel_invoice;
ALTER TABLE payment_entries VALIDATE CONSTRAINT fk_payment_entries_hotel_booking;
ALTER TABLE payment_entries VALIDATE CONSTRAINT fk_payment_entries_hotel_user;

ALTER TABLE payment_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_entries FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS payment_entries_tenant_isolation ON payment_entries;
CREATE POLICY payment_entries_tenant_isolation
    ON payment_entries
    USING (
        public.hms_rls_bypass_enabled()
        OR hotel_id = public.hms_current_hotel_id()
    )
    WITH CHECK (
        public.hms_rls_bypass_enabled()
        OR hotel_id = public.hms_current_hotel_id()
    );

UPDATE invoices
SET paid_amount_cents = amount_cents
WHERE status = 'PAID'
  AND COALESCE(paid_amount_cents, 0) = 0;

INSERT INTO payment_entries (
    id,
    hotel_id,
    invoice_id,
    booking_id,
    amount_cents,
    payment_method,
    payment_reference,
    note,
    received_at
)
SELECT
    gen_random_uuid(),
    i.hotel_id,
    i.id,
    i.booking_id,
    i.amount_cents,
    COALESCE(i.payment_method, 'CASH'),
    i.payment_reference,
    'legacy backfill from invoices',
    COALESCE(i.paid_at, i.created_at)
FROM invoices i
WHERE i.status = 'PAID'
  AND NOT EXISTS (
      SELECT 1
      FROM payment_entries pe
      WHERE pe.hotel_id = i.hotel_id
        AND pe.invoice_id = i.id
  );

UPDATE cash_closures
SET payment_count = 0
WHERE payment_count IS NULL;
