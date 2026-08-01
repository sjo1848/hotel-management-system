ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS payment_reference VARCHAR(120),
    ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP;

UPDATE invoices
SET paid_at = created_at
WHERE status = 'PAID' AND paid_at IS NULL;
