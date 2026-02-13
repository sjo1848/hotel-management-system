-- HMS Elite - Módulo de Cierre de Caja (Profit Guard)

-- 1. Añadir método de pago a las facturas
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20) DEFAULT 'CASH'; -- CASH, CARD, TRANSFER

-- 2. Crear tabla de cierres de caja
CREATE TABLE IF NOT EXISTS cash_closures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID NOT NULL REFERENCES hotels(id),
    user_id UUID NOT NULL REFERENCES users(id),
    total_amount_cents BIGINT NOT NULL,
    cash_amount_cents BIGINT NOT NULL,
    card_amount_cents BIGINT NOT NULL,
    opening_time TIMESTAMP WITH TIME ZONE NOT NULL,
    closing_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cash_closures_hotel ON cash_closures(hotel_id);
